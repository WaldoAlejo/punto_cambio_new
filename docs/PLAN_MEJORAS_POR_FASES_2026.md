# PLAN DE MEJORAS POR FASES — PUNTO CAMBIO

**Fecha:** 2026-05-05
**Basado en:** Auditoria Completa del Sistema (47 hallazgos identificados)
**Principio rector:** Seguridad primero, estabilidad segundo, funcionalidad tercero, performance al final.

---

## COMO USAR ESTE PLAN

Cada fase:
- Tiene un **objetivo claro** y medible
- Lista los **archivos a modificar**
- Incluye **criterios de exito** (como saber que esta listo)
- Indica **riesgo para produccion** (bajo/medio/alto)
- Sugiere **orden de ejecucion** dentro de la fase

> **REGLA DE ORO:** Nunca mezclar cambios de dos fases en un mismo deploy. Si algo falla, debe ser facil identificar la causa.

---

## FASE 0: SEGURIDAD CRITICA (URGENTE — 1-2 dias)

**Objetivo:** Cerrar brechas de seguridad que permiten acceso no autorizado a datos y operaciones de otros puntos.

### Tareas (ordenadas por riesgo)

1. **Eliminar o proteger endpoint publico `debug-saldos`**
   - Archivo: `server/routes/debug-saldos.ts`
   - Accion: Agregar `authenticateToken` y verificar que el usuario tenga acceso al punto solicitado.
   - Riesgo: Bajo (solo agrega validacion)

2. **Eliminar o proteger `debug-config` de Servientrega**
   - Archivo: `server/routes/servientrega/products.ts`
   - Accion: Eliminar endpoint `/debug-config` o filtrar solo keys que NO contengan "PASSWORD"
   - Riesgo: Bajo

3. **Eliminar proxy abierto `validar-retail`**
   - Archivo: `server/routes/servientrega/products.ts`
   - Accion: Eliminar endpoint `/validar-retail` o restringirlo a ADMIN/SUPER_USUARIO con validacion de payload
   - Riesgo: Bajo

4. **Agregar `requireRole` a endpoints criticos de Servientrega**
   - Archivos:
     - `server/routes/servientrega/balances.ts`: `POST /saldo`, `PUT /solicitar-saldo/:id/estado`
     - `server/routes/servientrega/anulaciones.ts`: `PUT /solicitudes-anulacion/:id/responder`, `POST /responder-solicitud-anulacion`
     - `server/routes/servientrega/shipping.ts`: `POST /anular-guia`
   - Accion: Agregar `requireRole(["ADMIN", "SUPER_USUARIO"])` antes del handler
   - Riesgo: Bajo (solo agrega gates de autorizacion)

5. **Quitar fallback de JWT_SECRET**
   - Archivo: `server/middleware/auth.ts`
   - Accion: `const JWT_SECRET = process.env.JWT_SECRET; if (!JWT_SECRET) throw new Error("JWT_SECRET no configurado");`
   - Riesgo: Medio (verificar que en produccion la env var este definida ANTES de deployar)

6. **Quitar fallback de credenciales Servientrega**
   - Archivos: `server/routes/servientrega/products.ts`, `users.ts`
   - Accion: Eliminar `|| "INTPUNTOC"` y `|| "73Yes7321t"`. Usar el patron de `shipping.ts` (lanzar error si faltan).
   - Riesgo: Bajo

### Criterios de exito
- [ ] Endpoint `debug-saldos` ya no responde sin token valido
- [ ] Ningun endpoint de Servientrega permite operaciones administrativas con rol OPERADOR
- [ ] `JWT_SECRET` no tiene fallback
- [ ] Credenciales Servientrega no tienen fallback hardcodeado

---

## FASE 1: ESTABILIDAD DE DATOS (Semana 1-2)

**Objetivo:** Hacer atomicas las operaciones criticas y eliminar race conditions que generan datos inconsistentes.

### Tareas

1. **Hacer atomica la generacion de guias Servientrega**
   - Archivo: `server/routes/servientrega/shipping.ts`
   - Accion: Envolver `guardarGuia`, `descontarSaldo`, `registrarIngresoServicioExterno` en una sola `prisma.$transaction(async (tx) => { ... })`. Actualizar los metodos de `servientregaDBService.ts` para aceptar `tx` opcional.
   - Riesgo: Medio (cambio en flujo critico de ingresos)

