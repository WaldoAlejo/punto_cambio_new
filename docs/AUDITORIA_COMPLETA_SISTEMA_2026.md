# AUDITORIA COMPLETA DEL SISTEMA PUNTO CAMBIO

**Fecha:** 2026-05-05
**Alcance:** Frontend, Backend, Base de Datos (Produccion), Seguridad, Arquitectura
**Enfoque:** Cambio de Divisas, Servientrega, Servicios Externos, Contabilidad, Cierre de Caja, Autenticacion

---

## RESUMEN EJECUTIVO

Se identificaron **47 hallazgos** distribuidos en:
- **9 Criticos** — Riesgo inmediato de perdida de datos, inconsistencias contables o brechas de seguridad
- **14 Altos** — Bugs que generan comportamientos erraticos o exponen informacion
- **16 Medios** — Inconsistencias, deuda tecnica y problemas de UX
- **8 Bajos** — Mejoras recomendadas

### Top 5 Problemas que explican sus inconvenientes actuales

1. **Calculos de divisas inconsistentes entre frontend y backend** — El frontend usa los campos `comportamiento_compra/venta` de la BD, pero el backend usa una tabla hardcodeada. Un operador ve un monto en pantalla y el sistema guarda otro.
2. **Endpoints de Servientrega sin validacion de roles** — Cualquier usuario autenticado (incluso OPERADOR) puede aprobar anulaciones, asignar saldos, ver informes de todos los puntos y anular guias directamente.
3. **Race conditions en saldos** — No hay bloqueo pesimista ni transacciones atomicas en operaciones criticas. Dos operadores concurrentes pueden generar saldo negativo o guias sin descuento de saldo.
4. **Cuadre de caja con diferencia siempre en cero** — El GET del cuadre sobrescribe el saldo teorico reconciliado con el snapshot fisico, ocultando descuadres reales.
5. **Timezone inconsistente** — Multiples endpoints usan `new Date().setHours(0,0,0,0)` (hora del servidor) en lugar de utilidades de Ecuador, generando cierres y filtros en fechas equivocadas.

---

## 1. SEGURIDAD Y AUTORIZACION

### CRITICOS

| # | Hallazgo | Archivo | Impacto |
|---|----------|---------|---------|
| S1 | `GET /api/debug-saldos/:puntoId/:monedaId` completamente publico (sin auth) | `server/routes/debug-saldos.ts` | Cualquiera en internet ve saldos y movimientos |
| S2 | `GET /api/servientrega/debug-config` expone `SERVIENTREGA_PASSWORD` | `server/routes/servientrega/products.ts` | Fuga de credenciales de API externa |
| S3 | `POST /api/servientrega/validar-retail` es proxy abierto a API de Servientrega | `server/routes/servientrega/products.ts` | Usuario autenticado puede enviar cualquier payload con credenciales del servidor |
| S4 | `JWT_SECRET` tiene fallback hardcodeado | `server/middleware/auth.ts` | Si falla env var, cualquiera puede firmar tokens |
| S5 | Cualquier usuario autenticado puede aprobar/rechazar solicitudes de anulacion | `server/routes/servientrega/anulaciones.ts` | Operador anula guias de otros puntos sin supervision |
| S6 | Cualquier usuario autenticado puede asignar/recargar saldo a cualquier punto | `server/routes/servientrega/balances.ts` | Operador se auto-asigna saldo infinito |
| S7 | Cualquier usuario autenticado puede aprobar/rechazar solicitudes de saldo | `server/routes/servientrega/balances.ts` | Auto-aprobacion de saldo |
| S8 | `POST /api/servientrega/anular-guia` sin validacion de rol ni propiedad | `server/routes/servientrega/shipping.ts` | Bypass del flujo de aprobacion de anulaciones |
| S9 | `authenticateTokenDebug` salta restricciones de punto principal para reportes | `server/middleware/authDebug.ts` | Ruta `/api/reports-debug` sin controles administrativos |

### ALTOS

