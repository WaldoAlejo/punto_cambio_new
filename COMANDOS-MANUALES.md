# 🔧 COMANDOS MANUALES PARA CORREGIR EL PROBLEMA (GCP)

## **IMPORTANTE: Ejecutar en tu VM de Google Cloud**

Estos comandos deben ejecutarse en tu máquina virtual `cevallos_oswaldo@punto-cambio-server`

## **OPCIÓN 1: Script Mejorado**

```bash
cd ~/punto_cambio_new
git pull  # Obtener los últimos cambios
chmod +x scripts/fix-migration-simple.sh
./scripts/fix-migration-simple.sh
```

## **OPCIÓN 2: Comandos Paso a Paso**

### **1. Aplicar migración SQL directamente**

```bash
cd ~/punto_cambio_new

# Cargar variables de entorno
source .env

# Aplicar SQL directamente
psql "$DATABASE_URL" -c "
ALTER TABLE \"PuntoAtencion\" ADD COLUMN IF NOT EXISTS \"es_principal\" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS \"PuntoAtencion_nombre_key\" ON \"PuntoAtencion\"(\"nombre\");
"
```

### **2. Regenerar cliente Prisma**

```bash
npx prisma generate
```

### **3. Ejecutar seed**

```bash
npx prisma db seed
```

### **4. Reiniciar servidor**

```bash
# Si usas PM2
pm2 restart all

# O si ejecutas manualmente
pkill -f "node.*server"
npm run dev:server
```

## **OPCIÓN 3: Si psql no está disponible**

### **1. Usar prisma db execute con schema**

```bash
cd ~/punto_cambio_new
npx prisma db execute --file prisma/migrations/20250808110320_add_es_principal_and_unique_nombre/migration.sql --schema prisma/schema.prisma
```

### **2. Continuar con los pasos 2-4 de la Opción 2**

## **VERIFICAR QUE FUNCIONÓ**

Después de ejecutar cualquiera de las opciones:

1. **Reinicia el servidor** (importante)
2. **Haz login con el usuario `operador`**
3. **Deberías ver los 3 puntos disponibles**:
   - Casa de Cambios Principal
   - amazonas1
   - Casa de Cambios Norte

## **🔑 CREDENCIALES DE PRUEBA**

- **admin** / **admin123** (ADMIN)
- **operador** / **operador123** (OPERADOR general)
- **operador1** / **operador123** (OPERADOR amazonas1)
