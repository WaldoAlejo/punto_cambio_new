# 🧪 Guía de Pruebas - Balance Proporcional

## 📋 Preparación

### 1. Verificar Estado Inicial

```bash
# Ver saldos actuales
GET /api/balance-completo?pointId=PUNTO_ID

# Ejemplo de respuesta:
{
  "USD": {
    "efectivo": 10000,
    "bancos": 5000,
    "billetes": 8000,
    "monedas": 2000
  },
  "COP": {
    "efectivo": 50000000,
    "bancos": 20000000,
    "billetes": 40000000,
    "monedas": 10000000
  }
}
```

---

## 🧪 Test 1: Cambio Completo (Sin Abono Inicial)

### **Objetivo**: Verificar que el comportamiento original se mantiene

### **Paso 1: Crear cambio completo**

```bash
POST /api/exchanges
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "punto_atencion_id": "PUNTO_ID",
  "moneda_origen_id": "USD_ID",
  "moneda_destino_id": "COP_ID",
  "tipo_operacion": "COMPRA",
  "monto_origen": 100,
  "monto_destino": 400000,
  "tasa_cambio_billetes": 4000,
  "estado": "COMPLETADO",
  "metodo_pago_origen": "efectivo",
  "metodo_entrega": "efectivo",
  "divisas_entregadas_total": 100,
  "divisas_entregadas_billetes": 100,
  "divisas_entregadas_monedas": 0,
  "divisas_recibidas_total": 400000,
  "divisas_recibidas_billetes": 400000,
  "divisas_recibidas_monedas": 0,
  "cliente": "Cliente Test 1"
}
```

### **Paso 2: Verificar balance actualizado**

```bash
GET /api/balance-completo?pointId=PUNTO_ID

# Verificar:
# USD.efectivo = 10000 + 100 = 10100 ✅
# USD.billetes = 8000 + 100 = 8100 ✅
# COP.efectivo = 50000000 - 400000 = 49600000 ✅
# COP.billetes = 40000000 - 400000 = 39600000 ✅
```

### **Resultado Esperado**: ✅ Balance actualizado 100%

---

## 🧪 Test 2: Cambio con Abono Inicial (50%)

### **Objetivo**: Verificar actualización proporcional

### **Paso 1: Crear cambio con abono inicial**

```bash
POST /api/exchanges
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "punto_atencion_id": "PUNTO_ID",
  "moneda_origen_id": "USD_ID",
  "moneda_destino_id": "COP_ID",
  "tipo_operacion": "COMPRA",
  "monto_origen": 200,
  "monto_destino": 800000,
  "tasa_cambio_billetes": 4000,
  "estado": "PENDIENTE",
  "abono_inicial_monto": 400000,
  "abono_inicial_fecha": "2025-01-15T10:00:00Z",
  "saldo_pendiente": 400000,
  "metodo_pago_origen": "efectivo",
  "metodo_entrega": "efectivo",
  "divisas_entregadas_total": 200,
  "divisas_entregadas_billetes": 200,
  "divisas_entregadas_monedas": 0,
  "divisas_recibidas_total": 800000,
  "divisas_recibidas_billetes": 800000,
  "divisas_recibidas_monedas": 0,
  "cliente": "Cliente Test 2"
}
```

### **Paso 2: Verificar balance actualizado proporcionalmente**

```bash
GET /api/balance-completo?pointId=PUNTO_ID

# Cálculo esperado:
# Porcentaje = 400000 / 800000 = 0.5 (50%)
#
# USD.efectivo = 10100 + (200 * 0.5) = 10100 + 100 = 10200 ✅
# USD.billetes = 8100 + (200 * 0.5) = 8100 + 100 = 8200 ✅
# COP.efectivo = 49600000 - (800000 * 0.5) = 49600000 - 400000 = 49200000 ✅
# COP.billetes = 39600000 - (800000 * 0.5) = 39600000 - 400000 = 39200000 ✅
```

### **Paso 3: Verificar transacción pendiente**

