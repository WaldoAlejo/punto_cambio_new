# Revisión para producción — 2026-09-13

Estado: revisión en curso. No se ha hecho push, despliegue ni escritura en la base remota. No equivale a autorizar el despliegue de todos los cambios acumulados.

## Avance: creación bancaria y mixta

Se reprodujo un error 500 al crear un pago MIXTO válido: la validación exigía dos movimientos aunque correspondían tres o cuatro. Ahora exige un movimiento por cada componente positivo de caja/bancos en origen/destino y mantiene la comprobación de que ambas monedas tengan importe contabilizado. No se crean movimientos artificiales para satisfacer el conteo.

Los cuatro campos de desglose bancario/efectivo rechazan negativos. Para MIXTO, la suma debe coincidir con el total; se eliminó el reparto automático 50/50 ante importes omitidos o inconsistentes. Esas solicitudes devuelven 400 antes de registrar saldos, cambio, movimientos o recibo.

Evidencia: [fallo reproducido](INTEGRACION_LOCAL_MIXTOS_ANTES.json), [141 pruebas correctas](INTEGRACION_LOCAL_CREACION_MIXTOS.json) y TypeScript backend correcto. La matriz prueba COMPRA EUR→USD completa y con abono inicial para BANCO/efectivo, EFECTIVO/transferencia, MIXTO/efectivo, EFECTIVO/mixto y MIXTO/mixto. Verifica total de movimientos, signos, saldo anterior/nuevo y separación caja/bancos; conserva la regla actual de bancos sin límite de saldo. Incluye seis rechazos de desgloses inválidos sin escrituras contables.

**Límite de esta corrección:** aún falta validar liquidación y reverso bancario/mixto, VENTA y otros pares. Hasta resolver la liquidación, `cerrar`, `completar` y `complete-partial` rechazan con 409 los abonos bancarios/mixtos, conservando los datos; antes solo el cierre administrativo tenía esa protección. Las pruebas comprueban los tres rechazos en cada combinación parcial. Crear estos abonos correctamente no significa que su ciclo completo esté listo para producción. No hubo cambios remotos ni de esquema.

## Avance: liquidación de parciales en efectivo

Actualización de anulaciones: los nuevos recibos de creación y liquidación en efectivo guardan `cash_delta_v1`, con variaciones reales del saldo, billetes y monedas en centavos enteros. Se obtiene dentro de la misma transacción, después de adquirir los bloqueos, y se verifica que total = billetes + monedas. Esto registra también las sustituciones de billetes por monedas realizadas por el sistema; no supone que el desglose solicitado fuera el entregado.

La anulación contrasta esa evidencia acumulada con los movimientos firmados de ambas monedas antes de revertir. Para un parcial pendiente devuelve solo el abono aplicado; para uno liquidado devuelve lo realmente contabilizado en creación y cierre. Recupera el desglose registrado. Si un parcial carece de evidencia suficiente (incluidos los históricos) o esta no coincide, responde 409 sin cambiar datos. Las anulaciones parciales bancarias/mixtas también requieren revisión y devuelven 409. Los completos históricos sin abono mantienen por ahora el tratamiento anterior; no quedan certificados por esta corrección.

Evidencia: [125 pruebas de integración correctas](INTEGRACION_LOCAL_ANULACION_PARCIALES.json) y TypeScript backend correcto. Cubre parcial, parcial liquidado, abono posterior, sustitución física, evidencia ausente/alterada, dos anulaciones simultáneas y rollback si falla la eliminación del recibo. Los saldos y su desglose regresan a los valores anteriores y el neto del historial del cambio queda en cero. No hubo escritura remota ni migración. Una operación cuyo cambio de desglose no coincide con su efectivo se rechaza; las discrepancias históricas ya detectadas requieren su revisión independiente.

Actualización de redondeo: creación y liquidación usan un reparto en centavos enteros para que billetes + monedas coincidan con el efectivo. Se redondea billetes y se asigna el resto a monedas, evitando redondear ambos componentes por separado. Verificación: [117 pruebas de integración correctas](INTEGRACION_LOCAL_REDONDEO_ABONOS.json), 3 pruebas unitarias de reparto y TypeScript backend correcto. El flujo de una operación de 10,00 con abono de 5,01 conserva la igualdad del desglose al crear y completar por `cerrar`, `completar` y `complete-partial`, manteniendo bancos intactos. La prueba unitaria recorre 1.002 importes y seis repartos, además de entradas inválidas. Ejecutar con `node --import tsx --test scripts/tests/cash-breakdown.test.ts`.

