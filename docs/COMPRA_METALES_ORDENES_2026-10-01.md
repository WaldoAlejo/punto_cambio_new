# Compra de oro y plata: orden de trabajo «Evaluación de oro»

Fecha: 2026-10-01. Implementado en el repositorio. Pendiente de aplicar en producción.

Implementa el formato «Orden de trabajo – Evaluación de oro» entregado por Punto Cambio. Decisiones de la empresa:

- La firma se hace en papel y se registra con una foto.
- La orden es **obligatoria** para toda compra.
- Una orden admite varias joyas.
- La numeración es global por año: `OE-2026-000001`.

## Flujo

| Estado | Qué ocurre | Quién |
|---|---|---|
| **PENDIENTE_AUTORIZACION** | Se registran el cliente (nombre, C.I., teléfono, dirección, procedencia), las joyas (tipo, descripción, piezas, peso recibido, color, estado de conservación, piedras) la **foto antes** (obligatoria) y los **procesos a realizar** (sección 4), que el cliente autoriza al firmar. Se genera el Nº de orden. Se imprime la orden para firmar. | Operador del punto |
| **AUTORIZADA** | Se sube la **foto de la orden firmada** por el cliente y el responsable. Recién entonces se habilitan las pruebas. | Operador del punto |
| **EVALUADA** | Para cada joya: metal, método, lista de reconocimiento de 8 pasos, **prueba de densidad** opcional, deducciones, peso final, precio por gramo y foto después (opcional). Incluye la confirmación de seguridad del ácido. Se calcula la **valoración / precio ofrecido**. **Solo se aceptan las pruebas autorizadas** en la orden firmada: si se registra ácido, piedra, densidad, XRF u otro proceso no marcado, la evaluación se rechaza y hay que devolver las joyas o abrir una orden nueva. Puede corregirse mientras siga evaluada. | Operador del punto |
| **COMPRADA** | El cliente acepta y se registra el pago: efectivo o transferencia, con caja, saldos y recibo como antes. El recibo muestra el Nº de orden. | Operador del punto |
| **DEVUELTA** | El cliente no acepta. Se registra el motivo, la confirmación de que las joyas fueron devueltas y una foto de constancia opcional. | Operador del punto |
| **ANULADA** | Solo antes de la firma (el cliente se retira). | Operador del punto |

- Las órdenes se pueden continuar entre operadores del **mismo punto**, por ejemplo en un cambio de turno.
- ADMIN y ADMINISTRATIVO consultan todas las órdenes; los operadores solo las de su punto.
- Cada cambio de estado deja un evento en `EventoCompraMetal`: `ORDEN_CREADA`, `ORDEN_AUTORIZADA`, `ORDEN_EVALUADA`, `ORDEN_DEVUELTA`, `ORDEN_ANULADA`.

## La compra depende de la orden

- `POST /api/metal-purchases` y `/preparar` ahora reciben **solo** `orden_id` y los datos de pago.
- El servidor toma de la orden el cliente, las joyas, la evaluación y la seguridad, recalcula con las mismas reglas y exige que el total coincida con la oferta guardada.
- Una orden se paga una sola vez: `CompraMetal.orden_id` es único y la orden pasa a COMPRADA en la misma transacción.
- Se mantienen la clave de idempotencia, el bloqueo de caja y apertura, el reverso y la recuperación de intentos inciertos.
- Las compras anteriores quedan con `orden_id` vacío.

## Prueba de densidad (peso específico)

- Cálculo: `densidad = peso en el aire ÷ (peso en el aire − peso sumergido)`.
- La tabla de referencia está en la guía, pestaña «Quilates y ácido».
- **Oro:**
  - La densidad limita la pureza que se puede pagar sin justificación: ≥18,5 → 999, ≥17 → 917, ≥16 → 833, ≥14,6 → 750, ≥13,8 → 667, ≥12,8 → 585, ≥11,9 → 500, ≥11 → 417.
  - Menos de 11 → no es oro.