2. **Hacer atomica la aprobacion de anulaciones**
   - Archivo: `server/routes/servientrega/anulaciones.ts`
   - Accion: Envolver `procesarAnulacionServientrega`, `db.anularGuia`, `actualizarSolicitudAnulacion`, `revertirIngresoServicioExterno` en transaccion. Nota: la llamada a API externa NO puede estar en la transaccion de BD (irreversible), pero los pasos de BD si deben ser atomicos.
   - Riesgo: Medio

3. **Agregar bloqueo pesimista en descuento de saldo Servientrega**
   - Archivo: `server/services/servientregaDBService.ts` (metodo `descontarSaldo`)
   - Accion: Usar `$queryRaw` con `SELECT ... FOR UPDATE` sobre `ServicioExternoSaldo` al inicio de la transaccion, o usar `update` con decremento atomico (`cantidad: { decrement: monto }`) que ya es atomico en PostgreSQL.
   - Riesgo: Medio

4. **Corregir validacion de saldo en cambio de divisas (TOCTOU)**
   - Archivo: `server/middleware/saldoValidation.ts`
   - Accion: Mover la validacion de saldo DENTRO de la transaccion del endpoint, no en middleware. Alternativa: usar `update` atomico con decremento y verificar que el resultado no sea negativo.
   - Riesgo: Medio

5. **Normalizar todas las fechas a timezone Ecuador**
   - Archivos:
     - `server/services/cierreUnificadoService.ts`: Reemplazar `new Date().setHours(0,0,0,0)` por `gyeDayRangeUtcFromDate(nowEcuador())`
     - `server/services/cierreService.ts`: Mismo cambio
     - `server/routes/guardar-cierre.ts`: Usar `nowEcuador()` para fecha de cierre
     - `server/routes/exchanges.ts`: Corregir fechas de abono inicial
     - `server/routes/contabilidad-diaria.ts`: Usar `gyeDateOnlyToUtcMidnight()`
   - Riesgo: Medio (afecta cierres diarios)

6. **Eliminar auto-fix de movimientos faltantes en creacion de cambio**
   - Archivo: `server/routes/exchanges.ts`
   - Accion: En lugar de crear movimientos faltantes automaticamente (lineas 1276-1341), lanzar error 500 con mensaje claro para forzar correccion de la causa raiz.
   - Riesgo: Bajo

### Criterios de exito
- [ ] Dos requests simultaneos de generacion de guia no pueden generar saldo negativo
- [ ] Dos requests simultaneos de cambio de divisa no pueden generar saldo negativo
- [ ] Los cierres de caja usan siempre la fecha correcta de Ecuador
- [ ] No hay auto-fix silencioso de movimientos faltantes

---

## FASE 2: CONSISTENCIA CONTABLE (Semana 2-3)

**Objetivo:** Corregir los bugs que hacen que los numeros no cuadren: calculos de divisas, cuadre de caja, saldos y reportes.

### Tareas

1. **Unificar logica de calculo de divisas: backend debe respetar comportamientos de BD**
   - Archivos:
     - `server/services/exchange/exchangeCalculationService.ts`: Eliminar tabla hardcodeada `rateModeByCode`
     - `server/routes/exchanges.ts`: Usar `monedaOrigen.comportamiento_compra` y `monedaDestino.comportamiento_venta` para decidir MULTIPLICA/DIVIDE
   - Accion: Refactorizar `getRateModeForPair` para que consulte la moneda desde BD y use sus campos de comportamiento.
   - Riesgo: **ALTO** (cambia calculos financieros core)

2. **Corregir sobrescritura de saldo teorico en cuadre de caja**
   - Archivo: `server/routes/cuadreCaja.ts`
   - Accion: Separar `saldoCierreTeorico` (del reconciliador) de `conteoFisicoUltimo` (de `DetalleCuadreCaja` o snapshot). La diferencia debe ser `conteoFisicoUltimo - saldoCierreTeorico`, no `conteoFisico - conteoFisico`.
   - Riesgo: Medio

