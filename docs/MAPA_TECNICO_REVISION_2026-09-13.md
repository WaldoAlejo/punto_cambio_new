# Punto Cambio: mapa técnico y diagnóstico inicial

Fecha de revisión: 2026-09-13. Revisión del código local, esquema Prisma y configuración de ejecución. No se modificó código de la aplicación ni información de la base de datos. Este documento no certifica una auditoría exhaustiva ni pruebas funcionales completas.

## Arquitectura y navegación

React/Vite/TypeScript → servicios HTTP Axios → API Express `/api` → PostgreSQL mediante Prisma y `pg`. El esquema local declara 35 modelos; no se pudo contrastar con las tablas desplegadas.

- `src/App.tsx`, `src/hooks/useAuth.tsx` y `src/pages/Index.tsx`: autenticación, recuperación de sesión y selección del punto.
- `src/components/dashboard/Dashboard.tsx`: selección de módulos y carga diferida de pantallas. Gran parte de la aplicación está en componentes, no en `src/pages`.
- `src/services/axiosInstance.ts`: añade JWT, normaliza errores y limpia sesión ante respuestas 401.
- `server/index.ts`: registra rutas, middleware HTTP y arranque.
- `server/middleware/auth.ts`: verifica JWT y usuario activo consultando PostgreSQL con `pg`; para operadores comprueba jornada del día y elimina el punto de la petición si falta jornada. Las rutas aplican controles de rol adicionales.
- Roles del código: OPERADOR, ADMINISTRATIVO, CONCESION, ADMIN y SUPER_USUARIO.

## Módulos y recorrido de los datos

| Módulo | Funcionamiento y archivos relevantes |
| --- | --- |
| Jornada y punto | Selección del punto, inicio, almuerzo, regreso y salida. `server/routes/schedules.ts`, `spontaneous-exits.ts`, `permissions.ts`; componentes `timeTracking`. Jornada, asignación del usuario y punto seleccionado en navegador son estados distintos que deben concordar. |
| Apertura | Verificación de conteo, diferencias y estado de apertura. `server/routes/apertura-caja.ts`, `inicio-jornada-validado.ts`, `admin-aperturas.ts`; `src/services/aperturaCajaService.ts`. Existen rutas alternativas: seguir la llamada real de la pantalla al diagnosticar. |
| Cambios de divisas | Compra/venta, tasas por billetes/monedas, efectivo/bancos, operaciones pendientes, abonos y anulaciones. `server/routes/exchanges.ts` y `server/services/exchange/*`; modelos `CambioDivisa`, `Saldo`, `MovimientoSaldo`. |
| Transferencias | El controlador actual crea EN_TRANSITO y descuenta del origen en una transacción. La aceptación en destino completa la transferencia y registra la entrada. Coexisten rutas de aprobación y rechazo. `server/controllers/transferController.ts`, `server/routes/transfer-approvals.ts`. |
| Saldos y contabilidad | `Saldo` mantiene efectivo (`cantidad`), billetes, monedas físicas y bancos por punto/moneda. `MovimientoSaldo` registra montos con signo y referencias; `SaldoInicial`, `AsignacionSaldo` e `HistorialSaldo` aportan bases e historial. Servicios principales: `movimientoSaldoService.ts`, `saldoCalculationService.ts`, `saldoReconciliationService.ts`. |
| Cierre | La UI llama `/guardar-cierre` mediante `src/services/cuatreCajaService.ts`. Guarda cabecera/detalles, y en cierre definitivo actualiza `Saldo` con el conteo e incorpora ajustes por diferencia. Tanto cierre parcial como definitivo finalizan jornada activa y liberan la asignación del usuario en esa ruta. |
| Servicios externos | Movimientos, saldos, asignaciones y cierres por servicio/punto, con efectos en caja según operación. `server/routes/servicios-externos.ts`; modelos `ServicioExterno*`. |
| Servientrega | Integración externa y persistencia de guías, remitentes, destinatarios, cupos/saldos y anulaciones. `servientregaAPIService.ts`, `servientregaDBService.ts` y rutas correspondientes. No se invocó el proveedor. |
| Administración/reportes | Usuarios, puntos, monedas, comportamiento de tasas, jornadas, cierres, contabilidad e históricos. Hay endpoints específicos para cada familia de reportes. |

