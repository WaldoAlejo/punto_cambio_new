# Compra de oro y plata: implementación y despliegue

Fecha: 2026-09-14. Implementado en el repositorio; no aplicado a producción por el agente.

## Funcionalidad entregada

- Menú «Compra de oro y plata». Operadores compran en su punto actual; ADMIN/SUPER_USUARIO habilitan puntos, consultan y registran reversos. ADMINISTRATIVO consulta. No se deducen puntos propios a partir de `es_principal` ni se habilitan concesionarios automáticamente.
- Vendedor: nombre, documento, teléfono y procedencia declarada. Hasta 20 líneas por compra, una pieza/sobre o grupo homogéneo por línea; oro/plata, descripción, número de piezas, pureza declarada y evaluada, método y observaciones. Fotos JPG/PNG opcionales de hasta 200 KB por imagen.
- Peso bruto y deducciones hasta 0,001 g; precio negociado por gramo hasta seis decimales. Pureza en milésimas y equivalencia orientativa de quilates para oro. El evaluador y la fecha de registro quedan identificados por operador/fecha de la compra. No se certifica el ensayo físico.
- Cálculo decimal en servidor, precisión de 40 dígitos, redondeo HALF_UP por línea a centavos. `total = suma(redondear((bruto − deducciones) × precio/g, 2))`. Los gramos finos son informativos; no se descuenta nuevamente la pureza. No hay tarifa mínima ni máximo comercial; únicamente límites de representación de datos.
- Moneda de pago entre las monedas activas, USD por defecto. Efectivo por defecto, con billetes y monedas explícitos y suficientes. Transferencia exige banco y referencia declarados; comprobante opcional. La aplicación registra un pago externo, no ejecuta transferencias.
- Historial paginado y filtros por fecha GYE, punto y nombre de operador; totales por moneda, medio y estado; piezas/gramos por metal y pureza de compras vigentes. Las compras reversadas conservan sus importes y aparecen separadas.
- Recibo interno con ubicación inicial y código de sobre por línea; impresión/reimpresión desde el registro guardado. No es comprobante fiscal autorizado. Las reglas tributarias y el documento fiscal de la empresa no se automatizan aquí.

## Integración de caja y apertura

Se usan `Saldo` y `MovimientoSaldo`, como en divisas. Los movimientos tienen tipo `EGRESO`/`INGRESO` y referencias `COMPRA_METAL`/`COMPRA_METAL_REVERSO`; por ello los reportes actuales reconocen los egresos e ingresos. La descripción diferencia `(CAJA)` y `(BANCOS) - NO afecta cuadre físico`, compatible con la conciliación física existente.

Efectivo descuenta únicamente cantidad, billetes y monedas físicas; transferencia descuenta únicamente bancos. El registro bancario puede quedar negativo y no representa fondos disponibles de una cuenta. Una transferencia no exige disponibilidad de caja.

Se exige jornada ACTIVO del día (fuera de almuerzo), punto asignado, punto habilitado y apertura ABIERTA con sus requisitos obligatorios cumplidos. El efectivo exige también el conteo de su moneda en aperturas por etapas. Los bloqueos de saldo son los mismos que usan divisas y transferencias. Tras obtenerlos se revisan otra vez jornada y apertura; se protege la jornada frente a un cierre concurrente.

Compra, líneas/piezas, pago, evento, egreso y recibo se guardan en una sola transacción. Fallar al guardar el recibo revierte todo. La clave de operación es obligatoria y persistente, única por usuario: reintentar devuelve la compra existente; cambiar el contenido con una clave confirmada da conflicto. La protección no depende de la caducidad del middleware general de idempotencia.

## Recuperación de intentos

Antes de confirmar, el navegador conserva temporalmente la solicitud exacta y su clave en `sessionStorage`, separadas por usuario y punto. Una respuesta incierta muestra «Consultar resultado antes de corregir» y «Confirmar / recuperar compra». El servidor consulta bajo el mismo bloqueo del intento. Si no existe compra y se corrigen los datos, se conserva la clave para impedir que una solicitud antigua tardía cause un segundo pago. Al recuperar o confirmar una compra se limpia el intento.

Ese almacenamiento temporal puede contener datos del vendedor y fotos. Se elimina al resolver el intento; no se usa almacenamiento público de imágenes ni URLs públicas. Cerrar definitivamente la pestaña puede perder ese intento local: en ese caso se debe revisar el historial antes de volver a registrar. Los datos de solicitudes de metales se omiten de los logs de payload del cliente; las respuestas del módulo llevan `Cache-Control: no-store`.

