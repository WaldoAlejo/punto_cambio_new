# Transferencias de efectivo: billetes y monedas

## Problema confirmado

El formulario enviaba únicamente el total. El backend ignoraba el `detalle_divisas` recibido y descontaba billetes y monedas proporcionalmente al saldo. La aceptación y el rechazo trataban el efectivo como billetes; la cancelación calculaba proporciones con la caja existente al devolver.

## Corrección

- El operador elige **Solo billetes**, **Solo monedas físicas** o **Billetes y monedas**. Para la combinación indica el importe en monedas; el resto corresponde a billetes.
- El servidor valida importes no negativos, hasta dos decimales, suma exacta y disponibilidad de cada componente bajo el bloqueo del saldo.
- Transferir 50,25 solo en monedas descuenta 0 billetes y 50,25 monedas. La recepción suma esos mismos componentes. El rechazo y la cancelación devuelven exactamente lo descontado, incluso si la caja cambió durante el tránsito.
- La consulta de pendientes entrega el desglose para mostrarlo al receptor.
- El comprobante y el descuento se guardan en una misma transacción. Si falla el comprobante, se revierten la transferencia y el descuento.

El comprobante usa `datos_operacion.desglose_contabilizado_v1` como evidencia del descuento. No cambia el esquema SQL. Clientes antiguos que omiten el desglose conservan el reparto proporcional, redondeado a centavos, y el nuevo servidor registra ese reparto para recibirlo o devolverlo correctamente.

## Alcance histórico

Las transferencias anteriores sin evidencia versionada conservan el comportamiento histórico. Su antiguo `detalle_divisas` era informativo y no prueba qué se descontó. Este cambio no reconstruye ni ajusta saldos históricos, ni modifica los flujos bancarios o la aprobación antigua de registros PENDIENTE. La investigación de euros de El Bosque fue cancelada por el usuario.

## Validación local

- TypeScript frontend y backend: sin errores.
- Compilación Vite en `node_modules/.cache/frontend-check`: correcta.
- Integración PostgreSQL temporal: **313/313**. Incluye monedas y combinación en aceptación/rechazo/cancelación, reintento idempotente, consulta del desglose al receptor, caja modificada durante tránsito, importes inválidos, monedas insuficientes y fallo de comprobante con reversión total.
- Pruebas aisladas de frontend: **18/18**, incluidas seis del envío del formulario y validaciones de sus importes.
- ESLint de los archivos revisados: permanece un error previo (`req as any` en la ruta de cancelación) y siete advertencias previas. No se declara el lint global como aprobado.
- Sin conexiones ni cambios a la base de producción durante esta corrección. No se realizó prueba visual en navegador.

Comandos reproducibles:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.server.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
node --test scripts/tests/transfer-form-regressions.cjs scripts/tests/frontend-regressions.cjs scripts/tests/auth-point-regressions.cjs
node --import tsx scripts/tests/integration-local.mjs
node scripts/tests/build-frontend-check.mjs
```

## Despliegue pendiente

El usuario realiza el push y el despliegue AWS. Respaldar los artefactos actuales y desplegar frontend y backend juntos durante una ventana sin operaciones: actualizar código, ejecutar `npm run build`, reiniciar `punto-cambio-api` con `ecosystem.config.cjs --update-env` y comprobar salud local/pública. No requiere `prisma db push`, migración SQL ni cambios de saldos. Recargar las pestañas de los operadores para utilizar el formulario actualizado. Evitar volver a un backend anterior mientras existan transferencias nuevas pendientes, ya que ese backend no interpreta el desglose versionado.
