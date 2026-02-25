# 💰 Sistema de Cuadre de Caja Mejorado

## Resumen

Se ha implementado un sistema completo de cuadre de caja que permite a los operadores registrar manualmente el conteo físico de billetes y monedas, validar diferencias antes del cierre, y revisar todos los movimientos del día para auditoría.

---

## 🎯 Funcionalidades Implementadas

### 1. Registro de Conteo Físico Manual
**Endpoint:** `POST /api/cuadre-caja/conteo-fisico`

Los operadores pueden ingresar:
- **Billetes**: Valor total en billetes por divisa
- **Monedas**: Valor total en monedas por divisa  
- **Bancos**: Valor en cuentas bancarias
- **Observaciones**: Notas adicionales

El sistema calcula automáticamente:
- Conteo físico total (billetes + monedas)
- Diferencia vs saldo teórico
- Alertas si la diferencia excede $10

**Ejemplo de Request:**
```json
{
  "cuadre_id": "uuid-del-cuadre",
  "moneda_id": "uuid-de-moneda",
  "billetes": 1500.00,
  "monedas_fisicas": 25.50,
  "conteo_bancos": 500.00,
  "observaciones": "Conteo realizado a las 6 PM"
}
```

**Ejemplo de Response:**
```json
{
  "success": true,
  "data": {
    "cuadre_id": "uuid-del-cuadre",
    "moneda_codigo": "USD",
    "conteo_fisico": 1525.50,
    "billetes": 1500.00,
    "monedas_fisicas": 25.50,
    "saldo_teorico": 1520.00,
    "diferencia": 5.50,
    "requiere_alerta": false
  },
  "alerta": null
}
```

---

### 2. Validación de Diferencias
**Endpoint:** `POST /api/cuadre-caja/validar`

Antes de cerrar el cuadre, el sistema valida:
- Diferencias mayores a $10 en efectivo
- Diferencias mayores a $10 en bancos
- Conteos físicos vacíos cuando hay movimientos
- Posibilidad de forzar cierre (solo admins)

**Ejemplo de Response con Discrepancias:**
```json
{
  "success": true,
  "data": {
    "puede_cerrar": false,
    "umbral_alerta": 10,
    "resumen": {
      "total_discrepancias": 2,
      "criticas": 1,
      "advertencias": 1,
      "info": 0
    },
    "discrepancias": [
      {
        "moneda_codigo": "USD",
        "tipo": "DIFERENCIA_EFECTIVO",
        "diferencia": 15.00,
        "severidad": "ADVERTENCIA",
        "mensaje": "Diferencia en efectivo de $15.00 USD. Sobrante detectado."
      },
      {
        "moneda_codigo": "EUR",
        "tipo": "CONTEO_FISICO_VACIO",
        "diferencia": 0,
        "severidad": "CRITICA",
        "mensaje": "No se ha registrado conteo físico para EUR pero existen 3 movimientos."
      }
    ]
  }
}
```

---

### 3. Auditoría de Movimientos del Día
**Endpoint:** `GET /api/cuadre-caja/movimientos-auditoria?fecha=2025-01-15`

Devuelve TODOS los movimientos que afectaron los saldos del día:

#### Tipos de Movimientos Incluidos:

| Tipo | Descripción | Campos Importantes |
|------|-------------|-------------------|
| `CAMBIO_DIVISA` | Operaciones de compra/venta de divisas | `monto_origen`, `monto_destino`, `tasa`, `numero_recibo` |
| `SERVICIO_EXTERNO` | Ingresos/egresos de servicios externos | `servicio`, `monto`, `tipo_movimiento` |
| `TRANSFERENCIA` | Transferencias entre puntos | `direccion` (ENTRADA/SALIDA), `monto`, `origen/destino` |
| `GUIA_SERVIENTREGA` | Guías generadas en Servientrega | `numero_guia`, `valor_declarado`, `costo_envio` |
| `MOVIMIENTO_SALDO` | Ajustes y movimientos de saldo | `tipo_movimiento`, `monto`, `descripcion` |

**Ejemplo de Response:**
```json
{
  "success": true,
  "data": {
    "periodo": {
      "desde": "2025-01-15T00:00:00.000Z",
      "hasta": "2025-01-15T23:59:59.999Z"
    },
    "totales": {
      "cambios_divisa": 5,
      "servicios_externos": 3,
      "transferencias": 2,
      "guias_servientrega": 1,
      "movimientos_saldo": 0,
      "total": 11
    },
    "movimientos": [
      {
        "tipo": "CAMBIO_DIVISA",
        "fecha": "2025-01-15T14:30:00Z",
        "descripcion": "Cambio COMPRA: USD → EUR",
        "monto_origen": 1000.00,
        "monto_destino": 920.00,
        "moneda_origen": "USD",
        "moneda_destino": "EUR",
        "numero_recibo": "C-2025-001"
      }
    ]
  }
}
```

---