```bash
GET /api/exchanges/pending?pointId=PUNTO_ID

# Debe aparecer la transacción con:
# - estado: "PENDIENTE"
# - saldo_pendiente: 400000
# - abono_inicial_monto: 400000
```

### **Resultado Esperado**: ✅ Balance actualizado solo 50%

---

## 🧪 Test 3: Cerrar Cambio Pendiente

### **Objetivo**: Verificar actualización del balance restante

### **Paso 1: Obtener ID de la transacción pendiente**

```bash
GET /api/exchanges/pending?pointId=PUNTO_ID

# Copiar el "id" de la transacción creada en Test 2
```

### **Paso 2: Cerrar la transacción**

```bash
PATCH /api/exchanges/TRANSACTION_ID/cerrar
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

# No requiere body
```

### **Paso 3: Verificar balance actualizado con monto restante**

```bash
GET /api/balance-completo?pointId=PUNTO_ID

# Cálculo esperado:
# Porcentaje restante = 400000 / 800000 = 0.5 (50%)
#
# USD.efectivo = 10200 + (200 * 0.5) = 10200 + 100 = 10300 ✅
# USD.billetes = 8200 + (200 * 0.5) = 8200 + 100 = 8300 ✅
# COP.efectivo = 49200000 - (800000 * 0.5) = 49200000 - 400000 = 48800000 ✅
# COP.billetes = 39200000 - (800000 * 0.5) = 39200000 - 400000 = 38800000 ✅
```

### **Paso 4: Verificar estado de la transacción**

```bash
GET /api/exchanges?pointId=PUNTO_ID

# Buscar la transacción y verificar:
# - estado: "COMPLETADO" ✅
# - saldo_pendiente: 0 ✅
# - fecha_completado: [fecha actual] ✅
# - numero_recibo_completar: "CIERRE-..." ✅
```

### **Paso 5: Verificar movimiento de saldo registrado**

```bash
# Revisar en la base de datos:
SELECT * FROM MovimientoSaldo
WHERE referencia_tipo = 'CAMBIO_DIVISA_CIERRE'
AND referencia_id = 'TRANSACTION_ID'

# Debe existir un registro con:
# - tipo_movimiento: "INGRESO"
# - monto: 400000 (monto restante)
# - descripcion: "Cierre de cambio pendiente - Monto restante: 400000.00"
```

### **Resultado Esperado**: ✅ Balance actualizado con 50% restante, total 100%

---

## 🧪 Test 4: Cambio con Abono Inicial (30%)

### **Objetivo**: Verificar cálculo con porcentaje diferente

### **Paso 1: Crear cambio con abono del 30%**

```bash
POST /api/exchanges
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "punto_atencion_id": "PUNTO_ID",
  "moneda_origen_id": "USD_ID",
  "moneda_destino_id": "COP_ID",
  "tipo_operacion": "COMPRA",
  "monto_origen": 300,
  "monto_destino": 1200000,
  "tasa_cambio_billetes": 4000,
  "estado": "PENDIENTE",
  "abono_inicial_monto": 360000,
  "saldo_pendiente": 840000,
  "metodo_pago_origen": "efectivo",
  "metodo_entrega": "efectivo",
  "divisas_entregadas_total": 300,
  "divisas_entregadas_billetes": 300,
  "divisas_entregadas_monedas": 0,
  "divisas_recibidas_total": 1200000,
  "divisas_recibidas_billetes": 1200000,
  "divisas_recibidas_monedas": 0,
  "cliente": "Cliente Test 3"
}
```

### **Paso 2: Verificar balance actualizado con 30%**

```bash
GET /api/balance-completo?pointId=PUNTO_ID

# Cálculo esperado:
# Porcentaje = 360000 / 1200000 = 0.3 (30%)
#
# USD.efectivo = 10300 + (300 * 0.3) = 10300 + 90 = 10390 ✅
# USD.billetes = 8300 + (300 * 0.3) = 8300 + 90 = 8390 ✅
# COP.efectivo = 48800000 - (1200000 * 0.3) = 48800000 - 360000 = 48440000 ✅
# COP.billetes = 38800000 - (1200000 * 0.3) = 38800000 - 360000 = 38440000 ✅
```