## Reglas clave para investigar inconsistencias

- Diferenciar efectivo de bancos. No comparar un total combinado con el conteo físico de caja.
- Comparar `Saldo` con saldo inicial más movimientos usando el mismo punto, moneda, período y criterio de caja/bancos.
- El cálculo histórico de caja aún identifica movimientos bancarios por texto en `descripcion`; revisar etiquetas y movimientos heredados cuando haya diferencias.
- Seguir referencia e importe con signo: ingresos positivos, egresos negativos; revisar también anulaciones, devoluciones y ajustes de cierre.
- Separar transferencia en tránsito de transferencia aceptada: el dinero ya puede haber salido del origen sin haber ingresado al destino.
- Los cierres definitivos tienen efecto contable; no son solamente un reporte del día.
- Para jornadas y reportes se usan utilidades de `server/utils/timezone.ts` con día de Guayaquil y límites UTC. Verificar el criterio de cada ruta al estudiar fechas.
- Hay middleware de idempotencia en operaciones principales, pero solo actúa si la petición incluye la clave correspondiente. Una transacción por sí sola no demuestra protección completa contra concurrencia.
- Existen implementaciones alternativas y comentarios históricos. Por ejemplo, `cierreUnificadoService.ts` no apareció importado por otros archivos en la búsqueda realizada, mientras la UI sí llama a `guardar-cierre.ts`.

## Acceso a PostgreSQL: no disponible desde esta sesión

Se intentó conectar usando las configuraciones existentes, con modo de transacción de solo lectura y límites de tiempo. Se repitió la prueba fuera de las restricciones de red con el mismo resultado.

| Configuración | Resultado | Alcance de la conclusión |
| --- | --- | --- |
| `.env` | `ENOTFOUND` en destino remoto | No se pudo resolver el nombre configurado. No se llegó a autenticar. Puede requerir corrección del host o acceso a la red/DNS correspondiente. |
| `.env.production` | `ECONNREFUSED` en destino local | El destino local rechazó la conexión. No confirma que la base de producción esté caída: esta configuración puede estar pensada para ejecutarse dentro del servidor. |

No se pudo ejecutar una consulta ni verificar credenciales, registros, permisos efectivos o migraciones aplicadas. Falta identificar el acceso correcto desde este equipo (conexión directa, VPN, túnel SSH o ejecución en servidor). No se incluyen secretos en este informe.

## Verificación técnica realizada

Se ejecutó TypeScript local sin emitir archivos ni regenerar Prisma:

```text
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --incremental false --composite false
node node_modules/typescript/bin/tsc -p tsconfig.server.json --noEmit --incremental false --composite false
```

- Backend: terminó correctamente usando el cliente Prisma instalado. No demuestra conexión ni compatibilidad con la base desplegada.
- Frontend: terminó con errores. Incluye incompatibilidades de tipos en jornadas, apertura, cierres, respuestas de servicios y cabeceras Axios, además de referencias no definidas.
- `src/components/admin/CierresAdminMejorado.tsx:507`: utiliza `AlertTitle` sin importarlo; afecta la rama que muestra puntos sin cierre.
- `src/hooks/useExchangeData.ts:81`: `reload` llama `loadExchanges`, pero la función está declarada dentro del efecto y queda fuera de su alcance.
- `src/components/admin/CierresDiariosResumen.tsx:490`: pasa directamente al evento de clic una función que recibe una fecha opcional; el manejador recibe un evento en lugar de una fecha.
- Configuración de arranque inconsistente: `package.json` usa `server-dist/index.js` en `start:server`, mientras PM2, Docker y la verificación de build apuntan a `dist-server/server/index.js`.

No se ejecutaron flujos de negocio, migraciones, seeds, scripts de reparación ni conciliaciones. No se hizo un build de producción ni una revisión visual del navegador. Los errores estáticos anteriores están confirmados en el código; su relación con los incidentes reportados requiere conocer los casos concretos.

