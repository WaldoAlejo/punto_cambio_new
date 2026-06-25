#!/bin/bash

# Configuration
BACKUP_DIR="/home/puntocambioweb/punto_cambio_new/backups"
DB_CONTAINER="punto_cambio_new-postgres-1"
DB_USER="testuser"
DB_NAME="punto_cambio"
# Archivo fijo para el respaldo diario (se sobrescribirá)
BACKUP_FILE="$BACKUP_DIR/punto_cambio_daily.sql"

# Asegurar que el directorio de respaldos existe
mkdir -p "$BACKUP_DIR"

echo "---------------------------------------------------------"
echo "Iniciando respaldo diario de $DB_NAME en $(date)"
echo "---------------------------------------------------------"

# Realizar el respaldo usando docker exec
# Usamos un archivo temporal para no borrar el anterior si falla el comando
TEMP_BACKUP_FILE="${BACKUP_FILE}.tmp"

if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$TEMP_BACKUP_FILE"; then
    echo "✅ Respaldo exitoso."
    
    # Comprimir el respaldo (sobrescribirá el .gz anterior por el nombre fijo)
    gzip -f "$TEMP_BACKUP_FILE"
    mv "${TEMP_BACKUP_FILE}.gz" "${BACKUP_FILE}.gz"
    
    echo "✅ Respaldo comprimido y actualizado en: ${BACKUP_FILE}.gz"
    echo "Tamaño del respaldo: $(du -sh ${BACKUP_FILE}.gz | cut -f1)"
else
    echo "❌ Error: ¡El respaldo falló!"
    rm -f "$TEMP_BACKUP_FILE"
    exit 1
fi

echo "---------------------------------------------------------"
echo "Proceso de respaldo finalizado en $(date)"
echo "---------------------------------------------------------"
