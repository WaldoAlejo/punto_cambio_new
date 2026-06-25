# Reporte de Migración de Base de Datos y Backups

## 1. Revisión de Conectividad y Configuración
- **Conflictos en `.env`**: Se detectaron marcadores de conflicto de Git en los archivos `.env` y `.env.production`. Esto impedía que el sistema cargara correctamente las variables.
- **Acción Realizada**: Se corrigieron ambos archivos. En `.env.production`, se estableció `DATABASE_URL` apuntando a `localhost:5432`, que es lo esperado cuando la base de datos corre en Docker (mapeada al host) y la aplicación corre mediante PM2.

## 2. Optimización de Respaldos (Backups)
- **Requerimiento**: El usuario solicitó que los respaldos se realicen diariamente, se sobrescriban y solo se mantenga el último para ahorrar espacio.
- **Acción Realizada**: Se modificó `scripts/backup_db.sh`.
  - Ahora usa un nombre de archivo fijo: `punto_cambio_daily.sql.gz`.
  - Implementa una lógica de archivo temporal para asegurar que no se borre el respaldo anterior hasta que el nuevo sea exitoso.
  - Se eliminó la retención de 30 días, dejando solo el archivo más reciente.

## 3. Verificación de Migración
- Se observó el archivo `restore_log.txt` con fecha reciente, indicando que se realizó una restauración de datos.
- Existe un respaldo previo de ~715MB (`backup_2026-06-16_21-38-31.sql.gz`), lo que confirma que el proceso de volcado de datos funciona.

## 4. Pendientes para Finalizar (Checklist)
Para poder eliminar la base de datos de Google Cloud SQL con total seguridad, se recomienda:

1. **Configurar el Cron**: Ejecutar el siguiente comando en la terminal de la VM para programar el respaldo diario (ej: 2 AM):
   ```bash
   (crontab -l 2>/dev/null; echo "0 2 * * * /home/puntocambioweb/punto_cambio_new/scripts/backup_db.sh >> /home/puntocambioweb/punto_cambio_new/logs/backup.log 2>&1") | crontab -
   ```
2. **Prueba de Humo**: Ejecutar `npm run smoke:db` en la VM para verificar que la aplicación puede realizar consultas básicas a la nueva base de datos local.
3. **Reinicio de Servicios**: Asegurarse de haber reiniciado PM2 para que tome los cambios en `.env.production`:
   ```bash
   pm2 restart punto-cambio-api
   ```

## Conclusión
El sistema está configurado y listo en cuanto a lógica y archivos. Una vez verificado que el sistema está operando con normalidad (acceso de usuarios y guardado de datos), **se puede proceder a la eliminación de la instancia de Google Cloud SQL.**
