# 🚀 Configuración de Producción - Casa de Cambios

## 📋 Resumen del Sistema

Este sistema está listo para producción con:

- ✅ 1 Usuario administrador
- ✅ 20 Monedas configuradas
- ✅ 1 Punto de atención principal
- ✅ Funcionalidad completa de asignación de saldos
- ✅ Base de datos limpia (sin datos de prueba)

## 🔧 Pasos para Despliegue en GCP

### 1. Preparar el Servidor

```bash
# En tu máquina virtual de GCP
git pull origin main
npm install
```

### 2. Configurar Variables de Entorno

Asegúrate de tener configurado `.env.production` con:

```env
DATABASE_URL="postgresql://usuario:password@host:puerto/database"
JWT_SECRET="tu-jwt-secret-seguro"
NODE_ENV="production"
```

### 3. Ejecutar Migración y Seed de Producción

```bash
# Aplicar migraciones
npx prisma migrate deploy

# Ejecutar seed de producción (SOLO LA PRIMERA VEZ)
npm run seed:production
```

### 4. Iniciar la Aplicación

```bash
# Modo producción
npm run build
npm start
```

## 🔑 Credenciales Iniciales

**Usuario Administrador:**

- Usuario: `admin`
- Contraseña: `Admin123!`

⚠️ **IMPORTANTE:** Cambia estas credenciales inmediatamente después del primer acceso.

## 💰 Configuración de Saldos

### Asignar Saldos al Punto Principal

1. Inicia sesión como administrador
2. Ve a "Gestión de Saldos Iniciales"
3. Selecciona el punto de atención principal
4. Asigna saldos para cada moneda que necesites

### Agregar Puntos de Atención Adicionales

```bash
# Desde la línea de comandos
npm run add:point "Nombre del Punto" "Dirección" "Ciudad" "Provincia" "Teléfono" "Código Postal"

# Ejemplo:
npm run add:point "Casa de Cambios Norte" "Av. Principal 123" "Quito" "Pichincha" "0987654321" "170135"
```

## 🏦 Monedas Disponibles

El sistema incluye 20 monedas principales:

- **Principales:** USD, EUR, GBP, CHF, CAD
- **Asiáticas:** JPY, CNY, AUD
- **Latinoamericanas:** COP, PEN, BRL, ARS, CLP, MXN, VES
- **Europeas:** SEK, NOK, DKK, PLN
- **Otras:** RUB

## 📊 Funcionalidades Principales

### ✅ Gestión de Saldos

- Asignación de saldos iniciales por punto y moneda
- Actualización de saldos existentes
- Vista consolidada de saldos por punto

### ✅ Gestión de Puntos

- Punto principal configurado
- Capacidad de agregar puntos adicionales
- Asignación independiente de saldos por punto

### ✅ Sistema de Usuarios

- Roles: ADMIN, OPERADOR, CONCESION, ADMINISTRATIVO
- Autenticación JWT
- Control de acceso por funcionalidad

## 🔒 Seguridad

- Contraseñas hasheadas con bcrypt
- Tokens JWT para autenticación
- Validación de roles por endpoint
- Headers de seguridad configurados

## 📝 Comandos Útiles

```bash
# Ver logs de la aplicación
pm2 logs

# Reiniciar la aplicación
pm2 restart all

# Agregar nuevo punto de atención
npm run add:point "Nombre" "Dirección" "Ciudad" "Provincia"

# Verificar estado de la base de datos
npx prisma studio
```

## ⚠️ Notas Importantes

1. **Primera vez:** Ejecuta `npm run seed:production` solo una vez
2. **Credenciales:** Cambia las credenciales por defecto inmediatamente
3. **Saldos:** Los saldos se asignan desde la interfaz web, no desde scripts
4. **Respaldos:** Configura respaldos automáticos de la base de datos
5. **Monitoreo:** Configura alertas para errores y disponibilidad

## 🆘 Solución de Problemas

### Error de conexión a base de datos

- Verifica `DATABASE_URL` en `.env.production`
- Confirma que la base de datos esté accesible

### Error de autenticación

- Verifica `JWT_SECRET` en variables de entorno
- Confirma que las credenciales sean correctas

### Problemas con saldos

- Verifica que el punto de atención esté activo
- Confirma que la moneda esté disponible
- Revisa los logs del servidor para errores específicos

## 🔧 Resolver Conflictos de Git en GCP

Si encuentras el error "Your local changes would be overwritten by merge":

```bash
# Ver qué archivos tienen cambios
git status

# Hacer stash de los cambios locales
git stash

# Hacer pull de los cambios remotos
git pull origin main

# Aplicar los cambios locales de vuelta (si es necesario)
git stash pop

# O descartar los cambios locales si no son importantes
git stash drop
```

---

🎉 **¡Sistema listo para producción!**
