# Análisis para Producción - Ejemplos de Prueba Detallados

**Fecha:** 24 de marzo 2026  
**Ambiente:** PRODUCCIÓN  
**Estado:** ⚠️ REQUIERE VALIDACIÓN CUIDADOSA

---

## 🔍 ANÁLISIS PROFUNDO DEL PROBLEMA DE ASIGNACIÓN DE SALDOS

### Código Revisado

He analizado exhaustivamente todos los endpoints que modifican saldos:

#### 1. `server/routes/saldos-iniciales.ts` (LÍNEAS 277-318)
```typescript
// Lógica CORRECTA - Suma al saldo existente
if (existingSaldo) {
  const baseCantidad = new Prisma.Decimal(
    existingSaldo.cantidad ?? 0
  ).add(decCantidad);  // ✅ SUMA
  
  saldoResult = await tx.saldo.update({
    data: {
      cantidad: baseCantidad,  // ✅ Asigna el resultado de la suma
      billetes: baseBilletes,
      monedas_fisicas: baseMonedas,
    },
  });
}
```

**Conclusión:** Este endpoint SÍ suma correctamente.

#### 2. `server/routes/exchanges.ts` (LÍNEAS 990-1000)
```typescript
// Actualiza saldo con los nuevos valores calculados
await upsertSaldoEfectivoYBancos(tx, ...)

// Dentro de upsertSaldoEfectivoYBancos:
const cantidadCalculada = round2(Number(newBilletes) + Number(newMonedas) + Number(newBancos));
// ... actualiza sumando
```

**Conclusión:** Los cambios de divisa actualizan saldo sumando/restando correctamente.

#### 3. `server/services/transferCreationService.ts` (LÍNEAS 350-372)
```typescript
// Suma al saldo del destino
const nuevoEf = +(antEf + efectivo).toFixed(2);
await prisma.saldo.update({
  data: {
    cantidad: nuevoEf,  // ✅ Suma al existente
  },
});
```

**Conclusión:** Las transferencias suman correctamente al destino.

---

## ❓ ENTONCES, ¿CUÁL ES EL PROBLEMA?

Basándome en el análisis, el código **SÍ está diseñado para sumar**, no para reemplazar. Sin embargo, hay varias hipótesis:

### Hipótesis 1: Race Condition en Asignaciones Simultáneas
Si dos administradores asignan saldo al mismo punto/divisa simultáneamente:

```
Tiempo 0ms: Admin A lee saldo = $100
Tiempo 1ms: Admin B lee saldo = $100  
Tiempo 2ms: Admin A suma $50 → Guarda $150
Tiempo 3ms: Admin B suma $30 → Guarda $130 (¡Sobrescribe!)
```

**Resultado esperado:** $180  
**Resultado actual:** $130 (pierde $50)

### Hipótesis 2: Confusión Visual
El administrador ve el campo "Cantidad Inicial" y asume que debe poner el total, no el incremento.

### Hipótesis 3: Problema de Caché
El navegador muestra datos desactualizados después de la asignación.

### Hipótesis 4: Otro Endpoint
Quizás hay otro endpoint o proceso batch que está reemplazando saldos.

---

## 🧪 EJEMPLOS DE PRUEBA PARA PRODUCCIÓN

### PRUEBA 1: Verificar Comportamiento de Asignación (Segura)

**Objetivo:** Confirmar si el sistema suma o reemplaza

**Pre-condiciones:**
- Tener acceso a la BD para verificar
- Tener un punto de prueba (o crear uno)
- Tener una divisa de prueba

**Pasos:**

```sql
-- 1. Verificar saldo actual del punto XYZ, moneda USD
SELECT punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas, bancos
FROM "Saldo" 
WHERE punto_atencion_id = 'ID_DEL_PUNTO' 
AND moneda_id = 'ID_DE_USD';
-- Anotar: cantidad = ____
```

```
2. Ir al frontend: Administración > Saldos Iniciales
3. Seleccionar el punto XYZ
4. Seleccionar divisa USD
5. Ingresar:
   - Cantidad Inicial: 100
   - Billetes: 100
   - Monedas: 0
6. Click en "Asignar Saldo"
7. Anotar la hora exacta (HH:MM:SS)
```

```sql
-- 8. Verificar saldo nuevamente
SELECT punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas, bancos
FROM "Saldo" 
WHERE punto_atencion_id = 'ID_DEL_PUNTO' 
AND moneda_id = 'ID_DE_USD';
-- Anotar: cantidad = ____
```

```
9. Calcular diferencia:
   - Si cantidad_nueva = cantidad_anterior + 100 → ✅ SUMA CORRECTAMENTE
   - Si cantidad_nueva = 100 → ❌ ESTÁ REEMPLAZANDO
```

**Resultado Esperado:**
```
cantidad_anterior = 500
cantidad_nueva = 600  (500 + 100)
```

**Resultado Problemático:**
```
cantidad_anterior = 500
cantidad_nueva = 100  (¡Reemplazó!)
```

---

### PRUEBA 2: Verificar Race Condition (Requiere 2 Personas)

