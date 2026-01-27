# FLUJO DIRECTO DE TRANSFERENCIAS ENTRE PUNTOS
**Fecha de implementación:** 2025-01-31

## Cambio de Flujo

### ANTERIOR (con aprobación del administrador):
1. Punto origen crea transferencia (estado: `PENDIENTE`)
2. **Administrador revisa y aprueba** (estado: `APROBADO`)
3. Sistema debita del origen y acredita al destino
4. Transferencia completada

### NUEVO (directo entre puntos):
1. Punto origen crea transferencia (estado: `EN_TRANSITO`)
   - ✅ Sistema **inmediatamente debita** del saldo del origen
   - ✅ Registra `TRANSFERENCIA_SALIENTE` en movimientos
2. Operador físicamente transporta el efectivo al punto destino
3. **Punto destino acepta** cuando recibe el efectivo (estado: `COMPLETADO`)
   - ✅ Sistema **acredita** al saldo del destino
   - ✅ Registra `TRANSFERENCIA_ENTRANTE` en movimientos

## Cambios en la Base de Datos

### Schema (`prisma/schema.prisma`)

#### Enum `EstadoTransferencia`:
```prisma
enum EstadoTransferencia {
  PENDIENTE      // ⚠️ Solo para transferencias antiguas
  EN_TRANSITO    // ✅ NUEVO: Transferencia creada, monto debitado del origen
  COMPLETADO     // ✅ NUEVO: Transferencia aceptada, monto acreditado al destino
  APROBADO       // ⚠️ Solo para transferencias antiguas
  RECHAZADO      // Para rechazos administrativos
  CANCELADO      // ✅ NUEVO: Para cancelaciones
}
```

#### Modelo `Transferencia` - Nuevos campos:
```prisma
model Transferencia {
  // ... campos existentes ...
  aceptado_por             String?    // Usuario del punto destino que acepta
  fecha_envio              DateTime?  // Cuándo se envió (= fecha de creación)
  fecha_aceptacion         DateTime?  // Cuándo el destino aceptó
  observaciones_aceptacion String?    // Comentarios al aceptar
  
  // Nuevo índice para performance
  @@index([origen_id])
}
```

## Cambios en el Backend

### 1. **Transfer Controller** (`server/controllers/transferController.ts`)

#### `createTransfer`:
- Cambió de crear con estado `PENDIENTE` a estado `EN_TRANSITO`
- Agregada **transacción atómica** que:
  1. Crea la transferencia
  2. Valida saldo suficiente en el origen
  3. **Debita inmediatamente** del saldo del origen
  4. Registra `TRANSFERENCIA_SALIENTE` en movimientos

```typescript
const newTransfer = await prisma.$transaction(async (tx) => {
  // 1. Crear transferencia con EN_TRANSITO
  const transfer = await tx.transferencia.create({
    data: { estado: "EN_TRANSITO", ... }
  });
  
  // 2. Deducir del saldo del origen
  if (origen_id) {
    const saldoOrigen = await tx.saldo.findUnique({ ... });
    // Validar suficiente saldo
    // Actualizar saldo (cantidad, billetes, monedas_fisicas)
    // Registrar TRANSFERENCIA_SALIENTE
  }
  
  return transfer;
});
```

### 2. **Transfer Approvals** (`server/routes/transfer-approvals.ts`)

#### Nuevo endpoint `POST /:id/accept`:
- **Autorización:** Usuario del punto destino (OPERADOR, CONCESION, ADMIN, SUPER_USUARIO)
- **Validaciones:**
  - Usuario pertenece al punto destino
  - Transferencia está en estado `EN_TRANSITO`
- **Acción en transacción:**
  1. Actualiza transferencia a estado `COMPLETADO`
  2. Registra usuario aceptador y fecha de aceptación
  3. **Acredita** al saldo del punto destino
  4. Registra `TRANSFERENCIA_ENTRANTE` en movimientos

```typescript
POST /api/transfer-approvals/:id/accept
Body: { observaciones?: string }
```

### 3. **Transfers Routes** (`server/routes/transfers.ts`)

#### Nuevo endpoint `GET /pending-acceptance`:
- Retorna transferencias `EN_TRANSITO` donde el usuario actual es el **punto destino**
- Usado por el frontend para mostrar transferencias pendientes de aceptación

```typescript
GET /api/transfers/pending-acceptance
Response: { transfers: [...] }
```

## Endpoints API

### Crear Transferencia
```http
POST /api/transfers
Authorization: Bearer {token}
Content-Type: application/json

{
  "origen_id": "uuid-origen",
  "destino_id": "uuid-destino",
  "moneda_id": "uuid-moneda",
  "monto": 500.00,
  "tipo_transferencia": "ENTRE_PUNTOS",
  "via": "EFECTIVO",
  "descripcion": "Transferencia de emergencia"
}

Response: {
  "transfer": { ... },
  "success": true,
  "message": "Transferencia creada exitosamente. Monto deducido del punto de origen. Pendiente de aceptación en punto destino."
}
```

### Listar Transferencias Pendientes de Aceptación
```http
GET /api/transfers/pending-acceptance
Authorization: Bearer {token}

Response: {
  "transfers": [
    {
      "id": "uuid",
      "monto": 500.00,
      "estado": "EN_TRANSITO",
      "origen": { "id": "...", "nombre": "Punto A" },
      "destino": { "id": "...", "nombre": "Punto B" },
      "moneda": { "codigo": "USD", "simbolo": "$" },
      "fecha": "2025-01-31T10:00:00Z"
    }
  ],
  "success": true
}
```