La corrección no redistribuye saldos históricos ni reconstruye denominaciones efectivamente entregadas. Sigue pendiente verificar toda la política de sustitución de billetes/monedas cuando no existe el desglose solicitado, y su reverso en operaciones parciales.

`cerrar` y `completar` contrastan ahora los movimientos vinculados al cambio antes de liquidar un abono en efectivo. Si ambas monedas ya están contabilizadas por completo, solo completan el estado y el recibo, sin tocar saldos ni duplicar movimientos. Si el historial coincide con el abono proporcional, registran la diferencia exacta del total en centavos. Historial ausente, incompatible, con reversos o con movimientos bancarios devuelve 409 para revisión; no se reconstruye por suposición.

`complete-partial` comparte ahora el proceso transaccional de `completar`, manteniendo acceso exclusivo ADMIN/SUPER_USUARIO y requisito de saldo pendiente. Deja de limitarse a cambiar el estado. El cierre administrativo de parciales bancarios o mixtos devuelve 409 hasta validar esas vías; las otras rutas bancarias conservan su comportamiento anterior y siguen pendientes de revisión.

Evidencia: [114 pruebas de integración correctas](INTEGRACION_LOCAL_PARCIALES_EFECTIVO.json) y TypeScript backend correcto. Incluye los tres endpoints, creación real con abono inicial y registro posterior, movimientos/saldos finales, doble solicitud, fallo de recibo con rollback e historial insuficiente. El alcance comprobado utiliza efectivo con desglose en billetes. Quedan pendientes la distribución fina billetes/monedas con redondeos, BANCO/MIXTO, cambios de vía al completar y reversos de parciales. No se cambiaron registros remotos ni el esquema.

## Contraste de la base indicada por el usuario

Consultas agregadas en transacciones READ ONLY, con tiempos máximos de 10–15 segundos. Primera consulta en REPEATABLE READ. Conexión TLS hasta el pooler confirmada; conexiones cerradas. No se utilizaron endpoints HTTP de reportes que escriben datos. Credenciales fuera del repositorio.

| Verificación | Resultado |
| --- | --- |
| Saldos consultados | 233 |
| Diferencias entre Saldo.cantidad y fórmula del reporte (SaldoInicial activo + movimientos de caja) | 0 |
| Pares con más de un SaldoInicial activo | 0 |
| Diferencias entre cantidad y billetes + monedas físicas | 12 |
| Desglose de diferencias | USD: 9, máximo absoluto 134.66; EUR: 1, máximo 48.48; COP: 2, máximo 168.00 |
| Cuadres encontrados por estado | 1403 ABIERTO; no se observaron otros estados en esta consulta |
| Cuadres con hora exacta 00:00 UTC | 809 |
| Transferencias por vía | Solo EFECTIVO: 1171 COMPLETADO, 34 CANCELADO, 3 EN_TRANSITO |

La reconstrucción reproduce el filtro textual de bancos que usa el reporte; no demuestra que todos los movimientos estén correctamente clasificados. Las cifras son el estado observado, no una certificación contable ni una comprobación de que el código desplegado coincide con este repositorio.

Los 12 desgloses requieren conteos o evidencia de origen; corregirlos automáticamente sería inventar la distribución física. Los cuadres a 00:00 UTC no tenían el prefijo de observación de la apertura actual: su convención histórica debe investigarse antes de reinterpretarlos. No se modificaron fechas ni importes.

## Compatibilidad de apertura y cuadre

Se reprodujo localmente que la apertura creaba un cuadre a 00:00 UTC y el reporte creaba otro al buscar desde 05:00 UTC. Se alineó la creación y búsqueda de la apertura con el rango del día de Guayaquil ya usado por reporte/cierre. Solo afecta código y nuevas operaciones; no migra registros históricos.

Evidencia: [antes](INTEGRACION_LOCAL_FECHA_APERTURA_ANTES.json), [después](INTEGRACION_LOCAL_FECHA_APERTURA_CORREGIDA.json). Las 70 pruebas pasan y ahora verifican explícitamente un solo cuadre después de apertura y reporte. TypeScript backend correcto.

## Pendientes de liberación

Navegador con backend real aislado: login de administrador ficticio, recarga conservando sesión, listado de puntos de PostgreSQL temporal y logout seguido de recarga comprobados. [Captura del listado](PRUEBA_NAVEGADOR_LOCAL_PUNTOS.png). El menú requiere desplazar su contenedor antes de hacer clic mediante automatización. El dashboard mostró error de conexión en métricas porque sus rutas no se montan en este entorno reducido; sus cifras no se consideran validadas. La suite volvió a pasar 95 casos y PostgreSQL se cerró al finalizar.

