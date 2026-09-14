# Revisión para producción — 2026-09-13

Estado: revisión en curso. No se ha hecho push, despliegue ni escritura en la base remota. No equivale a autorizar el despliegue de todos los cambios acumulados.

## Avance: liquidación de parciales en efectivo

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
