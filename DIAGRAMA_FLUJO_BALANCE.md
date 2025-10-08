# 📊 Diagrama de Flujo - Sistema de Balance

## 🔄 Flujo Completo de Transacciones

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CREACIÓN DE TRANSACCIÓN                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │  CAMBIO DIVISA    │       │   TRANSFERENCIA   │
        │                   │       │                   │
        │ Estado: PENDIENTE │       │ Estado: PENDIENTE │
        │    o COMPLETADO   │       │                   │
        └─────────┬─────────┘       └─────────┬─────────┘
                  │                           │
                  │                           │
                  ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │   ¿Aprobación?    │       │   ¿Aprobación?    │
        └─────────┬─────────┘       └─────────┬─────────┘
                  │                           │
         ┌────────┴────────┐         ┌────────┴────────┐
         │                 │         │                 │
         ▼                 ▼         ▼                 ▼
    COMPLETADO        CANCELADO  APROBADO         RECHAZADO
         │                 │         │                 │
         │                 │         │                 │
         ▼                 ▼         ▼                 ▼
    ✅ AFECTA         ❌ NO      ✅ AFECTA         ❌ NO
     BALANCE         AFECTA      BALANCE         AFECTA
                     BALANCE                     BALANCE
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                  SERVICIO EXTERNO MOVIMIENTO                        │
│                                                                     │
│  ⚡ SIN ESTADO - AFECTA BALANCE INMEDIATAMENTE                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │     INGRESO       │       │      EGRESO       │
        │                   │       │                   │
        │   ✅ + Balance    │       │   ✅ - Balance    │
        └───────────────────┘       └───────────────────┘
```

---

## 🧮 Cálculo de Balance por Moneda

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BALANCE POR MONEDA Y PUNTO                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │     INGRESOS      │       │      EGRESOS      │
        │        (+)        │       │        (-)        │
        └─────────┬─────────┘       └─────────┬─────────┘
                  │                           │
                  │                           │
    ┌─────────────┼─────────────┐            │
    │             │             │            │
    ▼             ▼             ▼            │
┌────────┐  ┌──────────┐  ┌─────────┐       │
│Cambios │  │Transfer. │  │Servicios│       │
│Destino │  │Recibidas │  │Ingresos │       │
│        │  │          │  │         │       │
│COMPLE- │  │APROBADO  │  │TODOS    │       │
│TADO    │  │          │  │         │       │
└────────┘  └──────────┘  └─────────┘       │
                                             │
                  ┌──────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌─────────┐
│Cambios │  │Transfer. │  │Servicios│
│Origen  │  │Enviadas  │  │Egresos  │
│        │  │          │  │         │
│COMPLE- │  │APROBADO  │  │TODOS    │
│TADO    │  │          │  │         │
└────────┘  └──────────┘  └─────────┘
                  │
                  ▼
        ┌───────────────────┐
        │                   │
        │  BALANCE FINAL    │
        │                   │
        │ Ingresos - Egresos│
        │                   │
        └───────────────────┘
```

---

## 📊 Ejemplo Práctico: Punto "Centro" - Moneda USD

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRANSACCIONES DEL DÍA                            │
└─────────────────────────────────────────────────────────────────────┘

1. Cambio Divisa: Cliente compra $500 USD con COP
   ├─ Moneda Origen: COP (2,000,000)
   ├─ Moneda Destino: USD (500)
   ├─ Estado: COMPLETADO ✅
   └─ Efecto en USD: +500 (ingreso)

2. Cambio Divisa: Cliente vende $300 USD por COP
   ├─ Moneda Origen: USD (300)
   ├─ Moneda Destino: COP (1,200,000)
   ├─ Estado: COMPLETADO ✅
   └─ Efecto en USD: -300 (egreso)

3. Cambio Divisa: Cliente compra $1000 USD (ABONO INICIAL)
   ├─ Moneda Origen: COP (4,000,000)
   ├─ Moneda Destino: USD (1000)
   ├─ Estado: PENDIENTE ⏳
   └─ Efecto en USD: 0 (NO afecta balance)