### **Resultado Esperado**: ✅ Balance actualizado solo 30%

---

## 🧪 Test 5: Completar con Método de Entrega

### **Objetivo**: Verificar endpoint `/completar` con actualización de método

### **Paso 1: Crear cambio pendiente sin método de entrega definido**

```bash
POST /api/exchanges
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "punto_atencion_id": "PUNTO_ID",
  "moneda_origen_id": "USD_ID",
  "moneda_destino_id": "COP_ID",
  "tipo_operacion": "COMPRA",
  "monto_origen": 150,
  "monto_destino": 600000,
  "tasa_cambio_billetes": 4000,
  "estado": "PENDIENTE",
  "abono_inicial_monto": 300000,
  "saldo_pendiente": 300000,
  "metodo_pago_origen": "efectivo",
  "metodo_entrega": null,
  "divisas_entregadas_total": 150,
  "divisas_entregadas_billetes": 150,
  "divisas_entregadas_monedas": 0,
  "cliente": "Cliente Test 4"
}
```

### **Paso 2: Completar especificando método de entrega**

```bash
PATCH /api/exchanges/TRANSACTION_ID/completar
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "metodo_entrega": "transferencia",
  "transferencia_banco": "Banco Test",
  "transferencia_numero": "REF123456",
  "divisas_recibidas_total": 600000,
  "divisas_recibidas_billetes": 0,
  "divisas_recibidas_monedas": 0
}
```

### **Paso 3: Verificar balance actualizado correctamente**

```bash
GET /api/balance-completo?pointId=PUNTO_ID

# Cálculo esperado:
# Porcentaje restante = 300000 / 600000 = 0.5 (50%)
#
# USD.efectivo = 10390 + (150 * 0.5) = 10390 + 75 = 10465 ✅
# USD.billetes = 8390 + (150 * 0.5) = 8390 + 75 = 8465 ✅
# COP.bancos = [valor anterior] - (600000 * 0.5) = [valor] - 300000 ✅
# (Nota: Como es transferencia, afecta bancos, no efectivo)
```

### **Resultado Esperado**: ✅ Balance actualizado con método correcto

---

## 🧪 Test 6: Validación de Errores

### **Test 6.1: Abono mayor al monto total**

```bash
POST /api/exchanges
{
  "monto_destino": 500000,
  "abono_inicial_monto": 600000,  # ❌ Mayor al total
  ...
}

# Resultado esperado:
# Status: 400
# Error: "El abono inicial no puede ser mayor al monto total"
```

### **Test 6.2: Cerrar cambio ya completado**

```bash
PATCH /api/exchanges/COMPLETED_TRANSACTION_ID/cerrar

# Resultado esperado:
# Status: 400
# Error: "El cambio ya está completado"
```

### **Test 6.3: Completar sin método de entrega para transferencia**

```bash
PATCH /api/exchanges/TRANSACTION_ID/completar
{
  "metodo_entrega": "transferencia"
  # ❌ Falta transferencia_banco y transferencia_numero
}

# Resultado esperado:
# Status: 400
# Error: "Banco requerido para transferencia"
```

---

## 📊 Verificación de Consistencia

### **Fórmula de Verificación**

```
Balance Final = Balance Inicial + Suma(Ingresos) - Suma(Egresos)

Para cada transacción con abono:
  Actualización Total = Actualización Inicial + Actualización Cierre
  Actualización Total = (Monto * %Abono) + (Monto * %Restante)
  Actualización Total = Monto * (%Abono + %Restante)
  Actualización Total = Monto * 1.0
  Actualización Total = Monto ✅
```

### **Script de Verificación SQL**

