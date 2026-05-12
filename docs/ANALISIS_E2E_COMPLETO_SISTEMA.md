# ANÁLISIS E2E COMPLETO — PUNTO CAMBIO

**Fecha:** 2026-05-12  
**Alcance:** Frontend ↔ Backend ↔ Base de Datos ↔ Integraciones Externas  
**Enfoque:** Producción-safe, mantenibilidad, seguridad, consistencia contable  
**Basado en:** Auditoría 2026-05-05 (47 hallazgos) + Exploración profunda E2E de arquitectura completa

---

## 1. VISIÓN E2E DE LA ARQUITECTURA ACTUAL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND (React + Vite)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Login   │→│  Index   │→│Dashboard │→│ Vistas   │→│  Cierre      │  │
│  │  Auth    │  │ PuntoSel │  │(switch)  │  │(switch)  │  │  Jornada     │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│         ↓              ↓            ↓             ↓              ↓          │
│  axiosInstance   apiService    useAuth      CustomEvents     useCuadre   │
│  (legacy)        (fetch)      (context)     (anti-patrón)    (781 líneas) │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP /api
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Express + TS)                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Routes (monolíticas): exchanges.ts (3403 líneas), schedules.ts     │   │
│  │  transfer-approvals.ts, guardar-cierre.ts, servientrega/*           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         ↓                    ↓                      ↓                       │
│  ┌─────────────┐    ┌──────────────┐      ┌──────────────┐                │
│  │ Middleware  │    │ Controllers  │      │   Services   │                │
│  │ auth.ts     │    │ (solo 2)     │      │movimientoSaldo│               │
│  │ validation  │    │transferCtrl  │      │cierreService  │               │
│  │ saldoValid  │    │reportCtrl    │      │exchangeCalc   │               │
│  └─────────────┘    └──────────────┘      └──────────────┘                │
│         ↓                    ↓                      ↓                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Prisma Client ◄─────────────────────────────────────────────┐      │   │
│  │  pg Pool (raw SQL) ──► auth, cuadreCaja (dualidad de acceso) │      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           POSTGRESQL (Prisma + SQL manual)                  │
│  Schema Prisma (38 modelos)        vs        BD Real (23+ migraciones SQL)  │
│  • MovimientoSaldo                              • Constraints CHECK         │
│  • HistorialSaldo (duplicado)                   • Índices únicos anti-dup   │
│  • ServicioExternoSaldo                         • ServicioExternoSaldoPunto │
│  • 61 relaciones sin onDelete                   • Triggers es_principal     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ SOAP/HTTP
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTEGRACIONES EXTERNAS                              │
│  Servientrega (Appsiscore)    Supabase (tipos TS)    No hay API de divisas │
│  • SSL rejectUnauthorized:false                     (tasas manuales)        │
│  • Credenciales fallback hardcoded                                          │
│  • Sin circuit breaker / sin caché de catálogos                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. FLUJOS CRÍTICOS VALIDADOS E2E

### 2.1 Cambio de Divisas (E2E)
```
[UI] ExchangeForm → ExchangeSteps → useExchangeProcess
  ↓ POST /api/exchanges (idempotency key)
[API] exchanges.ts (3403 líneas)
  → validarSaldoCambioDivisa (middleware, FUERA de transacción) ⚠️ TOCTOU
  → prisma.$transaction
    → crear CambioDivisa
    → upsert Saldo (cantidad, billetes, monedas_fisicas, bancos)
    → crear MovimientoSaldo (ledger)
    → (opcional) crear HistorialSaldo (duplicado)
    → (opcional) crear Recibo
    → (opcional) auto-fix movimientos faltantes ⚠️ SMELL
  → emitir CustomEvent("saldosUpdated")
[UI] Dashboard escucha evento → refetch saldos
```
**Riesgo:** Race condition en saldo + cálculo de tasas inconsistente backend vs frontend.

### 2.2 Transferencias (E2E)
```
[UI] TransferForm → transferService.createTransfer()
  ↓ POST /api/transfers
[API] transfers.ts
  → validarSaldoTransferencia (middleware, FUERA de transacción) ⚠️ TOCTOU
  → transferController.createTransfer
    → prisma.$transaction
      → crear Transferencia (estado: EN_TRANSITO)
      → upsert Saldo origen (decremento)
      → crear MovimientoSaldo
  → (opcional) punto destino acepta → transfer-approvals.ts
    → prisma.$transaction
      → upsert Saldo destino (incremento)
      → actualizar estado a COMPLETADO
```
**Riesgo:** Dos flujos paralelos confusos (EN_TRANSITO vs PENDIENTE/APROBADO). Race condition en validación de saldo.

### 2.3 Servientrega — Generación de Guía (E2E)
```
[UI] ServientregaMain (wizard 6 pasos) → PasoConfirmarEnvio
  ↓ POST /api/servientrega/shipping
[API] shipping.ts
  → validarSaldoServientrega (middleware) ⚠️ TOCTOU
  → llamar API externa Servientrega (SOAP-like)
  → si éxito:
    → guardarGuia (prisma)           ─┐
    → descontarSaldoServientrega      ├── NO atómico ⚠️
    → registrarIngresoServicioExterno ─┘
  → crear Recibo
```
**Riesgo:** Fallo intermedio deja guía sin descuento de saldo o saldo descontado sin guía.

### 2.4 Cierre de Caja (E2E)
```
[UI] DailyClose.tsx (2800 líneas) → useCuadreCaja.ts (781 líneas)
  ↓ GET /api/cuadre-caja/:puntoId → saldo teórico reconciliado
  ↓ POST /api/guardar-cierre
[API] guardar-cierre.ts
  → validar cerradoHoy con findFirst (FUERA de transacción) ⚠️ Race
  → prisma.$transaction
    → crear/actualizar CuadreCaja + DetalleCuadreCaja
    → actualizar Saldo (ajustes)
    → crear MovimientoSaldo (ajustes)
    → (opcional) finalizar Jornada
    → (opcional) crear CierreDiario
  → liberar punto_atencion_id del usuario
[UI] Si jornada finalizada → logout automático
```
**Riesgo:** Race condition en cierre duplicado. Diferencia de cuadre sobrescrita en GET.

### 2.5 Jornada / Marcaciones (E2E)
```
[UI] TimeTracker.tsx → scheduleService.updateSchedule()
  ↓ POST /api/schedules
[API] schedules.ts
  → findFirst jornada activa (NO transaccional)
  → findFirst punto ocupado (NO transaccional)
  → crear/actualizar Jornada
  → actualizar Usuario.punto_atencion_id
```
**Riesgo:** Dos operadores pueden iniciar jornada simultáneamente en el mismo punto.

---

## 3. MATRIZ DE RIESGO CRUZADO (E2E)

| Dominio | Seguridad | Consistencia | Race Conditions | Mantenibilidad | Impacto Producción |
|---------|:---------:|:------------:|:---------------:|:--------------:|:------------------:|
| **Cambio de Divisas** | 🟡 | 🔴 | 🔴 | 🔴 | **CRÍTICO** |
| **Transferencias** | 🟡 | 🟡 | 🔴 | 🟡 | **ALTO** |
| **Servientrega** | 🔴 | 🔴 | 🔴 | 🟡 | **CRÍTICO** |
| **Cierre de Caja** | 🟢 | 🔴 | 🔴 | 🔴 | **CRÍTICO** |
| **Jornadas** | 🟢 | 🟡 | 🔴 | 🟡 | **MEDIO** |
| **Base de Datos** | 🟡 | 🔴 | 🟡 | 🔴 | **CRÍTICO** |
| **Frontend** | 🟡 | 🟢 | 🟢 | 🔴 | **ALTO** |
| **Deploy/Infra** | 🔴 | 🟡 | 🟢 | 🟡 | **ALTO** |

*🔴 = Crítico | 🟡 = Alto | 🟢 = Medio/Bajo*

---

## 4. HALLAZGOS CRÍTICOS POR CAPA

### 4.1 BASE DE DATOS — Riesgo Estructural Máximo

| ID | Hallazgo | Impacto en Producción |
|----|----------|----------------------|
| **DB-SYNC** | 23+ migraciones SQL manuales no reflejadas en `schema.prisma`. Un `prisma migrate dev` o regeneración puede destruir constraints, índices únicos y triggers. | **DESTRUCTIVO** — Pérdida de integridad referencial y constraints de negocio. |
| **DB-DUP-1** | `MovimientoSaldo` y `HistorialSaldo` modelan lo mismo (ledger de saldo). Riesgo de que un proceso escriba en uno y olvide el otro. | **CONTABLE** — Desfase en reportes y auditoría. |
| **DB-DUP-2** | `ServicioExternoCierreDiario` + `ServicioExternoDetalleCierre` duplican funcionalidad de `CierreDiario` + `DetalleCuadreCaja`. | **MANTENIBILIDAD** — Lógica de cierre duplicada y divergente. |
| **DB-ZOMBIE** | Modelo `Movimiento` usado solo en 2 líneas (`transferCreationService.ts`). Todo el flujo usa `MovimientoSaldo`. | **CONFUSIÓN** — Riesgo de consultar tabla equivocada. |
| **DB-HUERFANA** | Tabla `ServicioExternoSaldoPunto` creada en SQL manual, **NO existe en schema.prisma**. Prisma la omitirá. | **PÉRDIDA DE DATOS** en regeneraciones. |
| **DB-ONDELETE** | 61 de 99 relaciones `@relation` **no tienen `onDelete` explícito**. PostgreSQL usa `RESTRICT` por defecto. | **ERRORES DE FK** impredecibles al eliminar registros. |
| **DB-UNIQUE-NULL** | Campos `@unique` que son `String?` (nullable) en `CambioDivisa`: `numero_recibo`, `numero_recibo_abono`, `numero_recibo_completar`. | **DUPLICADOS** — PostgreSQL permite múltiples NULLs en unique. |
| **DB-JSON** | 14+ campos `Json?` en modelos críticos (`AperturaCaja`, `ArqueoCajaHistorico`, `DetalleCuadreCaja`, etc.) sin validación de esquema. | **INTEGRIDAD** — Estructuras variables sin garantías de forma. |
| **DB-CHECK** | Constraints CHECK de negocio (`check_egreso_monto_negativo`, etc.) solo existen en SQL manual, no en Prisma schema. | **PÉRDIDA DE REGLAS** si se recrea la BD. |

### 4.2 BACKEND — Riesgo Operativo y de Seguridad

| ID | Hallazgo | Impacto |
|----|----------|---------|
| **BE-RACE-1** | Validación de saldo en **middleware**, fuera de transacción (`exchanges.ts`, `transfers.ts`, `servientrega/shipping.ts`). | Dos requests simultáneos pueden generar **saldo negativo**. |
| **BE-RACE-2** | Inicio de jornada sin transacción: validar punto libre + crear jornada son operaciones separadas. | Dos operadores en el **mismo punto**. |
| **BE-RACE-3** | Aprobación de transferencia: leer estado `PENDIENTE` fuera de transacción, luego actualizar dentro. | **Doble aprobación** de la misma transferencia. |
| **BE-RACE-4** | Cierre de caja: validar `cerradoHoy` fuera de transacción. | **Cierre duplicado** del mismo día. |
| **BE-SEC-1** | `JWT_SECRET` tiene fallback hardcodeado en `server/middleware/auth.ts`. | Si falla env var, **cualquiera firma tokens**. |
| **BE-SEC-2** | `/api/exchanges` y `/api/transfers` excluidos del `globalLimiter` de rate limiting. | **Sin protección** contra abuso en endpoints críticos. |
| **BE-SEC-3** | `GET /api/servientrega/debug-config` expone `SERVIENTREGA_PASSWORD`. | **Fuga de credenciales** de API externa. |
| **BE-SEC-4** | `POST /api/servientrega/validar-retail` es proxy abierto a API de Servientrega. | Usuario autenticado puede enviar **cualquier payload** con credenciales del servidor. |
| **BE-SEC-5** | Endpoints de Servientrega (`/saldo`, `/solicitar-saldo/:id/estado`, anulaciones) **sin validación de rol**. | Operador puede **auto-asignar saldo** o aprobar anulaciones. |
| **BE-MONO** | `exchanges.ts` tiene **3403 líneas** con validación, cálculos, contabilidad, recibos, auto-fixes y billetes/monedas/bancos. | **Imposible de mantener** y testear. |
| **BE-AUTOFIX** | Código en `exchanges.ts` detecta movimientos faltantes y los crea automáticamente en runtime. | **Enmascara bug raíz**; genera datos inconsistentes silenciosamente. |
| **BE-TZ** | Múltiples endpoints usan `new Date().setHours(0,0,0,0)` en lugar de utilidades de Ecuador (`nowEcuador`, `gyeDayRangeUtcFromDate`). | Cierres y filtros en **fechas equivocadas**. |
| **BE-DUALDB** | Uso simultáneo de Prisma Client y `pg` Pool (raw SQL) sin documentación clara de por qué. | **Inconsistencias** de transacción/connection pool. |

### 4.3 FRONTEND — Riesgo de Deuda Técnica

| ID | Hallazgo | Impacto |
|----|----------|---------|
| **FE-MONO-1** | `DailyClose.tsx` = 2800 líneas. `AperturaCaja.tsx` = 1253 líneas. `Reports.tsx` = 1096 líneas. | **Testing imposible**, bugs difíciles de rastrear. |
| **FE-MONO-2** | `Dashboard.tsx` tiene un `switch` de ~30 casos para renderizar vistas con lógica de permisos inline. | Cada nueva vista agranda el monolito; fácil olvidar permisos. |
| **FE-HTTP** | **Dos clientes HTTP coexisten**: `axiosInstance.ts` (axios) + `apiService.ts` (fetch custom con retry/idempotency) + `authService.ts` (fetch directo). | Inconsistencia en manejo de errores, retries, interceptores. |
| **FE-DENOM** | `DENOMINACIONES_POR_MONEDA` está hardcodeado e **idéntico en 3+ archivos**: `AperturaCaja.tsx`, `DailyClose.tsx`, `useCuadreCaja.ts`. | Si se agrega una moneda, hay que tocar N archivos. Violación DRY. |
| **FE-EVENTS** | Comunicación entre componentes vía `window.dispatchEvent(new CustomEvent("saldosUpdated"))`. | **Anti-patrón** en React; re-renders impredecibles, difícil de rastrear. |
| **FE-ADMIN** | `AdminDashboard.tsx` muestra datos **ficticios** (`Math.random()`) para stats, cierres recientes y actividad por hora. | El panel de admin **no muestra datos reales**. |
| **FE-TYPES** | Uso extensivo de `any` en componentes grandes (`AperturaCaja`, `DailyClose`). | Pérdida de type safety; errores en runtime. |
| **FE-FORMS** | Formularios complejos sin form library (React Hook Form, Formik). Validaciones dispersas en `useState` x10. | Código repetitivo, validaciones inconsistentes. |

### 4.4 INTEGRACIONES / DEVOPS

| ID | Hallazgo | Impacto |
|----|----------|---------|
| **INT-SSL** | `rejectUnauthorized: false` en llamadas a Servientrega. | **Vulnerable a MITM**. |
| **INT-CREDS** | Credenciales Servientrega con fallback hardcodeado en `products.ts` y `users.ts`. | Si falla env var, se usan credenciales **públicas conocidas**. |
| **INT-CB** | Sin circuit breaker para Servientrega. | Si está caído/lento, cada request espera 10-20s y consume recursos. |
| **INT-CACHE** | Sin caché de catálogos (países, ciudades, productos). Cada operador los pide en tiempo real. | **Lentitud** innecesaria + carga a API externa. |
| **INT-NOATOMIC** | Generación de guía: guardar guía → llamar API → descontar saldo → registrar ingreso son pasos separados. | Fallo intermedio = **datos inconsistentes**. |
| **DOCKER-CMD** | `Dockerfile` apunta a `dist/server.js` pero el build genera `dist-server/server/index.js`. | **Contenedor no arranca** si se usa Docker puro. |
| **DOCKER-ENV** | `COPY --from=builder /app/.env .env` filtra secrets a los layers de Docker. | **Fuga de secrets** en imagen. |
| **DOCKER-PKG** | `package-server.json` está desactualizado y desincronizado del `package.json` principal. | Build inconsistente. |

---

## 5. DEPENDENCIAS ENTRE PROBLEMAS (GRAFO DE IMPACTO)

```
DB-SYNC (Schema desincronizado)
  ├──► BE-RACE-* (Transacciones difíciles de implementar sin schema confiable)
  ├──► DB-ONDELETE (No se pueden agregar sin migrate)
  └──► DB-CHECK (Se pierden en recreate)

BE-RACE-1 (Validación saldo fuera de tx)
  ├──► CD3 (Cambio divisa race condition)
  ├──► SE2 (Servientrega race condition)
  └──► CC1 (Diferencias de cuadre inconsistentes)

BE-MONO (exchanges.ts 3403 líneas)
  ├──► BE-AUTOFIX (Enmascara bugs)
  ├──► BE-TZ (Fechas dispersas)
  └──► FE-EVENTS (Frontend necesita hacks para refrescar)

FE-HTTP (Dos clientes HTTP)
  └──► BE-SEC-2 (Rate limiting inconsistente)

INT-NOATOMIC + INT-CB
  └──► SE1 (Guías inconsistentes)
      └──► CC1 (Cuadre de caja no cuadra)
```

---

## 6. PLAN DE ACCIÓN POR FASES (PRODUCCIÓN-SAFE)

> **Principio rector:** Nunca mezclar cambios de dos fases en un mismo deploy.  
> **Regla de oro:** Cada fase debe ser reversible en < 15 minutos.

---

### FASE 0: CINTURÓN DE SEGURIDAD (1-2 días) — Riesgo: BAJO

**Objetivo:** Cerrar brechas que permiten acceso no autorizado o fugas de información.

| # | Tarea | Archivos | Riesgo Deploy |
|---|-------|----------|---------------|
| 0.1 | Proteger `debug-saldos` con `authenticateToken` + verificar punto | `server/routes/debug-saldos.ts` | Bajo |
| 0.2 | Eliminar/proteger `debug-config` — filtrar keys con "PASSWORD" | `server/routes/servientrega/products.ts` | Bajo |
| 0.3 | Eliminar/restringir proxy `/validar-retail` a ADMIN | `server/routes/servientrega/products.ts` | Bajo |
| 0.4 | Agregar `requireRole(["ADMIN","SUPER_USUARIO"])` a endpoints admin de Servientrega | `balances.ts`, `anulaciones.ts`, `shipping.ts` | Bajo |
| 0.5 | Quitar fallback hardcodeado de `JWT_SECRET` | `server/middleware/auth.ts` | **Medio** ⚠️ Verificar env var antes |
| 0.6 | Quitar fallback de credenciales Servientrega | `products.ts`, `users.ts` | Bajo |
| 0.7 | Quitar `/api/exchanges` y `/api/transfers` de `excludedPaths` del rate limiter | `server/index.ts` | Bajo |

**Validación:** Ejecutar smoke tests de autenticación y verificar que endpoints sensibles devuelven 403 para OPERADOR.

---

### FASE 1: ATOMICIDAD Y RACE CONDITIONS (Semana 1-2) — Riesgo: MEDIO

**Objetivo:** Hacer atómicas las operaciones críticas. Ningún cambio en schema de DB todavía.

| # | Tarea | Archivos | Riesgo Deploy |
|---|-------|----------|---------------|
| 1.1 | **Servientrega: transacción atómica** para guardar guía + descontar saldo + registrar ingreso. La llamada a API externa va FUERA de la transacción. | `shipping.ts`, `servientregaDBService.ts` | Medio |
| 1.2 | **Servientrega: decremento atómico** con `update { decrement: monto }` y verificar resultado ≥ 0 | `servientregaDBService.ts` | Bajo |
| 1.3 | **Cambio de divisas: mover validación de saldo DENTRO de la transacción** Prisma del endpoint. Eliminar validación del middleware o hacerla sintáctica solamente. | `exchanges.ts`, `saldoValidation.ts` | Medio |
| 1.4 | **Transferencias: idem** — validación de saldo dentro de transacción. | `transfers.ts`, `transfer-approvals.ts` | Medio |
| 1.5 | **Jornadas: transacción** para verificar punto libre + crear jornada + asignar punto a usuario. | `schedules.ts` | Medio |
| 1.6 | **Cierre de caja:** usar constraint único (`@@unique([fecha, punto_atencion_id])` ya existe en `CierreDiario`) o row-level lock para evitar duplicados. | `guardar-cierre.ts` | Medio |
| 1.7 | **Normalizar fechas:** Reemplazar `new Date().setHours(0,0,0,0)` por `gyeDayRangeUtcFromDate(nowEcuador())` en todos los endpoints de cierre. | `cierreUnificadoService.ts`, `cierreService.ts`, `guardar-cierre.ts`, `contabilidad-diaria.ts` | Medio |
| 1.8 | **Eliminar auto-fix de movimientos** en `exchanges.ts`. Lanzar error 500 claro para forzar corrección de causa raíz. | `exchanges.ts` | Bajo |

**Validación:** Tests de concurrencia (curl paralelo) para cambios, transferencias y guías Servientrega.

---

### FASE 2: CONSISTENCIA CONTABLE (Semana 2-3) — Riesgo: MEDIO-ALTO

**Objetivo:** Corregir bugs que hacen que los números no cuadren.

| # | Tarea | Archivos | Riesgo Deploy |
|---|-------|----------|---------------|
| 2.1 | **Unificar cálculo de divisas:** Backend debe respetar `comportamiento_compra/venta` de la BD. Eliminar tabla hardcodeada `rateModeByCode`. | `exchangeCalculationService.ts`, `exchanges.ts` | **ALTO** ⚠️ Cambia cálculos financieros |
| 2.2 | **Corregir sobrescritura de saldo teórico** en GET de cuadre de caja. Separar `saldoCierreTeorico` de `conteoFisicoUltimo`. | `server/routes/cuadreCaja.ts` | Medio |
| 2.3 | **Unificar normalización de signos** en movimientos de saldo. Extraer función única. | `saldoCalculationService.ts`, `apertura-caja.ts` | Bajo |
| 2.4 | **Eliminar raw SQL** de actualización de saldo en cuadre. Usar Prisma `upsert` o delegar a `movimientoSaldoService`. | `cuadreCaja.ts`, `cuadre-caja-conteo.ts` | Medio |
| 2.5 | **Corregir reporte de promedio** — no promediar montos de monedas distintas sin conversión. | `reportService.ts` | Bajo |
| 2.6 | **Documentar/Decidir:** `billetes` + `monedas_fisicas` + `bancos` vs `cantidad`. ¿La suma debe ser igual siempre? | `MovimientoSaldo`, `Saldo` | Bajo |
| 2.7 | **Eliminar modelo `Movimiento` zombie** — migrar las 2 creaciones a `MovimientoSaldo`. | `transferCreationService.ts`, `schema.prisma` | Medio |

**Validación:** Cuadre de caja debe reflejar diferencias reales. Reportes deben coincidir con saldos.

---

### FASE 3: SINCRONIZACIÓN SCHEMA ↔ BASE DE DATOS (Semana 3-4) — Riesgo: ALTO

**Objetivo:** Alinear Prisma con la realidad de PostgreSQL. **Requiere backup completo antes.**

| # | Tarea | Archivos | Riesgo Deploy |
|---|-------|----------|---------------|
| 3.1 | **Backup completo** de PostgreSQL antes de cualquier cambio en schema. | — | — |
| 3.2 | **Auditar migraciones manuales** en `server/migrations/`. Documentar cada constraint, índice y trigger que falta en `schema.prisma`. | `prisma/schema.prisma`, `server/migrations/` | Alto |
| 3.3 | **Agregar constraints CHECK** al schema Prisma (como comentarios/documentación si Prisma no los soporta nativamente). | `schema.prisma` | Bajo |
| 3.4 | **Agregar índices únicos anti-duplicados** al schema como `/// @unique` documentados + migración SQL manual si Prisma no soporta expresiones. | `schema.prisma` | Medio |
| 3.5 | **Agregar `onDelete` explícito** a las 61 relaciones faltantes. Empezar con tablas no críticas. | `schema.prisma` | Medio |
| 3.6 | **Decidir destino de `ServicioExternoSaldoPunto`:** migrar datos a `ServicioExternoSaldo` y hacer `DROP TABLE`, o agregarlo al schema. | `schema.prisma` | Medio |
| 3.7 | **Evaluar fusión** `MovimientoSaldo` + `HistorialSaldo` → mantener solo `MovimientoSaldo` con campos suficientes. | `schema.prisma` + código | Alto |
| 3.8 | **Corregir campos `@unique` opcionales** en `CambioDivisa` (hacerlos `String` no nullable donde aplique). | `schema.prisma` | Medio |
| 3.9 | **Generar nueva migración Prisma** con `prisma migrate dev --create-only` y revisar línea por línea antes de aplicar. | `prisma/migrations/` | **ALTO** |

**Validación:** Comparar dump de schema SQL antes/después. Ningún constraint debe faltar.

---

### FASE 4: REFACTOR FRONTEND — MODULARIZACIÓN (Semana 4-6) — Riesgo: MEDIO

**Objetivo:** Reducir deuda técnica del frontend sin cambiar lógica de negocio.

| # | Tarea | Archivos | Riesgo Deploy |
|---|-------|----------|---------------|
| 4.1 | **Unificar HTTP client:** Migrar todo a `apiService.ts` (fetch) o `axiosInstance.ts` (elegir uno). Eliminar el otro. | `src/services/*` | Medio |
| 4.2 | **Centralizar denominaciones** en `src/constants/denominations.ts`. Eliminar duplicados. | `AperturaCaja.tsx`, `DailyClose.tsx`, `useCuadreCaja.ts` | Bajo |
| 4.3 | **Reemplazar CustomEvents** por callbacks o TanStack Query invalidation. | `Dashboard.tsx`, `ExchangeManagement`, etc. | Medio |
| 4.4 | **Dividir `DailyClose.tsx`** en sub-componentes: `CurrencyCountForm`, `DenominationGrid`, `DifferenceAlert`, `CloseSummary`. | `src/components/close/` | Bajo |
| 4.5 | **Dividir `AperturaCaja.tsx`** en sub-componentes similares. | `src/components/caja/` | Bajo |
| 4.6 | **Crear `usePermissions()` hook** centralizado. Usar en Sidebar y Dashboard. | `src/hooks/usePermissions.ts` | Bajo |
| 4.7 | **Conectar `AdminDashboard`** a endpoints reales (`/admin/dashboard-stats`, etc.). Eliminar `Math.random()`. | `AdminDashboard.tsx` + backend | Medio |
| 4.8 | **Adoptar React Hook Form + Zod** para un formulario complejo (ej: `TransferForm`). Evaluar impacto antes de escalar. | `TransferForm.tsx` | Bajo |
| 4.9 | **Eliminar `any` graduales** en `AperturaCaja` y `DailyClose`. | Múltiples | Bajo |
| 4.10 | **Implementar paginación server-side** en reportes. | `Reports.tsx`, `reportService.ts` | Medio |

**Validación:** Smoke tests manuales de todos los flujos principales. Lighthouse de performance.

---

### FASE 5: RESILIENCIA DE INTEGRACIONES (Semana 6-7) — Riesgo: MEDIO

**Objetivo:** Hacer que Servientrega y otras integraciones sean robustas.

| # | Tarea | Archivos | Riesgo Deploy |
|---|-------|----------|---------------|
| 5.1 | **Implementar circuit breaker** para Servientrega (`opossum` o lógica propia). | `servientregaAPIService.ts` | Medio |
| 5.2 | **Cachear catálogos** (países, ciudades, productos) en Redis/memoria con TTL 24h. | `servientregaAPIService.ts` | Bajo |
| 5.3 | **Cola de reintentos** para operaciones críticas (Bull/BullMQ con Redis). | Nuevo módulo | Medio |
| 5.4 | **Restaurar SSL verification** (`rejectUnauthorized: true`) si el certificado de Servientrega es válido. | `servientregaAPIService.ts` | Bajo |
| 5.5 | **Corregir Dockerfile** — path de salida correcto y NO copiar `.env`. | `Dockerfile`, `docker-compose.yml` | Medio |
| 5.6 | **Eliminar `package-server.json`** o sincronizarlo con `package.json`. | `package-server.json` | Bajo |
| 5.7 | **Usar `Prisma.Decimal`** en TypeScript para todos los montos financieros. | Todo el backend | Medio |

---

### FASE 6: TESTING Y DOCUMENTACIÓN (Semana 7-8) — Riesgo: BAJO

**Objetivo:** Garantizar que futuros cambios no rompan el sistema.

| # | Tarea | Archivos |
|---|-------|----------|
| 6.1 | Tests de integración para flujos críticos: cambio de divisa, transferencia, guía Servientrega, cierre de caja. | `tests/integration/` |
| 6.2 | Tests de concurrencia (race conditions) con `Promise.all([req1, req2])`. | `tests/stress/` |
| 6.3 | Documentar arquitectura de datos actualizada. | `docs/ARQUITECTURA_DATOS.md` |
| 6.4 | Documentar decisiones técnicas (ADR) para cambios importantes. | `docs/adr/` |
| 6.5 | CI/CD básico: GitHub Action que corra build + lint + tests en PR. | `.github/workflows/ci.yml` |

---

## 7. RECOMENDACIONES PARA MANTENIBILIDAD A LARGO PLAZO

### 7.1 Arquitectura de Datos
- **Un solo ledger de saldo:** Consolidar `MovimientoSaldo` y eliminar `HistorialSaldo` y `Movimiento`.
- **Un solo modelo de cierre:** Evaluar fusionar `ServicioExternoCierreDiario` en `CierreDiario` con campo `servicio` nullable.
- **Un solo modelo de solicitud de saldo:** `SolicitudSaldo` con campo `servicio` nullable para cubrir Servientrega.
- **Esquema para campos JSON:** Documentar o usar Zod para validar la forma de `Json` fields en runtime.

### 7.2 Backend
- **Patrón Command/Handler:** Extraer toda la lógica de `exchanges.ts` en commands independientes (`CreateExchangeCommand`, `CompleteExchangeCommand`).
- **Unit of Work:** Todas las operaciones financieras deben pasar por una transacción Prisma con validación de saldo incluida.
- **API unificada de saldos:** Un solo `saldoService.ts` que maneje todos los `upsert` de `Saldo` y su desglose físico.
- **Middleware de errores centralizado:** `AppError` con códigos (`SALDO_INSUFICIENTE`, `PUNTO_OCUPADO`) + middleware que no exponga detalles internos en producción.

### 7.3 Frontend
- **TanStack Query:** Reemplar todos los `useEffect` de carga de datos por queries con caching.
- **Router real:** Considerar React Router para vistas internas en lugar del `switch` de `Dashboard.tsx`.
- **Design System:** Consolidar componentes de formularios reutilizables (inputs de moneda, selectores de punto, etc.).
- **Feature Flags:** Para deploys graduales de cambios grandes (ej: nuevo cálculo de divisas).

### 7.4 Operaciones
- **Monitoreo:** Agregar métricas de negocio (cambios por hora, saldo negativo detectado, guías fallidas) con `prom-client`.
- **Alerting:** Alertar cuando un punto tenga saldo negativo o cuando Servientrega falle N veces consecutivas.
- **Backups automatizados:** Antes de cualquier deploy que toque schema o migraciones.

---

## 8. CHECKLIST PRE-DEPLOY POR FASE

Antes de deployar cualquier fase a producción:

- [ ] Backup de PostgreSQL completado y verificado (restaurable).
- [ ] Smoke tests pasados en ambiente de staging.
- [ ] Rollback plan documentado (qué comando ejecutar si algo falla).
- [ ] Cambios revisados por al menos 1 par (no solo el autor).
- [ ] Variables de entorno verificadas en producción (especialmente `JWT_SECRET`, `DATABASE_URL`, credenciales Servientrega).
- [ ] Rate limiting y endpoints críticos verificados con `curl`.
- [ ] Fechas/horas verificadas: crear un cambio de prueba y verificar que `created_at` y fecha contable son correctas en timezone Ecuador.
- [ ] Logs de error monitoreados durante las primeras 2 horas post-deploy.

---

## 9. RESUMEN EJECUTIVO

El sistema **Punto Cambio es funcional y cubre todos los flujos de negocio**, pero acumula **deuda técnica severa** en 4 capas simultáneamente:

1. **Base de Datos:** El schema Prisma está desincronizado de la realidad. Un `prisma migrate dev` puede ser destructivo.
2. **Backend:** Race conditions en operaciones financieras, validación de saldo fuera de transacciones, y archivos monolíticos de 3400+ líneas.
3. **Frontend:** Componentes imposibles de mantener, dos clientes HTTP, datos de admin ficticios, y comunicación via `CustomEvent`.
4. **Integraciones:** Servientrega sin circuit breaker, sin caché, con credenciales expuestas y operaciones no atómicas.

**Prioridad absoluta:**
1. 🥇 **Seguridad** (Fase 0) — Cerrar brechas de acceso no autorizado.
2. 🥈 **Atomicidad** (Fase 1) — Eliminar race conditions en cambios, transferencias y guías.
3. 🥉 **Consistencia contable** (Fase 2) — Corregir cálculos de divisas y cuadre de caja.
4. **Schema sync** (Fase 3) — Solo después de que las transacciones estén funcionando.
5. **Frontend refactor** (Fase 4) — Una vez el backend es estable.

**Tiempo estimado total:** 7-8 semanas con 1 desarrollador full-time, o 4-5 semanas con 2 desarrolladores paralelos (backend + frontend).
