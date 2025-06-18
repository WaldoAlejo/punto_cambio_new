
# Punto Cambio - Guía de Producción

## 🚀 Despliegue de Producción

### Prerrequisitos

- Node.js 18+
- PostgreSQL 15+
- PM2 (para gestión de procesos)
- Nginx (opcional, para reverse proxy)
- Docker (opcional, para contenedores)

### Variables de Entorno Requeridas

```bash
# Base de datos
DATABASE_URL="postgresql://usuario:password@host:5432/punto_cambio"

# Autenticación
JWT_SECRET="tu-secreto-jwt-super-seguro-de-256-bits"

# Aplicación
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://tu-dominio.com
LOG_LEVEL=info
```

### Despliegue con PM2

1. **Configurar variables de entorno:**
   ```bash
   cp .env.production .env
   # Editar .env con tus valores reales
   ```

2. **Ejecutar script de despliegue:**
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

3. **Monitorear aplicación:**
   ```bash
   pm2 status
   pm2 logs punto-cambio-api
   pm2 monit
   ```

### Despliegue con Docker

1. **Construir imagen:**
   ```bash
   docker build -t punto-cambio-api .
   ```

2. **Ejecutar con Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Verificar servicios:**
   ```bash
   docker-compose ps
   docker-compose logs app
   ```

### Monitoreo y Mantenimiento

#### Health Checks
```bash
# Verificar salud de la aplicación
./scripts/health-check.sh

# Endpoint de salud
curl http://localhost:3001/health
```

#### Logs
```bash
# Ver logs en tiempo real
npm run logs:error
npm run logs:combined

# Con PM2
pm2 logs punto-cambio-api

# Con Docker
docker-compose logs -f app
```

#### Backups
```bash
# Crear backup manual
./scripts/backup.sh

# Programar backups automáticos (crontab)
0 2 * * * /path/to/scripts/backup.sh
```

### Configuración de Nginx

1. **Instalar certificado SSL:**
   ```bash
   # Con Let's Encrypt
   certbot --nginx -d tu-dominio.com
   ```

2. **Configurar reverse proxy:**
   - Copiar `nginx.conf` a `/etc/nginx/`
   - Descomentar configuración HTTPS
   - Reiniciar Nginx: `systemctl restart nginx`

### Seguridad

#### Configuraciones Implementadas:
- ✅ Rate limiting (100 req/15min, 5 login/15min)
- ✅ Helmet.js para headers de seguridad
- ✅ Validación de entrada con Zod
- ✅ Sanitización de datos
- ✅ JWT con expiración (24h)
- ✅ Logs de seguridad
- ✅ CORS configurado
- ✅ Hashing de contraseñas (bcrypt rounds: 12)

#### Recomendaciones Adicionales:
- Usar HTTPS en producción
- Configurar firewall (ufw/iptables)
- Actualizar dependencias regularmente
- Monitoreo con herramientas como Datadog/New Relic
- Implementar rotación de logs

### Comandos Útiles

```bash
# Gestión de PM2
npm run pm2:start     # Iniciar aplicación
npm run pm2:stop      # Detener aplicación
npm run pm2:restart   # Reiniciar aplicación
npm run pm2:logs      # Ver logs

# Base de datos
npm run db:migrate    # Aplicar migraciones
npm run db:generate   # Generar cliente Prisma

# Mantenimiento
npm run health        # Verificar salud
npm run backup        # Crear backup
```

### Troubleshooting

#### Problemas Comunes:

1. **Error de conexión a BD:**
   - Verificar `DATABASE_URL`
   - Comprobar que PostgreSQL esté corriendo
   - Validar permisos de usuario

2. **Alto uso de memoria:**
   - Verificar configuración de PM2
   - Revisar logs por memory leaks
   - Ajustar `max_memory_restart`

3. **Rate limiting muy restrictivo:**
   - Ajustar límites en `server/index.js`
   - Configurar whitelist para IPs internas

4. **Logs creciendo demasiado:**
   - Configurar rotación de logs
   - Implementar log retention policy

### Métricas y Monitoreo

#### Endpoints de Monitoreo:
- `GET /health` - Estado general
- `GET /api/test` - Conexión BD + contador usuarios

#### Métricas Importantes:
- Tiempo de respuesta promedio
- Rate de errores (4xx/5xx)
- Uso de memoria y CPU
- Conexiones activas a BD
- Uptime de la aplicación

### Escalabilidad

Para escalar horizontalmente:

1. **Configurar PM2 en modo cluster:**
   ```javascript
   // ecosystem.config.js
   instances: 'max' // Usar todos los CPUs
   ```

2. **Load balancer con Nginx:**
   - Configurar múltiples upstream servers
   - Implementar health checks

3. **Base de datos:**
   - Configurar pool de conexiones
   - Considerar read replicas
   - Implementar caching (Redis)

### Actualizaciones

1. **Proceso de actualización:**
   ```bash
   git pull origin main
   npm ci --only=production
   npm run db:migrate
   pm2 restart punto-cambio-api
   ```

2. **Rolling updates con PM2:**
   ```bash
   pm2 reload punto-cambio-api
   ```

3. **Zero-downtime con Docker:**
   ```bash
   docker-compose up -d --no-deps app
   ```
