# 📅 Manejo de Fechas con Zona Horaria de Ecuador

**Fecha de implementación:** 3 de octubre, 2025  
**Estado:** ✅ IMPLEMENTADO

---

## 🌍 Zona Horaria de Ecuador

Ecuador (Guayaquil) utiliza:

- **Zona horaria:** UTC-5 (America/Guayaquil)
- **Sin horario de verano:** Ecuador NO cambia de hora durante el año
- **Offset fijo:** -5 horas respecto a UTC

---

## 📚 Utilidades Disponibles

Todas las funciones están en: `/server/utils/timezone.ts`

### 🔄 Conversión de Fechas

#### `toEcuadorTime(utcDate: Date): Date`

Convierte una fecha UTC a hora de Ecuador.

```typescript
import { toEcuadorTime } from "../utils/timezone.js";

const utcDate = new Date("2025-10-03T23:00:00.000Z"); // UTC
const ecuadorDate = toEcuadorTime(utcDate);
// Resultado: 2025-10-03T18:00:00.000Z (representa las 18:00 de Ecuador)
```

#### `fromEcuadorToUTC(ecuadorDate: Date): Date`

Convierte una fecha de Ecuador a UTC para guardar en base de datos.

```typescript
import { fromEcuadorToUTC } from "../utils/timezone.js";

const ecuadorDate = new Date("2025-10-03T18:00:00"); // 18:00 Ecuador
const utcDate = fromEcuadorToUTC(ecuadorDate);
// Resultado: 2025-10-03T23:00:00.000Z (UTC)
```

### 📝 Formateo de Fechas

#### `formatEcuadorDateTime(utcDate: Date): string`

Formatea una fecha UTC al formato corto de Ecuador: **DD/MM/YYYY HH:mm**

```typescript
import { formatEcuadorDateTime } from "../utils/timezone.js";

const utcDate = new Date("2025-10-03T23:00:00.000Z");
const formatted = formatEcuadorDateTime(utcDate);
// Resultado: "03/10/2025 18:00"
```

#### `formatEcuadorDate(utcDate: Date): string`

Formatea solo la fecha: **DD/MM/YYYY**

```typescript
import { formatEcuadorDate } from "../utils/timezone.js";

const utcDate = new Date("2025-10-03T23:00:00.000Z");
const formatted = formatEcuadorDate(utcDate);
// Resultado: "03/10/2025"
```

#### `formatEcuadorTime(utcDate: Date): string`

Formatea solo la hora: **HH:mm:ss**

```typescript
import { formatEcuadorTime } from "../utils/timezone.js";

const utcDate = new Date("2025-10-03T23:00:00.000Z");
const formatted = formatEcuadorTime(utcDate);
// Resultado: "18:00:00"
```

### 🕐 Fecha/Hora Actual

#### `nowEcuador(): Date`

Obtiene la fecha y hora actual de Ecuador.

```typescript
import { nowEcuador } from "../utils/timezone.js";

const ahora = nowEcuador();
console.log(formatEcuadorDateTime(ahora));
// Muestra la hora actual de Ecuador
```

### 🏗️ Crear Fechas

#### `createEcuadorDate(year, month, day, hour?, minute?, second?): Date`

Crea una fecha UTC desde componentes de fecha/hora de Ecuador.

```typescript
import { createEcuadorDate } from "../utils/timezone.js";

// Crear fecha: 3 de octubre de 2025, 18:30:00 (Ecuador)
const fecha = createEcuadorDate(2025, 10, 3, 18, 30, 0);
// Resultado: Date en UTC que representa ese momento en Ecuador
```

**Nota:** El mes es 1-12 (no 0-11 como en JavaScript nativo).

---

## 🎯 Casos de Uso

### 1. Mostrar Fechas al Usuario

**❌ ANTES (Incorrecto):**