## Reversos y límites expresos de esta versión

ADMIN/SUPER_USUARIO pueden registrar devolución y recuperación íntegra durante la jornada original todavía abierta. Se exigen motivo, identificación/constancia de devolución de piezas y evidencia del dinero realmente recuperado. El efectivo recuperado lleva su propio desglose, que puede ser distinto del entregado. Un reverso bancario acredita bancos, sin tocar caja. Reintentar el reverso nunca acredita dos veces.

Una jornada ya cerrada no se reescribe. Los reversos posteriores al cierre requieren un flujo adicional definido con contabilidad; no están habilitados. No se ofrecen edición ni eliminación de compras pagadas.

No hay borradores persistidos para ensayos inconclusos: se bloquea la confirmación; el formulario sin enviar permanece solo mientras la pantalla está abierta. No hay pagos mixtos/parciales, ventas, traslados, fundición, inventario de movimientos posteriores, cotizaciones automáticas, integración bancaria ni cálculo de utilidad. La recepción inicial y su costo quedan registrados en cada línea. El precio promedio ponderado puede obtenerse de las compras, pero esta versión no añade un informe específico de precios medios.

## Esquema y archivos

Cuatro tablas nuevas: `ConfiguracionCompraMetal`, `CompraMetal`, `DetalleCompraMetal`, `EventoCompraMetal`. Pago y vendedor son campos de la cabecera inmutable; cada detalle identifica un sobre recibido. Se reutiliza `Recibo` con tipo MOVIMIENTO. No se añaden columnas escalares a modelos anteriores ni se convierten gramos en `Moneda`.

- API: `server/routes/metal-purchases.ts`.
- Validación/cálculo: `server/utils/metalPurchase.ts`.
- Pantalla: `src/components/metals/MetalPurchases.tsx`.
- SQL aditivo: `scripts/migrations/2026-09-14-metal-purchases.sql` y `2026-09-14-metal-purchases-checks.sql`.
- Ejecutor transaccional: `scripts/db/metal-purchases-migration.mjs`.

El ejecutor no carga `.env` automáticamente. Sin opciones solo muestra una simulación sin conectarse. `--execute` exige archivo de entorno explícito y aplica ambos SQL dentro de BEGIN/COMMIT, con tiempos máximos de espera. Si ya existen tablas del módulo, se detiene sin reaplicar. `--check` consulta en transacción de solo lectura la presencia de cuatro tablas, dos restricciones y el número de puntos habilitados; no reemplaza una auditoría completa de todas las definiciones SQL.

## Pruebas locales

La suite `scripts/tests/integration-local.mjs` crea PostgreSQL temporal con credenciales aleatorias y nunca carga `.env` ni usa producción. Ejecuta los flujos anteriores de divisas, transferencias, apertura y cierre, más `scripts/tests/metal-purchases-integration.mjs`.

Cobertura nueva: oro/plata, cálculo sin doble pureza, gramos/precios precisos, redondeo por línea, valores inválidos, ensayo inconcluso, esquema migrado equivalente a Prisma, configuración/permisos, apertura pendiente, moneda no contada, insuficiencia de caja, solicitudes iguales y distintas concurrentes, transferencia con caja cero/bancos negativos, recuperación de intento, fallo de recibo con rollback, reportes/conciliación y reversos con evidencia/concurrencia/cierre.

Resultado final: **303 pruebas de integración correctas, cero fallos**, en `INTEGRACION_LOCAL_METALES_2026-09-14.json`. También pasan las 12 regresiones frontend/autenticación previas, TypeScript de frontend/backend, ESLint del módulo y las compilaciones aisladas. La revisión previa del formulario valida también el desglose con Decimal en servidor, sin crear registros.

Piloto con navegador real, servidor local y usuarios ficticios:

1. Oro: 10,125 g brutos menos 0,125 g de deducciones, ley 750, USD 60/g → USD 600. Pago en efectivo, recibo y PDF.
2. Cambio transferencia → efectivo → transferencia limpió banco y referencia.
3. Administrador registró reverso de esa compra con evidencia; recibo indicó REVERSADA.
4. Plata: 10 g, ley 925, USD 5/g → USD 50. Transferencia con banco y referencia; recibo indicó 9,25 g finos estimados.
5. Simulación de respuesta perdida de la compra de plata; recarga y recuperación devolvieron el mismo recibo, manteniendo dos compras totales y eliminando el intento pendiente.

