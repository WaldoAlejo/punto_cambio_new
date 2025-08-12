# 🚀 Despliegue Súper Simple - Punto Cambio

## ⚡ Proceso de 3 Pasos

### 1️⃣ Primera vez (Solo una vez)

```bash
# En tu VM de GCP
git clone <tu-repositorio>
cd punto_cambio_new
npm install
npx prisma generate
npx prisma db push
./deploy.sh full
```

### 2️⃣ Actualizaciones diarias (Lo más común)

```bash
# En tu VM de GCP
./deploy.sh quick
```

### 3️⃣ Verificar que funciona

```bash
# Verificar estado
pm2 status

# Ver la aplicación
# Abrir en navegador: http://35.238.95.118:3001
```

## 🎯 Eso es todo!

### ¿Qué hace `./deploy.sh quick`?

1. `git pull origin main` - Descarga cambios de GitHub
2. `npm run build` - Construye frontend y backend
3. `pm2 restart punto-cambio-api` - Reinicia la aplicación

### ¿Cuándo usar `./deploy.sh full`?

- Primera instalación
- Cambios en dependencias (package.json)
- Cambios en base de datos (schema.prisma)
- Problemas con la aplicación

## 🔧 Comandos útiles

```bash
# Ver logs si algo falla
pm2 logs punto-cambio-api

# Reiniciar manualmente
pm2 restart punto-cambio-api

# Ver estado
pm2 status
```

## 🌐 URLs importantes

- **Aplicación**: http://35.238.95.118:3001
- **API**: http://35.238.95.118:3001/api
- **Health Check**: http://35.238.95.118:3001/health

## 🚨 Si algo falla

1. Ver logs: `pm2 logs punto-cambio-api`
2. Reiniciar: `pm2 restart punto-cambio-api`
3. Si sigue fallando: `./deploy.sh full`

## 📱 Flujo de trabajo diario

1. **En VSCode**: Hacer cambios, commit, push a GitHub
2. **En VM**: `./deploy.sh quick`
3. **Verificar**: Abrir http://35.238.95.118:3001

¡Listo! 🎉
