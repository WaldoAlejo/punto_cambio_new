# Análisis del Sistema Punto Cambio - Problemas y Mejoras

## 1. ARQUITECTURA GENERAL

### Flujo de Datos Principal
```
Operador → Frontend (React) → API (Express) → Prisma → PostgreSQL
                ↓                    ↓
           useCuadreCaja        Services/Routes
```

### Entidades Core
- **CambioDivisa**: Operaciones de compra/venta de divisas
- **Transferencia**: Movimiento físico de efectivo entre puntos
- **ServicioExterno**: Movimientos de servicios (Western, Bancos, etc.)
- **Saldo**: Balance actual por punto y moneda (efectivo + bancos)
- **MovimientoSaldo**: Historial de todos los movimientos
- **CuadreCaja**: Cierre diario con conteos físicos

---

## 2. PROBLEMAS IDENTIFICADOS

### 2.1 PROBLEMAS CRÍTICOS DE OPERADOR

#### A. Desbalance en Saldo por Desglose Incorrecto
**Severidad**: ALTA
**Descripción**: El desglose de billetes/monedas no siempre cuadra con el total físico
**Ubicación**: 
- `server/routes/exchanges.ts:1115-1185` (lógica de egreso)
- `server/routes/servicios-externos.ts:450-560` (actualización de saldos)

**Problema**: Cuando se hace un cambio, la distribución de billetes/monedas en el egreso puede no reflejar correctamente lo que realmente se entregó al cliente.

**Ejemplo**: 
- Cliente debe recibir $100
- Sistema tiene $70 billetes + $30 monedas
- Cliente quiere $80 billetes + $20 monedas
- Sistema fuerza a usar lo disponible, pero el desglose queda inconsistente

#### B. Doble Contabilización en Transferencias
**Severidad**: MEDIA
**Descripción**: El middleware `transferAutoReconciliation` fue deshabilitado pero puede haber lógica residual
**Ubicación**: `server/routes/transfers.ts:84`

**Nota**: El comentario indica que causaba "doble actualización de saldos"

#### C. Validación de Saldo Insuficiente con Tolerancia Incorrecta
**Severidad**: MEDIA
**Ubicación**: `server/routes/exchanges.ts:1099-1106`

**Problema**: La validación usa `<` en lugar de `<= + tolerancia`, causando rechazos cuando el saldo es exacto o difiere en centavos por redondeo.

#### D. Servicios Externos - Confusión INGRESO/EGRESO
**Severidad**: MEDIA
**Ubicación**: `server/routes/servicios-externos.ts:79-116`

**Problema**: Aunque hay mensajes de ayuda, la lógica es contraintuitiva:
- INGRESO (cliente paga) → RESTA del saldo asignado
- EGRESO (operador repone) → SUMA al saldo asignado

Esto es correcto desde el punto de vista del "crédito asignado", pero confuso para operadores.

#### E. Cierre de Caja sin Validación de Desglose
**Severidad**: ALTA
**Ubicación**: `src/components/close/DailyClose.tsx:637-665`

**Problema**: El frontend valida que `bills + coins ≈ saldo_cierre`, pero no guarda explícitamente el desglose que ingresó el operador. El backend podría estar recalculando.

### 2.2 PROBLEMAS DE ADMINISTRADOR

#### A. Reconciliación Manual Compleja
**Severidad**: MEDIA
**Ubicación**: `server/routes/saldo-reconciliation.ts`

**Problema**: 
- No hay endpoint para reconciliar un punto completo desde el frontend
- El admin debe usar endpoints individuales por moneda
- No hay visibilidad de inconsistencias en tiempo real

#### B. Falta de Dashboard de Salud del Sistema
**Severidad**: BAJA
**Problema**: No hay una vista consolidada que muestre:
- Puntos con saldos inconsistentes
- Transferencias pendientes de aceptación viejas
- Cambios con movimientos faltantes
- Diferencias en cierres de caja

#### C. Reportes de Auditoría Limitados
**Severidad**: MEDIA
**Problema**: 
- No hay reporte de "qué cambios afectaron un saldo específico"
- Difícil trazar el origen de una inconsistencia

### 2.3 PROBLEMAS TÉCNICOS

#### A. Race Conditions en Concurrencia
**Severidad**: MEDIA
**Ubicación**: Múltiples archivos

**Problema**: Las transacciones Prisma usan el nivel default (ReadCommitted), lo que puede causar:
- Dos operadores simultáneos vendiendo del mismo saldo
- Transferencias aceptadas mientras se hace un cambio

#### B. Fallback de Fallbacks
**Severidad**: BAJA
**Ubicación**: `src/components/close/DailyClose.tsx:506-532`

**Problema**: Código de fallback muy complejo que intenta adivinar el estado cuando el backend falla.

#### C. IDs de Moneda Hardcodeados
**Severidad**: BAJA
**Ubicación**: `server/routes/servicios-externos.ts:147-167`

**Problema**: La función `ensureUsdMonedaId()` crea USD si no existe, pero podría haber conflictos si el código USD ya existe pero con ID diferente.

---

## 3. MEJORAS IMPLEMENTADAS