```sql
-- Verificar que todas las transacciones completadas sumen correctamente
SELECT
  cd.id,
  cd.monto_destino,
  cd.abono_inicial_monto,
  cd.saldo_pendiente,
  cd.estado,
  (cd.abono_inicial_monto + cd.saldo_pendiente) as suma_verificacion,
  CASE
    WHEN cd.estado = 'COMPLETADO' AND cd.saldo_pendiente != 0
    THEN '❌ ERROR: Saldo pendiente no es 0'
    WHEN cd.estado = 'PENDIENTE' AND cd.saldo_pendiente = 0
    THEN '❌ ERROR: Pendiente sin saldo'
    WHEN cd.abono_inicial_monto > cd.monto_destino
    THEN '❌ ERROR: Abono mayor al total'
    ELSE '✅ OK'
  END as validacion
FROM CambioDivisa cd
WHERE cd.abono_inicial_monto IS NOT NULL
ORDER BY cd.fecha DESC;
```

---

## 🔍 Checklist de Pruebas

### **Funcionalidad Básica**

- [ ] Test 1: Cambio completo actualiza 100%
- [ ] Test 2: Cambio con abono 50% actualiza proporcionalmente
- [ ] Test 3: Cerrar pendiente actualiza monto restante
- [ ] Test 4: Cambio con abono 30% calcula correctamente
- [ ] Test 5: Completar con método de entrega funciona

### **Validaciones**

- [ ] Test 6.1: Rechaza abono mayor al total
- [ ] Test 6.2: Rechaza cerrar cambio ya completado
- [ ] Test 6.3: Valida datos de transferencia

### **Consistencia de Datos**

- [ ] Balances nunca negativos
- [ ] Suma de actualizaciones = monto total
- [ ] MovimientoSaldo registrado correctamente
- [ ] Estados de transacciones correctos
- [ ] Recibos generados correctamente

### **Integración**

- [ ] Dashboard muestra balances correctos
- [ ] Lista de pendientes funciona
- [ ] Filtros por estado funcionan
- [ ] Reportes incluyen transacciones correctas

---

## 🚨 Problemas Comunes y Soluciones

### **Problema 1: Balance negativo**

```
Síntoma: Saldo efectivo o bancos es negativo
Causa: Egreso mayor al saldo disponible
Solución: Verificar validación de saldo suficiente en creación
```

### **Problema 2: Porcentaje incorrecto**

```
Síntoma: Balance actualizado con monto incorrecto
Causa: División por cero o cálculo erróneo
Solución: Verificar que monto_destino > 0 y abono_inicial <= monto_destino
```

### **Problema 3: Transacción no aparece en pendientes**

```
Síntoma: Cambio con abono no aparece en /pending
Causa: Estado no es PENDIENTE o saldo_pendiente = 0
Solución: Verificar que estado = "PENDIENTE" y saldo_pendiente > 0
```

### **Problema 4: No se puede cerrar pendiente**

```
Síntoma: Error al cerrar cambio pendiente
Causa: Saldos insuficientes para actualización restante
Solución: Verificar que hay saldo suficiente en moneda destino
```

---

## 📝 Notas Importantes

1. **Redondeo**: Todos los cálculos usan `round2()` para 2 decimales
2. **Transacciones**: Actualizaciones de saldo usan `prisma.$transaction` para atomicidad
3. **Auditoría**: Cada actualización genera un registro en `MovimientoSaldo`
4. **Estados**: Solo transacciones COMPLETADAS afectan el balance final mostrado en dashboard
5. **Compatibilidad**: Transacciones sin abono inicial funcionan igual que antes (100%)

---

## ✅ Criterios de Aceptación

La implementación es exitosa si:

1. ✅ Cambios completos actualizan balance 100%
2. ✅ Cambios con abono actualizan balance proporcionalmente
3. ✅ Cerrar pendiente actualiza balance restante
4. ✅ Suma de actualizaciones = monto total
5. ✅ No hay balances negativos inesperados
6. ✅ MovimientoSaldo registra todas las actualizaciones
7. ✅ Dashboard muestra balances correctos
8. ✅ Transacciones pendientes se pueden cerrar sin errores

---

**Última Actualización**: 2025
**Versión**: 1.0
**Estado**: ✅ Listo para Testing