4. Transferencia: Recibida desde Punto "Norte"
   ├─ Origen: Punto Norte
   ├─ Destino: Punto Centro
   ├─ Monto: 2000 USD
   ├─ Estado: APROBADO ✅
   └─ Efecto en USD: +2000 (ingreso)

5. Transferencia: Enviada a Matriz
   ├─ Origen: Punto Centro
   ├─ Destino: Matriz
   ├─ Monto: 1500 USD
   ├─ Estado: PENDIENTE ⏳
   └─ Efecto en USD: 0 (NO afecta balance)

6. Servicio Externo: Pago Western Union
   ├─ Servicio: WESTERN
   ├─ Tipo: INGRESO
   ├─ Monto: 800 USD
   └─ Efecto en USD: +800 (ingreso)

7. Servicio Externo: Compra insumos oficina
   ├─ Servicio: INSUMOS_OFICINA
   ├─ Tipo: EGRESO
   ├─ Monto: 150 USD
   └─ Efecto en USD: -150 (egreso)

┌─────────────────────────────────────────────────────────────────────┐
│                      CÁLCULO DE BALANCE USD                         │
└─────────────────────────────────────────────────────────────────────┘

INGRESOS:
  Cambios Destino (COMPLETADO):        +500
  Transferencias Recibidas (APROBADO): +2000
  Servicios Ingresos:                  +800
  ─────────────────────────────────────────
  TOTAL INGRESOS:                      +3300

EGRESOS:
  Cambios Origen (COMPLETADO):         -300
  Transferencias Enviadas (APROBADO):  0
  Servicios Egresos:                   -150
  ─────────────────────────────────────────
  TOTAL EGRESOS:                       -450

┌─────────────────────────────────────────────────────────────────────┐
│  BALANCE FINAL USD = 3300 - 450 = +2850 USD                        │
└─────────────────────────────────────────────────────────────────────┘

NOTA: Las transacciones PENDIENTES (3 y 5) NO se incluyen en el cálculo
```

---

## 🔄 Flujo de Actualización de Saldos

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ACTUALIZACIÓN DE SALDOS                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │   AUTOMÁTICA      │       │     MANUAL        │
        │                   │       │                   │
        │ Cada transacción  │       │ Script recálculo  │
        │ actualiza saldo   │       │                   │
        └─────────┬─────────┘       └─────────┬─────────┘
                  │                           │
                  │                           │
                  ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │  Tabla: Saldo     │       │  Tabla: Saldo     │
        │                   │       │                   │
        │  UPDATE cantidad  │       │  RECALCULA todo   │
        │  WHERE punto_id   │       │  desde cero       │
        │  AND moneda_id    │       │                   │
        └───────────────────┘       └───────────────────┘
                  │                           │
                  └─────────────┬─────────────┘
                                │
                                ▼
                    ┌───────────────────┐
                    │                   │
                    │  SALDO ACTUAL     │
                    │  EN BASE DE DATOS │
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │                   │
                    │  ENDPOINT API     │
                    │  /balance-completo│
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │                   │
                    │  DASHBOARD        │
                    │  (Frontend)       │
                    │                   │
                    └───────────────────┘
```

---

