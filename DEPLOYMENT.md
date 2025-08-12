# 🚀 Guía de Despliegue - Punto Cambio

Esta guía te ayudará a desplegar tu aplicación de manera sencilla en tu VM de GCP.

## 📋 Requisitos Previos

- Node.js 18+ instalado
- PM2 instalado globalmente: `npm install -g pm2`
- Git configurado
- Base de datos PostgreSQL configurada

## 🏗️ Arquitectura de Despliegue

En producción, la aplicación funciona de la siguiente manera:

- **Puerto 3001**: Servidor Express que sirve tanto la API como el frontend
- **Frontend**: Archivos estáticos servidos desde `/dist`
- **Backend**: API REST en `/api/*`
- **PM2**: Gestiona el proceso del servidor con clustering

## 🚀 Despliegue Inicial

### 1. Clonar el repositorio (si es la primera vez)

```bash
git clone <tu-repositorio>
cd punto_cambio_new
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Asegúrate de que `.env.production` esté configurado correctamente:

```env
DATABASE_URL=postgresql://usuario:password@host:puerto/database
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://tu-ip:3001
VITE_API_URL=http://tu-ip:3001/api
```

### 4. Configurar base de datos

```bash
npx prisma generate
npx prisma db push
```

### 5. Construir y desplegar

```bash
./deploy.sh full
```

## 🔄 Actualizaciones Rutinarias

Para actualizaciones rápidas (solo cambios de código):

```bash
./deploy.sh quick
```

Para actualizaciones completas (dependencias, migraciones, etc.):

```bash
./deploy.sh full
```

## 📝 Scripts Disponibles

### Scripts de NPM

```bash
# Construcción completa (frontend + backend)
npm run build

# Solo frontend
npm run build:frontend

# Solo backend
npm run build:server

# Despliegue completo
npm run deploy

# Despliegue rápido
npm run deploy:quick
```

### Scripts de PM2

```bash
# Iniciar aplicación
npm run pm2:start

# Reiniciar aplicación
npm run pm2:restart

# Parar aplicación
npm run pm2:stop

# Ver logs
npm run pm2:logs

# Ver estado
npm run pm2:status
```

### Scripts de Shell

```bash
# Despliegue completo
./deploy.sh full

# Despliegue rápido
./deploy.sh quick

# Iniciar en producción
./start.sh prod

# Iniciar en desarrollo
./start.sh dev
```

## 🔍 Verificación del Despliegue

### Health Check

```bash
curl http://localhost:3001/health
```

### Verificar Frontend

Visita: `http://tu-ip:3001`

### Verificar API

```bash
curl http://localhost:3001/api/health
```

## 📊 Monitoreo

### Ver estado de PM2

```bash
pm2 status
```

### Ver logs en tiempo real

```bash
pm2 logs punto-cambio-api
```

### Ver logs específicos

```bash
pm2 logs punto-cambio-api --lines 50
```

### Monitoreo web de PM2

```bash
pm2 web
```

## 🛠️ Solución de Problemas

### La aplicación no inicia

1. Verificar logs: `pm2 logs punto-cambio-api`
2. Verificar que el puerto 3001 esté libre: `lsof -i :3001`
3. Verificar variables de entorno en `.env.production`

### Error de base de datos

1. Verificar conexión: `npx prisma db push`
2. Regenerar cliente: `npx prisma generate`

### Frontend no carga

1. Verificar que `dist/` existe y tiene archivos
2. Reconstruir: `npm run build:frontend`

### API no responde

1. Verificar logs del servidor
2. Verificar configuración CORS
3. Verificar rutas en `server/index.ts`

## 🔄 Flujo de Trabajo Recomendado

### Para desarrollo local:

```bash
./start.sh dev
```

### Para despliegue en producción:

1. Hacer cambios en tu rama local
2. Commit y push a GitHub
3. En el servidor: `./deploy.sh quick`

### Para cambios importantes (dependencias, migraciones):

```bash
./deploy.sh full
```

## 📁 Estructura de Archivos Importantes

```
proyecto/
├── src/                    # Frontend (React + Vite)
├── server/                 # Backend (Express + TypeScript)
├── dist/                   # Frontend construido
├── prisma/                 # Esquemas y migraciones
├── logs/                   # Logs de PM2
├── ecosystem.config.js     # Configuración PM2
├── deploy.sh              # Script de despliegue
├── start.sh               # Script de inicio
└── .env.production        # Variables de entorno
```

## 🚨 Comandos de Emergencia

### Reiniciar todo

```bash
pm2 restart all
```

### Parar todo

```bash
pm2 stop all
```

### Eliminar procesos PM2

```bash
pm2 delete all
```

### Reconstruir desde cero

```bash
npm run clean
npm install
npm run build
pm2 restart punto-cambio-api
```

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs: `pm2 logs punto-cambio-api`
2. Verifica el estado: `pm2 status`
3. Ejecuta health check: `curl http://localhost:3001/health`