3. **Unificar normalizacion de signos en movimientos de saldo**
   - Archivos: `server/services/saldoCalculationService.ts`, `server/routes/apertura-caja.ts`
   - Accion: Extraer funcion unica `normalizeMontoByTipo(monto, tipo)` y usarla en ambos lugares.
   - Riesgo: Bajo

4. **Eliminar raw SQL de actualizacion de saldo en cuadre de caja**
   - Archivos: `server/routes/cuadreCaja.ts`, `server/routes/cuadre-caja-conteo.ts`
   - Accion: Reemplazar `pool.query(UPDATE "Saldo" ...)` por `prisma.saldo.upsert()` o delegar a `movimientoSaldoService.ts`.
   - Riesgo: Medio

5. **Corregir reporte de promedio de transacciones**
   - Archivo: `server/services/reportService.ts`
   - Accion: Calcular volumenes por moneda por separado, o convertir todo a USD antes de sumar.
   - Riesgo: Bajo

6. **Documentar/decidir arquitectura de billetes+monedas_fisicas**
   - Archivo: `server/services/movimientoSaldoService.ts`
   - Accion: Si `billetes` y `monedas_fisicas` son solo snapshot de cierre/apertura, documentarlo. Si deben mantenerse durante el dia, actualizar el servicio para ajustarlos proporcionalmente.
   - Riesgo: Bajo (decision de negocio)

### Criterios de exito
- [ ] Frontend y backend calculan el mismo monto destino para el mismo par de monedas y tasa
- [ ] El cuadre de caja muestra diferencias reales (no siempre cero)
- [ ] No hay raw SQL de UPDATE directo en tabla Saldo
- [ ] Los reportes no mezclan monedas distintas en promedios sin sentido

---

## FASE 3: FUNCIONALIDAD Y PERMISOS (Semana 3-4)

**Objetivo:** Que cada rol vea solo lo que debe ver y pueda hacer solo lo que debe hacer.

### Tareas

1. **Agregar filtrado por punto de atencion en todos los endpoints de consulta**
   - Archivos:
     - `server/routes/exchanges.ts`: `GET /`, `GET /pending`, `GET /partial`, `GET /search-customers`
     - `server/controllers/transferController.ts`: `getAllTransfers`
     - `server/routes/transfer-approvals.ts`: GET `/`
     - `server/routes/balances.ts`: `GET /:pointId`
     - `server/routes/movimientos-saldo.ts`: `GET /:pointId`
     - `server/routes/historial-saldo.ts`: `GET /:pointId`
     - `server/routes/movimientos-contables.ts`: `GET /:pointId`
     - `server/routes/saldos-iniciales.ts`: `GET /:pointId`
     - `server/routes/balance-completo.ts`: `GET /punto/:pointId`
   - Accion: Si el rol es OPERADOR o CONCESION, forzar `punto_atencion_id = req.user.punto_atencion_id`. Si es ADMIN/SUPER_USUARIO/ADMINISTRATIVO, permitir filtrar por cualquier punto.
   - Riesgo: Medio

2. **Verificar punto de atencion en operaciones de escritura sobre cambios existentes**
   - Archivo: `server/routes/exchanges.ts`
   - Accion: En `PATCH /:id/cerrar`, `PATCH /:id/completar`, `PATCH /:id/register-partial-payment`, verificar que el cambio pertenezca al punto del usuario (o que sea admin).
   - Riesgo: Medio

3. **Restaurar restriccion de fecha en eliminacion de cambios**
   - Archivo: `server/routes/exchanges.ts`
   - Accion: Limitar eliminacion a cambios del dia actual, o al menos del mes actual. Agregar log de auditoria.
   - Riesgo: Bajo

4. **Unificar logica de `isAdmin` en todo el frontend**
   - Archivos: `src/components/dashboard/Sidebar.tsx`, `src/components/dashboard/Dashboard.tsx`, `src/components/admin/SaldoServientregaAdmin.tsx`
   - Accion: Crear constante compartida `isAdmin = ["ADMIN", "SUPER_USUARIO"].includes(user.rol)` y `isAdminOrAdministrativo = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(user.rol)`.
   - Riesgo: Bajo

