# Flujo de Rechazo/Anulación de Transferencias

## Descripción General

Esta funcionalidad permite al **punto de destino** rechazar una transferencia que aún está **EN_TRANSITO** (no ha sido aceptada). Cuando se rechaza una transferencia, el dinero es automáticamente devuelto al punto origen.

## Flujo de Negocio

### 1. Escenario
Un operador del Punto A realiza una transferencia incorrecta hacia el Punto B. El operador del Punto B detecta el error y decide rechazar la transferencia.

### 2. Estados de la Transferencia

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│ EN_TRANSITO │ ───► │  COMPLETADO  │      │  CANCELADO  │
│             │      │ (Aceptada)   │      │ (Rechazada) │
└─────────────┘      └──────────────┘      └─────────────┘
      │                                            ▲
      │                                            │
      └────────────────────────────────────────────┘
              Punto destino puede rechazar
```

### 3. Acciones Disponibles para el Punto Destino

Cuando una transferencia está **EN_TRANSITO**, el punto destino puede:

- ✅ **Aceptar**: Confirma la recepción del efectivo. El dinero se acredita al saldo del punto destino.
- ❌ **Rechazar**: Indica que NO recibió el efectivo o que hubo un error. El dinero se devuelve al punto origen.

## Cambios Técnicos Implementados

### 1. Schema de Base de Datos

#### Nuevos campos en `Transferencia`:
```prisma
model Transferencia {
  // ... campos existentes
  observaciones_rechazo    String?  // Motivo del rechazo
}
```

#### Nuevo tipo de movimiento:
```prisma
enum TipoMovimiento {
  INGRESO
  EGRESO
  TRANSFERENCIA_ENTRANTE
  TRANSFERENCIA_SALIENTE
  TRANSFERENCIA_DEVOLUCION  // ← NUEVO
  CAMBIO_DIVISA
}
```

### 2. Backend - Endpoint de Rechazo

**Ruta**: `POST /api/transfer-approvals/:id/reject`

**Permisos**: ADMIN, SUPER_USUARIO, OPERADOR, CONCESION

**Validaciones**:
- El usuario debe pertenecer al punto destino (o ser admin/super)
- La transferencia debe estar en estado `EN_TRANSITO`

**Proceso Transaccional**:
1. Actualiza el estado de la transferencia a `CANCELADO`
2. Registra `fecha_rechazo` y `observaciones_rechazo`
3. Obtiene el saldo actual del punto origen
4. Devuelve el monto al punto origen (revierte el débito original)
5. Registra un movimiento `TRANSFERENCIA_DEVOLUCION` en el punto origen

**Ejemplo de Request**:
```json
POST /api/transfer-approvals/abc-123-def/reject
{
  "observaciones": "El efectivo no fue entregado físicamente"
}
```

**Ejemplo de Response**:
```json
{
  "transfer": {
    "id": "abc-123-def",
    "estado": "CANCELADO",
    "fecha_rechazo": "2026-01-27T10:30:00Z",
    "observaciones_rechazo": "El efectivo no fue entregado físicamente",
    "monto": 1000.00
  },
  "success": true,
  "message": "Transferencia rechazada. Monto devuelto al punto origen."
}
```

### 3. Frontend - Servicio

**Nuevo método**: `transferService.rejectPendingTransfer()`

```typescript
async rejectPendingTransfer(
  transferId: string,
  observaciones?: string
): Promise<{ transfer: Transferencia | null; error: string | null }>
```

### 4. Componente UI - TransferAcceptance

**Archivo**: `src/components/admin/TransferAcceptance.tsx`

**Cambios**:
- Agregado icono `XCircle` de lucide-react
- Nuevo handler `handleReject()` con confirmación
- Botón "Rechazar" en color destructive (rojo)
- Layout actualizado con dos botones: "Rechazar" y "Confirmar Recepción"

**Vista del Operador**:
```
┌────────────────────────────────────────────────┐
│ Transferencias Pendientes de Recibir          │
├────────────────────────────────────────────────┤
│                                                │
│  💵 $1,000.00 USD                    EN TRÁNSITO│
│  De: Punto Centro                             │
│                                                │
│  Tipo: Entre Puntos                           │
│  Fecha de envío: 27/01/2026 09:15             │
│  Responsable: Byron Nogales                   │
│                                                │
│  Observaciones (opcional)                     │
│  ┌──────────────────────────────────────┐     │
│  │ Ej: Efectivo recibido completo...    │     │
│  └──────────────────────────────────────┘     │
│                                                │
│  [❌ Rechazar]  [✅ Confirmar Recepción]       │
│                                                │
└────────────────────────────────────────────────┘
```

## Flujo Completo de Ejemplo

### Paso 1: Operador A crea transferencia
- **Punto**: Punto Centro
- **Acción**: Crea transferencia de $1,000 USD hacia Punto Sur
- **Resultado**: 
  - Estado: `EN_TRANSITO`
  - Saldo Punto Centro: -$1,000 (débito inmediato)

### Paso 2: Operador B recibe notificación
- **Punto**: Punto Sur
- **Vista**: "Transferencias Pendientes de Recibir"
- **Opciones**: Aceptar o Rechazar

### Paso 3A: Operador B acepta (Flujo Normal)
- **Acción**: Click en "Confirmar Recepción"
- **Resultado**:
  - Estado: `COMPLETADO`
  - Saldo Punto Sur: +$1,000
  - Movimiento: `TRANSFERENCIA_ENTRANTE`

### Paso 3B: Operador B rechaza (Flujo de Error)
- **Acción**: Click en "Rechazar"
- **Motivo**: "El efectivo nunca fue entregado físicamente"
- **Resultado**:
  - Estado: `CANCELADO`
  - Saldo Punto Centro: +$1,000 (devolución)
  - Movimiento: `TRANSFERENCIA_DEVOLUCION`
  - Notificación al Operador A

## Registro de Movimientos

### Al crear la transferencia (Punto Origen):
```sql
INSERT INTO "MovimientoSaldo" (
  tipo_movimiento = 'TRANSFERENCIA_SALIENTE',
  monto = -1000.00,
  descripcion = 'Transferencia de salida a Punto Sur'
)
```

### Al rechazar (Punto Origen):
```sql
INSERT INTO "MovimientoSaldo" (
  tipo_movimiento = 'TRANSFERENCIA_DEVOLUCION',
  monto = +1000.00,
  descripcion = 'Devolución por transferencia rechazada - [observaciones]'
)
```

## Mensajes al Usuario

### Al rechazar exitosamente:
```
❌ Transferencia rechazada. Monto devuelto al punto origen.
```

### Al aceptar exitosamente:
```
✅ Transferencia aceptada. Monto agregado a tu saldo.
```

## Validaciones y Controles

### ✅ Validaciones Implementadas:
- Solo el punto destino puede aceptar o rechazar
- Solo se pueden rechazar transferencias en estado `EN_TRANSITO`
- El rechazo es transaccional (todo o nada)
- Se registra quién rechazó y cuándo
- Se mantiene el histórico completo de movimientos

### 🔒 Seguridad:
- Verificación de pertenencia al punto destino
- Autenticación JWT requerida
- Roles autorizados: ADMIN, SUPER_USUARIO, OPERADOR, CONCESION

## Reportes y Auditoría

### Consultar transferencias canceladas:
```sql
SELECT 
  t.numero_recibo,
  o.nombre AS punto_origen,
  d.nombre AS punto_destino,
  t.monto,
  t.fecha,
  t.fecha_rechazo,
  t.observaciones_rechazo,
  u.nombre AS rechazado_por