## 🎯 Estados y Decisiones

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MATRIZ DE DECISIÓN                               │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────┬──────────────┬──────────────────┐
│ Tipo Transacción │    Estado    │ Afecta Saldo │   Comentario     │
├──────────────────┼──────────────┼──────────────┼──────────────────┤
│ CambioDivisa     │ COMPLETADO   │     ✅ SÍ    │ Transacción OK   │
│ CambioDivisa     │ PENDIENTE    │     ❌ NO    │ Abono inicial    │
│ CambioDivisa     │ CANCELADO    │     ❌ NO    │ Anulada          │
├──────────────────┼──────────────┼──────────────┼──────────────────┤
│ Transferencia    │ APROBADO     │     ✅ SÍ    │ Autorizada       │
│ Transferencia    │ PENDIENTE    │     ❌ NO    │ Sin aprobar      │
│ Transferencia    │ RECHAZADO    │     ❌ NO    │ Denegada         │
├──────────────────┼──────────────┼──────────────┼──────────────────┤
│ ServicioExterno  │ (sin estado) │     ✅ SÍ    │ Inmediato        │
└──────────────────┴──────────────┴──────────────┴──────────────────┘
```

---

## 🔍 Verificación de Consistencia

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROCESO DE VERIFICACIÓN                          │
└─────────────────────────────────────────────────────────────────────┘

1. SCRIPT DE RECÁLCULO
   │
   ├─ Filtra: estado = "COMPLETADO" (CambioDivisa)
   ├─ Filtra: estado = "APROBADO" (Transferencia)
   ├─ Procesa: TODOS (ServicioExternoMovimiento)
   │
   └─ Actualiza tabla Saldo
              │
              ▼
2. ENDPOINT /balance-completo
   │
   ├─ Filtra: estado = "COMPLETADO" (CambioDivisa)
   ├─ Filtra: estado = "APROBADO" (Transferencia)
   ├─ Procesa: TODOS (ServicioExternoMovimiento)
   │
   └─ Calcula balance en tiempo real
              │
              ▼
3. COMPARACIÓN
   │
   ├─ ¿Saldo DB == Balance calculado?
   │
   ├─ SÍ ✅ → Sistema consistente
   │
   └─ NO ❌ → Ejecutar script de recálculo
```

---

## 📱 Flujo en el Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BALANCE DASHBOARD                                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌───────────────────────┐
                    │ Usuario selecciona    │
                    │ Punto de Atención     │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ GET /balance-completo │
                    │ /punto/:pointId       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Respuesta JSON:       │
                    │ - actividad           │
                    │ - balancesPorMoneda   │
                    └───────────┬───────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Tarjetas    │  │  Balance por │  │  Auto-refresh│
    │  Actividad   │  │  Moneda      │  │  cada 30s    │
    │              │  │              │  │              │
    │ - Cambios    │  │ USD: +2850   │  │  🔄          │
    │ - Servicios  │  │ COP: +1.2M   │  │              │
    │ - Transfer.  │  │ EUR: +500    │  │              │
    └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🚨 Casos de Error y Soluciones

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TROUBLESHOOTING                                  │
└─────────────────────────────────────────────────────────────────────┘

ERROR 1: "Cannot read properties of undefined"
├─ Causa: Estructura de respuesta incorrecta
├─ Verificar: Endpoint devuelve data.actividad
└─ Solución: ✅ Ya corregido en balance-completo.ts

ERROR 2: Saldos no coinciden con transacciones
├─ Causa: Script no filtraba por estado
├─ Verificar: Script usa filtros COMPLETADO/APROBADO
└─ Solución: ✅ Ya corregido en recalcularYLimpiarDB.ts

ERROR 3: Balance incluye transacciones pendientes
├─ Causa: Filtros incorrectos en queries
├─ Verificar: WHERE estado = "COMPLETADO"/"APROBADO"
└─ Solución: Revisar queries en endpoints

ERROR 4: Inconsistencia después de aprobar transferencia
├─ Causa: Saldo no se actualiza automáticamente
├─ Verificar: Trigger o lógica de actualización
└─ Solución: Ejecutar script de recálculo
```

---

## ✅ Checklist de Validación

```
ANTES DE DESPLEGAR:
□ Script de recálculo filtra por estado
□ Endpoint de balance filtra por estado
□ Frontend recibe estructura correcta
□ Build sin errores TypeScript
□ Pruebas en ambiente de desarrollo
□ Documentación actualizada

DESPUÉS DE DESPLEGAR:
□ Ejecutar script de recálculo
□ Verificar balances en dashboard
□ Comparar con registros contables
□ Monitorear logs de errores
□ Validar con usuarios finales
```

---

**Última actualización:** 2025-01-08  
**Versión:** 1.0
