# 📋 FLUJO DE CIERRES DEL SISTEMA PUNTO CAMBIO

**Documento técnico para desarrolladores y administradores**

---

## 🎯 RESUMEN EJECUTIVO

El sistema maneja **3 tipos de cierres** para dar flexibilidad operativa:

| Tipo | Propósito | Estado en BD | Jornada |
|------|-----------|--------------|---------|
| **Cierre Parcial** | Cambio de turno, revisiones administrativas | `PARCIAL` | No se cierra |
| **Cierre Total** | Fin de operaciones del día | `CERRADO` | Se cierra |
| **Cierre Diario** | Consolidación contable del día | - | - |

---

## 📊 DIAGRAMA DE ESTADOS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE CIERRES CON LIBERACIÓN DE PUNTO                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPERADOR A                                                                 │
│  ═══════════                                                                │
│       │                                                                     │
│       ▼                                                                     │
│  ┌───────────┐     Inicia jornada, asigna punto                            │
│  │  ABIERTO  │◀───────────────────────────────────────────────────┐        │
│  │  (cuadre) │                                                    │        │
│  └─────┬─────┘                                                    │        │
│        │                                                          │        │
│        │ Operador A trabaja...                                    │        │
│        │                                                          │        │
│        ▼                                                          │        │
│  CIERRE PARCIAL (Operador A)                                      │        │
│  ┌───────────────┐                                                │        │
│  │  - Guarda     │                                                │        │
│  │    conteos     │                                                │        │
│  │  - Cierra      │──────▶ Estado: PARCIAL                         │        │
│  │    jornada A   │        Jornada A: COMPLETADO ✓                  │        │
│  │  - LIBERA      │        Punto: LIBRE ✓                          │        │
│  │    PUNTO       │        Usuario A: sin punto ✓                   │        │
│  └───────┬───────┘                                                │        │
│          │                                                        │        │
│          ▼                                                        │        │
│  OPERADOR B (u otro)                                              │        │
│  ═══════════════════                                              │        │
│       │ Ve punto disponible en lista                              │        │
│       ▼                                                           │        │
│  SELECCIONA PUNTO                                                 │        │
│  ┌───────────────┐                                                │        │
│  │  Sistema      │                                                │        │
│  │  reactiva     │──────▶ PARCIAL → ABIERTO                        │        │
│  │  cuadre       │        Asigna Operador B                        │        │
│  └───────┬───────┘                                                │        │
│          │                                                        │        │
│          └────────────────────────────────────────────────────────┘        │
│                                                                             │
│  (Ciclo puede repetirse: Cierre Parcial → Nuevo Operador → Reactivar)     │
│                                                                             │
│       │                                                                     │
│       ▼                                                                     │
│  CIERRE TOTAL (Último operador del día)                                    │
│  ┌───────────────┐         Estado: CERRADO                                 │
│  │  Fin de día   │──────▶  Jornada: COMPLETADO                             │
│  │  definitivo   │         Cuadre: Cerrado (no se puede reabrir)          │
│  └───────────────┘         Día cerrado contablemente                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 DETALLE TÉCNICO

### 1. Modelos Involucrados

#### CuadreCaja (Cabecera)
```prisma
model CuadreCaja {
  id                           String
  estado                       EstadoCierre    @default(ABIERTO)  // ABIERTO | PARCIAL | CERRADO
  fecha                        DateTime
  punto_atencion_id            String
  usuario_id                   String          // Usuario que creó el cuadre
  usuario_cierre_parcial       String?         // Usuario que hizo cierre parcial
  usuario_cierre_final         String?         // Usuario que hizo cierre final
  fecha_cierre                 DateTime?       // Fecha de cierre (parcial o total)
  estado_cierre                String?         // PARCIAL o CERRADO
  total_cambios                Int
  total_transferencias_entrada Int
  total_transferencias_salida  Int
  observaciones                String?
  
  detalles                     DetalleCuadreCaja[]
}
```

