# 🔧 Solución al Problema de Migración

## Problema Identificado

La migración falló porque las tablas no existen en la base de datos. Esto puede suceder cuando:

1. La base de datos se resetea pero las migraciones no se aplican correctamente
2. Hay un problema de conectividad durante el proceso
3. El esquema no está sincronizado

## 🚀 Solución Paso a Paso

### Opción 1: Usar db push (Recomendado para desarrollo)

```bash
# 1. Sincronizar el esquema directamente con la base de datos
npx prisma db push

# 2. Ejecutar el seed manualmente
npx prisma db seed
```

### Opción 2: Crear migración inicial

```bash
# 1. Crear una migración inicial con todo el esquema
npx prisma migrate dev --name init

# 2. Si ya existe, resetear y crear nueva
npx prisma migrate reset --force
```

### Opción 3: Migración manual (si las anteriores fallan)

```bash
# 1. Generar el SQL del esquema
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > init.sql

# 2. Aplicar manualmente el SQL a la base de datos
# (ejecutar init.sql en el cliente de PostgreSQL)

# 3. Marcar como aplicada
npx prisma migrate resolve --applied init

# 4. Ejecutar seed
npx prisma db seed
```

## 🎯 Comandos Específicos para tu Caso

Ejecuta estos comandos en orden en la máquina virtual:

```bash
# 1. Verificar conexión
npx prisma db pull

# 2. Sincronizar esquema (esto debería crear todas las tablas)
npx prisma db push

# 3. Generar cliente Prisma
npx prisma generate

# 4. Ejecutar seed
npx prisma db seed

# 5. Verificar que todo funciona
npm run dev
```

## 🔍 Verificación

Después de ejecutar los comandos, verifica:

1. **Tablas creadas**: Deberían existir todas las tablas del esquema
2. **Enum RolUsuario**: Debe incluir ADMINISTRATIVO
3. **Usuario administrativo**: Debe existir en la tabla Usuario
4. **Datos de prueba**: Deben estar todos los datos del seed

## 🆘 Si Persisten los Problemas

Si los comandos anteriores no funcionan:

```bash
# Verificar el estado actual de la base de datos
npx prisma studio

# Ver qué tablas existen
npx prisma db pull

# Comparar esquemas
npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma
```

## 📋 Checklist de Verificación

- [ ] Base de datos conecta correctamente
- [ ] Esquema sincronizado con `npx prisma db push`
- [ ] Cliente Prisma generado
- [ ] Seed ejecutado exitosamente
- [ ] Usuario administrativo creado
- [ ] Servidor inicia sin errores
- [ ] Login con usuario administrativo funciona

## 🎯 Credenciales de Prueba

Una vez que todo funcione:

- **Usuario**: `administrativo`
- **Contraseña**: `admin123`
- **Rol**: ADMINISTRATIVO
- **Funcionalidades**: Gestión de horarios, salidas espontáneas, cualquier punto de atención
