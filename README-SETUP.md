
# Configuración del proyecto

## Para ejecutar en desarrollo local:

### 1. Instalar dependencias del frontend:
```bash
npm install
```

### 2. Configurar la base de datos:
```bash
# Generar cliente de Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Ejecutar seed (crear usuario admin)
npx prisma db seed
```

### 3. Instalar dependencias del servidor:
```bash
# Instalar dependencias del servidor
npm install --prefix . express cors bcryptjs nodemon
```

### 4. Ejecutar en desarrollo:

**Terminal 1 - Backend API:**
```bash
node server/index.js
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 5. Acceder a la aplicación:
- Frontend: http://localhost:8080
- API: http://localhost:3001

### Credenciales por defecto:
- Usuario: admin
- Contraseña: admin123