#### DetalleCuadreCaja (Líneas)
```prisma
model DetalleCuadreCaja {
  id                    String
  cuadre_id             String
  moneda_id             String
  saldo_apertura        Decimal         // Saldo al inicio del día
  saldo_cierre          Decimal         // Saldo calculado por el sistema
  conteo_fisico         Decimal         // Conteo real del operador
  billetes              Decimal         // Desglose: billetes
  monedas_fisicas       Decimal         // Desglose: monedas
  bancos_teorico        Decimal?        // Saldo en bancos (sistema)
  conteo_bancos         Decimal?        // Conteo en bancos (real)
  diferencia            Decimal         // Diferencia físico vs sistema
  diferencia_bancos     Decimal?
  movimientos_periodo   Int?            // Cantidad de movimientos
  observaciones_detalle String?
}
```

---

### 2. Endpoints de API

#### Crear/Reactivar Cuadre
```
POST /api/cuadre-caja
Authorization: Bearer <token>

Body:
{
  "fecha": "2026-03-24",  // opcional, default=hoy
  "observaciones": "..."
}

Response (nuevo cuadre):
{
  "success": true,
  "cuadre": { ... },
  "message": "Cuadre abierto creado"
}

Response (cuadre existente ABIERTO):
{
  "success": true,
  "cuadre": { ... },
  "message": "Ya existe cuadre abierto"
}

Response (cuadre PARCIAL reactivado):
{
  "success": true,
  "cuadre": { ... },
  "message": "Cuadre reactivado desde cierre parcial"
}
```

**Lógica del endpoint:**
1. Busca cuadre ABIERTO del día → Retorna existente
2. Busca cuadre PARCIAL del día → Reactiva a ABIERTO (cambio de turno)
3. Si no existe → Crea nuevo cuadre ABIERTO

#### Cierre Parcial
```
POST /api/cierre-parcial/parcial
Authorization: Bearer <token>

Body:
{
  "detalles": [
    {
      "moneda_id": "uuid",
      "saldo_apertura": 1000,
      "saldo_cierre": 1500,
      "conteo_fisico": 1500,
      "billetes": 1400,
      "monedas": 100,
      "bancos_teorico": 500,
      "conteo_bancos": 500,
      "ingresos_periodo": 600,
      "egresos_periodo": 100,
      "movimientos_periodo": 5
    }
  ],
  "observaciones": "Cambio de turno - Operador Juan",
  "allowMismatch": false  // true = permite guardar aunque no cuadre
}

Response:
{
  "success": true,
  "message": "Cierre parcial realizado correctamente",
  "cuadre_id": "uuid"
}
```

#### Listar Cierres Parciales Pendientes
```
GET /api/cierre-parcial/pendientes
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "estado": "PARCIAL",
      "fecha": "2026-03-24T10:30:00Z",
      "puntoAtencion": { "id": "uuid", "nombre": "Punto Norte" },
      "usuario": { "id": "uuid", "nombre": "Juan Pérez" },
      "detalles": [...]
    }
  ]
}
```

---

### 3. Flujo de Estados

#### Estado ABIERTO
- **Creación:** Se crea automáticamente al iniciar la apertura de caja
- **Operaciones:** El operador puede hacer cambios, transferencias, servicios externos
- **Transiciones:**
  - `ABIERTO` → `PARCIAL` (cierre parcial)
  - `ABIERTO` → `CERRADO` (cierre total)

#### Estado PARCIAL
- **Creación:** Cuando un operador hace clic en "Cierre Parcial"
- **Características:**
  - Se guardan los conteos físicos del operador que sale
  - Se cierra la jornada del operador actual (libera el punto)
  - Se limpia el punto_atencion_id del usuario
  - El punto queda LIBRE para que otro operador lo seleccione
  - El siguiente operador continúa con el mismo cuadre (reactivado a ABIERTO)
- **Transiciones:**
  - `PARCIAL` → `ABIERTO` (nuevo operador selecciona el punto y continúa)
  - `PARCIAL` → `CERRADO` (cierre total del día)

#### Estado CERRADO
- **Creación:** Cuando se hace el cierre definitivo del día
- **Características:**
  - Último estado del cuadre
  - Se cierra la jornada del operador
  - No se pueden hacer más operaciones en ese cuadre
  - El día queda cerrado contablemente
