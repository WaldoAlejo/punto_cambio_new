# El Bosque: diferencia de euros del 1 de septiembre

Revisión realizada el 14 de septiembre de 2026. Ventana principal: 17 a 31 de agosto de 2026, hora de Ecuador (UTC−5). Se consultó también la apertura y las operaciones del 1 de septiembre para contrastar el reporte.

## Método y alcance

Consultas directas a PostgreSQL en transacción `READ ONLY`; lectura principal con aislamiento `REPEATABLE READ`. Sin modificaciones a producción. Cálculos locales en centavos enteros.

Se examinaron 40 movimientos EUR, 31 cambios conservados, 7 transferencias y 13 aperturas en la ventana principal, además de cuadres asociados. No hubo asignaciones de euros en esa ventana. Se comprobó continuidad entre saldo anterior y saldo nuevo de los movimientos y su aritmética: sin saltos en el total registrado. Esto prueba continuidad contable, no existencia física del dinero.

Punto: EL BOSQUE, `3f13bb4e-181b-4026-b1bf-4ae00f1d1391`. Moneda EUR: `397fbd81-7f1e-49ed-832a-43baedcf0b02`.

## Primera aparición del desfase

Todas las aperturas encontradas del 17 al 28 de agosto guardaban un saldo esperado cuyo total coincidía con billetes más monedas. La apertura del 29 es la primera del período donde no coinciden:

| Apertura | Total esperado EUR | Billetes esperados | Monedas esperadas | Total menos desglose |
|---|---:|---:|---:|---:|
| 28/08 | 1.912,82 | 1.880,00 | 32,82 | 0,00 |
| 29/08 | 2.244,04 | 2.165,09 | 30,47 | 48,48 |
| 31/08 | 1.584,04 | 1.510,09 | 25,47 | 48,48 |
| 01/09 | 317,59 | 260,09 | 9,02 | 48,48 |

Son datos de `AperturaCaja.saldo_esperado`, no valores inferidos de la pantalla.

## Operaciones del 28 de agosto

Horas locales de Ecuador:

| Hora | Operación | Movimiento EUR | Saldo registrado |
|---|---|---:|---:|
| Apertura | Saldo de partida | — | 1.912,82 |
| 16:31:22 | Venta original | −48,38 | 1.864,44 |
| 16:32:08 | Reverso por eliminación de esa venta | +48,48 | 1.912,92 |
| 16:32:52 | Nueva venta | −48,38 | 1.864,54 |
| 20:36:08 | Compra de euros | +379,50 | 2.244,04 |

Venta eliminada: `27589bcc-6d3c-4902-9e79-76ef8c6a9d67`, recibo `CAM-1787934682145-5wu6`. Movimiento original EUR `791980e8-04e5-4713-a901-03fabfbc5587`; reverso `3d88e060-7155-4ad2-9969-5698057e6dbe`. Ambos movimientos conservan la misma referencia. El ingreso original de 60 USD se revirtió por exactamente 60 USD; la discrepancia comprobada está en EUR.

Nueva venta: `70e4e352-435e-4147-81ef-a12b6601e688`, recibo `CAM-1787934772168-oae2`. Desglose conservado: 45 EUR en billetes y 3,38 en monedas.

Compra: `ed16ae2c-1864-4092-adb4-13695728d3df`, recibo `CAM-1787949368536-s1ul`. Desglose conservado: 375 EUR en billetes y 4,50 en monedas.

## Dos efectos distintos

**Confirmado directamente:** el reverso sumó 48,48 EUR aunque el egreso original fue 48,38. Dejó **0,10 EUR adicionales en el saldo total**.

**Reconstrucción del desglose:** sin el efecto neto de la venta eliminada, la caja del final del 28 habría quedado:

- Billetes: 1.880,00 − 45,00 + 375,00 = **2.210,00**.
- Monedas: 32,82 − 3,38 + 4,50 = **33,94**.
- Total: **2.243,94 EUR**.

Pero el sistema guardó 2.165,09 en billetes y 30,47 en monedas: faltan **44,91 + 3,47 = 48,38 EUR en el desglose** frente a esa reconstrucción. La evidencia apunta a que el reverso no recuperó el desglose descontado. No se conserva una instantánea de `Saldo` inmediatamente antes y después de cada operación, por lo que esta atribución por componentes es una reconstrucción, no una lectura directa del reverso.

Ambos efectos explican el desfase: **48,38 de desglose sin recuperar + 0,10 de exceso en el total = 48,48 EUR**.

El operador registró el 29 de agosto **2.210 EUR en billetes y 33,94 en monedas**, total **2.243,94**, coincidente con la reconstrucción. La diferencia registrada contra el total del sistema fue **−0,10**. Esto aporta corroboración documental, aunque no sustituye una confirmación física independiente.

## Relación con el reporte del 1 de septiembre

La apertura de ese día conservó los valores reportados: total 317,59 frente a 260,09 + 9,02 = 269,11. El conteo ingresado fue 305 + 12,59 = 317,59. Guardar ese conteo no eliminó el desfase operativo.

La cadena registrada hasta el 31 de agosto es:

`917,91 + 15.420,00 transferencias + 3.652,67 ingresos − 19.721,47 egresos + 48,48 ajuste = 317,59 EUR`.

Sustituir únicamente el reverso incorrecto por 48,38 da **317,49 EUR**. Es una reconstrucción contable bajo ese supuesto, no una orden de ajuste ni un conteo físico validado. No sería correcto sumar automáticamente 48,48 a billetes: mezcla una diferencia de desglose con un exceso en el total.

El 1 de septiembre se registró una compra de 200 EUR a las 18:56 y una venta completada de 300 EUR a las 21:01. El intento rechazado no tiene un movimiento de saldo que permita fecharlo directamente.

## Límites y siguiente corrección

El cambio eliminado y su recibo ya no existen en sus tablas; permanecen los movimientos de ingreso, egreso y reverso. No se puede demostrar con esos datos qué campo original contenía 48,48 ni qué versión exacta de backend lo procesó.

La falta de sincronización de la apertura explica la persistencia y el bloqueo, pero el origen localizado en esta ventana es el reverso del **28 de agosto**, no la apertura del 1 de septiembre. No se ejecutó reparación histórica ni se reabrió la conciliación general cancelada de julio.

Antes de una reparación, reconstruir los componentes desde la referencia documentada, contrastarlos con operaciones posteriores y con el conteo físico vigente; registrar por separado la corrección del total y la del desglose. No aplicar una actualización global de saldos ni repetir la venta anulada.

Evidencia de consulta local (fuera de Git): `node_modules/.cache/audit-bosque/window-2026-08-17.json` y `reversal.json`. No contienen credenciales.