Evidencia ficticia: `PRUEBA_METALES_RECIBO_LOCAL.png`, `PRUEBA_METALES_RECIBO_LOCAL.pdf`, `PRUEBA_METALES_TRANSFERENCIA_LOCAL.png`. PostgreSQL temporal y navegadores se detuvieron al finalizar. Las compilaciones de `node_modules/.cache/frontend-check` usan API local y **no deben desplegarse**.

## Despliegue en la VM AWS (pendiente)

El usuario realiza el push y ejecuta estos pasos en `/home/ubuntu/punto_cambio_new`, durante una ventana sin operadores. No usar `npm run deploy`, `prisma db push` ni `migrate dev` para este cambio: el script general de deploy sincroniza todo el esquema y no es el procedimiento aditivo de esta entrega.

1. Actualizar el checkout después del push y confirmar el commit. Conservar `.env.production` local. Verificar un respaldo nuevo de archivos y base antes de detener PM2; el respaldo anterior de apertura no sustituye un respaldo posterior a nuevas operaciones.

```bash
git pull --ff-only
git log -1 --oneline
git status --short
umask 077
metales_respaldo=$(mktemp -d /home/ubuntu/pc-metales-XXXXXXXX)
cp -a dist dist-server ecosystem.config.cjs .env.production "$metales_respaldo/"
git rev-parse HEAD > "$metales_respaldo/commit-candidato.txt"
printf 'Respaldo de archivos: %s\n' "$metales_respaldo"
```

Generar además un `pg_dump` completo con el cliente PostgreSQL 18 ya instalado, usando la conexión del archivo de entorno sin imprimirla. Verificarlo con `pg_restore --exit-on-error --file=/dev/null RUTA_DEL_DUMP`. Conservar la ruta exacta del respaldo. No avanzar si falla la copia o la lectura del dump.

2. Simular el procedimiento y detener el proceso durante la actualización. Ejecutar cada comando solo si el anterior terminó correctamente.

```bash
node scripts/db/metal-purchases-migration.mjs
pm2 stop punto-cambio-api
npm run build
```

No se añadieron dependencias. Si el checkout contiene otros cambios de dependencias aún no instalados, sincronizar con `npm ci` antes del build, dentro de la misma ventana. El build usa la configuración de producción de la VM, no los artefactos de prueba local.

3. Aplicar las tablas y validaciones nuevas una sola vez; verificar el resultado.

```bash
node scripts/db/metal-purchases-migration.mjs --env-file .env.production --execute
node scripts/db/metal-purchases-migration.mjs --env-file .env.production --check
```

Primera ejecución esperada: cuatro tablas, dos restricciones, cero puntos habilitados. Si falla, el ejecutor revierte la transacción y hay que revisar la causa antes de iniciar el backend nuevo.

4. Levantar y comprobar proceso y acceso público.

```bash
pm2 startOrRestart ecosystem.config.cjs --only punto-cambio-api --update-env
pm2 status
curl --retry 5 --retry-connrefused --retry-delay 2 --max-time 10 --fail -sS http://127.0.0.1:3001/health
curl --max-time 15 --fail -sS -I https://puntocambio.ddns.net/
curl --max-time 15 --fail -sS https://puntocambio.ddns.net/health
pm2 logs punto-cambio-api --lines 50 --nostream
```

No compartir logs que contengan datos privados. Health confirma servicio HTTP, no una compra completa. Tras verificar estabilidad, `pm2 save` guarda la lista de procesos.

5. Un administrador entra a «Compra de oro y plata» y habilita únicamente los puntos directos acordados con el CEO, registrando el motivo. Revisar que otros puntos sigan deshabilitados. El primer uso del operador debe seguir selección de punto → jornada → apertura/conteos → compra real documentada. No crear compras ficticias en producción para probar el botón.

## Retorno de versión

Ante un problema, deshabilitar compras de metales y detener PM2 antes de restaurar los artefactos anteriores verificados. Conservar las nuevas tablas y cualquier compra ya registrada. No restaurar un dump sobre producción ni borrar transacciones como forma de revertir código. El esquema nuevo es aditivo y los flujos anteriores no dependen de estas tablas. Una compra real ya pagada requiere su trazabilidad y, si corresponde, reverso documentado.
