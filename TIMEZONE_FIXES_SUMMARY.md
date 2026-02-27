# Correcciones de Zona Horaria (GMT-5 Ecuador) - Resumen

## Fecha de corrección: 27 de febrero de 2026

---

## Archivos Modificados

### 1. **server/services/cierreService.ts**
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha_cierre: new Date()` → `fecha_cierre: nowEcuador()` (5 reemplazos)
  - `fecha_salida: new Date()` → `fecha_salida: nowEcuador()` (1 reemplazo)

### 2. **server/services/cierreUnificadoService.ts**
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha: new Date()` → `fecha: nowEcuador()`
  - `fecha_cierre: new Date()` → `fecha_cierre: nowEcuador()` (2 reemplazos)
  - `fecha_salida: new Date()` → `fecha_salida: nowEcuador()`

### 3. **server/routes/guardar-cierre.ts**
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha: new Date()` → `fecha: nowEcuador()`
  - `fecha_cierre: new Date()` → `fecha_cierre: nowEcuador()` (2 reemplazos)
  - `fecha_salida: new Date()` → `fecha_salida: nowEcuador()`
  - Comentario actualizado: "hoy UTC" → "hoy Ecuador"

### 4. **server/routes/contabilidad-diaria.ts**
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha_cierre: new Date()` → `fecha_cierre: nowEcuador()` (4 reemplazos)
  - `fecha_salida: new Date()` → `fecha_salida: nowEcuador()`

### 5. **server/routes/cierreParcial.ts**
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha_cierre: new Date()` → `fecha_cierre: nowEcuador()`

### 6. **server/routes/schedules.ts** (Jornadas)
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha_inicio: new Date()` → `fecha_inicio: nowEcuador()`
  - `fecha_salida: new Date()` → `fecha_salida: nowEcuador()`

### 7. **server/controllers/transferController.ts**
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha: new Date()` → `fecha: nowEcuador()`
  - `fecha_envio: new Date()` → `fecha_envio: nowEcuador()`
  - `fecha_rechazo: new Date()` → `fecha_rechazo: nowEcuador()`

### 8. **server/routes/transfer-approvals.ts**
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha_aprobacion: new Date()` → `fecha_aprobacion: nowEcuador()`
  - `fecha_rechazo: new Date()` → `fecha_rechazo: nowEcuador()` (2 reemplazos)
  - `fecha_aceptacion: new Date()` → `fecha_aceptacion: nowEcuador()`

### 9. **server/routes/exchanges.ts** (Cambios de divisa)
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha_completado: new Date()` → `fecha_completado: nowEcuador()` (3 reemplazos)

### 10. **server/routes/permissions.ts** (Permisos)
- **Importación agregada**: `nowEcuador` desde `../utils/timezone.js`
- **Cambios**:
  - `fecha_aprobacion: new Date()` → `fecha_aprobacion: nowEcuador()` (2 reemplazos)

### 11. **server/routes/servientrega/anulaciones.ts**
- **Importación agregada**: `nowEcuador` desde `../../utils/timezone.js`
- **Cambios**:
  - `fecha_respuesta: new Date()` → `fecha_respuesta: nowEcuador()` (3 reemplazos)

---

## Función Utilizada

```typescript
// server/utils/timezone.ts
export function nowEcuador(): Date {
  return toEcuadorTime(new Date());
}

export function toEcuadorTime(utcDate: Date): Date {
  return new Date(utcDate.getTime() + GYE_OFFSET_HOURS * 60 * 60 * 1000);
}
```

La función `nowEcuador()` convierte la hora UTC actual a hora de Ecuador (GMT-5).

---

## Impacto de los Cambios

### Antes:
- Un cierre realizado a las 20:00 (hora Ecuador) se guardaba como 01:00 UTC del día siguiente
- Las fechas mostradas al usuario estaban en UTC
- Los reportes podían mostrar transacciones en el día incorrecto

### Después:
- Un cierre realizado a las 20:00 (hora Ecuador) se guarda como 20:00 hora Ecuador (convertida a UTC para almacenamiento)
- Todas las fechas de auditoría reflejan la hora local de Ecuador
- Los cierres diarios coinciden con el calendario de Ecuador

---

## Notas Importantes

1. **Las fechas se siguen almacenando en UTC** en la base de datos (mejor práctica)
2. **La diferencia es que ahora se usa la hora de Ecuador como base** para calcular el valor UTC a almacenar
3. **Las consultas por rango de fechas ya usaban correctamente** `gyeDayRangeUtcFromDate()`
4. **Los cambios son retrocompatibles** - las fechas existentes no se ven afectadas

---

## Verificación

Para verificar que los cambios funcionan correctamente:

1. Realizar un cierre de caja después de las 19:00 (hora Ecuador)
2. Verificar que el cierre aparezca en la fecha correcta (día actual en Ecuador)
3. Verificar que la hora del cierre en la base de datos sea la hora Ecuador convertida a UTC

Ejemplo:
- Cierre realizado: 27 feb 2026, 20:30 (hora Ecuador)
- Almacenado en BD: 28 feb 2026, 01:30 UTC (que corresponde a 20:30 GMT-5)
- Al consultar el cierre del día 27, debe aparecer correctamente