```typescript
console.log(`Fecha: ${fecha.toISOString()}`);
// Muestra: 2025-10-03T23:00:00.000Z (confuso para usuarios de Ecuador)
```

**✅ AHORA (Correcto):**

```typescript
import { formatEcuadorDateTime } from "../utils/timezone.js";

console.log(`Fecha: ${formatEcuadorDateTime(fecha)} (Ecuador)`);
// Muestra: 03/10/2025 18:00 (Ecuador) (claro y legible)
```

### 2. Guardar Fechas en Base de Datos

Las fechas en la base de datos **siempre se guardan en UTC**. Esto es correcto y no debe cambiar.

```typescript
// ✅ Correcto - Prisma maneja UTC automáticamente
await prisma.movimientoSaldo.create({
  data: {
    fecha_asignacion: new Date(), // Se guarda en UTC
    monto: 100,
    // ... otros campos
  },
});
```

### 3. Filtrar por Rango de Fechas

Usa las funciones existentes de `timezone.ts`:

```typescript
import { gyeDayRangeUtcFromYMD } from "../utils/timezone.js";

// Obtener todos los movimientos del 3 de octubre de 2025 (Ecuador)
const { gte, lt } = gyeDayRangeUtcFromYMD(2025, 10, 3);

const movimientos = await prisma.movimientoSaldo.findMany({
  where: {
    fecha_asignacion: {
      gte: gte, // Inicio del día en Ecuador (convertido a UTC)
      lt: lt, // Fin del día en Ecuador (convertido a UTC)
    },
  },
});
```

### 4. Comparar Fechas

```typescript
import { toEcuadorTime } from "../utils/timezone.js";

const fecha1UTC = new Date("2025-10-03T23:00:00.000Z");
const fecha2UTC = new Date("2025-10-04T04:00:00.000Z");

// Convertir a hora de Ecuador para comparar
const fecha1Ecuador = toEcuadorTime(fecha1UTC); // 18:00 del 3 de octubre
const fecha2Ecuador = toEcuadorTime(fecha2UTC); // 23:00 del 3 de octubre

// Ambas son del mismo día en Ecuador
```

---

## 📊 Scripts Actualizados

Los siguientes scripts ya usan las funciones de timezone de Ecuador:

### ✅ `validar-backend.ts`

- Muestra fechas en formato Ecuador
- Ejemplo: `📅 Fecha de corte: 02/10/2025 23:00 (Ecuador)`

### ✅ `actualizar-saldos.ts`

- Muestra fechas en formato Ecuador
- Ejemplo: `📅 Fecha de corte: 02/10/2025 23:00 (Ecuador)`

### ✅ `calcular-saldos.ts`

- Muestra fechas en formato Ecuador
- Ejemplo: `📅 Fecha de inicio: 30/09/2025 00:00 (Ecuador)`
- Ejemplo: `📅 Fecha de corte: 02/10/2025 23:00 (Ecuador)`

---

## 🔧 Cómo Actualizar Código Existente

### Paso 1: Importar las funciones

```typescript
import {
  formatEcuadorDateTime,
  formatEcuadorDate,
  toEcuadorTime,
  nowEcuador,
} from "../utils/timezone.js";
```

### Paso 2: Reemplazar formateo de fechas

**Buscar:**

```typescript
fecha.toISOString();
fecha.toLocaleString("es-EC", { timeZone: "America/Guayaquil" });
```

**Reemplazar con:**

```typescript
formatEcuadorDateTime(fecha);
```

### Paso 3: Actualizar logs y mensajes

**Antes:**

```typescript
console.log(`Fecha: ${fecha.toISOString()}`);
```

**Después:**

```typescript
console.log(`Fecha: ${formatEcuadorDateTime(fecha)} (Ecuador)`);
```

---

## 📖 Principios Importantes

### 1. **Base de Datos = UTC**

- ✅ Todas las fechas en la BD se guardan en UTC
- ✅ Prisma maneja esto automáticamente
- ❌ NO intentes guardar fechas en hora local

