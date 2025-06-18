
#!/bin/bash

# Script de backup para base de datos
set -e

BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="punto_cambio"

# Crear directorio de backups
mkdir -p $BACKUP_DIR

echo "🗄️ Creando backup de base de datos..."

# Backup de la base de datos
pg_dump $DATABASE_URL > "$BACKUP_DIR/backup_$DATE.sql"

# Comprimir backup
gzip "$BACKUP_DIR/backup_$DATE.sql"

echo "✅ Backup creado: $BACKUP_DIR/backup_$DATE.sql.gz"

# Limpiar backups antiguos (mantener últimos 7 días)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "🧹 Backups antiguos eliminados"