- **Plata:** fuera del rango 9,8–11 → no es plata.
- En piezas de **menos de 5 g** la densidad es solo orientativa y no bloquea, porque el error de la balanza es alto. Tampoco sirve para piezas huecas o con piedras.

## Impresión

- «Ver / imprimir orden» reproduce el formato de la empresa en una hoja A4: logo, secciones 1–7, texto de autorización con nombre y C.I., casillas de procesos y fotos, resultado, valoración y recuadros de firma.
- El logo se recortó de la imagen del formato (`public/metal-guide/logo-punto-cambio.png`). Conviene reemplazarlo por el archivo original en alta resolución.
- El título dice «Evaluación de oro y plata», porque el módulo también compra plata.

## Esquema y archivos

- `OrdenEvaluacionMetal`, `JoyaOrdenEvaluacion` y la columna `CompraMetal.orden_id` (única, puede quedar vacía).
- SQL aditivo: `scripts/migrations/2026-10-01-metal-orders.sql`, generado con `prisma migrate diff` desde el esquema de `main`.
- Restricciones: `scripts/migrations/2026-10-01-metal-orders-checks.sql`.
- Ejecutor: `scripts/db/metal-orders-migration.mjs`. Se niega a reaplicarse; `--check` es de solo lectura.
- Servidor:
  - `server/utils/metalOrder.ts`: validaciones y armado de las líneas de compra.
  - `server/routes/metal-purchases.ts`: rutas `/ordenes`.
  - `server/utils/metalEvaluation.ts`: densidad.
- Pantalla:
  - `src/components/metals/MetalOrders.tsx`
  - `MetalOrderPrint.tsx`
  - `metalOrderTypes.ts`
  - `MetalPurchases.tsx`: pago desde la orden.
- Las fotos se comprimen en el navegador a JPEG antes de enviarse:
  - Joyas: hasta ~420 KB.
  - Orden firmada: hasta ~650 KB, con más resolución para que se lea.

## Pruebas

- `node --import tsx scripts/tests/integration-local.mjs`: **349 correctas, 0 fallos**. Cubren:
  - Numeración y reintento.
  - Firma obligatoria.
  - Evaluación completa, reglas y seguridad.
  - Permisos por punto y rol.
  - Anulación, devolución y cierre sin pago.
  - Restricciones SQL.
  - Pago desde la orden (doble confirmación, conflicto, orden ya pagada, caja insuficiente, concurrencia, transferencia, reverso, fallo de recibo con la orden intacta, almuerzo, moneda pendiente, cierre de jornada).
  - Densidad.
- Navegador con usuario ficticio: orden con anillo de oro y cadena de plata → impresión en una hoja → autorización con foto → evaluación (densidad 15,50 → hasta 18K) → oferta de USD 616 → pago en efectivo → recibo con el Nº de orden → reimpresión con procesos, resultado y precio llenos.
- Ensayo de la migración sobre el esquema de `main`: 8 de 8 pasos correctos. Se aplica, se niega a reaplicarse, `--check` pasa y el esquema resultante coincide con Prisma.

## Despliegue en la VM

Hacerlo en una ventana sin operadores. **Después de desplegar, las compras directas sin orden ya no son posibles**: capacitar a los operadores en el nuevo flujo antes de abrir.

1. Actualizar el código:

```bash
git checkout main && git pull --ff-only && git log -1 --oneline
```

2. Respaldo verificado, como en el despliegue anterior. Debe terminar en `RESPALDO_OK`.
3. Migración:

```bash
node scripts/db/metal-orders-migration.mjs --env-file .env.production --execute
node scripts/db/metal-orders-migration.mjs --env-file .env.production --check
```

4. Compilar y reiniciar:

```bash
pm2 stop punto-cambio-api
npm ci
npm run build
pm2 startOrRestart ecosystem.config.cjs --only punto-cambio-api --update-env
curl --retry 5 --retry-connrefused --retry-delay 2 -fsS http://127.0.0.1:3001/health
pm2 save
```

La migración debe aplicarse **antes** de iniciar el backend nuevo, porque este lee las tablas de órdenes.