| # | Hallazgo | Archivo |
|---|----------|---------|
| S10 | Token JWT almacenado en `localStorage` (vulnerable a XSS) | `src/services/authService.ts` |
| S11 | CORS permite origenes HTTP inseguros | `server/index.ts` |
| S12 | Helmet tiene `hsts: false` y `crossOriginOpenerPolicy: false` | `server/index.ts` |
| S13 | `/api/exchanges` y `/api/transfers` excluidos del rate limiting | `server/index.ts` |
| S14 | `GET /api/exchanges/partial` sin `pointId` devuelve cambios de todos los puntos | `server/routes/exchanges.ts` |
| S15 | `GET /api/exchanges/search-customers` busca en todos los clientes del sistema | `server/routes/exchanges.ts` |
| S16 | `GET /api/transfers` devuelve todas las transferencias sin filtro de punto | `server/controllers/transferController.ts` |
| S17 | Multiples endpoints permiten consultar cualquier punto de atencion | `balances.ts`, `movimientos-saldo.ts`, etc. |
| S18 | Credenciales Servientrega con fallback hardcodeado | `server/routes/servientrega/products.ts`, `users.ts` |
| S19 | No hay refresh tokens ni invalidacion de JWT | `server/middleware/auth.ts` |
| S20 | Admin puede crear usuarios SUPER_USUARIO sin restricciones | `server/routes/users.ts` |

---

## 2. CAMBIO DE DIVISAS

### CRITICOS

| # | Hallazgo | Archivo | Linea |
|---|----------|---------|-------|
| CD1 | Backend ignora comportamientos de divisa de la BD — usa tabla hardcodeada `rateModeByCode` | `exchangeCalculationService.ts`, `exchanges.ts` | 14-28, 512-576 |
| CD2 | Normalizacion USD silenciosa intercambia origen/destino sin recalcular tasas ni desgloses | `exchanges.ts` | 407-461 |
| CD3 | Race condition TOCTOU en validacion de saldo — middleware valida saldo fuera de transaccion | `saldoValidation.ts` | 343-653 |
| CD4 | Doble registro de movimientos al completar cambio con abono | `exchanges.ts`, `CompletePaymentForm.tsx` | 2041-2325, 106-136 |
| CD5 | OPERADOR puede ver cambios de otros puntos — filtra por usuario_id pero no por punto_atencion_id | `exchanges.ts` | 1379-1615 |

### ALTOS

| # | Hallazgo | Archivo | Linea |
|---|----------|---------|-------|
| CD6 | Transaccion anidada sin atomicidad en cerrar y completar cambio | `exchanges.ts` | 1619-2419 |
| CD7 | Eliminacion de cambios sin restriccion de fecha | `exchanges.ts` | 3159 |
| CD8 | Auto-fix de movimientos faltantes enmascara bugs graves | `exchanges.ts` | 1276-1341 |
| CD9 | Acceso a cambios pendientes de cualquier punto | `exchanges.ts` | 2423-2515 |
| CD10 | Completar/cerrar cambio sin verificar punto de atencion | `exchanges.ts` | 1619-2419 |
| CD11 | Middleware generico valida origen en lugar de destino para cambios | `saldoValidation.ts` | 226-244 |

---

## 3. SERVIENTREGA Y SERVICIOS EXTERNOS

### CRITICOS

| # | Hallazgo | Archivo | Linea |
|---|----------|---------|-------|
| SE1 | Generacion de guias NO es atomica — guardarGuia -> API externa -> descontarSaldo -> registrarIngreso como operaciones separadas | `shipping.ts` | 1143-1271 |
| SE2 | Race condition TOCTOU en generacion | `shipping.ts` | 101-199 |
| SE3 | Frontend no envia desglose de pago (metodo_ingreso, billetes, monedas_fisicas, bancos) | `PasoConfirmarEnvio.tsx` | 49-66 |
| SE4 | Anulaciones sin validacion de rol | `anulaciones.ts` | 167-356 |
| SE5 | `saldo_descontado` nunca se actualiza — campo huerfano en schema | `schema.prisma` | 588 |

### ALTOS

| # | Hallazgo | Archivo |
|---|----------|---------|
| SE6 | `POST /saldo` sin restriccion de rol | `balances.ts` |
| SE7 | `PUT /solicitar-saldo/:id/estado` sin restriccion de rol | `balances.ts` |
| SE8 | `POST /anular-guia` shortcut directo bypassa flujo de aprobacion | `shipping.ts` |
| SE9 | Fallback de credenciales hardcodeado | `products.ts`, `users.ts` |
| SE10 | `ServicioExternoSaldoPunto` tabla huerfana no esta en Prisma schema | Migraciones SQL |
| SE11 | Asignacion de saldo no es atomica | `balances.ts` |