FROM "Transferencia" t
JOIN "PuntoAtencion" o ON t.origen_id = o.id
JOIN "PuntoAtencion" d ON t.destino_id = d.id
LEFT JOIN "Usuario" u ON t.rechazado_por = u.id
WHERE t.estado = 'CANCELADO'
ORDER BY t.fecha_rechazo DESC;
```

### Consultar devoluciones:
```sql
SELECT 
  ms.*,
  p.nombre AS punto_nombre,
  m.codigo AS moneda
FROM "MovimientoSaldo" ms
JOIN "PuntoAtencion" p ON ms.punto_atencion_id = p.id
JOIN "Moneda" m ON ms.moneda_id = m.id
WHERE ms.tipo_movimiento = 'TRANSFERENCIA_DEVOLUCION'
ORDER BY ms.fecha DESC;
```

## Testing

### Escenarios a Probar:
1. ✅ Rechazo exitoso de transferencia EN_TRANSITO
2. ✅ Intento de rechazar transferencia ya COMPLETADA (debe fallar)
3. ✅ Intento de rechazar transferencia ya CANCELADA (debe fallar)
4. ✅ Usuario de punto diferente intenta rechazar (debe fallar)
5. ✅ Verificar que el saldo se devuelve correctamente
6. ✅ Verificar que el movimiento TRANSFERENCIA_DEVOLUCION se registra
7. ✅ Verificar que las observaciones se guardan

### Comandos de Prueba:
```bash
# Crear transferencia de prueba
curl -X POST http://localhost:3001/api/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"origen_id": "...", "destino_id": "...", "monto": 1000}'

# Rechazar transferencia
curl -X POST http://localhost:3001/api/transfer-approvals/abc-123/reject \
  -H "Authorization: Bearer $TOKEN_DESTINO" \
  -d '{"observaciones": "Prueba de rechazo"}'
```

## Fecha de Implementación
27 de enero de 2026

## Autor
Sistema Punto Cambio - Módulo de Transferencias

---
**Nota**: Esta funcionalidad complementa el flujo directo de transferencias implementado anteriormente, agregando mayor control y capacidad de corrección de errores.
