# 🔍 ANÁLISIS: Race Condition en Creación de Movimientos

## Fecha: 21 de marzo 2026
## Punto: Royal Pacific
## Problema: Duplicado de movimiento EGRESO COP -$102,000

---

## 🎯 Causa Raíz Identificada

El duplicado del movimiento EGRESO COP con diferencia de **19 milisegundos** indica una **Race Condition** (condición de carrera) en el proceso de creación de cambios de divisa.

---

## 📋 Cómo Ocurrió

### Secuencia Temporal:
```
Hora: 16:50:35.559Z → Movimiento 1 creado (ID: c390108a...)
Hora: 16:50:35.578Z → Movimiento 2 creado (ID: 8347db05...)
Diferencia: 19 milisegundos
```

### Escenario Probable:

1. **Usuario hace clic** en "Guardar Cambio" o "Procesar"
2. **Doble clic accidental** o **reintentos automáticos** del navegador
3. **Dos solicitudes HTTP** llegan casi simultáneamente al servidor
4. **Ambas solicitudes** pasan las validaciones porque:
   - No hay bloqueo (lock) distribuido
   - La validación de "¿ya existe movimiento?" ocurre antes de crear
   - Ambas pasan la validación casi al mismo tiempo
5. **Ambas solicitudes** crean el movimiento resultando en duplicado

---

## 🔧 Problemas en el Código

### 1. **Falta de Idempotencia Real**

El endpoint `/exchanges` crea el cambio y los movimientos, pero no tiene mecanismo para evitar duplicados si la misma petición llega dos veces.

### 2. **Validación de Existencia Insuficiente**

```typescript
// Línea 1247-1252: La validación ocurre DESPUÉS de crear movimientos
const movimientosCreados = await tx.movimientoSaldo.count({
  where: {
    tipo_referencia: 'EXCHANGE',
    referencia_id: cambio.id
  }
});
```

Esta validación cuenta movimientos DESPUÉS de crearlos, no ANTES.

### 3. **No hay Índice Único en Base de Datos**

No existe un constraint que impida:
- Mismo `referencia_id`
- Mismo `tipo_referencia`
- Misma `moneda_id`
- Mismo `tipo_movimiento`

---

## 💡 Soluciones Recomendadas

### Solución 1: Índice Único en Base de Datos (Inmediata)

```sql
-- Prevenir duplicados a nivel de base de datos
CREATE UNIQUE INDEX idx_movimiento_unico 
ON movimiento_saldo(referencia_id, tipo_referencia, moneda_id, tipo_movimiento);
```

### Solución 2: Token de Idempotencia (Recomendada)

```typescript
// Frontend: Generar token único por operación
const idempotencyKey = generateUUID();

// Backend: Guardar token y rechazar duplicados
const exists = await redis.get(`idempotency:${idempotencyKey}`);
if (exists) return res.status(409).json({ error: 'Operación ya procesada' });

await redis.setex(`idempotency:${idempotencyKey}`, 3600, 'processed');
```

### Solución 3: Bloqueo Distribuido (Avanzada)

```typescript
// Usar Redis o similar para bloquear durante la transacción
const lock = await redlock.lock(`exchange:${userId}`, 10000);
try {
  // Procesar cambio
} finally {
  await lock.unlock();
}
```

### Solución 4: Deshabilitar Botón en Frontend (Temporal)

```javascript
// Deshabilitar botón después del primer clic
button.disabled = true;
button.textContent = 'Procesando...';
```

---

## 📊 Impacto del Bug

| Aspecto | Valor |
|---------|-------|
| Movimientos duplicados encontrados | 1 (COP -$102,000) |
| Diferencia en saldo COP | $102,000 |
| Usuarios afectados | Royal Pacific |
| Período | 20 marzo 2026 |

---

## ✅ Acciones Tomadas

1. ✅ Eliminado movimiento duplicado
2. ✅ Recalculados saldos
3. ✅ Actualizada tabla Saldo
4. 📋 Documentado problema para desarrollo

---

## 🚨 Recomendación Urgente

Implementar **al menos una** de las soluciones antes de que el problema se repita. La más efectiva es el **índice único en base de datos** combinado con **token de idempotencia**.
