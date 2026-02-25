# 📊 Informe Completo - Sistema de Ajustes Contables en Cierre de Caja

## 🎯 Propósito de este Documento

Este informe detalla el **sistema de ajustes contables automáticos** implementado en el proceso de cierre de caja, garantizando:
- ✅ **Trazabilidad completa** de cada centavo
- ✅ **Cuadre perfecto** entre sistema y físico
- ✅ **Auditoría transparente** para administradores
- ✅ **Prevención de pérdidas** por diferencias no detectadas

---

## 💰 Importancia del Control de Diferencias

> **"Es dinero real que ingresamos en un sistema y que debe trabajarse con el mayor cuidado posible"**

### Riesgos sin Control de Ajustes:
- ❌ Diferencias acumuladas sin explicación
- ❌ Pérdidas monetarias no detectadas
- ❌ Desconfianza en el sistema
- ❌ Problemas fiscales y legales
- ❌ Falta de responsabilidad clara

### Solución Implementada:
- ✅ Cada diferencia queda registrada con:
  - Monto exacto
  - Tipo (sobrante/faltante)
  - Fecha y hora
  - Usuario responsable
  - Punto de atención
  - Referencia al cuadre específico

---

## 🔍 Proceso de Ajuste Contable - Paso a Paso

### Diagrama del Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROCESO DE AJUSTE CONTABLE                            │
│                    (Ejecutado automáticamente al cierre)                 │
└─────────────────────────────────────────────────────────────────────────┘

   OPERADOR CIERRA CAJA
           │
           ▼
   ┌──────────────────┐
   │ INGRESA CONTEO   │  ← Billetes + Monedas = Total Físico
   │ FÍSICO MANUAL    │
   └──────────────────┘
           │
           ▼
   ┌──────────────────┐
   │ SISTEMA COMPARA  │  ← Saldo Teórico vs Conteo Físico
   │                  │
   │ Ejemplo:         │
   │ Teórico: $1,000  │
   │ Físico:  $1,015  │
   │ Diferencia: +$15 │
   └──────────────────┘
           │
     ¿Diferencia >= $0.01?
           │
      SÍ /    \ NO
         │      │
         ▼      ▼
   ┌────────┐  ┌──────────────┐
   │CREAR   │  │NO REQUIERE   │
   │AJUSTE  │  │AJUSTE        │
   │CONTABLE│  │(Cierre ideal) │
   └────────┘  └──────────────┘
         │
         ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                    AJUSTE CONTABLE CREADO                     │
   ├──────────────────────────────────────────────────────────────┤
   │ 1. ACTUALIZA TABLA SALDO                                     │
   │    └─ cantidad = $1,015 (valor físico real)                  │
   │    └─ Próximo día inicia con este saldo                      │
   │                                                               │
   │ 2. CREA MOVIMIENTO DE AJUSTE                                 │
   │    └─ Tipo: INGRESO (sobrante) / EGRESO (faltante)           │
   │    └─ Monto: $15.00                                          │
   │    └─ Descripción: "AJUSTE CIERRE 2025-01-15"                │
   │    └─ Referencia: ID del cuadre                              │
   │    └─ Usuario: ID del operador                               │
   │    └─ Timestamp: Fecha/hora exacta                           │
   │                                                               │
   │ 3. ACTUALIZA CUADRE                                          │
   │    └─ Guarda diferencia detectada ($15)                      │
   │    └─ Estado: CERRADO                                        │
   └──────────────────────────────────────────────────────────────┘
           │
           ▼
   ┌──────────────────┐
   │ CIERRE           │
   │ COMPLETADO       │
   │ ✅ Sistema       │
   │ ✅ Físico        │
   │ ✅ Libros        │
   └──────────────────┘