## Datos mínimos para continuar con incidentes

Para cada caso: pantalla/operación, punto, fecha de Ecuador, moneda, resultado esperado y observado; si existe, número de recibo o identificador de transferencia/cierre. Con acceso de lectura, cruzar primero operación → movimientos → saldo → apertura/cierre; cualquier corrección debe derivarse de ese diagnóstico.

## Seguimiento: correcciones locales del frontend

Posteriormente, por solicitud del usuario, se corrigieron los errores de TypeScript detectados en el frontend. Esta sección actualiza el estado del diagnóstico anterior; los cambios aún no están desplegados.

- Corregidos el import de `AlertTitle`, el alcance de `loadExchanges` y el manejador de clic de Reintentar.
- Alineados los contratos de jornadas, cuadre, apertura, balance, cambios parciales y tarifas con los campos consumidos y devueltos por la API. `DailyClose` reutiliza el contrato del servicio de cuadre.
- Conservadas las validaciones e importes del cierre. Los totales de operaciones admiten los dos formatos existentes: número o `{ cantidad }`.
- El servicio de apertura ahora devuelve a la pantalla `con_diferencia`, que el backend ya enviaba y la pantalla consultaba.
- Cabeceras HTTP gestionadas mediante los métodos de `AxiosHeaders`; normalización de campos opcionales de entrega y de punto.
- Exportación: se conservan números, signos, fechas y booleanos; los objetos/arrays del reporte se convierten a texto JSON para su celda.
- El reporte de pre-cierre usa el nombre del punto seleccionado cuando corresponde al punto consultado; la respuesta de cuadre no contiene el campo `punto` que se intentaba leer.

Validación posterior:

| Comprobación | Resultado |
| --- | --- |
| TypeScript frontend, sin emitir | Correcto, sin errores. |
| `node --test scripts/tests/frontend-regressions.cjs` | 5 pruebas correctas: recarga con filtros, ausencia de punto, flags de apertura, datos de Excel y roles. Usan dependencias simuladas y no hacen peticiones reales. |
| ESLint comparado con HEAD en los 22 archivos modificados de `src` | Ningún error nuevo; permanece 1 error previo. No equivale a un lint limpio de toda la aplicación. |
| `git diff --check` | Correcto. |
| Vite build hacia directorio separado | Bloqueado antes de compilar: falta `node_modules/vite/dist/client/client.mjs`; el directorio local `dist/client` está vacío. |

No se modificaron backend, esquema, base de datos, dependencias ni configuración de despliegue. No se probó la interfaz en navegador. Antes de desplegar, restaurar las dependencias desde el lockfile en un entorno de prueba, completar el build y verificar manualmente recarga de cambios, Reintentar de cierres, apertura con/sin incidencia, conteos y exportación. Las pruebas aisladas no sustituyen esa validación integrada.

## Seguimiento: dependencias restauradas y compilación verificada

En el siguiente paso autorizado se restauró `node_modules` con `npm ci --ignore-scripts --no-audit --no-fund`, utilizando una caché temporal. Se mantuvieron `package.json`, `package-lock.json` y las versiones fijadas por el lockfile. La instalación agregó 695 paquetes. Después se regeneró el cliente Prisma desde el esquema existente, sin migraciones ni consultas a PostgreSQL.

Resultados posteriores a la restauración:

- Build Vite en modo producción: correcto, 2735 módulos transformados. Se usó la configuración existente con `envDir: false`, API local explícita y salida separada en `node_modules/.cache/frontend-check`. Este artefacto es exclusivo para pruebas; no debe publicarse porque apunta a localhost.
- TypeScript frontend: correcto tras regenerar Prisma.
- TypeScript backend: correcto.
- Las 5 pruebas aisladas volvieron a pasar.
- Navegador Chrome con perfil temporal: carga del login e inicio con usuario ficticio correctos. API simulada local, sin proxy al backend real.
- Regresión de Reintentar: primera consulta de cierres devuelve un fallo simulado; al pulsar Reintentar, la segunda consulta responde correctamente. Se registraron exactamente dos consultas con la misma fecha `2026-09-12`; la pantalla mostró el punto ficticio sin cierre.
- Para abrir la sección de cierres fue necesario activar su botón mediante DOM porque los clics automatizados iniciales no cambiaron la vista. El clic en Reintentar sí se ejecutó con el controlador del navegador. Esto no constituye validación completa de la navegación ni de todas las pantallas.
- La fixture rechaza operaciones no previstas y limita las conexiones del navegador al mismo origen mediante CSP. Las respuestas 404 de endpoints administrativos no incluidos y el 503 preparado son parte de la simulación, no resultados de producción.
- Navegador y servidor local de prueba detenidos al terminar.