### 2. **Mostrar al Usuario = Ecuador**

- ✅ Siempre convierte a hora de Ecuador para mostrar
- ✅ Usa `formatEcuadorDateTime()` para logs y reportes
- ✅ Indica claramente que es hora de Ecuador: `(Ecuador)`

### 3. **Cálculos = UTC**

- ✅ Realiza cálculos y comparaciones en UTC
- ✅ Solo convierte a Ecuador para mostrar resultados
- ❌ NO hagas aritmética de fechas en hora local

### 4. **Entrada del Usuario = Convertir a UTC**

- ✅ Si el usuario ingresa una fecha/hora, asume que es de Ecuador
- ✅ Convierte a UTC antes de guardar: `fromEcuadorToUTC()`
- ✅ Valida que la fecha sea válida

---

## 🧪 Ejemplos de Prueba

### Probar Conversión

```typescript
import {
  formatEcuadorDateTime,
  toEcuadorTime,
  fromEcuadorToUTC,
} from "../utils/timezone.js";

// Fecha UTC
const utc = new Date("2025-10-03T23:00:00.000Z");
console.log("UTC:", utc.toISOString());
// UTC: 2025-10-03T23:00:00.000Z

console.log("Ecuador:", formatEcuadorDateTime(utc));
// Ecuador: 03/10/2025 18:00

// Convertir de vuelta
const ecuadorDate = toEcuadorTime(utc);
const backToUTC = fromEcuadorToUTC(ecuadorDate);
console.log("De vuelta a UTC:", backToUTC.toISOString());
// De vuelta a UTC: 2025-10-03T23:00:00.000Z
```

### Probar Rango de Fechas

```typescript
import { gyeDayRangeUtcFromYMD } from "../utils/timezone.js";

// Día completo: 3 de octubre de 2025 (Ecuador)
const { gte, lt } = gyeDayRangeUtcFromYMD(2025, 10, 3);

console.log("Inicio (UTC):", gte.toISOString());
// Inicio (UTC): 2025-10-03T05:00:00.000Z (00:00 Ecuador)

console.log("Fin (UTC):", lt.toISOString());
// Fin (UTC): 2025-10-04T05:00:00.000Z (00:00 del día siguiente Ecuador)
```

---

## 🚀 Próximos Pasos

### Recomendaciones para el Futuro

1. **Actualizar Servicios**

   - Revisar `/server/services/` para usar funciones de timezone
   - Especialmente en reportes y logs

2. **Actualizar Rutas**

   - Revisar `/server/routes/` para formatear fechas correctamente
   - Asegurar que las respuestas API incluyan fechas en formato Ecuador

3. **Actualizar Frontend**

   - Crear funciones similares en el frontend
   - Asegurar consistencia entre backend y frontend

4. **Documentar APIs**
   - Indicar claramente que las fechas en la API están en UTC
   - Proporcionar ejemplos de conversión

---

## 📚 Referencias

- **Archivo de utilidades:** `/server/utils/timezone.ts`
- **Scripts actualizados:** `/server/scripts/`
- **Zona horaria IANA:** `America/Guayaquil`
- **Offset UTC:** -5 horas (sin cambios por horario de verano)

---

## ✅ Checklist de Implementación

- [x] Crear funciones de formateo en `timezone.ts`
- [x] Actualizar `validar-backend.ts`
- [x] Actualizar `actualizar-saldos.ts`
- [x] Actualizar `calcular-saldos.ts`
- [x] Crear documentación completa
- [ ] Actualizar servicios (opcional, según necesidad)
- [ ] Actualizar rutas (opcional, según necesidad)
- [ ] Actualizar frontend (opcional, según necesidad)

---

**Última actualización:** 3 de octubre, 2025  
**Autor:** Sistema de Gestión de Punto Cambio  
**Versión:** 1.0