5. **Corregir `ServientregaInformes` para usar estado de BD en lugar de proceso**
   - Archivos: `server/routes/servientrega/informes.ts`, `server/services/servientregaDBService.ts`
   - Accion: Usar campo `estado` de la tabla para filtros y mapeo. (Ya se hizo en la sesion anterior, verificar que este completo)
   - Riesgo: Bajo

6. **Agregar soporte para metodo "mixto" en frontend de cambio de divisas**
   - Archivo: `src/components/exchange/ExchangeForm.tsx` o tipos relacionados
   - Accion: El backend ya soporta `mixto`, el frontend no. Agregar opcion.
   - Riesgo: Bajo

### Criterios de exito
- [ ] Un OPERADOR no puede ver cambios, transferencias, saldos ni movimientos de otro punto
- [ ] Un OPERADOR no puede cerrar/completar un cambio de otro punto
- [ ] ADMINISTRATIVO puede ver informes de Servientrega
- [ ] No hay eliminacion de cambios historicos sin restriccion

---

## FASE 4: ARQUITECTURA Y PERFORMANCE (Semana 4-5)

**Objetivo:** Sincronizar base de datos, agregar indices, paginacion y eliminar deuda tecnica.

### Tareas

1. **Sincronizar schema Prisma con base de datos real**
   - Accion: `npx prisma db pull` en entorno de desarrollo con copia de produccion. Revisar diff cuidadosamente.
   - Riesgo: **ALTO** (puede eliminar campos o tablas si no se revisa bien)

2. **Resolver tabla huérfana `ServicioExternoSaldoPunto`**
   - Accion: Si no se usa, eliminar tabla y migracion. Si se usa, agregarla a `schema.prisma`.
   - Riesgo: Medio

3. **Agregar paginacion a APIs de listado**
   - Archivos: `exchanges.ts`, `transfers.ts`, `movimientos-saldo.ts`, `contabilidad-diaria.ts`, `cierreReporte.ts`
   - Accion: Agregar `take: 50` por defecto y parametros `skip`/`page` en todas las APIs de listado.
   - Riesgo: Bajo

4. **Agregar indices faltantes**
   - Archivo: `prisma/schema.prisma`
   - Accion:
     - `CambioDivisa`: `@@index([estado])`, `@@index([moneda_origen_id, moneda_destino_id])`
     - `Transferencia`: `@@index([estado, fecha])`, `@@index([moneda_id])`
     - `Jornada`: `@@index([fecha_inicio, estado])`
     - `ServientregaSolicitudAnulacion`: `@@index([guia_id])`, `@@index([solicitado_por])`
   - Riesgo: Bajo (indices no afectan datos existentes, solo performance)

5. **Definir onDelete en todas las relaciones**
   - Archivo: `prisma/schema.prisma`
   - Accion: Agregar `onDelete: Restrict` o `onDelete: SetNull` en todas las FKs. Para tablas historicas, usar `Restrict`. Para registros opcionales, `SetNull`.
   - Riesgo: Medio

6. **Refactorizar servicios de cierre solapados**
   - Archivos: `server/services/cierreService.ts`, `server/services/cierreUnificadoService.ts`, `server/routes/guardar-cierre.ts`
   - Accion: Unificar en un solo servicio `CierreService` con metodos claros. Eliminar logica duplicada.
   - Riesgo: Medio

7. **Agregar proteccion NODE_ENV a seeds**
   - Archivo: `prisma/seed-complete.ts`
   - Accion: `if (process.env.NODE_ENV === "production") throw new Error("No ejecutar seed en produccion");`
   - Riesgo: Bajo

### Criterios de exito
- [ ] `prisma db pull` no genera cambios inesperados en schema
- [ ] Todas las APIs de listado tienen paginacion (max 50 registros por defecto)
- [ ] No hay tabla huérfana en BD
- [ ] Todos los seeds tienen proteccion de produccion

---

## FASE 5: TESTING Y DOCUMENTACION (Semana 5-6)