- **Transiciones:** Ninguna (estado final)

---

### 4. Escenarios de Uso

#### Escenario 1: Un Solo Operador por Día
```
08:00 - Apertura de caja (estado: ABIERTO)
08:00-18:00 - Operaciones normales
18:00 - Cierre Total (estado: CERRADO)
```

#### Escenario 2: Cambio de Turno (Con Liberación de Punto)
```
08:00 - Apertura de caja (Operador A)
        └─► Crea cuadre ABIERTO
        └─► Jornada A iniciada
        └─► Punto asignado a Operador A

08:00-14:00 - Operaciones del Operador A

14:00 - Cierre Parcial (Operador A)
        └─► Guarda conteos físicos
        └─► Estado cuadre: PARCIAL
        └─► Jornada A: COMPLETADO (cerrada)
        └─► Punto liberado (usuario A: punto_atencion_id = null)
        └─► Operador A sale del sistema

14:00 - Operador B inicia sesión
        └─► Ve el punto liberado en la lista
        └─► Selecciona el punto
        └─► Sistema reactiva cuadre: PARCIAL → ABIERTO
        └─► Jornada B iniciada
        └─► Operador B continúa con mismo cuadre

14:00-20:00 - Operaciones del Operador B

20:00 - Cierre Total (Operador B)
        └─► Estado: CERRADO
        └─► Jornada B: COMPLETADO
        └─► Día cerrado contablemente
```

#### Escenario 3: Revisión Administrativa
```
10:00 - Apertura de caja
10:00-12:00 - Operaciones
12:00 - Cierre Parcial (para revisión de admin)
        └─► Admin revisa saldos y conteos
12:30 - Operador continúa (cuadre vuelve a ABIERTO)
12:30-18:00 - Más operaciones
18:00 - Cierre Total
```

#### Escenario 4: Múltiples Cierres Parciales
```
08:00 - Apertura
08:00-12:00 - Turno mañana (Operador A)
12:00 - Cierre Parcial A
12:00-16:00 - Turno tarde (Operador B)
16:00 - Cierre Parcial B
16:00-20:00 - Turno noche (Operador C)
20:00 - Cierre Total
```

---

### 5. Validaciones Importantes

#### Al hacer Cierre Parcial
1. ✅ Debe existir un cuadre ABIERTO
2. ✅ El usuario debe tener punto de atención asignado
3. ✅ Opcional: Validar tolerancia de diferencias
4. ✅ Validar que billetes + monedas = conteo físico
5. ✅ Se cierra la jornada del operador (estado COMPLETADO)
6. ✅ Se libera el punto (usuario.punto_atencion_id = null)
7. ✅ El cuadre queda en estado PARCIAL para el siguiente operador

#### Al continuar después de Parcial (Nuevo Operador)
1. ✅ El punto debe estar libre (sin jornada ACTIVO/ALMUERZO)
2. ✅ El nuevo operador selecciona el punto
3. ✅ El sistema busca cuadre PARCIAL del día
4. ✅ El sistema reactiva el cuadre: PARCIAL → ABIERTO
5. ✅ El nuevo operador se asigna al cuadre
6. ✅ El nuevo operador continúa desde los últimos conteos

#### Al hacer Cierre Total
1. ✅ Todas las validaciones del cierre parcial
2. ✅ Verificar que no haya operaciones pendientes
3. ✅ Verificar que no haya transferencias EN_TRANSITO
4. ✅ Cuadrar servicios externos (si aplica)

---

### 6. Consideraciones de Concurrencia

#### Problema Potencial: Dos operadores simultáneos
**Situación:** Operador A hace cierre parcial, Operador B inicia sesión antes de que A termine.

**Solución:**
- El backend valida el estado del cuadre
- Solo un operador puede tener el cuadre "activo" a la vez
- El sistema usa transacciones de BD para evitar race conditions

#### Problema Potencial: Cierre parcial durante una operación
**Situación:** Operador A está haciendo un cambio de divisa, Operador B hace cierre parcial.

