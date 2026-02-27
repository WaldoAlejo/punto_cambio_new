# Análisis de Zona Horaria - Punto Cambio

## Configuración Actual

### Zona Horaria de Ecuador (Guayaquil)
- **Offset**: UTC-5 (GMT-5)
- **No usa DST** (horario de verano) - offset fijo todo el año
- **Hora actual Ecuador**: 5 horas menos que UTC

## Estado del Sistema

### ✅ Bien implementado:

1. **Utilidades de zona horaria** (`server/utils/timezone.ts`):
   ```typescript
   export const GYE_OFFSET_HOURS = -5;
   export const GYE_OFFSET_MS = Math.abs(GYE_OFFSET_HOURS) * 60 * 60 * 1000;
   ```

2. **Consultas por rango de fechas** - Usan correctamente:
   ```typescript
   const { gte, lt } = gyeDayRangeUtcFromDate(fecha);
   // Esto asegura que un "día" en Ecuador sea:
   // 00:00 GYE = 05:00 UTC hasta 23:59:59 GYE = 04:59:59 UTC siguiente día
   ```

3. **Cálculo de "hoy" en Ecuador**:
   ```typescript
   const hoyGyeStr = todayGyeDateOnly(); // "2025-02-27" en hora de Ecuador
   ```

### ⚠️ Problemas encontrados:

#### 1. Fechas de cierre guardadas en UTC
En `server/services/cierreService.ts`:
```typescript
// Línea ~469, ~589
fecha_cierre: new Date(), // Guarda UTC, no hora de Ecuador
```

**Impacto**: Cuando un usuario cierra caja a las 18:00 (hora Ecuador), se guarda como 23:00 UTC.

#### 2. Timestamps en respuestas JSON
Muchos endpoints usan:
```typescript
timestamp: new Date().toISOString() // Siempre en UTC
```

**Impacto**: Los logs y respuestas muestran hora UTC, no hora local de Ecuador.

#### 3. Validación de "día actual"
En algunos lugares se usa `new Date()` sin convertir a zona de Ecuador:
```typescript
const hoy = new Date(); // UTC del servidor
// Debería ser:
const hoyEcuador = nowEcuador(); // Hora actual en Ecuador
```

## Soluciones Recomendadas

### Opción 1: Configurar PostgreSQL (Recomendada)
Asegurar que PostgreSQL use UTC:
```sql
-- Verificar zona horaria
SHOW timezone;
-- Debería mostrar 'UTC'

-- Si no es UTC, cambiar en postgresql.conf:
-- timezone = 'UTC'
```

### Opción 2: Corregir fechas en el código
Para cada campo de fecha que se muestra al usuario, usar las utilidades de Ecuador:

```typescript
// En lugar de:
fecha_cierre: new Date()

// Usar:
import { nowEcuador } from "../utils/timezone.js";
fecha_cierre: nowEcuador()
```

### Opción 3: Formatear en el frontend
Asegurar que todas las fechas mostradas al usuario usen el formato de Ecuador:

```typescript
import { formatEcuadorDateTime } from "../utils/timezone";

// En la UI:
<span>{formatEcuadorDateTime(fecha)}</span>
```

## Flujo Correcto de Fechas

### Almacenamiento (Guardar):
1. El usuario realiza una transacción a las 14:30 (hora Ecuador)
2. El backend recibe la hora local del cliente o usa `nowEcuador()`
3. Se convierte a UTC: 19:30 UTC
4. Se guarda en PostgreSQL como UTC

### Recuperación (Leer):
1. Se lee la fecha UTC de la base de datos: 19:30 UTC
2. Se convierte a hora Ecuador: 14:30
3. Se muestra al usuario en formato local

### Cierre Diario:
1. El operador cierra caja el 27 de febrero a las 20:00 (hora Ecuador)
2. El sistema debe registrar el cierre como perteneciente al día 27 de febrero
3. El rango UTC para el día 27 de febrero es:
   - Inicio: 27 feb 05:00 UTC (00:00 GYE)
   - Fin: 28 feb 04:59:59 UTC (23:59:59 GYE)

## Archivos que necesitan revisión:

1. `server/services/cierreService.ts` - Fechas de cierre
2. `server/services/cierreUnificadoService.ts` - Fechas de cierre
3. `server/routes/*.ts` - Timestamps en respuestas
4. Frontend - Formateo de fechas para mostrar al usuario

## Verificación rápida:

Para verificar que todo funciona correctamente:

1. Crear una transacción a las 22:00 hora Ecuador
2. Verificar que se guarde como 03:00 UTC del día siguiente
3. Consultar el cierre del día - debe aparecer en el día correcto (hora Ecuador)
4. Verificar que el cierre no aparezca en el día UTC incorrecto