### 4. Detalles del Cuadre con Alertas
**Endpoint:** `GET /api/cuadre-caja/detalles/:cuadreId`

Devuelve todos los detalles del cuadre con indicadores de alerta:

```json
{
  "success": true,
  "data": {
    "cuadre_id": "uuid",
    "umbral_alerta": 10,
    "detalles": [
      {
        "moneda_id": "uuid",
        "moneda_codigo": "USD",
        "saldo_apertura": 1000.00,
        "saldo_cierre": 2520.00,
        "conteo_fisico": 2525.50,
        "billetes": 2500.00,
        "monedas_fisicas": 25.50,
        "diferencia": 5.50,
        "alertas": {
          "diferencia_efectivo": false,
          "diferencia_bancos": false,
          "severidad": "OK"
        }
      }
    ]
  }
}
```

---

## 🚨 Sistema de Alertas

### Niveles de Severidad

| Severidad | Color | Condición | Acción Requerida |
|-----------|-------|-----------|------------------|
| **CRITICA** | 🔴 Rojo | Diferencia > $20 o conteo vacío con movimientos | No permite cierre. Revisar movimientos. |
| **ADVERTENCIA** | 🟡 Amarillo | Diferencia > $10 y ≤ $20 | No permite cierre normal. Admin puede forzar. |
| **INFO** | 🔵 Azul | Diferencia ≤ $10 | Permite cierre. Registrar observación. |
| **OK** | 🟢 Verde | Sin diferencias | Cierre normal. |

### Umbral de Alerta
- **Default:** $10 USD (o equivalente)
- **Configurable:** Puede ajustarse según necesidades del negocio
- **Doble umbral:** >$10 advertencia, >$20 crítica

---

## 📋 Flujo de Trabajo Recomendado

### Para Operadores:

1. **Al finalizar el día**, acceder al formulario de cuadre
2. **Ingresar conteo físico** para cada divisa:
   - Contar billetes y monedas por separado
   - Registrar valores en el formulario
   - Agregar observaciones si es necesario

3. **Revisar alertas:**
   - Si hay diferencias >$10, revisar movimientos
   - Usar la vista de auditoría para comparar con bitácora física

4. **Validar antes de cerrar:**
   - El sistema mostrará discrepancias encontradas
   - Si todo está correcto, proceder con el cierre
   - Si hay discrepancias, corregir o contactar admin

### Para Administradores:

1. **Monitorear cuadres** con alertas
2. **Revisar discrepancias** mayores a $10
3. **Forzar cierre** si es necesario (con override)
4. **Hacer ajustes** contables según sobrantes/faltantes

---

## 🔧 Endpoints Disponibles

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/cuadre-caja/conteo-fisico` | Guardar conteo manual |
| POST | `/api/cuadre-caja/validar` | Validar antes de cerrar |
| GET | `/api/cuadre-caja/movimientos-auditoria` | Obtener movimientos del día |
| GET | `/api/cuadre-caja/detalles/:cuadreId` | Detalles con alertas |

---

## 💡 Mejores Prácticas

1. **Conteo físico diario:** Siempre realizar el conteo al final de la jornada
2. **Separar billetes/monedas:** Registrar por separado para mejor trazabilidad
3. **Bitácora física:** Mantener registro escrito para comparar con sistema
4. **Revisar alertas:** No ignorar advertencias de diferencias
5. **Observaciones:** Agregar notas cuando hay situaciones especiales

---

## 📝 Ejemplo de Uso Completo

```typescript
// 1. Guardar conteo físico
const conteo = await fetch('/api/cuadre-caja/conteo-fisico', {
  method: 'POST',
  body: JSON.stringify({
    cuadre_id: "abc-123",
    moneda_id: "usd-uuid",
    billetes: 5000,
    monedas_fisicas: 150.50,
    conteo_bancos: 2000
  })
});

// 2. Validar antes de cerrar
const validacion = await fetch('/api/cuadre-caja/validar', {
  method: 'POST',
  body: JSON.stringify({
    cuadre_id: "abc-123"
  })
});

// Si validacion.data.puede_cerrar === true, proceder con cierre
// Si hay discrepancias, revisar movimientos:

// 3. Obtener movimientos para auditoría
const movimientos = await fetch('/api/cuadre-caja/movimientos-auditoria?fecha=2025-01-15');

// Comparar con bitácora física del operador
```

---

## 🔒 Seguridad

- Solo usuarios autenticados pueden acceder
- Los operadores solo pueden modificar su propio punto de atención
- Los admins pueden forzar cierre con `forzar: true`
- Todos los cambios quedan registrados con timestamp y usuario

---

## 📊 Reportes Futuros Sugeridos

1. **Reporte de discrepancias diarias** - Para revisión administrativa
2. **Historial de ajustes** - Tracking de correcciones
3. **Estadísticas de cuadre** - Por operador, por punto, por período
4. **Alertas en tiempo real** - Notificaciones cuando hay diferencias grandes
