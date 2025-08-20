# Despliegue en VM GCP - Nueva IP

## 🏗️ Arquitectura

- **VM GCP**: 34.70.184.11 (punto-cambio)
- **Base de datos**: SQL Cloud 34.66.51.85
- **Puerto aplicación**: 3001

## 📋 Cambios realizados para nueva IP

### IPs actualizadas:

- **Anterior**: 35.238.95.118
- **Nueva**: 34.70.184.11

### Archivos modificados:

- `.env`, `.env.production`, `.env.local` - URLs actualizadas
- `src/config/environment.ts` - URL por defecto de API
- `server/index.ts` - CORS actualizado + listen en 0.0.0.0
- `deploy.sh` - URLs de producción
- `ecosystem.config.js` - Configuración PM2 completa

## 🚀 Pasos para desplegar

### 1. En VSCode local (ya completado):

```bash
# Verificar rama
git branch  # Debe mostrar: produccion-servidor-gcp

# Agregar cambios
git add .

# Commit
git commit -m "feat: actualizar configuración para nueva VM GCP 34.70.184.11

- Actualizar todas las URLs de 35.238.95.118 a 34.70.184.11
- Configurar CORS para nueva IP
- Actualizar ecosystem.config.js con variables de SQL Cloud
- Agregar scripts de despliegue automatizado
- Configurar servidor para escuchar en 0.0.0.0:3001"

# Push a producción
git push origin produccion-servidor-gcp
```

### 2. En tu VM (34.70.184.11):

```bash
# Ir al directorio del proyecto
cd /ruta/del/proyecto

# Pull de los cambios
git pull origin produccion-servidor-gcp

# Ejecutar script de configuración
chmod +x setup-vm-gcp.sh
./setup-vm-gcp.sh
```

## 🔧 Verificaciones importantes

### En SQL Cloud (34.66.51.85):

- ✅ IP de la VM autorizada: 34.70.184.11
- ✅ Puerto 5432 accesible
- ✅ Usuario postgres con permisos

### En VM GCP (34.70.184.11):

- ✅ Puerto 3001 abierto en firewall
- ✅ PM2 instalado
- ✅ Node.js y npm instalados
- ✅ Git configurado

## 🌐 URLs finales:

- **Aplicación**: http://34.70.184.11:3001
- **API**: http://34.70.184.11:3001/api
- **Health Check**: http://34.70.184.11:3001/health

## 🔍 Comandos de diagnóstico

### En la VM:

```bash
# Estado de PM2
pm2 status

# Logs en tiempo real
pm2 logs

# Variables de entorno
pm2 env 0

# Test de conectividad a SQL Cloud
telnet 34.66.51.85 5432

# Test local del servidor
curl http://localhost:3001/health

# Test externo del servidor
curl http://34.70.184.11:3001/health

# Estado de migraciones Prisma
npx prisma migrate status
```

### Desde local:

```bash
# Test de conectividad
./test-connection.sh

# O manualmente:
curl http://34.70.184.11:3001/health
curl http://34.70.184.11:3001/api/auth/login
```

## 🚨 Solución de problemas

### Error de conexión a base de datos:

1. Verificar IP autorizada en SQL Cloud
2. Verificar firewall de la VM
3. Verificar variables de entorno: `pm2 env 0`

### Error de CORS:

1. Verificar que server/index.ts tenga la nueva IP
2. Reiniciar PM2: `pm2 restart all`

### Error de timeout:

1. Verificar que el servidor escuche en 0.0.0.0:3001
2. Verificar firewall GCP para puerto 3001
3. Verificar logs: `pm2 logs`

## 📝 Notas importantes:

- La base de datos ya existe en SQL Cloud, solo se aplican migraciones
- El schema de Prisma se sincroniza automáticamente
- PM2 se configura para reinicio automático
- Los logs se guardan en ./logs/
