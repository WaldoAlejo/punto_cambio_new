# Instrucciones de Despliegue

Este documento contiene instrucciones para desplegar la aplicación Punto Cambio en un servidor de producción.

## Requisitos

- Node.js 18 o superior
- PM2 (gestor de procesos para Node.js)
- PostgreSQL 14 o superior
- Git

## Pasos para el Despliegue

### 1. Clonar el Repositorio

```bash
git clone <URL_DEL_REPOSITORIO> punto_cambio_new
cd punto_cambio_new
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env.production` con las siguientes variables:

```
DATABASE_URL=postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio
DB_USER=postgres
DB_PASSWORD=Esh2ew8p
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_TIMEOUT=30000
JWT_SECRET=s3rv13ntr3g4_super_secure_jwt_key_change_in_production
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://35.238.95.118:3001
LOG_LEVEL=info
VITE_API_URL=http://35.238.95.118:3001/api
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX_REQUESTS=5
```

### 4. Generar Cliente de Prisma

```bash
npx prisma generate
```

### 5. Construir la Aplicación

```bash
npm run build
```

### 6. Iniciar la Aplicación con PM2

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

### 7. Verificar el Despliegue

```bash
curl http://localhost:3001/health
```

## Scripts de Utilidad

### Despliegue Completo

```bash
./deploy-full.sh
```

Este script realiza los siguientes pasos:

- Detiene la aplicación actual
- Actualiza el código desde el repositorio
- Actualiza las variables de entorno
- Instala dependencias
- Genera el cliente de Prisma
- Construye el backend y el frontend
- Inicia la aplicación con PM2
- Verifica que la aplicación está respondiendo

### Despliegue Simplificado

```bash
./deploy-simple.sh
```

Este script realiza los siguientes pasos:

- Detiene la aplicación actual
- Actualiza el código desde el repositorio
- Instala dependencias
- Genera el cliente de Prisma
- Construye el backend y el frontend
- Inicia la aplicación con PM2

### Servidor Simple

```bash
./start-simple-server.sh
```

Este script inicia un servidor simple que solo sirve el archivo `index.html` y el endpoint `/health`.

### Despliegue del Servidor Simple

```bash
./deploy-simple-server.sh
```

Este script realiza los siguientes pasos:

- Detiene la aplicación actual
- Verifica que el archivo `simple-server.js` existe (o lo crea si no existe)
- Verifica que el archivo `package.json` tiene el tipo `module`
- Crea un archivo `ecosystem.config.js` para el servidor simple
- Inicia el servidor simple con PM2
- Verifica que la aplicación está respondiendo

### Verificar y Corregir Todos los Problemas

```bash
./fix-all.sh
```

Este script ejecuta todos los scripts de verificación y corrección:

- Detiene la aplicación actual
- Actualiza las variables de entorno
- Verifica y corrige problemas del frontend
- Verifica y corrige problemas del backend
- Verifica y corrige problemas del despliegue
- Inicia la aplicación con PM2
- Verifica que la aplicación está respondiendo
- Si la aplicación no responde, intenta con el servidor simple

### Verificar y Corregir Problemas

```bash
./fix-deployment.sh
```

Este script verifica y corrige problemas comunes de despliegue:

- Verifica que el directorio `dist` existe
- Verifica que el archivo `index.html` existe en `dist`
- Verifica que el archivo `index.js` existe en `dist`
- Verifica que el archivo `ecosystem.config.js` existe
- Verifica que el archivo `.env.production` existe
- Verifica que el archivo `package.json` tiene el tipo `module`
- Verifica que PM2 está instalado
- Reinicia la aplicación con PM2

### Verificar y Corregir Problemas del Servidor Simple

```bash
./fix-simple-server.sh
```

Este script verifica y corrige problemas específicos del servidor simple:

- Verifica que el archivo `simple-server.js` existe (o lo crea si no existe)
- Verifica que el archivo `package.json` tiene el tipo `module`
- Verifica que el directorio `dist` existe
- Verifica que el archivo `index.html` existe en `dist`
- Verifica que PM2 está instalado
- Verifica si el servidor está en ejecución (lo inicia o reinicia según sea necesario)
- Verifica que la aplicación está respondiendo
- Si la aplicación no responde, intenta con otro puerto