Reproducción local desde la raíz del repositorio:

```text
node scripts/tests/build-frontend-check.mjs
node --test scripts/tests/frontend-regressions.cjs
node scripts/tests/preview-frontend.cjs
```

Abrir `http://127.0.0.1:4173` en un perfil de prueba, ingresar valores ficticios en el login y abrir Resumen Cierres Diarios. La primera consulta falla a propósito; pulsar Reintentar debe mostrar el resumen. El estado de la simulación se consulta en `/__test/status`. Detener el servidor con Ctrl+C. Nunca utilizar credenciales reales en esta fixture.

Sigue pendiente la validación integrada de operaciones y caja con un backend y una base de prueba: las respuestas simuladas no certifican saldos, permisos del servidor ni escrituras reales. No se realizó despliegue ni se modificó información de producción.

## Seguimiento: pruebas contra PostgreSQL real aislado

Después de confirmar que no existía una base de pruebas, se preparó PostgreSQL 15 portátil local y un lanzador que crea un clúster temporal nuevo por ejecución. Se probaron rutas Express reales con datos ficticios, sin utilizar las conexiones de producción.

Resultado: **8 casos aprobados y 1 fallo reproducido de autenticación con una jornada de las 19:30 de Ecuador**. Apertura, compra en efectivo, reintento idempotente y cierre exacto aprobaron con una jornada de mañana. El backend todavía no se ha modificado y la suite termina con error por el caso nocturno. PostgreSQL y Express quedaron detenidos.

Detalles, alcance y reproducción: [Pruebas de integración local](PRUEBAS_INTEGRACION_LOCAL.md). Evidencia: [Resultados](INTEGRACION_LOCAL_RESULTADOS.json). No equivale a certificar todos los flujos ni la base desplegada.

## Seguimiento: autenticación de jornadas corregida localmente

Se corrigió la serialización de los límites de fecha en `server/middleware/auth.ts` usando texto ISO UTC en la consulta parametrizada. No se alteraron fechas almacenadas ni el esquema. La prueba de las 19:30 GYE pasó; se añadieron casos de medianoche, último milisegundo, jornadas fuera del día y estados ALMUERZO/COMPLETADO/CANCELADO.

Resultado posterior: **16 pruebas de integración aprobadas**, TypeScript backend y ESLint del middleware correctos. Apertura, compra, reintento idempotente y cierre continúan pasando. Evidencia: [Autenticación corregida](INTEGRACION_LOCAL_AUTH_CORREGIDA.json). Entorno temporal detenido, sin despliegue ni acceso a producción. El resultado anterior se conserva para comparar.
# Verificación de acceso a PostgreSQL — 2026-09-13

Se confirmó acceso a la base `punto_cambio` indicada por el usuario. Se consultaron únicamente metadatos dentro de una transacción `READ ONLY`, con tiempo máximo de consulta de 8 segundos; se terminó con `ROLLBACK` y se cerró la conexión. No se guardaron credenciales en el repositorio.

- PostgreSQL remoto: 18.6; zona horaria de la sesión: GMT.
- `public.Jornada.fecha_inicio` y `fecha_salida`: `timestamp without time zone`, precisión 3, coincidente con el tipo utilizado en las pruebas locales.
- Se confirmó la existencia de `Jornada.estado`, `Jornada.usuario_id`, `Usuario.rol` y `Usuario.punto_atencion_id`.
- Esto confirma el tipo de columna relevante para la corrección de autenticación. Sigue pendiente verificar la zona horaria efectiva del proceso backend desplegado y la convención de escritura de fechas; la zona de la sesión PostgreSQL no acredita la del proceso Node.js.
- No se consultaron registros de clientes ni operaciones, no se modificaron datos ni se desplegó código.