Para repetir esa revisión: construir con `node scripts/tests/build-frontend-check.mjs` y ejecutar `node --import tsx scripts/tests/integration-local.mjs --browser`. Abre localhost:4173 con API real local y CSP `connect-src 'self'`. Al terminar las pruebas crea el usuario ficticio `navegador_local` con clave `PruebaLocal_123!`; solo existe en el nuevo clúster temporal. El proceso muestra la ruta `finishFile`: crear ese archivo termina la sesión y apaga PostgreSQL, o lo hace automáticamente tras 10 minutos. El modo normal conserva su puerto HTTP aleatorio y cierre inmediato. No publicar el build de esta prueba: apunta a localhost.

Anulación: la eliminación bloquea ahora el cambio y ambas monedas antes de leer los saldos. Si el efectivo o su desglose no alcanzan para el reverso, devuelve 409 y conserva los datos, en lugar de recortar a cero y registrar un movimiento diferente. Bancos conserva aritmética exacta sin límite de saldo. Dos eliminaciones simultáneas dejan un solo reverso; la segunda obtiene 404. [95 pruebas correctas](INTEGRACION_LOCAL_REVERSO_SEGURO.json). Esto cubre la atomicidad y suficiencia del reverso de cambios completos; sigue abierta la fórmula de reverso para parciales/históricos.

Frontend: completar un cambio sin indicar desglose ahora omite esos campos en la petición, conservando los importes guardados; los ceros explícitos siguen enviándose. Las 6 regresiones frontend pasan. La compilación aislada Vite pasó (aviso de datos Browserslist antiguos y bundle grande de reportes; no se actualizaron dependencias automáticamente).

`complete-partial` y `register-partial-payment` condicionan la escritura a estado PENDIENTE: si una cancelación gana mientras esperan el bloqueo, responden 409 sin reactivar el cambio. [93 pruebas correctas](INTEGRACION_LOCAL_ESTADOS_ABONOS.json). La comprobación de fondos en cerrar/completar se limita al efectivo y su desglose; se conserva la regla existente de bancos como registro sin límite de saldo.

**Hallazgo contable aún abierto:** POST `/exchanges` contabiliza el 100% si no hay abono, incluso con estado PENDIENTE. Registrar un abono posteriormente cambia solo los metadatos, mientras cerrar/completar calcula otro movimiento proporcional. Por otra parte, `complete-partial` marca completado sin movimientos, aunque su pantalla anuncia actualización contable. No es seguro unificar estos flujos aplicando ciegamente el porcentaje restante a registros históricos: primero debe distinguirse lo ya contabilizado. También sigue pendiente el reverso de parciales al eliminar un cambio. Estos casos impiden declarar lista la liberación completa.

`cerrar` y `completar` ahora bloquean el cambio y ambas monedas, vuelven a verificar la jornada y guardan saldos, movimientos, estado y recibo en una transacción. Rechazan saldo/desglose insuficiente. Pruebas de doble solicitud y fallo deliberado del recibo confirman una sola contabilización y rollback completo: [91 pruebas correctas](INTEGRACION_LOCAL_ABONOS_ATOMICOS.json). Se conserva por ahora la fórmula existente de reparto del abono; no certifica la correcta clasificación histórica ni todos los métodos de pago.

Permisos de `cerrar`, `completar` y `register-partial-payment` corregidos: operador limitado a su punto, cambios cancelados rechazados con 409, alcance ADMIN/SUPER_USUARIO conservado. Verificación aislada: 85 pruebas correctas y TypeScript backend correcto; [resultados](INTEGRACION_LOCAL_PERMISOS_CAMBIOS.json). Estas pruebas de permisos no certifican todavía la contabilidad de abonos ni su concurrencia.

- Fecha/estado de cuadres históricos y discrepancias de desglose señaladas arriba.
- Abonos, completar/cerrar cambios pendientes, anulaciones y sus permisos/concurrencia.
- Vías BANCO/MIXTO y devolución del desglose físico de transferencias.
- Validación de las pantallas con backend aislado y mensajes de conflictos.
- Zona horaria efectiva y revisión exacta desplegada, respaldo y reversión del despliegue.

No ejecutar `npm run deploy` como verificación: el script incluye `prisma db push`. Las comprobaciones locales no requieren modificar el esquema remoto.