**Objetivo:** Detectar si hay race condition

**Pre-condiciones:**
- Dos administradores con acceso simultáneo
- Coordinación por teléfono/chat

**Pasos:**

```sql
-- 1. Verificar saldo inicial
SELECT cantidad FROM "Saldo" 
WHERE punto_atencion_id = 'ID_PUNTO' AND moneda_id = 'ID_USD';
-- Anotar: ____
```

```
2. Admin A y Admin B abren simultáneamente:
   Administración > Saldos Iniciales > Punto XYZ > USD

3. Ambos ven el mismo saldo actual (ej: $1000)

4. A la cuenta de 3:
   - Admin A asigna $100
   - Admin B asigna $200

5. Ambos hacen click en "Asignar" al mismo tiempo
```

```sql
-- 6. Verificar saldo final
SELECT cantidad FROM "Saldo" 
WHERE punto_atencion_id = 'ID_PUNTO' AND moneda_id = 'ID_USD';
-- Anotar: ____
```

**Resultado Esperado:**
```
Saldo inicial: $1000
Saldo final: $1300 (1000 + 100 + 200)
```

**Resultado con Race Condition:**
```
Saldo inicial: $1000
Saldo final: $1100 o $1200 (pierde una asignación)
```

---

### PRUEBA 3: Verificar Idempotencia de Cambios (Nuevo Código)

**Objetivo:** Confirmar que los cambios no se duplican

**Pre-condiciones:**
- Desplegar el nuevo código con idempotencia
- Tener un punto con saldo suficiente

**Pasos:**

```sql
-- 1. Contar cambios del día para el punto
SELECT COUNT(*) as total_cambios
FROM "CambioDivisa"
WHERE punto_atencion_id = 'ID_PUNTO'
AND DATE(fecha) = CURRENT_DATE;
-- Anotar: ____
```

```
2. Ir a Cambio de Divisa
3. Crear una compra de USD:
   - Moneda origen: EUR
   - Monto: 100 EUR
   - Tasa: 1.08
   - Destino: USD → $108

4. Hacer click 5 veces RÁPIDAMENTE en "Guardar Cambio"
   (Simular doble clic accidental)

5. Esperar 5 segundos
```

```sql
-- 6. Contar cambios nuevamente
SELECT COUNT(*) as total_cambios
FROM "CambioDivisa"
WHERE punto_atencion_id = 'ID_PUNTO'
AND DATE(fecha) = CURRENT_DATE;
-- Anotar: ____

-- 7. Verificar movimientos de saldo
SELECT COUNT(*) as total_movimientos, 
       SUM(CASE WHEN monto > 0 THEN monto ELSE 0 END) as total_ingresos,
       SUM(CASE WHEN monto < 0 THEN ABS(monto) ELSE 0 END) as total_egresos
FROM "MovimientoSaldo"
WHERE punto_atencion_id = 'ID_PUNTO'
AND DATE(fecha) = CURRENT_DATE
AND tipo_referencia = 'EXCHANGE';
```

**Resultado Esperado (con fix):**
```
Diferencia en count: 1 (solo se creó 1 cambio)
Total ingresos: 100 EUR
Total egresos: 108 USD
```

**Resultado Problemático (sin fix):**
```
Diferencia en count: 5 (se crearon 5 cambios duplicados)
Total ingresos: 500 EUR (¡5x!)
Total egresos: 540 USD (¡5x!)
```

---

### PRUEBA 4: Verificar Duplicados en Transferencias

**Objetivo:** Confirmar que las transferencias no se duplican

**Pasos:**

```sql
-- 1. Contar transferencias pendientes del día
SELECT COUNT(*) as total_transferencias
FROM "Transferencia"
WHERE solicitado_por = 'ID_USUARIO'
AND DATE(fecha) = CURRENT_DATE
AND estado = 'PENDIENTE';
-- Anotar: ____
```

```
2. Crear una transferencia:
   - Origen: Punto A
   - Destino: Punto B
   - Moneda: USD
   - Monto: $500
   - Tipo: ENTRE_PUNTOS

3. Hacer doble click en "Enviar Transferencia"
```

```sql
-- 4. Contar transferencias nuevamente
SELECT COUNT(*) as total_transferencias
FROM "Transferencia"
WHERE solicitado_por = 'ID_USUARIO'
AND DATE(fecha) = CURRENT_DATE
AND estado = 'PENDIENTE';
-- Anotar: ____
```

**Resultado Esperado:**
```
Diferencia: 1 (solo se creó 1 transferencia)
```

**Resultado Problemático:**
```
Diferencia: 2 o más (duplicados)
```

---

## 📊 SCRIPT DE VALIDACIÓN RÁPIDA (SQL)

Ejecutar este script para verificar el estado actual:

```sql
-- ============================================================
-- SCRIPT DE VALIDACIÓN: DUPLICADOS Y CONSISTENCIA
-- ============================================================

-- 1. Detectar cambios de divisa duplicados (mismo usuario, mismo segundo)
WITH duplicados_cambios AS (
  SELECT 
    usuario_id,
    punto_atencion_id,
    moneda_origen_id,
    moneda_destino_id,
    monto_origen,
    monto_destino,
    DATE_TRUNC('second', fecha) as fecha_segundo,
    COUNT(*) as cantidad,
    ARRAY_AGG(id) as ids
  FROM "CambioDivisa"
  WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY 1,2,3,4,5,6,7
  HAVING COUNT(*) > 1
)
SELECT 
  'CAMBIOS DUPLICADOS' as tipo_problema,
  COUNT(*) as grupos_afectados,
  SUM(cantidad - 1) as total_duplicados
FROM duplicados_cambios;

-- 2. Detectar movimientos de saldo duplicados
WITH duplicados_movimientos AS (
  SELECT 
    punto_atencion_id,
    moneda_id,
    tipo_movimiento,
    tipo_referencia,
    referencia_id,
    monto,
    DATE_TRUNC('second', fecha) as fecha_segundo,
    COUNT(*) as cantidad
  FROM "MovimientoSaldo"
  WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
  AND referencia_id IS NOT NULL
  GROUP BY 1,2,3,4,5,6,7
  HAVING COUNT(*) > 1
)
SELECT 
  'MOVIMIENTOS DUPLICADOS' as tipo_problema,
  COUNT(*) as grupos_afectados,
  SUM(cantidad - 1) as total_duplicados
FROM duplicados_movimientos;

-- 3. Verificar consistencia de saldos (cantidad = billetes + monedas + bancos)
SELECT 
  'SALDOS INCONSISTENTES' as tipo_problema,
  COUNT(*) as cantidad
FROM "Saldo"
WHERE ABS(cantidad - (COALESCE(billetes,0) + COALESCE(monedas_fisicas,0) + COALESCE(bancos,0))) > 0.01;

-- 4. Verificar asignaciones recientes (últimas 24h)
SELECT 
  'ASIGNACIONES RECIENTES' as tipo,
  si.id,
  si.cantidad_inicial,
  s.cantidad as saldo_actual,
  si.asignado_por,
  si.created_at
FROM "SaldoInicial" si
JOIN "Saldo" s ON s.punto_atencion_id = si.punto_atencion_id AND s.moneda_id = si.moneda_id
WHERE si.created_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY si.created_at DESC
LIMIT 20;
```

---

## ⚡ PLAN DE ACCIÓN PARA PRODUCCIÓN

### FASE 1: Validación (Antes de Desplegar)

```bash
# 1. Ejecutar script de validación SQL
psql -d $DATABASE_URL -f validacion_pre_deploy.sql

# 2. Guardar resultados como baseline
# Si hay duplicados existentes, documentarlos
```

### FASE 2: Despliegue (Con Precaución)

```bash
# 1. Backup de BD
pg_dump $DATABASE_URL > backup_pre_fix_$(date +%Y%m%d_%H%M%S).sql

# 2. Ejecutar migración de índices únicos
# NOTA: Esto puede tomar tiempo y bloquea tablas
psql -d $DATABASE_URL -f server/migrations/2026-03-24-add-unique-constraints-prevent-duplicates.sql

# 3. Si la migración falla por duplicados:
#    - Restaurar backup
#    - Ejecutar script de limpieza de duplicados primero
#    - Reintentar migración
```

### FASE 3: Despliegue Frontend

```bash
# 1. Build con nuevo código
npm run build

# 2. Deploy gradual (si es posible, solo a algunos usuarios primero)
# 3. Monitorear logs
pm2 logs --lines 100
```

### FASE 4: Verificación Post-Deploy

```bash
# Ejecutar Prueba 1, 2, 3 y 4
# Ejecutar script de validación SQL nuevamente
# Comparar con baseline
```

---

## 🆘 ROLLBACK PLAN (Si algo sale mal)

```bash
# 1. Detener el frontend nuevo
pm2 stop app

# 2. Restaurar versión anterior del frontend
git checkout HEAD~1 -- src/services/apiService.ts src/services/exchangeService.ts src/services/transferService.ts
npm run build
pm2 start app

# 3. Eliminar índices únicos (si causaron problemas)
psql -d $DATABASE_URL << EOF
DROP INDEX IF EXISTS idx_movimiento_saldo_unico;
DROP INDEX IF EXISTS idx_cambio_divisa_unico;
DROP INDEX IF EXISTS idx_transferencia_unica;
EOF

# 4. Si es necesario, restaurar BD completa
pg_restore -d $DATABASE_URL backup_pre_fix_*.sql
```

---

## ✅ CHECKLIST FINAL

Antes de tocar producción:

- [ ] Backup de BD completado y verificado
- [ ] Script de validación SQL ejecutado (baseline guardado)
- [ ] Ventana de mantenimiento definida
- [ ] Equipo de soporte notificado
- [ ] Plan de rollback probado en staging
- [ ] Métricas de monitoreo configuradas
- [ ] Canal de comunicación abierto (chat/videollamada)

---

**Documento generado:** 24 de marzo 2026  
**Revisión:** Pendiente  
**Aprobación:** Pendiente
