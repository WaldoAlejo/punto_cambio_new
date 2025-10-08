# 🎨 Diagrama Visual - Flujo de Balance Proporcional

## 📊 Flujo Completo: Cambio de Divisa con Abono Inicial

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLIENTE SOLICITA CAMBIO DE DIVISA                    │
│                                                                          │
│  Quiere: $1,000,000 COP                                                 │
│  Debe entregar: $250 USD (tasa: 4000)                                   │
│  Tiene disponible: $125 USD (50%)                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PASO 1: CREAR TRANSACCIÓN PENDIENTE                  │
│                                                                          │
│  POST /api/exchanges                                                    │
│  {                                                                       │
│    monto_destino: 1000000,                                              │
│    abono_inicial_monto: 500000,  ◄── 50% del total                     │
│    saldo_pendiente: 500000,      ◄── 50% restante                      │
│    estado: "PENDIENTE"                                                  │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              CÁLCULO DE PORCENTAJE DE ACTUALIZACIÓN                     │
│                                                                          │
│  porcentajeActualizacion = abono_inicial / monto_total                  │
│  porcentajeActualizacion = 500000 / 1000000                             │
│  porcentajeActualizacion = 0.5 (50%)                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│           ACTUALIZACIÓN PROPORCIONAL DE SALDOS (50%)                    │
│                                                                          │
│  ┌─────────────────────────┐         ┌─────────────────────────┐       │
│  │   MONEDA ORIGEN (USD)   │         │  MONEDA DESTINO (COP)   │       │
│  │      ↑ INGRESO          │         │      ↓ EGRESO           │       │
│  ├─────────────────────────┤         ├─────────────────────────┤       │
│  │ Efectivo: +$125 (50%)   │         │ Efectivo: -$500k (50%)  │       │
│  │ Billetes: +$125 (50%)   │         │ Billetes: -$500k (50%)  │       │
│  │ Bancos: $0              │         │ Bancos: $0              │       │
│  │ Monedas: $0             │         │ Monedas: $0             │       │
│  └─────────────────────────┘         └─────────────────────────┘       │
│                                                                          │
│  ✅ Balance actualizado con 50% del monto total                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    REGISTRO EN BASE DE DATOS                            │
│                                                                          │
│  CambioDivisa:                                                          │
│    ├─ id: "abc123"                                                      │
│    ├─ estado: "PENDIENTE"                                               │
│    ├─ monto_destino: 1000000                                            │
│    ├─ abono_inicial_monto: 500000                                       │
│    ├─ saldo_pendiente: 500000                                           │
│    └─ numero_recibo_abono: "ABONO-..."                                  │
│                                                                          │
│  MovimientoSaldo:                                                       │
│    ├─ tipo_movimiento: "INGRESO"                                        │
│    ├─ monto: 500000                                                     │
│    ├─ referencia_tipo: "CAMBIO_DIVISA"                                  │
│    └─ descripcion: "Abono inicial 50%"                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │
                        ⏰ TIEMPO TRANSCURRE...
                        Cliente regresa con $125 USD restantes
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                PASO 2: CERRAR TRANSACCIÓN PENDIENTE                     │
│                                                                          │
│  PATCH /api/exchanges/abc123/cerrar                                     │
│                                                                          │
│  Sistema detecta:                                                       │
│    ✓ huboAbonoInicial = true                                            │
│    ✓ montoRestante = 1000000 - 500000 = 500000                         │
│    ✓ porcentajeRestante = 500000 / 1000000 = 0.5 (50%)                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│        ACTUALIZACIÓN DEL BALANCE RESTANTE (50% RESTANTE)                │
│                                                                          │
│  ┌─────────────────────────┐         ┌─────────────────────────┐       │
│  │   MONEDA ORIGEN (USD)   │         │  MONEDA DESTINO (COP)   │       │
│  │      ↑ INGRESO          │         │      ↓ EGRESO           │       │
│  ├─────────────────────────┤         ├─────────────────────────┤       │
│  │ Efectivo: +$125 (50%)   │         │ Efectivo: -$500k (50%)  │       │
│  │ Billetes: +$125 (50%)   │         │ Billetes: -$500k (50%)  │       │
│  │ Bancos: $0              │         │ Bancos: $0              │       │
│  │ Monedas: $0             │         │ Monedas: $0             │       │
│  └─────────────────────────┘         └─────────────────────────┘       │
│                                                                          │
│  ✅ Balance actualizado con 50% restante                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              ACTUALIZACIÓN FINAL EN BASE DE DATOS                       │
│                                                                          │
│  CambioDivisa:                                                          │
│    ├─ id: "abc123"                                                      │
│    ├─ estado: "COMPLETADO" ◄── Cambió de PENDIENTE                     │
│    ├─ monto_destino: 1000000                                            │
│    ├─ abono_inicial_monto: 500000                                       │
│    ├─ saldo_pendiente: 0 ◄── Cambió de 500000                          │
│    ├─ numero_recibo_completar: "CIERRE-..." ◄── Nuevo                  │
│    └─ fecha_completado: [fecha actual] ◄── Nuevo                        │
│                                                                          │
│  MovimientoSaldo (nuevo registro):                                      │
│    ├─ tipo_movimiento: "INGRESO"                                        │
│    ├─ monto: 500000                                                     │
│    ├─ referencia_tipo: "CAMBIO_DIVISA_CIERRE"                           │
│    └─ descripcion: "Cierre - Monto restante: 500000.00"                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      RESULTADO FINAL                                    │
│                                                                          │
│  Balance Total Actualizado:                                             │
│    USD: +$250 ($125 inicial + $125 cierre) ✅                           │
│    COP: -$1,000,000 ($500k inicial + $500k cierre) ✅                   │
│                                                                          │
│  Transacción:                                                           │
│    Estado: COMPLETADO ✅                                                │
│    Saldo Pendiente: $0 ✅                                               │
│                                                                          │
│  Auditoría:                                                             │
│    2 registros en MovimientoSaldo ✅                                    │
│    3 recibos generados (inicial, abono, cierre) ✅                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Comparación: Antes vs Después

### **❌ ANTES (Bug)**

```
PASO 1: Crear con abono inicial
┌──────────────────────────────────┐
│ Cliente paga: $500k de $1M (50%) │
│ Estado: PENDIENTE                │
└──────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ ❌ Balance actualizado: $1M      │  ◄── ERROR: Actualiza 100%
│    (debería ser $500k)           │
└──────────────────────────────────┘

PASO 2: Cerrar pendiente
┌──────────────────────────────────┐
│ Cliente paga: $500k restantes    │
│ Estado: COMPLETADO               │
└──────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ ❌ Balance NO actualizado        │  ◄── ERROR: No actualiza nada
│    (debería actualizar $500k)    │
└──────────────────────────────────┘

RESULTADO:
  Balance mostrado: $1M
  Dinero real recibido: $1M
  Diferencia: $0 ✅ (por suerte se compensan los errores)

  PERO si el cliente nunca completa el pago:
  Balance mostrado: $1M
  Dinero real recibido: $500k
  Diferencia: -$500k ❌ (balance inflado)
```

### **✅ DESPUÉS (Corregido)**

```
PASO 1: Crear con abono inicial
┌──────────────────────────────────┐
│ Cliente paga: $500k de $1M (50%) │
│ Estado: PENDIENTE                │
└──────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ ✅ Balance actualizado: $500k    │  ◄── CORRECTO: Actualiza 50%
│    (50% del total)               │
└──────────────────────────────────┘

PASO 2: Cerrar pendiente
┌──────────────────────────────────┐
│ Cliente paga: $500k restantes    │
│ Estado: COMPLETADO               │
└──────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ ✅ Balance actualizado: +$500k   │  ◄── CORRECTO: Actualiza 50% restante
│    (50% restante)                │
└──────────────────────────────────┘

RESULTADO:
  Balance mostrado: $1M ($500k + $500k)
  Dinero real recibido: $1M
  Diferencia: $0 ✅

  Si el cliente nunca completa el pago:
  Balance mostrado: $500k
  Dinero real recibido: $500k
  Diferencia: $0 ✅ (balance correcto)
```

---

## 📈 Flujo de Decisión: ¿Cuándo Actualizar Balance?

```
                    ┌─────────────────────┐
                    │  Crear CambioDivisa │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ ¿Tiene abono_inicial?│
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
         ┌─────────────┐              ┌─────────────┐
         │     SÍ      │              │     NO      │
         └──────┬──────┘              └──────┬──────┘
                │                             │
                ▼                             ▼
    ┌───────────────────────┐    ┌───────────────────────┐
    │ Estado = PENDIENTE    │    │ Estado = COMPLETADO   │
    │ Porcentaje = abono/   │    │ Porcentaje = 100%     │
    │              total    │    │                       │
    └───────────┬───────────┘    └───────────┬───────────┘
                │                             │
                ▼                             ▼
    ┌───────────────────────┐    ┌───────────────────────┐
    │ Actualizar balance    │    │ Actualizar balance    │
    │ proporcionalmente     │    │ completo              │
    │ (ej: 50%)             │    │ (100%)                │
    └───────────┬───────────┘    └───────────┬───────────┘
                │                             │
                ▼                             │
    ┌───────────────────────┐                │
    │ Cliente regresa       │                │
    │ para completar        │                │
    └───────────┬───────────┘                │
                │                             │
                ▼                             │
    ┌───────────────────────┐                │
    │ PATCH /cerrar o       │                │
    │ PATCH /completar      │                │
    └───────────┬───────────┘                │
                │                             │
                ▼                             │
    ┌───────────────────────┐                │
    │ Calcular porcentaje   │                │
    │ restante              │                │
    │ (ej: 50% restante)    │                │
    └───────────┬───────────┘                │
                │                             │
                ▼                             │
    ┌───────────────────────┐                │
    │ Actualizar balance    │                │
    │ con monto restante    │                │
    └───────────┬───────────┘                │
                │                             │
                └─────────────┬───────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Balance actualizado │
                   │ correctamente       │
                   │ ✅ CONSISTENTE      │
                   └─────────────────────┘
```

---

## 🎯 Matriz de Escenarios

| Escenario | Abono Inicial | Estado Inicial | % Actualización Inicial | Estado Final | % Actualización Final | Total Actualizado |
| --------- | ------------- | -------------- | ----------------------- | ------------ | --------------------- | ----------------- |
| **1**     | $0 (0%)       | COMPLETADO     | 100%                    | COMPLETADO   | 0%                    | 100% ✅           |
| **2**     | $500k (50%)   | PENDIENTE      | 50%                     | COMPLETADO   | 50%                   | 100% ✅           |
| **3**     | $300k (30%)   | PENDIENTE      | 30%                     | COMPLETADO   | 70%                   | 100% ✅           |
| **4**     | $800k (80%)   | PENDIENTE      | 80%                     | COMPLETADO   | 20%                   | 100% ✅           |
| **5**     | $1M (100%)    | COMPLETADO     | 100%                    | COMPLETADO   | 0%                    | 100% ✅           |

**Conclusión**: En todos los escenarios, el balance total actualizado es **100%** ✅

---

## 🔢 Fórmulas Matemáticas

### **Creación con Abono Inicial**

```
porcentajeActualizacion = abono_inicial_monto / monto_destino

ingresoEfectivo = divisas_entregadas_efectivo × porcentajeActualizacion
ingresoBancos = divisas_entregadas_transfer × porcentajeActualizacion
ingresoBilletes = divisas_entregadas_billetes × porcentajeActualizacion
ingresoMonedas = divisas_entregadas_monedas × porcentajeActualizacion

egresoEfectivo = divisas_recibidas_efectivo × porcentajeActualizacion
egresoBancos = divisas_recibidas_transfer × porcentajeActualizacion
egresoBilletes = divisas_recibidas_billetes × porcentajeActualizacion
egresoMonedas = divisas_recibidas_monedas × porcentajeActualizacion
```

### **Cierre de Pendiente**

```
montoRestante = monto_destino - abono_inicial_monto
porcentajeRestante = montoRestante / monto_destino

ingresoEfectivoRestante = divisas_entregadas_efectivo × porcentajeRestante
ingresoBancosRestante = divisas_entregadas_transfer × porcentajeRestante
ingresoBilletesRestante = divisas_entregadas_billetes × porcentajeRestante
ingresoMonedasRestante = divisas_entregadas_monedas × porcentajeRestante

egresoEfectivoRestante = divisas_recibidas_efectivo × porcentajeRestante
egresoBancosRestante = divisas_recibidas_transfer × porcentajeRestante
egresoBilletesRestante = divisas_recibidas_billetes × porcentajeRestante
egresoMonedasRestante = divisas_recibidas_monedas × porcentajeRestante
```

### **Verificación de Consistencia**

```
Total Actualizado = Actualización Inicial + Actualización Cierre

Total Actualizado = (Monto × %Inicial) + (Monto × %Restante)
Total Actualizado = Monto × (%Inicial + %Restante)
Total Actualizado = Monto × 1.0
Total Actualizado = Monto ✅

Ejemplo:
  Monto = $1,000,000
  Abono = $500,000 (50%)

  Inicial = $1,000,000 × 0.5 = $500,000
  Cierre = $1,000,000 × 0.5 = $500,000
  Total = $500,000 + $500,000 = $1,000,000 ✅
```

---

## 🎨 Leyenda de Símbolos

```
┌─┐  Caja de proceso
│ │  Contenido
└─┘

 │   Flujo secuencial
 ▼

 ├─  Bifurcación
 └─

 ✅  Correcto / Exitoso
 ❌  Error / Incorrecto
 ⚠️  Advertencia
 💡  Sugerencia
 🔍  Verificación
 📊  Datos / Métricas
 ⏰  Tiempo / Espera
 ◄── Anotación / Comentario
```

---

## 📱 Vista Simplificada para Móvil

```
FLUJO SIMPLE:

1️⃣ CREAR CON ABONO
   Pago: $500 de $1000 (50%)
   ↓
   Balance: +$500 (50%)
   Estado: PENDIENTE

2️⃣ ESPERAR
   Cliente regresa...

3️⃣ CERRAR PENDIENTE
   Pago: $500 restantes (50%)
   ↓
   Balance: +$500 (50%)
   Estado: COMPLETADO

✅ TOTAL: $1000 (100%)
```

---

**Última Actualización**: 2025  
**Versión**: 1.0  
**Estado**: ✅ COMPLETADO