---

## 4. CONTABILIDAD, CUADRE DE CAJA Y CIERRES

### CRITICOS

| # | Hallazgo | Archivo | Linea |
|---|----------|---------|-------|
| CC1 | Diferencia de cuadre SIEMPRE en cero cuando existe fila en Saldo | `cuadreCaja.ts` | ~521-595 |
| CC2 | Uso de hora local del servidor en lugar de utilidades Ecuador | `cierreUnificadoService.ts` | ~200-206 |

### ALTOS

| # | Hallazgo | Archivo |
|---|----------|---------|
| CC3 | Desfase permanente entre cantidad y desglose fisico | `movimientoSaldoService.ts` |
| CC4 | Inconsistencia en calculo de saldo entre apertura-caja.ts y saldoCalculationService.ts | `apertura-caja.ts`, `saldoCalculationService.ts` |
| CC5 | guardar-cierre.ts crea cabecera con new Date() sin normalizar | `guardar-cierre.ts` |
| CC6 | Triple via de actualizacion de Saldo (Prisma, raw SQL x2) | Multiples |
| CC7 | Tres servicios de cierre con responsabilidades solapadas | Multiples |
| CC8 | cierreParcial.ts busca cuadre ABIERTO de cualquier fecha | `cierreParcial.ts` |
| CC9 | Reporte promedia montos de monedas distintas sin conversion | `reportService.ts` |

---

## 5. BASE DE DATOS

### CRITICOS

| # | Hallazgo | Impacto |
|---|----------|---------|
| DB1 | Desincronizacion total entre schema Prisma y BD real — 23 migraciones manuales que Prisma no conoce | `prisma migrate dev` puede ser destructivo |
| DB2 | Tabla `ServicioExternoSaldoPunto` huerfana | Prisma la omitira en regeneraciones |
| DB3 | Constraints CHECK en SQL no estan en Prisma | Si se recrea la tabla, se pierden validaciones |

### ALTOS

| # | Hallazgo | Impacto |
|---|----------|---------|
| DB4 | `number` en vez de `Decimal` en codigo TypeScript para montos | Perdida de centavos por precision float |
| DB5 | Consultas `findMany` sin paginacion en multiples endpoints | Timeout/OOM |
| DB6 | ~25 relaciones sin `onDelete` explicito | Errores de integridad al eliminar registros |
| DB7 | Seed `seed-complete.ts` sin proteccion de NODE_ENV | Riesgo de ejecutar en produccion |
| DB8 | Indices faltantes en campos de filtro frecuente | Lentitud en reportes |

---

## 6. TIMEZONE Y FECHAS

| Archivo | Problema |
|---------|----------|
| `exchanges.ts` | Fechas de abono usan `new Date(string)` sin timezone Ecuador |
| `cierreUnificadoService.ts` | `setHours(0,0,0,0)` usa hora local del servidor |
| `cierreService.ts` | Mismo problema de hora local |
| `guardar-cierre.ts` | `new Date()` para fecha de cierre sin normalizacion |
| `contabilidad-diaria.ts` | `new Date(`${fecha}T00:00:00.000Z`)` no es 00:00 Ecuador |
| `Reports.tsx` (frontend) | `toISOString().slice(0,10)` usa UTC, puede cortar dia equivocado |
| `ContabilidadDashboard.tsx` | `new Date()` local del navegador sin normalizacion |

---

## CONCLUSION

El sistema funciona en el dia a dia para operaciones simples, pero tiene fallas estructurales que explican los inconvenientes recurrentes:

1. **Inconsistencias contables** vienen de la divergencia frontend/backend y la falta de atomicidad.
2. **Problemas de seguridad** permiten que usuarios no autorizados accedan a datos de otros puntos o realicen operaciones administrativas.
3. **Race conditions** explican saldos negativos ocasionales y guias generadas sin descuento.
4. **Timezone** genera cierres en fechas equivocadas y filtros de informes incorrectos.
5. **Base de datos desincronizada** hace que cualquier cambio futuro en el schema sea riesgoso.
