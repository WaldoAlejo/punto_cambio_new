# Reconstrucción de euros de El Bosque

Consulta de producción del 14/09/2026 a las 07:33 de Ecuador. Transacción de lectura; sin ajustes aplicados. Complementa `REVISION_EUR_BOSQUE_2026-08-17_A_2026-08-31.md`.

## Referencia histórica y movimientos posteriores

Referencia: conteo registrado del 29/08, 2.210,00 EUR en billetes y 33,94 en monedas, total **2.243,94 EUR**. Coincide con la reconstrucción del 28/08 al revertir exactamente los 48,38 EUR que habían salido, en vez de los 48,48 registrados.

Se contrastaron los **42 movimientos** posteriores, **36 cambios** y **6 transferencias**, sin asignaciones en el período. La cadena de totales registrados no presenta saltos; todos los cambios conservados tienen desgloses declarados que suman su importe EUR. Esto no prueba que las proporciones declaradas fueran siempre las efectivamente descontadas por el código antiguo.

Cálculo en centavos enteros, agrupado por día de Ecuador:

| Fecha | Saldo inicial reconstruido | Entradas | Salidas | Saldo final reconstruido |
|---|---:|---:|---:|---:|
| 29/08 | 2.243,94 | 500,00 | 1.160,00 | 1.583,94 |
| 31/08 | 1.583,94 | 1.000,00 | 2.266,45 | 317,49 |
| 01/09 | 317,49 | 200,00 | 300,00 | 217,49 |
| 02/09 | 217,49 | 285,00 | 138,00 | 364,49 |
| 03/09 | 364,49 | 1.500,00 | 700,00 | 1.164,49 |
| 04/09 | 1.164,49 | 0,00 | 400,00 | 764,49 |
| 05/09 | 764,49 | 70,00 | 0,00 | 834,49 |
| 07/09 | 834,49 | 2.692,00 | 200,00 | 3.326,49 |
| 08/09 | 3.326,49 | 161,11 | 1.500,00 | 1.987,60 |
| 09/09 | 1.987,60 | 2.550,00 | 3.110,00 | 1.427,60 |
| 10/09 | 1.427,60 | 0,00 | 887,34 | 540,26 |
| 11/09 | 540,26 | 1.300,00 | 520,00 | 1.320,26 |
| 12/09 | 1.320,26 | 525,00 | 100,00 | **1.745,26** |

Las entradas/salidas incluyen transferencias, sin sumarlas una segunda vez. Los días sin movimientos conservan el saldo. No hay movimientos posteriores al 12/09 en la consulta realizada.

## Contraste con el último conteo documentado

Apertura `98cca2e1-059c-4d89-8a48-3bb2eb05ea09`, conteo terminado el 12/09 a las 16:09:11 UTC (11:09:11 de Ecuador):

- Billetes: 13 × 100 + 1 × 5 = **1.305,00 EUR**.
- Monedas: 6 × 2 + 3 × 0,50 + 2 × 0,20 + 10 × 0,10 + 9 × 0,05 + 1 × 0,01 = **15,36 EUR**.
- Total contado registrado: **1.320,36 EUR**, 0,10 por encima de la reconstrucción histórica.

Solo hubo dos movimientos después de ese conteo:

1. Venta de 100 EUR en billetes, 12/09 a las 16:47:50 UTC. Cambio `950a9ff7-ab32-4475-8546-ca27b3f84224`.
2. Compra de 525 EUR en billetes, 12/09 a las 17:49:30 UTC. Cambio `f1bf99c2-39e0-441a-9228-b19faa0ebe6d`.

Por tanto, tomando ese conteo registrado como referencia, resulta:

**Billetes: 1.305 − 100 + 525 = 1.730,00 EUR. Monedas: 15,36 EUR. Total: 1.745,36 EUR.**

## Estado de la corrección

La fila actual de `Saldo` mantiene 1.745,36 de total, 1.689,74 de billetes y 7,14 de monedas; bancos 0. Su desglose suma 1.696,88.

