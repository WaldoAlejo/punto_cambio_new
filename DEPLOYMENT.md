# Instrucciones de Despliegue

Este documento contiene instrucciones para desplegar la aplicación Punto Cambio en un servidor de producción.

## Requisitos

- Node.js 18 o superior
- PM2 (gestor de procesos para Node.js)
- PostgreSQL 14 o superior
- Git

## Scripts de Despliegue

### deploy.sh

Este script realiza el despliegue completo de la aplicación:

```bash
./deploy.sh
```

El script realiza las siguientes acciones:

- Crea un respaldo de la aplicación actual
- Detiene la aplicación actual
- Actualiza las variables de entorno
- Instala dependencias
- Genera el cliente de Prisma
- Opcionalmente limpia la base de datos y ejecuta el seed completo
- Limpia el directorio dist
- Verifica que existe el archivo ecosystem.config.cjs
- Construye el backend
- Construye el frontend
- Inicia la aplicación con PM2
- Verifica el estado de la aplicación

### status.sh

Este script verifica el estado de la aplicación:

```bash
./status.sh
```

El script realiza las siguientes acciones:

- Verifica el estado de PM2
- Verifica que la aplicación está respondiendo
- Verifica los logs de PM2
- Verifica el uso de memoria
- Verifica el uso de disco
- Verifica los procesos en ejecución
- Verifica los puertos en uso

### restart.sh

Este script reinicia la aplicación:

```bash
./restart.sh
```

El script realiza las siguientes acciones:

- Reinicia la aplicación con PM2
- Verifica el estado de la aplicación
- Verifica que la aplicación está respondiendo

## Pasos para el Despliegue

### 1. Clonar el Repositorio

```bash
git clone <URL_DEL_REPOSITORIO> punto_cambio_new
cd punto_cambio_new
```

### 2. Ejecutar el Script de Despliegue

```bash
./deploy.sh
```

### 3. Verificar el Despliegue

```bash
./status.sh
```

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

3. Reinicia la aplicación:

```bash
./restart.sh
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
