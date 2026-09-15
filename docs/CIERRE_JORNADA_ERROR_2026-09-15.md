# Finalizar jornada: motivo del bloqueo y acceso al cierre

## Reporte de producción

La captura del 14/09/2026 muestra «Finalizar Jornada» en Control de Horarios y el mensaje «Error al guardar la jornada en backend».

Consulta de solo lectura del 15/09: la jornada de la operadora en AMAZONAS 3 (`9b376b70-e08f-4230-b1a7-18d5fac00971`) continúa ACTIVO, sin salida. El cuadre del 14/09 (`b7393534-4f66-44fa-ada5-1e528e728bd7`) figura ABIERTO. La apertura ABIERTA por etapas contiene MXN 46,50 y CHF 2,00 pendientes de conteo; las restantes pendientes consultadas tienen cantidad esperada cero.

Este estado es compatible con el bloqueo de finalización por cierre diario pendiente. No se cuenta con el log HTTP del intento de la captura para atribuirle un código concreto. No se finalizaron jornadas, modificaron conteos ni actualizaron saldos en producción.

## Defecto confirmado en código

`guardarJornadaBackend` descartaba el error Axios y sus detalles y lanzaba un nuevo Error genérico. `handleFinalizarJornada` buscaba en ese error el texto «cierre de caja diario» para ofrecer navegación, de modo que esa ayuda nunca se activaba ante el rechazo real del backend.

## Corrección

- Se conserva el detalle del servidor, incluidos errores de validación y mensajes de conectividad.
- El cierre pendiente usa el código `CASH_CLOSE_REQUIRED` y ofrece ir a `daily-close`.
- Los conteos pendientes usan `PENDING_CURRENCY_COUNT` y ofrecen ir a `apertura-caja`.
- Se reconocen también los mensajes de versiones anteriores del backend.
- No se modifica el estado local de jornada ante un error ni se simula un cierre exitoso.
- El backend exige un cierre CERRADO dentro de todo el día de Ecuador: un registro fechado mañana no satisface el requisito de hoy.

Se conservan los controles de cierre y conteos por etapas. El bloqueo por conteos se resuelve completando las divisas pendientes con existencia en Apertura de Caja. Se recomienda seguir despu?s el flujo habitual de cierre diario y finalizaci?n. Una jornada histórica pendiente no se cierra automáticamente con este cambio.

## Validación y despliegue

Pruebas aisladas del frontend comprueban preservación de detalles y navegación para cierre pendiente, conteos pendientes y errores de red/validación. La integración local prueba ausencia de cierre, cierre futuro rechazado, jornada/punto intactos al fallar y finalización con liberación del punto después de un cierre válido del día.

Desplegar frontend y backend juntos mediante el build y reinicio PM2 habituales. No requiere migración SQL ni cambios de datos. El usuario realiza push y despliegue; recargar la aplicación después de actualizar.

Resultados: 319/319 comprobaciones de integraci?n local aprobadas; PostgreSQL temporal detenido al terminar. Regresiones frontend y autenticaci?n: 14/14 aprobadas. TypeScript de frontend/backend, ESLint de los componentes modificados y build aislado de Vite completados correctamente.
