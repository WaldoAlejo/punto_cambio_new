# 🚀 Setup de Producción - Punto Cambio

## Configuración Completa para VM de GCP

### 1. Preparación del Servidor (Solo primera vez)

```bash
# Instalar Node.js (si no está instalado)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 globalmente
sudo npm install -g pm2

# Configurar PM2 para auto-inicio
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

### 2. Configuración del Proyecto

```bash
# Clonar repositorio (primera vez)
git clone <tu-repositorio-github>
cd punto_cambio_new

# O actualizar repositorio existente
git pull origin main

# Instalar dependencias
npm install

# Configurar Prisma
npx prisma generate
npx prisma db push
```

### 3. Variables de Entorno

Asegúrate de que `.env.production` tenga:

```env
DATABASE_URL=postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://35.238.95.118:3001
VITE_API_URL=http://35.238.95.118:3001/api
JWT_SECRET=s3rv13ntr3g4_super_secure_jwt_key_change_in_production
```

### 4. Despliegue Inicial

```bash
# Construir aplicación completa
npm run build

# Iniciar con PM2
pm2 start ecosystem.config.js --env production

# Guardar configuración PM2
pm2 save
```

### 5. Verificación

```bash
# Verificar estado
pm2 status

# Verificar logs
pm2 logs punto-cambio-api

# Health check
curl http://localhost:3001/health

# Verificar frontend
curl http://localhost:3001
```

## 🔄 Flujo de Actualización Diario

### Actualización Rápida (solo código)

```bash
./deploy.sh quick
```

### Actualización Completa (dependencias, DB, etc.)

```bash
./deploy.sh full
```

## 📋 Comandos Útiles

```bash
# Ver estado de la aplicación
pm2 status

# Ver logs en tiempo real
pm2 logs punto-cambio-api

# Reiniciar aplicación
pm2 restart punto-cambio-api

# Parar aplicación
pm2 stop punto-cambio-api

# Eliminar aplicación de PM2
pm2 delete punto-cambio-api

# Ver métricas
pm2 monit
```

## 🌐 Acceso a la Aplicación

Una vez desplegada, la aplicación estará disponible en:

- **Frontend**: http://35.238.95.118:3001
- **API**: http://35.238.95.118:3001/api
- **Health Check**: http://35.238.95.118:3001/health

## 🔧 Configuración de Firewall (GCP)

Asegúrate de que el puerto 3001 esté abierto:

```bash
# Crear regla de firewall (ejecutar una sola vez)
gcloud compute firewall-rules create allow-punto-cambio \
  --allow tcp:3001 \
  --source-ranges 0.0.0.0/0 \
  --description "Allow Punto Cambio application"
```

## 🚨 Solución de Problemas Comunes

### Error: Puerto en uso

```bash
# Ver qué está usando el puerto
sudo lsof -i :3001

# Matar proceso si es necesario
sudo kill -9 <PID>
```

### Error: PM2 no encuentra la aplicación

```bash
# Eliminar procesos PM2 existentes
pm2 delete all

# Reiniciar desde cero
pm2 start ecosystem.config.js --env production
pm2 save
```

### Error: Base de datos no conecta

```bash
# Verificar conexión
npx prisma db push

# Regenerar cliente
npx prisma generate
```

### Frontend no carga

```bash
# Reconstruir frontend
npm run build:frontend

# Verificar que dist/ tiene archivos
ls -la dist/
```

## 📊 Monitoreo Avanzado

### Configurar logs rotativos

```bash
# Instalar logrotate para PM2
pm2 install pm2-logrotate

# Configurar rotación cada 10MB
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Configurar alertas

```bash
# Instalar módulo de notificaciones
pm2 install pm2-slack

# Configurar webhook de Slack (opcional)
pm2 set pm2-slack:slack_url https://hooks.slack.com/services/...
```

## 🔐 Seguridad

### Configurar HTTPS (Opcional)

Si quieres usar HTTPS, puedes configurar un proxy reverso con Nginx:

```bash
# Instalar Nginx
sudo apt update
sudo apt install nginx

# Configurar proxy reverso
sudo nano /etc/nginx/sites-available/punto-cambio
```

Contenido del archivo Nginx:

```nginx
server {
    listen 80;
    server_name 35.238.95.118;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/punto-cambio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```
