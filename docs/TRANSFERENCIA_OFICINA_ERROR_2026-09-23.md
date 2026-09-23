# Transferencia a oficina bloqueada por componente no utilizado

La captura del 23/09/2026 muestra una transferencia de USD 1.200 desde AMAZONAS 3 hacia OFICINA ROYAL PACIFIC, con desglose de solo billetes. El dashboard muestra cantidad 2.160,34, billetes 2.162,97 y monedas físicas -2,38.

## Causa y corrección

En `server/controllers/transferController.ts`, la validación comparaba también las cero monedas solicitadas contra el saldo negativo: `0 > -2.38`. Por eso rechazaba el envío aun con billetes y saldo total suficientes.

Ahora se exige disponibilidad de cada componente cuando su importe solicitado es mayor que cero. Se mantiene la validación del saldo total, el bloqueo transaccional y el registro del desglose realmente descontado. El saldo negativo del componente no utilizado se conserva; esta corrección no reconcilia datos históricos.

Los importes de la captura también presentan una diferencia: billetes más monedas suman 2.160,59, frente a 2.160,34 de saldo total. El origen de esa diferencia y del saldo negativo requiere revisar movimientos y conteo físico; no se deduce de las capturas. No se modificaron datos de producción.

## Verificación y despliegue

Se agregaron pruebas de integración con PostgreSQL temporal para el caso exacto reportado, su equivalente con solo monedas, rechazo al solicitar monedas con stock negativo, billetes insuficientes y saldo total insuficiente. Comprueban saldos, comprobante, devolución al cancelar y ausencia de cambios ante rechazo.

El cambio requiere compilar y desplegar el backend y reiniciarlo mediante el procedimiento habitual. No requiere migraciones ni cambios en el frontend. La transferencia real debe realizarse desde la aplicación después del despliegue.

Resultado local: 325/325 comprobaciones de integración aprobadas y PostgreSQL temporal detenido. Verificación TypeScript del backend sin errores.