**Objetivo:** Asegurar que el sistema siga funcionando correctamente despues de los cambios y que los desarrolladores futuros entiendan el codigo.

### Tareas

1. **Crear tests unitarios para calculo de divisas**
   - Archivo: `server/services/exchange/exchangeCalculationService.ts`
   - Accion: Tests con Jest/Vitest para todas las combinaciones de pares de monedas (USD/EUR, USD/COP, EUR/USD, etc.) verificando que frontend y backend den el mismo resultado.
   - Riesgo: Ninguno (nuevo codigo)

2. **Crear tests de integracion para flujo critico**
   - Accion: Tests para:
     - Crear cambio de divisa -> verificar saldos -> eliminar cambio -> verificar reversión
     - Generar guia Servientrega -> verificar descuento de saldo -> anular guia -> verificar reversión
     - Abrir caja -> registrar movimientos -> cerrar caja -> verificar cuadre
   - Riesgo: Ninguno

3. **Documentar flujo de cambio de divisas**
   - Archivo: `docs/CAMBIO_DIVISAS.md`
   - Accion: Documentar:
     - Logica de normalizacion de pares USD
     - Flujo de cambios parciales y abonos
     - Diferencia entre `divisas_entregadas_*` y `monto_origen/destino`
     - Comportamiento de tasas diferenciadas (billetes vs monedas)
   - Riesgo: Ninguno

4. **Documentar arquitectura de saldos y cierres**
   - Archivo: `docs/ARQUITECTURA_SALDOS.md`
   - Accion: Documentar:
     - Diferencia entre `Saldo.cantidad` y desglose fisico
     - Cuando se actualiza cada uno
     - Como funciona la reconciliacion
   - Riesgo: Ninguno

5. **Sincronizar documentacion existente con schema real**
   - Archivos: `docs/FLUJO_CIERRES_SISTEMA.md`, `docs/VALIDACION_CIERRE_CAJA.md`
   - Accion: Actualizar campos y valores que ya no coinciden con el codigo.
   - Riesgo: Ninguno

6. **Crear checklist de deploy seguro**
   - Archivo: `docs/CHECKLIST_DEPLOY.md`
   - Accion: Lista de verificacion antes de cada deploy a produccion (env vars, migraciones, seeds, health checks).
   - Riesgo: Ninguno

### Criterios de exito
- [ ] Tests de calculo de divisas pasan para todos los pares operativos
- [ ] Tests de integracion pasan para flujo completo de cambio y guia
- [ ] Documentacion tecnica existe para cambio de divisas, saldos y cierres
- [ ] Checklist de deploy esta actualizado y se usa

---

## CRONOGRAMA SUGERIDO

| Semana | Fase | Focus | Riesgo de Deploy |
|--------|------|-------|------------------|
| Semana 1 | Fase 0 | Seguridad critica | Bajo |
| Semana 1-2 | Fase 1 | Transacciones atomicas, timezone | Medio |
| Semana 2-3 | Fase 2 | Calculos contables, cuadre de caja | **ALTO** (probar en staging) |
| Semana 3-4 | Fase 3 | Permisos, filtrado por punto | Medio |
| Semana 4-5 | Fase 4 | BD, indices, paginacion, sincronizacion | **ALTO** (backup obligatorio) |
| Semana 5-6 | Fase 5 | Tests, documentacion | Ninguno |

---

## RECOMENDACIONES ADICIONALES

### Entorno de Pruebas
Antes de aplicar Fase 2 o Fase 4 en produccion, se recomienda:
1. Crear un snapshot/backup completo de la BD de produccion
2. Restaurar en un entorno de staging
3. Aplicar cambios y ejecutar suite de pruebas manual (cambio de divisa completo, generacion y anulacion de guia, cierre de caja)
4. Solo si todo pasa, deployar a produccion

### Monitoreo Post-Deploy
Despues de cada fase, monitorear:
- Logs de errores 500 en backend
- Diferencias de cuadre de caja (deberian aumentar si se corrigio el bug del cero)
- Saldos negativos en ServicioExternoSaldo (deberian desaparecer con bloqueo pesimista)
- Tiempo de respuesta de APIs de listado (deberia mejorar con paginacion)