### Aceptar Transferencia
```http
POST /api/transfer-approvals/:id/accept
Authorization: Bearer {token}
Content-Type: application/json

{
  "observaciones": "Efectivo recibido completo"
}

Response: {
  "transfer": { ... },
  "success": true,
  "message": "Transferencia aceptada. Monto agregado al saldo del punto destino."
}
```

## Migración de Datos

### Ejecutar migración Prisma:
```bash
npx prisma migrate dev --name direct_transfer_flow
```

Esto aplicará los cambios del schema:
- Agregar nuevos valores al enum `EstadoTransferencia`
- Agregar campos `aceptado_por`, `fecha_envio`, `fecha_aceptacion`, `observaciones_aceptacion`
- Crear índice en `origen_id`

### Transferencias existentes:
- Las transferencias con estado `PENDIENTE` o `APROBADO` **NO se modifican**
- El flujo antiguo (con aprobación del admin) sigue funcionando para estas transferencias
- Solo las **nuevas transferencias** usan el flujo directo

## Impacto en el Frontend

### Cambios requeridos:

1. **Dashboard del Punto Destino:**
   - Agregar sección "Transferencias Pendientes de Recibir"
   - Mostrar transferencias `EN_TRANSITO` destinadas a este punto
   - Botón "Aceptar Transferencia" que llama a `POST /api/transfer-approvals/:id/accept`

2. **Dashboard del Punto Origen:**
   - Mostrar transferencias `EN_TRANSITO` enviadas desde este punto
   - Indicador de "En tránsito - Pendiente de aceptación"

3. **Historial de Transferencias:**
   - Actualizar estados para mostrar `EN_TRANSITO`, `COMPLETADO`
   - Mostrar fechas de envío y aceptación

4. **Creación de Transferencias:**
   - Actualizar mensaje de confirmación:
     - ANTES: "Transferencia creada. Pendiente de aprobación del administrador."
     - NUEVO: "Transferencia creada. Monto deducido de tu punto. Pendiente de aceptación en punto destino."

## Seguridad

### Validaciones implementadas:
- ✅ Saldo suficiente en el origen antes de crear transferencia
- ✅ Solo usuario del punto destino puede aceptar la transferencia
- ✅ Transferencia debe estar en estado `EN_TRANSITO` para ser aceptada
- ✅ Transacciones atómicas para evitar inconsistencias
- ✅ Registro completo en `movimientoSaldo` para auditoría

### Permisos:
- **Crear transferencia:** OPERADOR, CONCESION, ADMIN, SUPER_USUARIO (del punto origen)
- **Aceptar transferencia:** OPERADOR, CONCESION, ADMIN, SUPER_USUARIO (del punto destino)
- **Ver transferencias pendientes:** Automático si tienes asignado un punto de atención

## Auditoría y Trazabilidad

Cada transferencia registra:
1. **Al crear (EN_TRANSITO):**
   - `solicitado_por`: Usuario que creó la transferencia
   - `fecha`: Timestamp de creación
   - `MovimientoSaldo`: TRANSFERENCIA_SALIENTE en el origen

2. **Al aceptar (COMPLETADO):**
   - `aceptado_por`: Usuario que aceptó
   - `fecha_aceptacion`: Timestamp de aceptación
   - `observaciones_aceptacion`: Comentarios opcionales
   - `MovimientoSaldo`: TRANSFERENCIA_ENTRANTE en el destino

## Rollback (en caso de problemas)

Si necesitas volver al flujo anterior:

1. **Revertir código:**
   ```bash
   git revert <commit-hash>
   ```

2. **Migración de rollback:**
   ```sql
   -- Marcar transferencias EN_TRANSITO como PENDIENTE
   UPDATE "Transferencia" 
   SET estado = 'PENDIENTE' 
   WHERE estado = 'EN_TRANSITO';
   
   -- Revertir movimientos si es necesario
   -- (consultar con administrador antes de ejecutar)
   ```

## Testing Recomendado

1. **Crear transferencia desde Punto A:**
   - Verificar que saldo de Punto A se reduce inmediatamente
   - Verificar estado `EN_TRANSITO`
   - Verificar registro de `TRANSFERENCIA_SALIENTE`

2. **Aceptar transferencia desde Punto B:**
   - Verificar que solo usuario de Punto B puede aceptar
   - Verificar que saldo de Punto B aumenta
   - Verificar estado `COMPLETADO`
   - Verificar registro de `TRANSFERENCIA_ENTRANTE`

3. **Intentar aceptar transferencia duplicada:**
   - Verificar que no se puede aceptar dos veces
   - Verificar mensaje de error apropiado

4. **Transferencia con saldo insuficiente:**
   - Verificar que se bloquea en creación
   - Verificar mensaje de error claro

## Notas Importantes

⚠️ **IMPORTANTE:** Este cambio es **irreversible** para las nuevas transferencias. Una vez que una transferencia se crea con estado `EN_TRANSITO`, el dinero ya fue debitado del origen.

✅ **VENTAJAS:**
- Proceso más rápido (un paso menos)
- No requiere aprobación del administrador
- Refleja el flujo real del dinero (se debita cuando sale, se acredita cuando llega)
- Mejor trazabilidad de quién envió y quién recibió

⚠️ **CONSIDERACIONES:**
- El administrador ya no tiene control previo sobre las transferencias
- El punto origen debe tener suficiente saldo antes de crear la transferencia
- Si el efectivo se pierde en tránsito, requiere proceso manual de corrección

## Soporte

Para preguntas o problemas con esta funcionalidad, contactar al equipo de desarrollo.
