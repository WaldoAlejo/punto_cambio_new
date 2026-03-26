# Flujo de Inicio de Jornada con Validación de Apertura de Caja

## Resumen

Nuevo endpoint que obliga al operador a completar la apertura de caja antes de poder operar, con validaciones estrictas para USD y EUR.

---

## Endpoints Nuevos

### 1. POST `/inicio-jornada-validado/iniciar`

**Descripción**: Crea la jornada y devuelve los saldos esperados para el conteo de apertura.

**Request:**
```json
{
  "punto_atencion_id": "uuid-del-punto"
}
```

**Response:**
```json
{
  "success": true,
  "jornada": { "id": "...", "estado": "ACTIVO" },
  "requiere_apertura": true,
  "saldos_esperados": [
    {
      "moneda_id": "...",
      "codigo": "USD",
      "nombre": "Dólar estadounidense",
      "simbolo": "$",
      "cantidad": 1000.00,
      "billetes": 1000.00,
      "monedas": 0.00,
      "es_obligatoria": true
    }
  ],
  "monedas_obligatorias": ["USD", "EUR"],
  "message": "Jornada creada. Debe completar la apertura de caja obligatoriamente."
}
```

---

### 2. POST `/inicio-jornada-validado/validar-apertura`

**Descripción**: Valida el conteo de apertura y crea el cuadre de caja si todo está correcto.

**Validaciones:**
1. **USD obligatorio**: Debe tener conteo > 0
2. **EUR obligatorio**: Debe tener conteo > 0
3. **Diferencias**: Si hay diferencias fuera de tolerancia, se registra alerta

**Request:**
```json
{
  "jornada_id": "uuid-de-la-jornada",
  "conteos": [
    {
      "moneda_id": "uuid-moneda-usd",
      "codigo": "USD",
      "billetes": [
        { "denominacion": 100, "cantidad": 10 },
        { "denominacion": 50, "cantidad": 5 }
      ],
      "monedas": [],
      "total": 1250.00
    },
    {
      "moneda_id": "uuid-moneda-eur",
      "codigo": "EUR",
      "billetes": [
        { "denominacion": 50, "cantidad": 10 }
      ],
      "monedas": [],
      "total": 500.00
    }
  ]
}
```

**Response - Todo correcto:**
```json
{
  "success": true,
  "apertura": {
    "id": "...",
    "estado": "ABIERTA"
  },
  "diferencias": [],
  "puede_operar": true,
  "requiere_aprobacion_admin": false,
  "message": "Apertura validada correctamente. Puede iniciar operaciones."
}
```

**Response - Con diferencias:**
```json
{
  "success": true,
  "apertura": {
    "id": "...",
    "estado": "CON_DIFERENCIA"
  },
  "diferencias": [
    {
      "moneda_id": "...",
      "codigo": "USD",
      "esperado": 1000.00,
      "fisico": 950.00,
      "diferencia": -50.00,
      "fuera_tolerancia": true
    }
  ],
  "alerta_admin": "ALERTA - Diferencias en conteo de apertura: USD: Esperado $1000, Físico $950, Dif: $-50",
  "puede_operar": false,
  "requiere_aprobacion_admin": true,
  "message": "Se registraron diferencias en el conteo. Debe esperar la aprobación del administrador para operar."
}
```

---

### 3. GET `/inicio-jornada-validado/estado/:jornada_id`

**Descripción**: Verifica si la jornada puede operar o necesita completar apertura.

**Response:**
```json
{
  "success": true,
  "jornada": {
    "id": "...",
    "estado": "ACTIVO",
    "punto": { "id": "...", "nombre": "EL BOSQUE" }
  },
  "apertura": {
    "id": "...",
    "estado": "ABIERTA",
    "requiere_aprobacion": false
  },
  "puede_operar": true,
  "requiere_apertura": false
}
```

---

## Flujo Completo

### Paso 1: Login y Selección de Punto
```
Operador inicia sesión → Selecciona punto de atención
```

### Paso 2: Iniciar Jornada
```
POST /inicio-jornada-validado/iniciar
↓
Sistema crea jornada en estado ACTIVO
↓
Sistema devuelve saldos esperados
↓
Frontend muestra pantalla de Apertura de Caja
```

### Paso 3: Conteo de Apertura (OBLIGATORIO)
```
Operador debe ingresar:
- USD: Obligatorio, debe ser > 0
- EUR: Obligatorio, debe ser > 0
- Otras monedas: Opcional

Frontend valida que USD y EUR estén presentes antes de enviar
```

### Paso 4: Validación del Conteo
```
POST /inicio-jornada-validado/validar-apertura
↓
Sistema valida:
  ✓ USD presente y > 0
  ✓ EUR presente y > 0
  ✓ Calcula diferencias
↓
Si hay diferencias fuera de tolerancia:
  - Estado: CON_DIFERENCIA
  - Puede operar: FALSE
  - Se registra alerta en observaciones
  - Se notifica al admin (vía logs, pendiente integrar notificaciones)
↓
Si todo cuadra:
  - Estado: ABIERTA
  - Crea CuadreCaja automáticamente
  - Puede operar: TRUE
```

### Paso 5: Operación Normal
```
Si puede_operar = true:
  → Operador puede hacer cambios de divisa, transferencias, etc.

Si puede_operar = false:
  → Sistema bloquea operaciones
  → Muestra mensaje: "Espere aprobación del administrador"
```

---

## Validaciones

### Obligatorias
| Moneda | Requerida | Validación |
|--------|-----------|------------|
| USD | Sí | total > 0 |
| EUR | Sí | total > 0 |
| Otras | No | - |

### Tolerancias
| Moneda | Tolerancia |
|--------|------------|
| USD | $1.00 |
| Otras | $0.01 |

### Si hay diferencias
1. Se registra la apertura con estado `CON_DIFERENCIA`
2. Se guarda alerta en `observaciones_operador`
3. Se loguea warning para el admin
4. **NO se permite operar** hasta aprobación del admin
5. El cuadre de caja **NO se crea** hasta que se resuelva

---

## Integración con Frontend

### Flujo recomendado:

1. **Login** → Token guardado
2. **Seleccionar punto** → POST `/inicio-jornada-validado/iniciar`
3. **Mostrar pantalla de apertura** con:
   - Formulario para USD (obligatorio)
   - Formulario para EUR (obligatorio)
   - Formularios opcionales para otras monedas
   - Botón "Confirmar Apertura" (deshabilitado hasta que USD y EUR > 0)
4. **Enviar conteo** → POST `/inicio-jornada-validado/validar-apertura`
5. **Si puede_operar = true** → Redirigir a pantalla principal
6. **Si puede_operar = false** → Mostrar mensaje de espera y bloquear operaciones

### Verificación periódica:
```javascript
// Antes de cada operación, verificar estado
GET /inicio-jornada-validado/estado/:jornada_id

Si puede_operar = false:
  → Bloquear operación
  → Mostrar alerta
```

---

## Próximos Pasos

1. **Integrar con sistema de notificaciones** para alertar al admin cuando hay diferencias
2. **Crear endpoint de aprobación** para que el admin pueda aprobar aperturas con diferencia
3. **Bloquear operaciones** en otros endpoints si la jornada no tiene apertura aprobada
4. **Crear pantalla de administrador** para ver y gestionar aperturas pendientes

---

## Archivos Modificados/Creados

- **Nuevo**: `server/routes/inicio-jornada-validado.ts`
- **Integrar**: Agregar ruta en `server/index.ts`
