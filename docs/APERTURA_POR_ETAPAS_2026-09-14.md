# Apertura por etapas

## Regla implementada

Las nuevas aperturas priorizan USD, EUR y las divisas con movimientos de caja desde el inicio de la última jornada COMPLETADA del punto hasta el inicio de la jornada actual, independientemente del operador anterior. Si no existe jornada completada, se considera el historial disponible anterior al inicio actual. Los movimientos SALDO_INICIAL y los bancarios identificados por la convención existente de descripción no añaden prioridades. La lista queda guardada en el JSON de la apertura y no cambia mientras se cuenta.

El operador guarda las divisas obligatorias y confirma la apertura. El menú permanece bloqueado hasta esa confirmación. Las divisas restantes se presentan como pendientes en Apertura de Caja: no se envían como ceros ni se les crea un detalle desde la confirmación inicial. Los reportes generales conservan sus reglas propias; la apertura es la fuente del estado pendiente.

Después de abrir, cada divisa pendiente admite un conteo independiente por denominaciones. Debe cuadrar dentro de la tolerancia existente y coincidir con el saldo esperado enviado por la pantalla. La operación bloquea saldo y apertura, conserva los conteos anteriores y registra hora, usuario e historial. Dos guardados simultáneos de la misma divisa producen un único conteo. El detalle del cuadre abierto recibe el conteo posterior; el saldo contable no se ajusta automáticamente.

La excepción existente de incidencia para diferencias en divisas obligatorias se conserva: la apertura debe estar confirmada mediante INCIDENCIA_OPERADOR o INCIDENCIA_APROBADA y la divisa debe figurar en la evidencia registrada. Una divisa opcional con diferencia no queda habilitada por esa excepción; debe corregirse el conteo.

## Protección del efectivo y cierre

[SQL de instalación](../scripts/migrations/2026-09-14-staged-opening.sql) añade dos triggers, sin actualizar datos:

- `staged_opening_cash_guard`: impide INSERT/UPDATE que cambien cantidad física o su desglose de una divisa pendiente. También protege escritores que no pasan por las rutas HTTP. Las actualizaciones exclusivamente bancarias se permiten.
- `staged_opening_close_guard`: impide finalizar/cancelar la jornada o cambiar su punto cuando quedan divisas con existencia física sin contar. El cierre normal comprueba además los conteos dentro de la transacción que bloquea los saldos.

Solo se aplican a aperturas marcadas `apertura_por_etapas` y jornadas vigentes. Las aperturas antiguas conservan la política anterior; no se migran sus conteos ni saldos. La protección SQL complementa los permisos y transacciones existentes: no certifica todos los permisos administrativos ni impide acciones de un administrador de PostgreSQL que elimine o desactive los triggers.

## Validación local

La suite de integración pasa **270 casos** y cubre prioridad por movimientos de una jornada anterior, exclusión bancaria, falta de conteo obligatorio, rechazo de un cambio con divisa pendiente, conservación de saldos tras rechazo, escritura SQL directa bloqueada, actualización bancaria permitida, cierre bloqueado, conteo posterior inválido/duplicado/concurrente, historial, conservación de conteos previos, cambio posterior y cierre normal por API. [Resultado](INTEGRACION_LOCAL_APERTURA_ETAPAS.json). Pasan además las 12 regresiones frontend/autenticación, TypeScript frontend/backend y la compilación Vite local. Las advertencias de tamaño de bundle y Browserslist son anteriores.

En navegador local se verificó selección de punto, conteo USD/EUR, confirmación, regreso a Apertura de Caja y conteo posterior de GBP, dejando CHF pendiente. [Captura](PRUEBA_NAVEGADOR_APERTURA_ETAPAS.png). Se repitió con el frontend final: [conteo guardado con menú todavía bloqueado](PRUEBA_NAVEGADOR_APERTURA_SIN_CONFIRMAR.png), seguido de confirmación y menú habilitado. Las rutas generales de métricas no se montan en el servidor reducido y sus errores 404 no se consideran verificación del dashboard. Los servicios temporales se detuvieron al finalizar.

## Orden de despliegue pendiente

No se ha aplicado esta instalación a producción. No basta con hacer pull y reiniciar el backend.

1. Conservar el respaldo de base de datos y los artefactos del despliegue actual. Revisar esta SQL concreta; no ejecutar todas las migraciones históricas ni `prisma db push` como parte de este cambio.
2. Aplicar `scripts/migrations/2026-09-14-staged-opening.sql` en la base correcta durante la ventana de mantenimiento. El archivo contiene BEGIN/COMMIT y un tiempo máximo de espera de bloqueo de cinco segundos; ante error se debe detener el despliegue. No imprimir la cadena de conexión.
3. Verificar que ambos triggers están instalados y habilitados. El nuevo backend rechaza crear una apertura por etapas si falta alguno de ellos.
4. Compilar y activar backend y frontend como pareja. El artefacto generado por `build-frontend-check.mjs` es exclusivamente local y no debe publicarse.
5. Verificar salud, variables efectivas y pantalla pública. La comprobación con dinero/jornadas reales corresponde a la operación real supervisada, no a transacciones ficticias en producción.

Consulta de instalación, sin credenciales ni datos de clientes:

```sql
SELECT tgname, tgenabled, tgrelid::regclass AS tabla
FROM pg_trigger
WHERE tgname IN ('staged_opening_cash_guard', 'staged_opening_close_guard');
```

Ambos deben existir en sus tablas respectivas, habilitados (`O` o `A`). La SQL no es para reejecutarse sin comprobar el estado: CREATE TRIGGER rechazará un nombre ya instalado y la transacción debe revertirse.

Para volver a la versión anterior, primero comprobar que no haya jornadas por etapas con conteos pendientes: la pantalla anterior no permite completarlos. No eliminar los triggers para eludir esos pendientes. La reversión debe prepararse sobre el estado real de las jornadas; el respaldo no se restaura encima de nuevas operaciones.