### Verificar y Corregir Problemas del Frontend

```bash
./fix-frontend.sh
```

Este script verifica y corrige problemas específicos del frontend:

- Verifica que el archivo `src/config/environment.ts` existe
- Verifica que el archivo `src/services/axiosInstance.ts` existe
- Verifica que el archivo `.env.production` existe (o lo crea si no existe)
- Verifica que el archivo `.env.local` existe (o lo crea si no existe)
- Verifica que el archivo `.env` existe (o lo crea si no existe)
- Verifica que el archivo `src/config/environment.ts` tiene la URL de la API correcta
- Verifica que el archivo `vite.config.ts` existe
- Verifica que el archivo `vite.config.ts` tiene la configuración correcta
- Verifica que el directorio `dist` existe
- Verifica que el archivo `dist/index.html` existe (o construye el frontend si no existe)

### Verificar y Corregir Problemas del Backend

```bash
./fix-backend.sh
```

Este script verifica y corrige problemas específicos del backend:

- Verifica que el archivo `server/index.ts` existe
- Verifica que el archivo `tsconfig.server.json` existe (o lo crea si no existe)
- Verifica que el archivo `ecosystem.config.js` existe (o lo crea si no existe)
- Verifica que el archivo `server/index.ts` tiene la configuración CORS correcta
- Verifica que el archivo `server/index.ts` tiene la configuración de puerto correcta
- Verifica que el archivo `server/index.ts` tiene la configuración de escucha correcta
- Verifica que el directorio `dist` existe
- Verifica que el archivo `dist/index.js` existe (o construye el backend si no existe)
- Verifica que el archivo `package.json` tiene el script `build:server`
- Verifica que el archivo `prisma/schema.prisma` existe
- Verifica que el cliente de Prisma está generado

### Verificar el Estado del Servidor

```bash
./check-server.sh
```

Este script verifica el estado del servidor:

- Verifica el estado de PM2
- Verifica que la aplicación está respondiendo
- Verifica los logs de PM2
- Verifica el uso de memoria
- Verifica el uso de disco
- Verifica los procesos en ejecución
- Verifica los puertos en uso

### Verificar el Estado del Servidor Simple

```bash
./check-simple-server.sh
```

Este script verifica el estado del servidor simple:

- Verifica el estado de PM2
- Verifica que la aplicación está respondiendo en el puerto 3001 o 8080
- Verifica los logs de PM2
- Verifica el uso de memoria
- Verifica el uso de disco
- Verifica los procesos en ejecución
- Verifica los puertos en uso
- Verifica el firewall

### Actualizar Variables de Entorno

```bash
./update-env.sh
```

Este script actualiza las variables de entorno en el servidor:

- Crea o actualiza el archivo `.env.production` con las variables de entorno para producción
- Crea o actualiza el archivo `.env.local` con las variables de entorno para desarrollo local
- Crea o actualiza el archivo `.env` con las variables de entorno por defecto

## Solución de Problemas

### La aplicación no responde

1. Verifica que la aplicación está en ejecución:

```bash
pm2 status
```

2. Verifica los logs de la aplicación:

```bash
pm2 logs
```

3. Verifica que el puerto 3001 está abierto:

```bash
netstat -tuln | grep 3001
```

4. Verifica que el firewall permite el tráfico en el puerto 3001:

```bash
sudo ufw status
```

### Error al construir la aplicación

1. Verifica que todas las dependencias están instaladas:

```bash
npm install
```

2. Verifica que el archivo `tsconfig.server.json` existe:

```bash
ls -la tsconfig.server.json
```

3. Verifica que el archivo `package.json` tiene el tipo `module`:

```bash
grep '"type": "module"' package.json
```

### Error al conectar con la base de datos

1. Verifica que la base de datos está en ejecución:

```bash
pg_isready -h 34.66.51.85 -p 5432
```

2. Verifica que las credenciales de la base de datos son correctas:

```bash
psql -h 34.66.51.85 -p 5432 -U postgres -d punto_cambio
```

3. Verifica que la variable de entorno `DATABASE_URL` está configurada correctamente:

```bash
grep DATABASE_URL .env.production
```
