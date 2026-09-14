# Reporte de saldos por punto de atención

Disponible en **Reportes Históricos → Saldos por Punto de Atención → Descargar Excel**.

El archivo contiene:

1. **Saldos actuales:** una fila por saldo registrado de punto/divisa; efectivo, billetes, monedas físicas, suma del desglose, diferencia, bancos y última actualización en hora de Ecuador. Incluye puntos inactivos con registros, identificados como tales.
2. **Cuadres históricos:** fecha, punto, divisa, estado, apertura, cierre y conteo registrados, desglose del conteo, diferencias y bancos. Se conservan los distintos cuadres del día con su ID; un cuadre abierto no se presenta como cierre confirmado. No se inventan valores para días sin registros.
3. **Información:** fecha de generación, filtros y significado de las columnas.

El filtro de punto se aplica a ambas hojas. Desde/Hasta se aplica solo a los cuadres; los saldos actuales reflejan la consulta al generar el archivo, incluso si su última actualización queda fuera del período histórico. El rango incluye todo el día final de Ecuador, usando intervalo UTC semiabierto.

Los importes mantienen su divisa y tipo numérico, con dos decimales. No se suman divisas distintas. Bancos es un registro informativo separado del efectivo, no una conciliación bancaria. Las diferencias se muestran sin alterar los datos.

## Backend y permisos

GET `/api/reportes/saldos-por-punto`, parámetros opcionales `punto_atencion_id`, `desde`, `hasta` (YYYY-MM-DD).

Roles autorizados: ADMIN, SUPER_USUARIO y ADMINISTRATIVO, con las condiciones del middleware de autenticación existente. Operadores y solicitudes sin autenticación no pueden exportar. UUID/fechas inválidos y rangos invertidos devuelven 400; punto inexistente 404.

Las lecturas usan una transacción Prisma RepeatableRead para que ambas hojas se generen desde la misma instantánea. Sin escrituras en la base ni recalculado de saldos. Máximo 50.000 filas por hoja; si se supera, devuelve 422 solicitando reducir filtros, sin entregar un archivo truncado. Respuesta Excel con Cache-Control: no-store.

## Validación

- TypeScript frontend/backend: aprobado.
- ESLint del endpoint y componente modificados: aprobado.
- Compilación frontend local: aprobada.
- Suite PostgreSQL temporal: **318/318**. Cinco pruebas nuevas cubren Excel legible, importes numéricos, diferencias, separación de bancos, punto inactivo, filtro por punto, bordes del día en Ecuador, múltiples cuadres, ausencia de filtros, fechas/UUID inválidos, roles y ausencia de modificaciones al saldo.
- No se consultó ni modificó producción para implementar el reporte. No se realizó comprobación visual en navegador.

## Despliegue

Requiere actualizar frontend y backend en conjunto, ejecutar `npm run build` y reiniciar PM2 según el procedimiento existente. **No requiere migración SQL ni ejecución del script de reparación de El Bosque.** El usuario realiza el push y despliegue.