**Solución:**
- Las operaciones son atómicas
- El cierre parcial solo guarda conteos, no bloquea operaciones
- Las operaciones en curso se completan normalmente

---

### 7. Hooks y Servicios del Frontend

#### Hook: useCuadreCaja
```typescript
const {
  // Estado
  cuadre,                    // Datos del cuadre actual
  parciales,                 // Lista de cierres parciales del día
  
  // Acciones
  guardarParcial,            // POST /cierre-parcial/parcial
  guardarCerrado,            // POST /guardar-cierre (tipo: CERRADO)
  refresh,                   // Recargar datos
  
  // Validaciones
  puedeCerrar,               // boolean: ¿puede hacer cierre?
  diferencias,               // Diferencias por moneda
} = useCuadreCaja({ pointId, fecha });
```

#### Servicio: cuatreCajaService
```typescript
// Guardar cierre parcial
await cuatreCajaService.guardarParcial({
  detalles: [...],
  observaciones: "...",
  allowMismatch: false
});

// Obtener parciales pendientes
const { data } = await cuatreCajaService.getParcialesPendientes();

// Guardar cierre total
await cuatreCajaService.guardarCierre({
  detalles: [...],
  tipo_cierre: "CERRADO",
  allowMismatch: false
});
```

---

### 8. Permisos por Rol

| Acción | SUPER_USUARIO | ADMIN | OPERADOR | CONCESION |
|--------|:-------------:|:-----:|:--------:|:---------:|
| **Ver cierres parciales** | ✅ | ✅ | ✅ (solo su punto) | ✅ (solo su punto) |
| **Hacer cierre parcial** | ✅ | ✅ | ✅ | ✅ |
| **Hacer cierre total** | ✅ | ✅ | ✅ | ✅ |
| **Ver cierres de otros puntos** | ✅ | ✅ | ❌ | ❌ |
| **Forzar cierre con diferencias** | ✅ | ✅ | ❌ | ❌ |

---

### 9. Troubleshooting

#### Problema: "No existe un cuadre ABIERTO para realizar cierre parcial"
**Causa:** El cuadre ya está en estado PARCIAL o CERRADO

**Solución:**
1. Verificar el estado actual del cuadre
2. Si está PARCIAL, el nuevo operador debe iniciar sesión primero
3. Si está CERRADO, el día ya cerró, no se puede hacer más

#### Problema: "Las diferencias superan la tolerancia permitida"
**Causa:** El conteo físico no coincide con el saldo del sistema

**Solución:**
1. Revisar el desglose de billetes y monedas
2. Verificar que no haya operaciones pendientes
3. Si es correcto, usar `allowMismatch: true` (requiere permisos)

#### Problema: Cierre parcial no aparece en la lista
**Causa:** El cierre parcial fue de otro punto o fecha

**Solución:**
1. Verificar que se esté consultando la fecha correcta
2. Verificar el punto de atención asignado al usuario
3. Los cierres parciales son por punto y por día

---

### 10. Mejores Prácticas

1. **Siempre hacer cierre parcial al cambiar de turno**
   - Documenta quién entrega y quién recibe
   - Guarda las observaciones

2. **Verificar diferencias antes de cerrar**
   - Si hay diferencias significativas, investigar antes de cerrar
   - Usar la función de reconciliación de saldos

3. **No dejar cierres parciales pendientes**
   - Al final del día, alguien debe hacer el cierre total
   - Los cierres parciales no cierran el día contablemente

4. **Comunicación entre operadores**
   - Dejar observaciones claras en el cierre parcial
   - Informar al siguiente operador de cualquier situación especial

---

## 📚 Referencias

- [Manual de Usuario](./MANUAL_SISTEMA.md) - Guía para operadores
- [QA Completo](./QA_COMPLETO_SISTEMA.md) - Análisis técnico del sistema
- [Schema de BD](../prisma/schema.prisma) - Definición de modelos

---

**Fin del Documento**

*Última actualización: 2026-03-24*
*Versión: 1.0.0*
