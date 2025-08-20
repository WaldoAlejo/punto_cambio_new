# Cambios Realizados para Nueva VM

## IP Anterior vs Nueva
- **Anterior**: 35.238.95.118
- **Nueva**: 34.70.184.11

## Archivos Modificados

### 1. Variables de Entorno
- `.env` - Actualizada VITE_API_URL
- `.env.production` - Actualizada VITE_API_URL y FRONTEND_URL
- `.env.local` - Actualizada VITE_API_URL

### 2. Configuración Frontend
- `src/config/environment.ts` - Actualizada URL por defecto de la API

### 3. Configuración Backend
- `server/index.ts` - Actualizada lista de orígenes permitidos en CORS
- `deploy.sh` - Actualizadas URLs de producción

### 4. Archivos de Despliegue Creados
- `ecosystem.config.js` - Configuración PM2 con nueva IP
- `vm-setup-commands.sh` - Script para ejecutar en la VM
- `test-connection.sh` - Script de verificación de conectividad
- `update-database.sh` - Script para actualizar base de datos

## URLs Actualizadas
- **Aplicación**: http://34.70.184.11:3001
- **API**: http://34.70.184.11:3001/api
- **Health Check**: http://34.70.184.11:3001/health

## Pasos para Desplegar

1. **En tu máquina local**: Ya completado ✅
   - Archivos actualizados con nueva IP
   - Scripts de despliegue creados

2. **Subir archivos a la VM**:
   ```bash
   # Ejemplo con scp (ajusta según tu método)
   scp -r . usuario@34.70.184.11:/ruta/del/proyecto/
   ```

3. **En la VM (34.70.184.11)**:
   ```bash
   chmod +x vm-setup-commands.sh
   ./vm-setup-commands.sh
   ```

4. **Verificar desde local**:
   ```bash
   ./test-connection.sh
   ```

## Verificaciones Importantes

- ✅ Puerto 3001 abierto en firewall de la VM
- ✅ PM2 instalado en la VM
- ✅ Node.js y npm instalados en la VM
- ✅ Base de datos accesible desde la VM
- ✅ Variables de entorno configuradas

## Comandos Útiles en la VM

```bash
# Ver estado de PM2
pm2 status

# Ver logs
pm2 logs

# Reiniciar aplicación
pm2 restart all

# Monitoreo en tiempo real
pm2 monit

# Ver variables de entorno
pm2 env 0
```