La reconstrucción histórica arroja 1.745,26, mientras que la referencia física más reciente registrada y sus movimientos arrojan 1.745,36. No corresponde declarar confirmado uno de esos dos importes físicos sin resolver los 0,10 de diferencia. Tampoco corresponde distribuir los 48,48 arbitrariamente entre billetes y monedas.

Si se confirma el último conteo trasladado al presente (1.730,00 + 15,36), el ajuste de desglose sería **+40,26 en billetes y +8,22 en monedas**, manteniendo el total; el expediente debe conservar que la reconstrucción histórica difiere en 0,10. Si el conteo actual es distinto, documentar la diferencia y usar sus componentes reales, sin atribuirla automáticamente al reverso de agosto.

Se solicitó al usuario confirmar billetes y monedas actuales. **No se ejecutó UPDATE ni se alteraron ventas, transferencias, aperturas o cuadres.**

Lo anterior describe el estado previo a la respuesta del usuario. El resultado aplicado posteriormente se detalla a continuación.

Hay jornadas antiguas todavía marcadas ACTIVO, incluida la del 12/09; no apareció jornada del 14/09 en la consulta. Antes de aplicar un ajuste se debe volver a comprobar actividad y movimientos, bloquear la fila y validar su versión para evitar sobrescribir operaciones nuevas. El ajuste debe conservar evidencia anterior/posterior y una referencia de auditoría única para impedir duplicaciones.

Evidencia local excluida de Git: `node_modules/.cache/audit-bosque/window-2026-08-29.json` y `current.json`. Las credenciales no se guardaron en estos archivos.

## Aplicación autorizada y verificada

El usuario indicó que el punto aún no iniciaba y que los 0,10 EUR se resolverían en el conteo de hoy. Se tomó como base operativa el último conteo registrado más las operaciones posteriores, conservando el total. No se certifica con ello un conteo físico actual ni se da por resuelta la diferencia histórica.

Se actualizó exclusivamente la fila `Saldo` `648988a5-c36f-4069-b376-212096ee4233`:

| Campo | Antes | Después | Variación |
|---|---:|---:|---:|
| Cantidad | 1.745,36 | 1.745,36 | 0,00 |
| Billetes | 1.689,74 | 1.730,00 | +40,26 |
| Monedas físicas | 7,14 | 15,36 | +8,22 |
| Bancos | 0,00 | 0,00 | 0,00 |
| Total menos desglose | 48,48 | **0,00** | −48,48 |

COMMIT confirmado; `updated_at` SQL: **2026-09-14 12:40:37.585 UTC**. La consulta posterior independiente verificó diferencia 0,00 y bancos intactos. No se generó una venta, transferencia ni ingreso ficticio: es una reparación del desglose de efectivo ya registrado. No se modificó el historial económico, las aperturas ni los cuadres.

Script específico: `scripts/db/repair-bosque-eur-breakdown.mjs`. Diez pruebas locales aprobadas. Incluye respaldo previo obligatorio, bloqueo del punto y saldo, comprobación de actividad del día, verificación de evidencia y versión exacta, y detección de reparación ya aplicada. Un primer intento se revirtió completamente por una conversión de zona horaria del cliente; se corrigió comparando `updated_at::text` con su marca SQL exacta. No se desactivaron triggers.

Respaldo: `node_modules/.cache/audit-bosque/repair-2026-09-14-before-v2.json`; confirmación: mismo nombre más `.result.json`.
SHA-256 del respaldo: `88d0b32bc3ade9575b393622bda3e20fcf51e63cfdee3f77a986c005aa9691cd`.

Para verificar nuevamente, usar `--check` con la conexión suministrada mediante `AUDIT_DATABASE_URL`. No ejecutar este script para otro saldo ni reutilizarlo si cambia la actividad del punto. Una reversión requeriría confirmar que no hubo movimientos posteriores y comparar la versión exacta del resultado; no restaurar el respaldo a ciegas.

**Pendiente operativo:** contar efectivamente billetes y monedas hoy y registrar la diferencia que exista. La diferencia histórica de 0,10 continúa abierta en este expediente.