## Seguimiento: ruta de arranque del backend corregida

Se corrigió `start:server` en `package.json`: ahora ejecuta `node dist-server/server/index.js`. La ruta anterior, `server-dist/index.js`, no corresponde al artefacto generado por la configuración TypeScript actual. El comando queda alineado con PM2, Docker y la verificación de build existente.

Validación local: compilación completa del backend correcta, con salida aislada en `node_modules/.cache/server-entry-check` y archivo incremental separado. Se confirmó que genera `server/index.js`, que npm/PM2/Docker apuntan a la misma ruta relativa y que `node --check` acepta la sintaxis de la entrada compilada. `git diff --check` correcto. No se ejecutó el backend, no se cargaron sus variables de entorno ni se consultó PostgreSQL. Esta comprobación no certifica el arranque completo ni sus integraciones.

No se cambiaron dependencias ni el lockfile. Cambio local incluido en el siguiente commit de correcciones de caja; pendiente de despliegue.

## Seguimiento: aperturas con incidencia y cierres con diferencias

Se reprodujo un defecto en `/guardar-cierre`: `allowMismatch: true` omitía tanto la tolerancia frente al saldo esperado como la validación de que billetes más monedas sumen el conteo físico. Un cierre con conteo USD 900 y billetes 950 respondió 200. Se separaron ambas comprobaciones: permitir diferencias contables ya no permite un desglose inconsistente, tanto en cierre definitivo como parcial.

Suite ampliada: **26 comprobaciones aprobadas** en PostgreSQL temporal con datos ficticios. Se verificaron aperturas que exigen incidencia, apertura con incidencia pendiente de revisión sin alterar saldos, rechazos sin escrituras contables, faltante USD de 100 y sobrante EUR de 10. El cierre definitivo ajusta saldo y registra un movimiento por moneda; el parcial conserva saldos y no registra ajustes. Ambos finalizan jornada y liberan el punto, conforme al comportamiento actual.

TypeScript backend, ESLint de la ruta y revisión de espacios correctos. Evidencia anterior: [Fallo de desglose](INTEGRACION_LOCAL_DESGLOSE_ANTES.json). Evidencia posterior: [Caja corregida](INTEGRACION_LOCAL_CAJA_CORREGIDA.json). Entorno temporal detenido; sin consultas ni escrituras en producción. Pendientes: concurrencia, transferencias, diferencias bancarias y validación de las pantallas contra el backend aislado.

## Seguimiento: permisos de origen y flujo de transferencias en efectivo

Se reprodujo un fallo en `POST /transfers`: un OPERADOR con apertura válida podía enviar `origen_id` de otro punto y descontar su saldo; la petición devolvió 201. El controlador ahora exige que usuarios distintos de ADMIN/SUPER_USUARIO indiquen su punto asignado como origen. Para usuarios operativos también se rechaza el origen nulo u omitido. Los permisos administrativos existentes se conservan, incluido el requisito previo de usar el punto principal.

Resultado: **37 pruebas aprobadas** en PostgreSQL temporal. Transferencias EFECTIVO entre dos puntos ficticios: envío resta 100 solo al origen, reintento con la misma clave no duplica egreso, origen no puede aceptar/rechazar por destino, aceptación acredita destino y rechazo devuelve origen. Repetir secuencialmente aceptación/rechazo devuelve 400 sin duplicar movimientos. Se verifican bancos intactos, suma de billetes y monedas, dos movimientos de signos opuestos por transferencia resuelta y permisos de OPERADOR, CONCESION, ADMIN y SUPER_USUARIO.

Evidencia: [Antes](INTEGRACION_LOCAL_TRANSFER_ANTES.json), [después](INTEGRACION_LOCAL_TRANSFER_CORREGIDA.json). TypeScript backend correcto; ESLint del controlador: cero errores y tres advertencias preexistentes de variables/import sin uso. No se accedió a producción; servicios temporales detenidos.