### ✅ 3.1 Servicio de Reconciliación Automática
**Archivo**: `server/services/saldoReconciliationService.ts`
- Calcula saldo real desde último saldo inicial
- Normaliza signos de movimientos legacy
- Reconcilia automáticamente si diferencia > $0.01

### ✅ 3.2 Endpoints de Reconciliación
**Archivo**: `server/routes/saldo-reconciliation.ts`
- `GET /calcular-real` - Calcula saldo desde movimientos
- `POST /reconciliar` - Reconcilia saldo específico
- `GET /validar-consistencia` - Reporte de inconsistencias

### ✅ 3.3 Hook de Cuadre Mejorado
**Archivo**: `src/hooks/useCuadreCaja.ts`
- Exports `reconciliarSaldo()` y `calcularSaldoReal()`
- Estado `reconciliando` para loading states

### ✅ 3.4 Componente de Cuadre Visual Mejorado
**Archivo**: `src/components/caja/CuadreCajaMejorado.tsx`
- Alertas visuales para diferencias
- Validación de desglose (billetes + monedas = total)
- Instrucciones claras para operadores

---

## 4. MEJORAS PENDIENTES RECOMENDADAS

### 🔧 4.1 Validación de Desglose en Cierre
**Prioridad**: ALTA
**Descripción**: Validar que `billetes + monedas = conteo_fisico` antes de permitir cerrar.

```typescript
// En DailyClose.tsx o guardar-cierre.ts
const sumaDesglose = billetes + monedas;
if (Math.abs(sumaDesglose - conteoFisico) > 0.01) {
  throw new Error(`El desglose no cuadra: ${billetes} + ${monedas} ≠ ${conteoFisico}`);
}
```

### 🔧 4.2 Dashboard de Salud para Admin
**Prioridad**: MEDIA
**Vista**: Nueva página `/admin/health`

**Métricas**:
- Saldos inconsistentes por punto
- Transferencias EN_TRANSITO > 24h
- Cambios sin movimientos completos
- Diferencias en cierres últimos 7 días

### 🔧 4.3 Mejorar Transacciones Concurrentes
**Prioridad**: MEDIA

```typescript
// En operaciones críticas, usar Serializable
await prisma.$transaction(async (tx) => {
  // operaciones
}, {
  isolationLevel: 'Serializable'
});
```

### 🔧 4.4 Validación de Saldo con Tolerancia
**Prioridad**: MEDIA
**Ubicación**: `server/routes/exchanges.ts:1099`

```typescript
// Antes
if (destinoAnteriorEf < egresoEf) {

// Después  
const tolerancia = 0.01;
if (destinoAnteriorEf + tolerancia < egresoEf) {
```

### 🔧 4.5 Log de Auditoría Detallado
**Prioridad**: BAJA
**Descripción**: Registrar quién y cuándo modificó cada saldo, con valores antes/después.

### 🔧 4.6 Confirmación de Servicios Externos
**Prioridad**: MEDIA
**Descripción**: Mostrar diálogo de confirmación con el mensaje de ayuda antes de ejecutar.

---

## 5. FLUJOS CRÍTICOS A PROTEGER

### 5.1 Cambio de Divisa (COMPRA/VENTA)
```
1. Validar saldo suficiente (middleware)
2. Crear registro CambioDivisa
3. Actualizar saldo ORIGEN (ingreso)
4. Actualizar saldo DESTINO (egreso)
5. Registrar movimientos (2 INGRESO/EGRESO)
6. Validación: debe haber exactamente 2 movimientos
```

### 5.2 Transferencia entre Puntos
```
1. Validar saldo suficiente en origen
2. Crear Transferencia estado=EN_TRANSITO
3. Descontar saldo origen inmediatamente
4. Notificar punto destino
5. Punto destino acepta → suma saldo destino
6. Cambiar estado a COMPLETADA
```

### 5.3 Servicio Externo (Western, Bancos)
```
1. Validar saldo del servicio (si tiene asignación)
2. Actualizar saldo del servicio (crédito digital)
3. Actualizar saldo físico general del punto
4. Registrar movimiento
```

### 5.4 Cierre de Caja
```
1. Obtener saldos teóricos desde movimientos
2. Operador ingresa conteos físicos
3. Validar desglose (billetes + monedas = físico)
4. Validar diferencias dentro de tolerancia
5. Crear CuadreCaja con detalles
6. Actualizar SaldoInicial para próximo día
7. Si diferencia > 0, crear movimiento AJUSTE
```

---

## 6. CHECKLIST DE VERIFICACIÓN

### Antes de Deploy
- [ ] Todos los cambios de divisa registran 2 movimientos
- [ ] Las transferencias actualizan saldo origen inmediatamente
- [ ] El cierre de caja valida desglose billetes/monedas
- [ ] La reconciliación funciona desde el frontend
- [ ] Los servicios externos con asignación validan su propio saldo

### Monitoreo Post-Deploy
- [ ] Logs de errores en movimientoSaldoService
- [ ] Diferencias en cierres de caja > $1.00
- [ ] Transferencias EN_TRANSITO > 48h
- [ ] Cambios con < 2 movimientos asociados
