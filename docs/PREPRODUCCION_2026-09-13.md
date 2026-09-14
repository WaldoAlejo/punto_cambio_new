# Revisión para producción — 2026-09-13

Estado: revisión en curso. No se ha hecho push, despliegue ni escritura en la base remota. No equivale a autorizar el despliegue de todos los cambios acumulados.

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

- Fecha/estado de cuadres históricos y discrepancias de desglose señaladas arriba.
- Abonos, completar/cerrar cambios pendientes, anulaciones y sus permisos/concurrencia.
- Vías BANCO/MIXTO y devolución del desglose físico de transferencias.
- Validación de las pantallas con backend aislado y mensajes de conflictos.
- Zona horaria efectiva y revisión exacta desplegada, respaldo y reversión del despliegue.

No ejecutar `npm run deploy` como verificación: el script incluye `prisma db push`. Las comprobaciones locales no requieren modificar el esquema remoto.