Pendientes específicos: concurrencia de envíos/aceptaciones/rechazos/cancelaciones; conservación del desglose cuando hay monedas físicas; vías BANCO/MIXTO; cancelación desde origen y rutas históricas de aprobación PENDIENTE. La lectura detectó validaciones de estado previas a la transacción y tratamiento incompleto de BANCO/MIXTO, que requieren pruebas propias antes de corregir. Los 37 casos no certifican estos escenarios.

## Seguimiento: resolución concurrente de una transferencia

Se reprodujeron dos aceptaciones simultáneas de la misma transferencia con respuestas 200/200. Se añadió `claimTransferInTransit`: una escritura condicionada por `estado=EN_TRANSITO` dentro de la transacción obtiene el derecho a resolverla. Aceptación, rechazo y cancelación usan esta comprobación antes de afectar saldos. Si otra solicitud ya resolvió la transferencia, se revierte la transacción y se responde 409. Las comprobaciones previas de permisos y respuestas 400 a reintentos secuenciales se conservan.

**41 pruebas aprobadas**. Cuatro carreras controladas en PostgreSQL real: accept/accept, reject/reject, accept/reject y accept/cancel. La prueba mantiene bloqueada la fila y espera que ambas peticiones compitan por ella antes de liberar el bloqueo; no depende únicamente de lanzar dos promesas. Se verifica una respuesta exitosa y un 409, estado final, efectivo de ambos puntos, bancos y exactamente dos movimientos compensados por transferencia, incluido el envío.

Evidencia: [Antes](INTEGRACION_LOCAL_CONCURRENCIA_ANTES.json), [después](INTEGRACION_LOCAL_CONCURRENCIA_CORREGIDA.json). TypeScript backend correcto; ESLint de los tres archivos: cero errores, cuatro advertencias preexistentes. Servicios temporales detenidos. No hubo acceso a producción ni despliegue.

Alcance: resolver la misma transferencia EN_TRANSITO. Aún falta la competencia entre transferencias distintas que comparten saldo, envíos simultáneos con fondos limitados, interacción con cambios/cierres y vías BANCO/MIXTO. No se afirma seguridad completa frente a concurrencia.

## Seguimiento: transferencias distintas sobre el mismo saldo

Se reprodujo pérdida de actualización: dos envíos de 10 registraron éxito, pero el saldo bajó solo 10 (690 en lugar de 680). Ahora envío, aceptación, rechazo y cancelación adquieren un bloqueo transaccional por punto/moneda antes de leer y calcular el saldo. Un bloqueo consultivo coordina transferencias incluso si no existe fila de Saldo; un bloqueo de fila `FOR NO KEY UPDATE` protege el registro existente mientras se calcula y escribe. Ambos se liberan al confirmar o revertir la transacción. No requiere migraciones. Saldo insuficiente responde 400 y revierte la creación de transferencia y sus movimientos.

**47 pruebas aprobadas** en PostgreSQL temporal: las 41 anteriores más envíos simultáneos con fondos suficientes/insuficientes, aceptación/rechazo/cancelación de dos transferencias distintas y dos primeras recepciones sin saldo previo. Se verifican saldos, bancos, desglose, cantidad de transferencias/movimientos y continuidad del saldo anterior/nuevo en los casos de envío y primera recepción.

Evidencia: [Antes](INTEGRACION_LOCAL_SALDO_CONCURRENTE_ANTES.json), [después](INTEGRACION_LOCAL_SALDO_CONCURRENTE_CORREGIDO.json). TypeScript correcto; ESLint sin errores, cuatro advertencias preexistentes. Entorno temporal detenido, sin acceso a producción ni despliegue.

Límites: los demás módulos todavía no participan del bloqueo consultivo. Falta probar transferencias simultáneas con cambios, cierres, ajustes y aprobaciones históricas; vías BANCO/MIXTO y cargas superiores a dos solicitudes. No se certifica concurrencia global del sistema.
