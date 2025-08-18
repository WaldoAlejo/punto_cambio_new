# 🏦 Punto Cambio - Sistema de Casa de Cambios

Sistema completo de gestión para casas de cambio con frontend React y backend Node.js/Express.

## 🚀 Despliegue Rápido

### Para despliegue en producción (VM de GCP):

```bash
# Despliegue optimizado
git clone <tu-repositorio>
cd punto_cambio_new
npm install
./deploy.sh
```

**📖 Ver [PLAN-DESPLIEGUE.md](./PLAN-DESPLIEGUE.md) para instrucciones detalladas**

## 🏗️ Arquitectura

- **Frontend**: React + TypeScript + Vite (carpeta `src/`)
- **Backend**: Node.js + Express + TypeScript (carpeta `server/`)
- **Base de datos**: PostgreSQL + Prisma ORM
- **Despliegue**: PM2 + Scripts automatizados

## 🛠️ Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar base de datos
npx prisma generate
npx prisma db push

# Desarrollo (frontend y backend separados)
npm run dev          # Frontend en puerto 5173
npm run dev:server   # Backend en puerto 3001

# O usar el script helper
./start.sh dev
```

## 📦 Construcción

```bash
# Construir todo (frontend + backend)
npm run build

# Solo frontend
npm run build:frontend

# Solo backend
npm run build:server
```

## 🚀 Despliegue en Producción

### Scripts disponibles:

```bash
# Despliegue optimizado
./deploy.sh

# Monitorear conexiones a la base de datos
node scripts/monitor-db-connections.js

# Probar conexión a la base de datos
node scripts/test-db-connection.js

# Probar conexión con Prisma
node scripts/test-prisma-connection.js

# Verificar integridad del sistema
./scripts/verify-system.sh

# Limpiar la base de datos y ejecutar el seed completo
./scripts/reset-database.sh

# Verificar y corregir la configuración de PM2
./scripts/fix-pm2-config.sh

# Solucionar problemas comunes
./scripts/fix-common-issues.sh
```

### Comandos PM2:

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs punto-cambio-api

# Reiniciar
pm2 restart punto-cambio-api

# Parar
pm2 stop punto-cambio-api
```

## 🌐 URLs de Producción

- **Aplicación**: http://35.238.95.118:3001
- **API**: http://35.238.95.118:3001/api
- **Health Check**: http://35.238.95.118:3001/health

## 📚 Documentación

- **[PLAN-DESPLIEGUE.md](./PLAN-DESPLIEGUE.md)** - Plan detallado de despliegue
- **[README.md](./README.md)** - Documentación principal

## 🛠️ Tecnologías

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Base de datos**: PostgreSQL, Prisma ORM
- **Despliegue**: PM2, Scripts automatizados
- **Infraestructura**: Google Cloud Platform

## 🔄 Flujo de Trabajo

1. **Desarrollo local**: Hacer cambios en VSCode
2. **Commit y push**: Subir cambios a GitHub
3. **Despliegue**: Ejecutar `./deploy.sh` en la VM
4. **Verificación**: Revisar que todo funcione correctamente con los scripts de prueba

## 🚨 Soporte

Si tienes problemas:

1. Revisar logs: `pm2 logs punto-cambio-api`
2. Verificar estado: `pm2 status`
3. Ejecutar health check: `curl http://localhost:3001/health`
4. Consultar documentación en los archivos .md
