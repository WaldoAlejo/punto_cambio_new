# Pruebas de integración con PostgreSQL local

Se preparó PostgreSQL 15 portátil porque este equipo no tenía Docker ni PostgreSQL y no existe una base de pruebas separada. No se instaló ningún servicio de Windows ni se copiaron datos de producción.

## Preparación y ejecución

Desde la raíz del repositorio, instalar el runtime separado (ya realizado en este equipo):

```powershell
npm install --prefix node_modules/.cache/pg-sandbox-runtime --no-audit --no-fund --ignore-scripts --save-exact embedded-postgres@15.18.0-beta.17
node --import tsx scripts/tests/integration-local.mjs
```

El paquete portátil proviene de [embedded-postgres](https://github.com/leinelissen/embedded-postgres). El lanzador usa directamente sus binarios Windows `initdb.exe` y `pg_ctl.exe`, con procesos ocultos; no ejecuta los scripts de instalación. Las dependencias principales y su lockfile permanecen sin cambios.

Cada ejecución crea un directorio nuevo `%TEMP%/pc-integration-*`, inicializa un clúster con contraseña aleatoria y escucha exclusivamente en `127.0.0.1:55439`. Crea `punto_cambio_test` solo después de comprobar que `data_directory` corresponde al clúster recién iniciado. Si el puerto está ocupado, el inicio falla; no se reutiliza una base existente.

El esquema se construye desde `prisma/schema.prisma` mediante SQL generado desde vacío. Esto no prueba la cadena de migraciones de una base histórica. El script ejecuta rutas reales de autenticación, apertura, cambios y cierre en una instancia Express local con puerto dinámico; no arranca `server/index.ts` ni las integraciones de proveedores. Por tanto, tampoco certifica la configuración HTTP completa de producción.

Se descartan las variables heredadas de conexión antes de importar las rutas y se usa un directorio de trabajo nuevo sin `.env`. Los usuarios, puntos, monedas y saldos son ficticios. Al finalizar se cierra Express y se detiene PostgreSQL; los archivos temporales y `results.json` quedan para inspección. No ejecutar el script E2E antiguo contra la conexión habitual del proyecto.

## Resultado inicial reproducido, antes de corregir autenticación

Ejecución inicial: 8 comprobaciones aprobadas y 1 fallida, con código de salida 1. Evidencia anterior al cambio en `INTEGRACION_LOCAL_RESULTADOS.json`. El resultado posterior aparece al final de este documento.

| Caso | Resultado |
| --- | --- |
| Login ficticio | Aprobado |
| Jornada de 19:30 GYE reconocida por autenticación | **Fallido** |
| Cambio bloqueado sin apertura | Aprobado |
| Inicio de apertura | Aprobado |
| Confirmación bloqueada sin conteos obligatorios | Aprobado |
| Conteos USD y EUR, confirmación ABIERTA | Aprobado |
| Compra de 100 EUR por 110 USD | Aprobado: efectivo USD 1000 → 890; EUR 1000 → 1100; bancos permanecen en 25 por moneda |
| Repetición con la misma clave de idempotencia | Aprobado: un solo cambio registrado |
| Cierre con conteo exacto | Aprobado: saldos conservados, jornada COMPLETADO y usuario sin punto asignado |

Durante el reintento Prisma registra una violación de clave única que el middleware captura para devolver la respuesta existente. El caso de idempotencia aprobó; ese mensaje no es el fallo de la suite.

## Fallo de autenticación por fecha

La prueba usa `TZ=America/Guayaquil`, igual que la configuración PM2 del repositorio. Una jornada del 13 de septiembre a las 19:30 de Ecuador se guarda mediante Prisma como `2026-09-14T00:30:00.000Z`.

En `server/middleware/auth.ts`, la consulta con `pg` recibe límites como objetos JavaScript `Date`. Aunque la utilidad calcula correctamente el rango UTC 05:00 → 05:00, el controlador `pg` serializa los parámetros con hora local; al compararlos con la columna `timestamp without time zone`, el rango utilizado pasa a 00:00 → 00:00.

Evidencia obtenida en PostgreSQL real:

- Rango UTC esperado: `2026-09-13T05:00:00.000Z` → `2026-09-14T05:00:00.000Z`.
- Parámetros interpretados como timestamp: `2026-09-13 00:00:00` → `2026-09-14 00:00:00`.
- Consulta con parámetros `Date`: 0 jornadas.
- Misma consulta con límites expresados en texto UTC: 1 jornada.
- `/auth/verify` responde con `punto_atencion_id: null` pese a existir jornada activa del mismo día de Ecuador.

En el diagnóstico inicial no se modificó el backend ni las fechas almacenadas. La prueba local demuestra el defecto con el esquema actual; falta contrastar el esquema y la configuración efectivos de producción antes de atribuirle incidentes reales.

Continúan pendientes: pruebas de frontend contra estas rutas reales, aperturas con incidencia, cierres parciales/con diferencias, transferencias, concurrencia y compatibilidad con migraciones históricas. No se ha realizado ningún despliegue.

## Corrección local de autenticación y resultado posterior

Se cambió únicamente la serialización de los límites de la consulta de jornadas en `server/middleware/auth.ts`: se envían `hoy.toISOString()` y `manana.toISOString()` en lugar de objetos `Date`. La consulta continúa parametrizada y mantiene los filtros de usuario y estados. No cambia la utilidad de calendario, las fechas almacenadas, el esquema ni otras conexiones de la aplicación.

Con el esquema Prisma actual (`timestamp without time zone` con valores UTC), esto evita que `pg` convierta los parámetros al reloj local del proceso antes de compararlos.

Validación posterior: **16 de 16 comprobaciones aprobadas, código de salida 0**. Evidencia: [Resultados después de corregir autenticación](INTEGRACION_LOCAL_AUTH_CORREGIDA.json).

- La regresión de las 19:30 GYE ahora pasa.
- Se excluye el milisegundo anterior al día; se incluye la medianoche inicial.
- Se incluye el último milisegundo del día; se excluye la medianoche siguiente.
- ALMUERZO conserva el punto; COMPLETADO y CANCELADO no habilitan el punto en la petición.
- Se comprueba que la autenticación no modifica ni la asignación persistida del usuario ni la fecha de la jornada.
- El flujo de apertura, compra, idempotencia y cierre sigue pasando.
- TypeScript backend y ESLint de `server/middleware/auth.ts`: correctos; `git diff --check`: correcto.

La sección `diagnostics` del resultado conserva la consulta con parámetros `Date` como control negativo: devuelve 0, mientras los límites UTC devuelven 1. Esto es intencional; las peticiones HTTP ejecutan el middleware corregido y pasan.

El PostgreSQL temporal y Express se detuvieron al finalizar. No se desplegó la corrección ni se ejecutó ninguna consulta contra producción. Se mantiene pendiente contrastar el tipo real de columna de producción antes del despliegue y completar los escenarios adicionales descritos arriba.

## Ampliación: incidencia de apertura y diferencias de cierre

El mismo comando de integración ahora ejecuta 26 comprobaciones. Los casos nuevos utilizan dos puntos ficticios independientes para cierre CERRADO y PARCIAL, con faltante de 100 USD y sobrante de 10 EUR. Comprueban bloqueo sin incidencia, apertura con incidencia pendiente de aprobación conservando saldos, rechazo sin `allowMismatch`, rechazo de desglose inconsistente incluso con ese indicador y persistencia del cierre válido.

Antes de corregir, la petición con total 900 y billetes 950 se aceptaba: [resultado previo](INTEGRACION_LOCAL_DESGLOSE_ANTES.json). La validación del desglose se separó de la tolerancia contable. Después, los rechazos mantienen saldos, cuadre/detalles, movimientos, jornada y usuario sin cambios; el cierre definitivo genera ajustes -100 USD y +10 EUR, mientras el parcial conserva los saldos y no genera ajustes. Ambos completan la jornada y liberan al usuario según las reglas existentes. [Resultado: 26 aprobadas](INTEGRACION_LOCAL_CAJA_CORREGIDA.json).

TypeScript backend y ESLint de la ruta correctos. No se probaron diferencias bancarias ni operaciones simultáneas. Se detuvieron los servicios temporales y no se accedió a producción.

## Ampliación: transferencias y permisos de origen

El lanzador monta también las rutas reales `/transfers` y `/transfer-approvals`. Crea dos operadores con jornadas, aperturas por API y saldos ficticios de 1000 por moneda y 25 en bancos. Prueba envío de 100 USD en efectivo, idempotencia de creación, permisos de recepción, aceptación, rechazo y repetición secuencial. Comprueba efectivo, desglose, bancos y movimientos con signos opuestos. Añade rechazo de origen ajeno/omitido para operador, origen ajeno para concesión y conservación del acceso administrativo con punto principal.

La prueba de origen ajeno falló antes de la corrección: [resultado previo](INTEGRACION_LOCAL_TRANSFER_ANTES.json). Tras validar el origen contra el punto asignado, **37 pruebas pasan**: [resultado posterior](INTEGRACION_LOCAL_TRANSFER_CORREGIDA.json). TypeScript correcto; ESLint del controlador sin errores, con tres advertencias previas. PostgreSQL y Express detenidos.

Alcance: EFECTIVO con billetes y operaciones secuenciales. No incluye concurrencia, monedas físicas en el envío, BANCO/MIXTO, cancelación desde origen ni aprobaciones históricas PENDIENTE. Los permisos administrativos se prueban cambiando el rol del usuario ficticio en la base local; el middleware consulta ese rol en cada solicitud.

## Ampliación: resolución simultánea de una transferencia

Suite actual: **41 comprobaciones aprobadas**. Se añaden accept/accept, reject/reject, accept/reject y accept/cancel. Una conexión local mantiene un bloqueo de fila y la prueba consulta `pg_stat_activity` hasta observar las dos solicitudes esperando, con límite de 10 segundos. Después libera el bloqueo y exige un único éxito y un 409, saldos correctos y dos movimientos con suma cero. La conexión de bloqueo se revierte y cierra incluso si falla la prueba.

Antes: dos aceptaciones respondieron 200 ([evidencia](INTEGRACION_LOCAL_CONCURRENCIA_ANTES.json)). Después: las cuatro carreras pasan ([evidencia](INTEGRACION_LOCAL_CONCURRENCIA_CORREGIDA.json)). El helper de estado se ejecuta dentro de la misma transacción que los movimientos; el fallo de la escritura condicionada aborta la solicitud perdedora. TypeScript correcto y ESLint sin errores (cuatro advertencias previas). Entorno temporal detenido, sin producción.

Pendiente: envíos simultáneos o resoluciones de transferencias diferentes que comparten un saldo. Estas pruebas protegen contra la resolución duplicada de una misma transferencia, no certifican la concurrencia de todo el libro contable.

## Ampliación: competencia por saldo entre transferencias distintas

Suite actual: **47 pruebas aprobadas**. Se añaden dos envíos con fondos suficientes, dos con fondos que alcanzan para uno, dos aceptaciones, dos rechazos, dos cancelaciones y dos primeras recepciones sin Saldo existente. Se usa una barrera de bloqueo de fila (o consultivo en el caso sin fila) y se espera observar dos transacciones bloqueadas antes de liberarla.

Antes se perdía uno de los descuentos de 10: [resultado previo](INTEGRACION_LOCAL_SALDO_CONCURRENTE_ANTES.json). La corrección coordina el acceso por punto/moneda dentro de las transacciones existentes; la solicitud sin fondos responde 400 y no persiste transferencia ni movimiento. [Resultado posterior](INTEGRACION_LOCAL_SALDO_CONCURRENTE_CORREGIDO.json). TypeScript correcto, ESLint sin errores y cuatro advertencias previas. Servicios temporales detenidos.

El bloqueo consultivo también evita la carrera al crear el primer saldo. La prueba de primera recepción comprueba una fila de saldo por 20 y movimientos consecutivos 0→10→20. Quedan fuera la interacción concurrente con otros módulos, BANCO/MIXTO y pruebas de carga; no se modificó producción.