```

---

## 📋 Estructura de Datos para Trazabilidad

### 1. Tabla `CuadreCaja` (Cabecera del Cierre)

```sql
CREATE TABLE "CuadreCaja" (
  id                    UUID PRIMARY KEY,
  usuario_id            UUID REFERENCES "Usuario",
  punto_atencion_id     UUID REFERENCES "PuntoAtencion",
  fecha                 TIMESTAMP,
  estado                VARCHAR(20),           -- 'ABIERTO', 'PARCIAL', 'CERRADO'
  fecha_cierre          TIMESTAMP,
  total_ingresos        DECIMAL(15,2),         -- Total del día
  total_egresos         DECIMAL(15,2),         -- Total del día
  total_cambios         INTEGER,               -- Cantidad de operaciones
  observaciones         TEXT,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

**Ejemplo de Registro:**
| Campo | Valor |
|-------|-------|
| id | `550e8400-e29b-41d4-a716-446655440000` |
| usuario_id | `Operador: Juan Pérez` |
| punto_atencion_id | `Oficina Principal` |
| fecha | `2025-01-15 00:00:00` |
| estado | `CERRADO` |
| fecha_cierre | `2025-01-15 18:30:45` |
| total_ingresos | `5,250.00` |
| total_egresos | `3,100.00` |

---

### 2. Tabla `DetalleCuadreCaja` (Detalle por Moneda)

```sql
CREATE TABLE "DetalleCuadreCaja" (
  id                    UUID PRIMARY KEY,
  cuadre_id             UUID REFERENCES "CuadreCaja",
  moneda_id             UUID REFERENCES "Moneda",
  saldo_apertura        DECIMAL(15,2),         -- Inicio del día
  saldo_cierre          DECIMAL(15,2),         -- Calculado por sistema
  conteo_fisico         DECIMAL(15,2),         -- Ingresado por operador
  diferencia            DECIMAL(15,2),         -- conteo - saldo_cierre
  billetes              DECIMAL(15,2),         -- Desglose físico
  monedas_fisicas       DECIMAL(15,2),         -- Desglose físico
  bancos_teorico        DECIMAL(15,2),         -- En bancos según sistema
  conteo_bancos         DECIMAL(15,2),         -- En bancos según operador
  diferencia_bancos     DECIMAL(15,2),         -- Diferencia en bancos
  movimientos_periodo   INTEGER,               -- Cantidad de movimientos
  observaciones_detalle TEXT
);
```

**Ejemplo de Registro:**
| Campo | Valor | Descripción |
|-------|-------|-------------|
| moneda_id | `USD` | Dólares Americanos |
| saldo_apertura | `1,000.00` | Apertura del día |
| saldo_cierre | `1,000.00` | Según sistema |
| conteo_fisico | `1,015.00` | Según operador |
| **diferencia** | **+15.00** | **Sobrante detectado** |
| billetes | `900.00` | Conteo detallado |
| monedas_fisicas | `115.00` | Conteo detallado |

---

### 3. Tabla `MovimientoSaldo` (Ajuste Contable)

```sql
CREATE TABLE "MovimientoSaldo" (
  id                UUID PRIMARY KEY,
  punto_atencion_id UUID REFERENCES "PuntoAtencion",
  moneda_id         UUID REFERENCES "Moneda",
  usuario_id        UUID REFERENCES "Usuario",
  tipo_movimiento   VARCHAR(20),           -- 'INGRESO', 'EGRESO'
  monto             DECIMAL(15,2),
  saldo_anterior    DECIMAL(15,2),
  saldo_nuevo       DECIMAL(15,2),
  tipo_referencia   VARCHAR(50),           -- 'CIERRE_DIARIO'
  referencia_id     UUID,                  -- ID del cuadre
  descripcion       VARCHAR(255),          -- 'AJUSTE CIERRE 2025-01-15'
  saldo_bucket      VARCHAR(20),           -- 'CAJA', 'BANCOS'
  fecha             TIMESTAMP DEFAULT NOW()
);
```

**Ejemplo de Registro (Ajuste por Sobrante):**
| Campo | Valor |
|-------|-------|
| tipo_movimiento | `INGRESO` |
| monto | `15.00` |
| saldo_anterior | `1,000.00` |
| saldo_nuevo | `1,015.00` |
| tipo_referencia | `CIERRE_DIARIO` |
| referencia_id | `550e8400-e29b-41d4-a716-446655440000` |
| descripcion | `AJUSTE CIERRE 2025-01-15` |
| saldo_bucket | `CAJA` |

**Ejemplo de Registro (Ajuste por Faltante):**
| Campo | Valor |
|-------|-------|
| tipo_movimiento | `EGRESO` |
| monto | `8.50` |
| saldo_anterior | `2,500.00` |
| saldo_nuevo | `2,491.50` |
| descripcion | `AJUSTE CIERRE 2025-01-15` |

---

## 📊 Reportes para el Administrador

### Reporte 1: Resumen de Diferencias por Período

```sql
-- REPORTE: Diferencias en cierres del último mes
SELECT 
  DATE(c.fecha_cierre) as fecha,
  p.nombre as punto,
  u.nombre as operador,
  m.codigo as moneda,
  dc.saldo_cierre as saldo_teorico,
  dc.conteo_fisico as conteo_fisico,
  dc.diferencia,
  CASE 
    WHEN dc.diferencia > 0 THEN 'SOBRANTE'
    WHEN dc.diferencia < 0 THEN 'FALTANTE'
    ELSE 'CUADRA'
  END as tipo_diferencia,
  ABS(dc.diferencia) as monto_ajuste,
  c.id as cuadre_id
FROM "CuadreCaja" c
JOIN "DetalleCuadreCaja" dc ON c.id = dc.cuadre_id
JOIN "PuntoAtencion" p ON c.punto_atencion_id = p.id
JOIN "Usuario" u ON c.usuario_id = u.id
JOIN "Moneda" m ON dc.moneda_id = m.id
WHERE c.estado = 'CERRADO'
  AND c.fecha_cierre >= CURRENT_DATE - INTERVAL '30 days'
  AND dc.diferencia != 0
ORDER BY c.fecha_cierre DESC, ABS(dc.diferencia) DESC;
```

**Salida Esperada:**
| fecha | punto | operador | moneda | saldo_teorico | conteo_fisico | diferencia | tipo_diferencia | monto_ajuste |
|-------|-------|----------|--------|---------------|---------------|------------|-----------------|--------------|
| 2025-01-15 | Principal | Juan Pérez | USD | 1,000.00 | 1,015.00 | +15.00 | SOBRANTE | 15.00 |
| 2025-01-14 | Sucursal Norte | María García | USD | 2,500.00 | 2,491.50 | -8.50 | FALTANTE | 8.50 |
| 2025-01-14 | Principal | Carlos Ruiz | EUR | 850.00 | 850.00 | 0.00 | CUADRA | 0.00 |

---

### Reporte 2: Detalle de Ajustes Contables

```sql
-- REPORTE: Todos los ajustes contables con trazabilidad completa
SELECT 
  ms.fecha as fecha_ajuste,
  p.nombre as punto,
  u.nombre as operador,
  m.codigo as moneda,
  ms.tipo_movimiento as tipo_ajuste,
  ms.monto as monto_ajustado,
  ms.saldo_anterior,
  ms.saldo_nuevo,
  ms.descripcion,
  ms.referencia_id as cuadre_id,
  dc.observaciones_detalle as notas_operador
FROM "MovimientoSaldo" ms
JOIN "PuntoAtencion" p ON ms.punto_atencion_id = p.id
JOIN "Usuario" u ON ms.usuario_id = u.id
JOIN "Moneda" m ON ms.moneda_id = m.id
LEFT JOIN "DetalleCuadreCaja" dc ON ms.referencia_id = dc.cuadre_id 
  AND ms.moneda_id = dc.moneda_id
WHERE ms.tipo_referencia = 'CIERRE_DIARIO'
  AND ms.descripcion LIKE '%AJUSTE CIERRE%'
  AND ms.fecha >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY ms.fecha DESC;
```

**Salida Esperada:**
| fecha_ajuste | punto | operador | moneda | tipo_ajuste | monto_ajustado | notas_operador |
|--------------|-------|----------|--------|-------------|----------------|----------------|
| 2025-01-15 18:30:45 | Principal | Juan Pérez | USD | INGRESO | 15.00 | Conteo verificado por supervisor |
| 2025-01-14 19:15:22 | Sucursal Norte | María García | USD | EGRESO | 8.50 | Diferencia aceptada |

---

### Reporte 3: Estadísticas de Cuadre por Operador

```sql
-- REPORTE: Rendimiento de operadores en cuadres
SELECT 
  u.nombre as operador,
  p.nombre as punto,
  COUNT(*) as total_cierres,
  COUNT(CASE WHEN dc.diferencia = 0 THEN 1 END) as cierres_perfectos,
  COUNT(CASE WHEN dc.diferencia != 0 THEN 1 END) as cierres_con_diferencia,
  SUM(CASE WHEN dc.diferencia > 0 THEN dc.diferencia ELSE 0 END) as total_sobrantes,
  SUM(CASE WHEN dc.diferencia < 0 THEN ABS(dc.diferencia) ELSE 0 END) as total_faltantes,
  AVG(ABS(dc.diferencia)) as promedio_diferencia_abs,
  MAX(ABS(dc.diferencia)) as maxima_diferencia
FROM "CuadreCaja" c
JOIN "DetalleCuadreCaja" dc ON c.id = dc.cuadre_id
JOIN "Usuario" u ON c.usuario_id = u.id
JOIN "PuntoAtencion" p ON c.punto_atencion_id = p.id
WHERE c.estado = 'CERRADO'
  AND c.fecha_cierre >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.nombre, p.nombre
ORDER BY promedio_diferencia_abs ASC;
```

**Salida Esperada:**
| operador | punto | total_cierres | cierres_perfectos | cierres_con_diferencia | total_sobrantes | total_faltantes | promedio_diferencia |
|----------|-------|---------------|-------------------|------------------------|-----------------|-----------------|---------------------|
| Juan Pérez | Principal | 15 | 12 | 3 | 25.00 | 5.50 | 2.03 |
| María García | Norte | 14 | 10 | 4 | 18.00 | 12.50 | 3.82 |

---

## 🛡️ Medidas de Seguridad Implementadas

### 1. **Idempotencia** (Evita Duplicados)
```typescript
// Antes de crear un ajuste, verifica que no exista
const yaExiste = await buscarAjusteExistente(cuadre_id, moneda_id);
if (!yaExiste) {
  await crearAjusteContable(datos);
}
```

### 2. **Transaccionalidad** (Todo o Nada)
```typescript
// Todo el proceso en una transacción
await prisma.$transaction(async (tx) => {
  await actualizarSaldo(tx, datos);
  await crearAjusteContable(tx, datos);
  await cerrarJornada(tx, datos);
});
// Si algo falla, TODO se revierte automáticamente
```

### 3. **Inmutabilidad de Registros**
- Una vez cerrado el cuadre, no se puede modificar
- Los ajustes contables son registros permanentes
- Solo se permite consulta, no edición

### 4. **Auditoría Completa**
Cada ajuste incluye:
- ✅ Quién (usuario_id)
- ✅ Dónde (punto_atencion_id)
- ✅ Cuándo (timestamp exacto)
- ✅ Qué (monto y tipo)
- ✅ Por qué (referencia al cuadre)

---

## 📈 Métricas de Control Recomendadas

### KPIs para el Administrador:

1. **% de Cierres Perfectos**
   ```
   Fórmula: (Cierres sin diferencia / Total cierres) × 100
   Meta: > 90%
   ```

2. **Promedio de Diferencia Absoluta**
   ```
   Fórmula: AVG(ABS(diferencia)) por operador
   Meta: < $5.00
   ```

3. **Monto Total de Ajustes por Período**
   ```
   Control semanal/mensual de:
   - Total sobrantes
   - Total faltantes
   - Balance neto
   ```

4. **Operadores con Mayor Desviación**
   ```
   Identificar quiénes necesitan capacitación
   ```

---

## ✅ Checklist de Implementación

- [x] Sistema de ajustes contables automáticos implementado
- [x] Trazabilidad completa en base de datos
- [x] Prevención de duplicados (idempotencia)
- [x] Transaccionalidad garantizada
- [x] Reportes SQL para administrador
- [x] Auditoría de todos los movimientos
- [x] Logs detallados de operaciones
- [ ] Dashboard visual para administrador (próxima fase)
- [ ] Alertas automáticas por diferencias grandes (próxima fase)

---

## 📞 Soporte y Escalación

### Si Encuentras una Diferencia Grande:

1. **Revisar el Reporte de Auditoría**
   - Ver movimientos del día en `/api/cuadre-caja/movimientos-auditoria`

2. **Verificar con el Operador**
   - Confirmar conteo físico
   - Revisar bitácora manual

3. **Revisar Cámaras (si aplica)**
   - Para montos significativos

4. **Documentar Observaciones**
   - Agregar notas en el cuadre

5. **Ajuste Contable**
   - El sistema lo crea automáticamente
   - Queda registrado para siempre

---

**Documento versión:** 1.0  
**Fecha:** 24 de Febrero, 2026  
**Estado:** Sistema implementado y operativo
