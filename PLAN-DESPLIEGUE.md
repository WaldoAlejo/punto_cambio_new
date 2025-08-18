# Plan de Despliegue - Punto Cambio

Este documento describe el plan de despliegue para la aplicación Punto Cambio, incluyendo los pasos necesarios para configurar el entorno de producción y optimizar el rendimiento.

## Requisitos Previos

- Servidor Ubuntu 20.04 LTS o superior
- Node.js 18.x o superior
- PostgreSQL 14.x o superior
- PM2 (gestor de procesos para Node.js)
- Acceso SSH al servidor

## Pasos de Despliegue

### 1. Preparación del Servidor

```bash
# Actualizar el sistema
sudo apt update
sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y curl git build-essential

# Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node -v  # Debería mostrar v18.x.x
npm -v   # Debería mostrar 8.x.x o superior

# Instalar PM2 globalmente
sudo npm install -g pm2
```

### 2. Configuración de PostgreSQL

```bash
# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Iniciar y habilitar el servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Configurar PostgreSQL para permitir más conexiones
sudo -u postgres psql -c "ALTER SYSTEM SET max_connections = '200';"
sudo -u postgres psql -c "SELECT pg_reload_conf();"

# Crear usuario y base de datos
sudo -u postgres psql -c "CREATE USER punto_cambio WITH PASSWORD 'tu_contraseña_segura';"
sudo -u postgres psql -c "CREATE DATABASE punto_cambio_db OWNER punto_cambio;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE punto_cambio_db TO punto_cambio;"
```

### 3. Clonar y Configurar el Repositorio

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/punto-cambio.git
cd punto-cambio

# Crear archivo de variables de entorno
cat > .env.production << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://punto_cambio:tu_contraseña_segura@localhost:5432/punto_cambio_db
JWT_SECRET=tu_clave_secreta_jwt_muy_segura
LOG_LEVEL=info
EOF

# Instalar dependencias
npm install
```

### 4. Configuración de Prisma

```bash
# Generar cliente de Prisma
npx prisma generate

# Aplicar migraciones (si existen)
npx prisma migrate deploy

# O sincronizar el esquema directamente (si no hay migraciones)
npx prisma db push
```

### 5. Construir y Desplegar la Aplicación

```bash
# Ejecutar el script de despliegue
./deploy.sh
```

El script `deploy.sh` realizará las siguientes acciones:

- Crear un respaldo de la aplicación
- Detener la aplicación actual (si está en ejecución)
- Instalar dependencias
- Verificar y crear archivos de configuración de TypeScript si no existen
- Generar cliente de Prisma
- Construir el backend y el frontend
- Iniciar la aplicación con PM2
- Configurar un cron job para monitorear las conexiones a la base de datos
- Probar la conexión a la base de datos

### 6. Configuración de Firewall

```bash
# Instalar UFW si no está instalado
sudo apt install -y ufw

# Configurar reglas de firewall
sudo ufw allow ssh
sudo ufw allow 3001/tcp  # Puerto de la aplicación
sudo ufw enable
```

### 7. Configuración de Nginx (Opcional)

Si deseas utilizar Nginx como proxy inverso:

```bash
# Instalar Nginx
sudo apt install -y nginx

# Crear configuración para la aplicación
sudo nano /etc/nginx/sites-available/punto-cambio

# Añadir la siguiente configuración
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Habilitar el sitio
sudo ln -s /etc/nginx/sites-available/punto-cambio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Configurar firewall para Nginx
sudo ufw allow 'Nginx Full'
```

## Optimizaciones Realizadas

### 1. Instancia Compartida de Prisma

Se ha implementado una instancia compartida de PrismaClient en `server/lib/prisma.ts` para evitar la creación de múltiples conexiones a la base de datos.

### 2. Configuración de PM2

Se ha configurado PM2 para usar una sola instancia en modo fork, lo que reduce el número de conexiones a la base de datos.

### 3. Monitoreo de Conexiones

Se ha implementado un script (`scripts/monitor-db-connections.js`) que monitorea y limpia las conexiones inactivas periódicamente.

## Verificación del Despliegue

Después de completar el despliegue, verifica que todo funcione correctamente:

```bash
# Verificar estado de PM2
pm2 status

# Verificar logs
pm2 logs

# Verificar conexiones a la base de datos
node scripts/monitor-db-connections.js

# Verificar que la aplicación responde
curl http://localhost:3001/health
```

## Mantenimiento

### Actualizaciones

Para actualizar la aplicación:

```bash
# Obtener los últimos cambios
git pull

# Ejecutar el script de despliegue
./deploy.sh
```

### Respaldos

Los respaldos se crean automáticamente durante el despliegue en el directorio `$HOME/backups`.

Para crear un respaldo manual:

```bash
# Respaldar la aplicación
tar -czvf ~/backups/punto_cambio_backup_$(date +%Y%m%d_%H%M%S).tar.gz --exclude="node_modules" --exclude="dist" .

# Respaldar la base de datos
pg_dump -U punto_cambio -d punto_cambio_db > ~/backups/punto_cambio_db_$(date +%Y%m%d_%H%M%S).sql
```

### Monitoreo

Para monitorear la aplicación:

```bash
# Ver estado de PM2
pm2 status

# Ver logs
pm2 logs

# Monitorear conexiones a la base de datos
node scripts/monitor-db-connections.js
```

## Solución de Problemas

### Demasiadas Conexiones a la Base de Datos

Si recibes el error "Too many database connections":

```bash
# Ejecutar el script de monitoreo para limpiar conexiones inactivas
node scripts/monitor-db-connections.js

# Reiniciar la aplicación
pm2 restart all
```

### La Aplicación No Responde

```bash
# Verificar logs
pm2 logs

# Reiniciar la aplicación
pm2 restart all

# Verificar estado
pm2 status
```

### Problemas con la Base de Datos

```bash
# Verificar conexión a la base de datos
psql -U punto_cambio -d punto_cambio_db -c "SELECT 1;"

# Verificar espacio en disco
df -h

# Verificar memoria disponible
free -m
```

## Contacto

Para soporte técnico, contacta a:

- Nombre: Tu Nombre
- Email: tu.email@ejemplo.com
- Teléfono: +1234567890
