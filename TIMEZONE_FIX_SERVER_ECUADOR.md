# Corrección de Timezone - Servidor en Ecuador

## Fecha: 06 de marzo de 2026

---

## 🎯 Problema Principal Identificado

El servidor está configurado con timezone de Ecuador (GMT-5), pero las funciones de timezone asumían que `new Date()` devolvía UTC. Esto causaba:

1. **Doble conversión de timezone**: Cuando se usaba `nowEcuador()`, se restaban 5 horas de una hora que YA era de Ecuador
2. **Cierres guardados con fecha incorrecta**: Un cierre a las 20:00 Ecuador se guardaba como 15:00 Ecuador (05:00 UTC del día anterior)
3. **Desfase en reportes**: Los cierres aparecían en días incorrectos o no aparecían

---

## 🔍 Análisis Técnico

### Configuración del Servidor
```
Hora del servidor: Fri Mar 06 2026 10:54:10 GMT-0500 (hora de Ecuador)
Hora UTC (ISO): 2026-03-06T15:54:10.558Z
Offset (minutos): 300 (GMT-5)
```

### Problema con `nowEcuador()` anterior
```typescript
// Código anterior (INCORRECTO para servidor en Ecuador):
export function nowEcuador(): Date {
  return toEcuadorTime(new Date()); // Resta 5 horas de hora local Ecuador
}

// Resultado:
// new Date() = 10:54 GMT-5 (hora Ecuador)
// nowEcuador() = 05:54 GMT-5 (¡5 horas antes!)
```

---

## 🔧 Solución Implementada

### 1. Nueva función `isServerInEcuador()`
```typescript
export function isServerInEcuador(): boolean {
  return new Date().getTimezoneOffset() === 300; // 300 minutos = 5 horas = GMT-5
}
```

### 2. Corrección de `nowEcuador()`
```typescript
export function nowEcuador(): Date {
  if (isServerInEcuador()) {
    return new Date(); // El servidor ya está en Ecuador
  }
  return toEcuadorTime(new Date()); // Convertir desde UTC
}
```

### 3. Corrección de `toEcuadorTime()`
```typescript
export function toEcuadorTime(utcDate: Date): Date {
  // Si el servidor ya está en Ecuador, la fecha ya es hora local
  if (isServerInEcuador()) {
    return new Date(utcDate.getTime());
  }
  // Si el servidor está en UTC, convertimos a hora Ecuador
  return new Date(utcDate.getTime() + GYE_OFFSET_HOURS * 60 * 60 * 1000);
}
```

### 4. Corrección de funciones de rango de fechas

#### `gyeDayRangeUtcFromDate()`
```typescript
export function gyeDayRangeUtcFromDate(date: Date): { gte: Date; lt: Date } {
  if (isServerInEcuador()) {
    // Servidor en Ecuador - 'date' tiene hora local Ecuador
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    
    // 00:00 en Ecuador = 05:00 UTC del mismo día
    const gte = new Date(Date.UTC(y, m, d, 5, 0, 0, 0));
    const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
    return { gte, lt };
  }
  
  // Servidor en UTC - usar lógica original
  // ... (código anterior)
}
```

#### `todayGyeDateOnly()`
```typescript
export function todayGyeDateOnly(now: Date = new Date()): string {
  let y: number, m: number, d: number;
  
  if (isServerInEcuador()) {
    // Servidor en Ecuador - usar fecha local directamente
    y = now.getFullYear();
    m = now.getMonth() + 1;
    d = now.getDate();
  } else {
    // Servidor en UTC u otro timezone - convertir
    const asGye = toGyeClock(now);
    y = asGye.getUTCFullYear();
    m = asGye.getUTCMonth() + 1;
    d = asGye.getUTCDate();
  }
  
  // ... formateo
}
```

### 5. Corrección de funciones de formateo

Las funciones ahora detectan el timezone del servidor y usan métodos locales o UTC según corresponda:

```typescript
export function formatEcuadorDateTime(utcDate: Date): string {
  const ecuadorDate = toEcuadorTime(utcDate);

  // Usar métodos locales si servidor está en Ecuador, UTC si no
  const getDay = isServerInEcuador() ? (d: Date) => d.getDate() : (d: Date) => d.getUTCDate();
  const getMonth = isServerInEcuador() ? (d: Date) => d.getMonth() : (d: Date) => d.getUTCMonth();
  // ... etc
}
```

---

## 📁 Archivo Modificado

| Archivo | Cambios |
|---------|---------|
| `server/utils/timezone.ts` | Agregada función `isServerInEcuador()`, corregidas `nowEcuador()`, `toEcuadorTime()`, `fromEcuadorToUTC()`, `gyeDayRangeUtcFromDate()`, `todayGyeDateOnly()`, y funciones de formateo |

---

## ✅ Resultado Esperado

### Antes (Problema):
```
Hora real cierre: 06 mar 2026, 20:30 (Ecuador/GMT-5)
new Date()        : 06 mar 2026, 20:30 GMT-5
nowEcuador()      : 06 mar 2026, 15:30 GMT-5 (¡5 horas antes!)
Guardado en BD    : 06 mar 2026, 20:30 UTC (¡corresponde a 15:30 Ecuador!)
Al consultar      : El cierre aparece con 5 horas de retraso o en día incorrecto
```

### Después (Solución):
```
Hora real cierre: 06 mar 2026, 20:30 (Ecuador/GMT-5)
new Date()        : 06 mar 2026, 20:30 GMT-5
nowEcuador()      : 06 mar 2026, 20:30 GMT-5 (correcto, mismo valor)
Guardado en BD    : 07 mar 2026, 01:30 UTC (que es 20:30 GMT-5)
Al consultar      : El cierre aparece correctamente en el día 06 de marzo
```

---

## 🧪 Pruebas Recomendadas

1. **Verificar hora del servidor**:
   ```bash
   date
   # Debe mostrar hora Ecuador (GMT-5)
   ```

2. **Probar función todayGyeDateOnly()**:
   ```typescript
   import { todayGyeDateOnly } from "./utils/timezone";
   console.log(todayGyeDateOnly()); // Debe mostrar fecha actual de Ecuador
   ```

3. **Probar cierre de caja**:
   - Realizar cierre a las 20:00 (hora Ecuador)
   - Verificar que aparezca en el día correcto
   - Verificar que la hora guardada sea correcta

4. **Verificar rango de fechas**:
   ```typescript
   import { gyeDayRangeUtcFromDate } from "./utils/timezone";
   const { gte, lt } = gyeDayRangeUtcFromDate(new Date());
   console.log(gte, lt); // Debe mostrar rango UTC correcto
   ```

---

## 📝 Notas Técnicas

- **Las fechas se siguen almacenando en UTC** en PostgreSQL (mejor práctica)
- **El servidor debe estar configurado con timezone de Ecuador** (GMT-5)
- **Las funciones ahora detectan automáticamente** el timezone del servidor
- **Si el servidor se mueve a UTC**, las funciones seguirán funcionando correctamente

---

## 🔄 Compatibilidad

- ✅ Servidor en Ecuador (GMT-5) - **RECOMENDADO**
- ✅ Servidor en UTC - Funciona correctamente
- ✅ Servidor en otro timezone - Funciona correctamente

---

## 📚 Documentación Relacionada

- `TIMEZONE_ANALYSIS.md` - Análisis original del problema
- `TIMEZONE_FIXES_COMPLETE.md` - Correcciones anteriores (obsoletas)
- `TIMEZONE_FIXES_SUMMARY.md` - Resumen de correcciones anteriores (obsoleto)
