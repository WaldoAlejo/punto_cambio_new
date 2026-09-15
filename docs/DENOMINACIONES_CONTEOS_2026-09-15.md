# Denominaciones agregadas por el operador

En Apertura de Caja (incluidos conteos pendientes) y Cierre Diario, el operador puede agregar una denominación de moneda a la divisa que está contando. Ejemplo: seleccionar ARS, escribir 0,25, pulsar Agregar moneda e ingresar el número de piezas en la nueva casilla.

Se admite coma o punto decimal, desde 0,01 y hasta dos decimales. No se permiten valores negativos, cero, texto ni denominaciones repetidas en el mismo conteo. La nueva casilla empieza con cantidad cero y no altera el total hasta ingresar las piezas.

Las denominaciones se guardan con el conteo mediante las estructuras existentes de la base. No se crea una divisa nueva ni se modifica el catálogo global. En otro conteo se pueden agregar nuevamente si no aparecen. Recargar antes de guardar conserva únicamente lo que ya se haya guardado en el servidor, como el resto del formulario.

El cierre recupera también denominaciones guardadas que no existen en la lista predeterminada. La ruta de Cierre Diario ahora persiste el desglose que recibe (antes lo descartaba) y valida valores/cantidades antes de escribir. El frontend envía el saldo teórico con el nombre esperado por el servicio.

## Despliegue

Actualizar frontend y backend juntos con el procedimiento habitual de build y reinicio PM2. No requiere migraciones ni actualizaciones manuales de saldos. No se realizaron operaciones en producción.

## Verificación

Pruebas unitarias: valores de 0,25/0,10/0,01, coma decimal, valores inválidos, recuperación sin duplicados y conservación de cantidades/totales.
Integración aislada: guardado de centavos en apertura inicial y pendiente, persistencia en cierre y rechazo de cantidades inválidas por la ruta de Cierre Diario.
TypeScript y build verificados. ESLint de las pantallas conserva los problemas previos (8 errores de tipos any en AperturaCaja y advertencias existentes); los archivos nuevos no agregan errores.

Resultado final: 320/320 pruebas de integración y 10/10 regresiones frontend aprobadas. PostgreSQL temporal detenido al finalizar. No se realizó prueba visual en navegador.
