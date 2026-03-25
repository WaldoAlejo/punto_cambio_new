# Diseño: Arqueo de Caja por Operador (con Verificación Remota)

## Concepto

El **operador** es responsable de contar físicamente el efectivo tanto al **inicio** como al **fin** de su jornada. El **administrador** verifica y aprueba los conteos **remotamente** (videollamada).

Este modelo hace al operador responsable directo del dinero que recibe y entrega.

---

## Flujo del Día - Paso a Paso

### 🌅 APERTURA DE CAJA (Inicio del día)

```
┌─────────────────────────────────────────────────────────────────┐
│  OPERADOR llega al punto de atención                            │
│  Enciende computadora y abre "Apertura de Caja"                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Sistema muestra:                                            │
│     - Saldo inicial esperado (asignado por admin): $1,200       │
│     - Fecha: 24/03/2026                                         │
│     - Operador: Juan Pérez                                      │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. OPERADOR cuenta FÍSICAMENTE todo el efectivo:               │
│     - Desglose por billetes: $100, $50, $20, $10, $5, $1        │
│     - Desglose por monedas: $1, 50¢, 25¢, 10¢, 5¢, 1¢           │
│     - Total físico contado: $1,200                              │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. OPERADOR ingresa en el sistema:                             │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │  BILLETES:                                              │ │
│     │  $100 x 5 = $500                                        │ │
│     │  $50  x 10 = $500                                       │ │
│     │  $20  x 10 = $200                                       │ │
│     │  ─────────────────                                     │ │
│     │  Total billetes: $1,200                                 │ │
│     │                                                         │ │
│     │  MONEDAS:                                               │ │
│     │  $1   x 0 = $0                                          │ │
│     │  ─────────────────                                     │ │
│     │  Total monedas: $0                                      │ │
│     └─────────────────────────────────────────────────────────┘ │
│     TOTAL CONTEO FÍSICO: $1,200                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. SISTEMA VALIDA automáticamente:                             │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │  Saldo esperado (sistema):    $1,200                    │ │
│     │  Conteo físico (operador):    $1,200                    │ │
│     │  ─────────────────────────────────                     │ │
│     │  DIFERENCIA:                  $0.00  ✅ CUADRADO        │ │
│     └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
┌──────────────────────┐    ┌─────────────────────────────────────┐
│  ✅ TODO CUADRADO    │    │  ❌ HAY DIFERENCIA                  │
│                      │    │                                     │
│  - Sistema permite   │    │  Diferencia: $25.00                 │
│    iniciar jornada   │    │                                     │
│  - Estado: ABIERTA   │    │  El operador NO puede iniciar       │
│  - Listo para        │    │  hasta resolver con el              │
│    operar            │    │  administrador                      │
│                      │    │                                     │
│  [Iniciar Jornada]   │    │  [🔴 Llamar al Administrador]       │
└──────────────────────┘    │  [📸 Subir foto del conteo]         │
                            │  [📝 Explicar diferencia]           │
                            └─────────────────────────────────────┘
```

### 📹 Videollamada con Administrador (si hay diferencia)

```
┌─────────────────────────────────────────────────────────────────┐
│  OPERADOR inicia videollamada con ADMIN                         │
│                                                                 │
│  Admin: "Muéstrame los billetes de $100"                        │
│  Operador muestra físicamente los billetes por cámara           │
│                                                                 │
│  Admin revisa en su pantalla:                                   │
│  - Conteo ingresado por operador                                │
│  - Saldo esperado                                               │
│  - Diferencia detectada                                         │
│                                                                 │
│  Si admin aprueba:                                              │
│  - Puede autorizar ajuste                                       │
│  - O registrar incidencia                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 🌙 CIERRE DE CAJA (Fin del día)

```
┌─────────────────────────────────────────────────────────────────┐
│  OPERADOR termina sus operaciones                               │
│  Abre "Cierre de Caja"                                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Sistema muestra:                                            │
│     - Saldo inicial del día: $1,200                             │
│     - Ingresos del día: $800                                    │
│     - Egresos del día: $425                                     │
│     - Saldo teórico (debería tener): $1,575                     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. OPERADOR cuenta FÍSICAMENTE todo el efectivo actual:        │
│     - Billetes: $1,500                                          │
│     - Monedas: $75                                              │
│     - TOTAL FÍSICO: $1,575                                      │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. OPERADOR ingresa conteo desglosado en el sistema            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. SISTEMA VALIDA:                                             │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │  Saldo teórico:    $1,575                               │ │
│     │  Conteo físico:    $1,575                               │ │
│     │  ─────────────────────────────────                     │ │
│     │  DIFERENCIA:       $0.00  ✅ CUADRADO                   │ │
│     └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. GENERAR REPORTE DE CIERRE                                   │
│                                                                 │
│  El sistema genera reporte completo:                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RESUMEN DEL DÍA - 24/03/2026                           │   │
│  │                                                         │   │
│  │  OPERADOR: Juan Pérez                                   │   │
│  │  PUNTO: Oficina Principal                               │   │
│  │                                                         │   │
│  │  ─────────────────────────────────────────────────     │   │
│  │  Saldo inicial:        $1,200.00                        │   │
│  │  + Ingresos:           $  800.00                        │   │
│  │  - Egresos:            $  425.00                        │   │
│  │  ─────────────────────────────────────────────────     │   │
│  │  Saldo teórico:        $1,575.00                        │   │
│  │  Saldo físico:         $1,575.00                        │   │
│  │  ─────────────────────────────────────────────────     │   │
│  │  DIFERENCIA:           $    0.00  ✅ CUADRADO           │   │
│  │  ─────────────────────────────────────────────────     │   │
│  │                                                         │   │
│  │  FIRMA OPERADOR: _________________                      │   │
│  │  FIRMA ADMIN:    _________________ (remoto)             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. VIDEOLLAMADA CON ADMIN PARA VALIDAR CIERRE                  │
│                                                                 │
│  - Operador comparte pantalla mostrando el reporte              │
│  - Admin revisa los números                                     │
│  - Operador muestra físicamente el dinero por cámara            │
│     * "Aquí están los billetes de $100..."                      │
│     * "Las monedas están en esta bolsa..."                      │
│  - Admin confirma y aprueba desde su panel                      │
│  - Sistema marca cierre como "APROBADO"                         │
│  - Dinero queda listo para retiro/recuento final                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Responsabilidades

| Tarea | Operador | Administrador |
|-------|----------|---------------|
| **Contar dinero físico** | ✅ Sí | ❌ No |
| **Ingresar conteo en sistema** | ✅ Sí | ❌ No |
| **Validar cuadre automático** | Sistema | Sistema |
| **Resolver diferencias** | Reporta | Aprueba/Ajusta |
| **Verificación visual (videollamada)** | Muestra dinero | Observa y aprueba |
| **Firma digital/reporte** | ✅ Sí | ✅ Sí (remoto) |
| **Apertura de jornada** | ✅ Si cuadra | ✅ Autoriza si hay dif. |
| **Cierre de jornada** | ✅ Realiza | ✅ Aprueba |

---

## Estados de Apertura/Cierre

### Apertura de Caja (Estados)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  PENDIENTE  │────▶│  EN_CONTEO   │────▶│   CUADRADO   │────▶│    ABIERTA   │
│  (inicio)   │     │ (operador    │     │ (sin dif.)   │     │  (listo para │
└─────────────┘     │  cuenta)     │     └──────────────┘     │   operar)    │
                    └──────────────┘                          └──────────────┘
                           │
                           ▼ (si hay diferencia)
                    ┌──────────────┐     ┌──────────────┐
                    │ CON_DIFERENC │────▶│  RESUELTO    │────▶ ABIERTA
                    │    IA        │     │ (por admin)  │
                    └──────────────┘     └──────────────┘
```

### Cierre de Caja (Estados)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  PENDIENTE  │────▶│  EN_CONTEO   │────▶│  POR_APROBAR │────▶│   CERRADO    │
│  (fin día)  │     │ (operador    │     │ (videollama- │     │  (aprobado)  │
└─────────────┘     │  cuenta)     │     │   da admin)  │     └──────────────┘
                    └──────────────┘     └──────────────┘
                           │                    │
                           ▼                    ▼ (si admin no aprueba)
                    ┌──────────────┐     ┌──────────────┐
                    │ CON_DIFERENC │     │  RECHAZADO   │────▶ RE-CONTEO
                    │    IA        │     │              │
                    └──────────────┘     └──────────────┘
```

---

## Modelo de Datos (Actualizado)

### Tabla: AperturaCaja (NUEVA)
```prisma
model AperturaCaja {
  id                    String   @id @default(uuid())
  jornada_id            String   @unique  // Una apertura por jornada
  usuario_id            String   // Operador que realiza la apertura
  punto_atencion_id     String
  
  // Fechas
  fecha                 DateTime @db.Date
  hora_apertura         DateTime @default(now())
  
  // Saldos esperados (del sistema)
  saldo_inicial_esperado Json    // [{moneda_id, cantidad, billetes, monedas}]
  
  // Conteo físico realizado por operador
  conteo_fisico         Json     // [{moneda_id, desglose_billetes, desglose_monedas, total}]
  
  // Resultado
  estado                EstadoApertura @default(PENDIENTE)
  diferencias           Json?    // [{moneda_id, diferencia, fuera_tolerancia}]
  
  // Videollamada/Verificación
  requiere_aprobacion   Boolean  @default(false)
  aprobado_por          String?  // Admin que aprueba (si aplica)
  hora_aprobacion       DateTime?
  
  // Observaciones
  observaciones         String?
  observaciones_admin   String?
  
  // Relaciones
  jornada               JornadaCaja @relation(fields: [jornada_id], references: [id])
  usuario               Usuario    @relation("OperadorApertura", fields: [usuario_id], references: [id])
  puntoAtencion         PuntoAtencion @relation(fields: [punto_atencion_id], references: [id])
  aprobador             Usuario?   @relation("AdminApertura", fields: [aprobado_por], references: [id])
  
  @@index([punto_atencion_id, fecha])
  @@index([estado])
}

enum EstadoApertura {
  PENDIENTE        // Inicial
  EN_CONTEO        // Operador está contando
  CUADRADO         // Cuadre perfecto, esperando confirmar
  CON_DIFERENCIA   // Hay diferencia, requiere admin
  RESUELTO         // Admin resolvió diferencia
  ABIERTA          // Jornada oficialmente abierta
}
```

### Tabla: CierreCaja (Modificación)
```prisma
model CierreCaja {
  // ... campos existentes ...
  
  // NUEVOS CAMPOS para verificación remota
  estado_verificacion   EstadoVerificacion @default(PENDIENTE)
  verificado_por        String?  // Admin que verifica
  hora_verificacion     DateTime?
  
  // Para videollamada
  link_videollamada     String?  // Link de Zoom/Meet (opcional)
  hora_programada_vc    DateTime? // Hora programada de videollamada
  
  // Relación
  verificador           Usuario? @relation(fields: [verificado_por], references: [id])
}

enum EstadoVerificacion {
  PENDIENTE      // Esperando videollamada
  EN_VERIFICACION // En videollamada ahora
  APROBADO       // Admin aprobó
  RECHAZADO      // Admin rechazó, requiere re-conteo
}
```

---

## Interfaz de Usuario

### Pantalla: Apertura de Caja (Operador)

```
┌─────────────────────────────────────────────────────────────────┐
│  🌅 APERTURA DE CAJA - 24/03/2026                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Operador: Juan Pérez          Punto: Oficina Principal        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  💵 USD - Dólar Americano                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SALDO INICIAL ESPERADO (Según sistema)                  │   │
│  │                                                         │   │
│  │  Total: $1,200.00                                       │   │
│  │  Billetes: $1,200                                       │   │
│  │  Monedas: $0                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ MI CONTEO FÍSICO (Lo que realmente tengo en caja)       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │ BILLETES:                                               │   │
│  │  $100  [    5    ] = $500.00                           │   │
│  │  $50   [   10    ] = $500.00                           │   │
│  │  $20   [   10    ] = $200.00                           │   │
│  │  $10   [    0    ] = $0.00                             │   │
│  │  $5    [    0    ] = $0.00                             │   │
│  │  $1    [    0    ] = $0.00                             │   │
│  │  ───────────────────────────────────────               │   │
│  │  Total Billetes: $1,200.00                             │   │
│  │                                                         │   │
│  │ MONEDAS:                                                │   │
│  │  $1    [    0    ] = $0.00                             │   │
│  │  50¢   [    0    ] = $0.00                             │   │
│  │  25¢   [    0    ] = $0.00                             │   │
│  │  10¢   [    0    ] = $0.00                             │   │
│  │  5¢    [    0    ] = $0.00                             │   │
│  │  1¢    [    0    ] = $0.00                             │   │
│  │  ───────────────────────────────────────               │   │
│  │  Total Monedas: $0.00                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  MI CONTEO TOTAL:                  $1,200.00                   │
│  SALDO ESPERADO:                   $1,200.00                   │
│  DIFERENCIA:                       $0.00   ✅ CUADRADO         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  [📸 Subir foto del conteo]                                     │
│                                                                 │
│           [Guardar Borrador]  [✅ Confirmar Apertura]          │
└─────────────────────────────────────────────────────────────────┘
```

### Alerta: Diferencia Detectada (Apertura)

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  DIFERENCIA DETECTADA                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tu conteo físico NO coincide con el saldo esperado:            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  ESPERADO  │  TU CONTEO  │ DIFERENCIA  │   │
│  │  USD               $1,200  │    $1,175   │   -$25.00 ❌│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚠️  No puedes iniciar la jornada hasta resolver esto.          │
│                                                                 │
│  ¿Qué deseas hacer?                                             │
│                                                                 │
│  [🔴 Llamar al Administrador]  ← Videollamada                   │
│  [📝 Explicar la diferencia]                                    │
│  [🔄 Volver a contar]                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Panel Admin: Verificación de Aperturas

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 APERTURAS PENDIENTES DE VERIFICACIÓN                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔴 Oficina Principal                                    │   │
│  │    Operador: Juan Pérez                                 │   │
│  │    Hora: 08:15 AM                                       │   │
│  │    Estado: CON DIFERENCIA (-$25 USD)                    │   │
│  │                                                         │   │
│  │    [📹 Iniciar Videollamada]  [📸 Ver Foto]  [✓ Aprobar]│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟡 Sucursal Norte                                       │   │
│  │    Operador: María López                                │   │
│  │    Hora: 08:30 AM                                       │   │
│  │    Estado: CON DIFERENCIA (+$10 EUR)                    │   │
│  │                                                         │   │
│  │    [📹 Iniciar Videollamada]  [📸 Ver Foto]  [✓ Aprobar]│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟢 Sucursal Sur                                         │   │
│  │    Operador: Carlos Ruiz                                │   │
│  │    Hora: 08:45 AM                                       │   │
│  │    Estado: CUADRADO (Aprobado automático)               │   │
│  │                                                         │   │
│  │    [✓ Ver Detalle]                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Endpoints API

### POST /api/apertura-caja/iniciar
Inicia el proceso de apertura para el operador.

**Response:**
```json
{
  "apertura_id": "uuid",
  "estado": "EN_CONTEO",
  "saldo_esperado": {
    "USD": { "cantidad": 1200, "billetes": 1200, "monedas": 0 },
    "EUR": { "cantidad": 500, "billetes": 500, "monedas": 0 }
  },
  "instrucciones": "Cuenta todo el efectivo físico y registra el desglose por denominación"
}
```

### POST /api/apertura-caja/conteo
Operador envía su conteo físico.

**Request:**
```json
{
  "apertura_id": "uuid",
  "conteos": [
    {
      "moneda_id": "uuid-usd",
      "billetes": [
        {"denominacion": 100, "cantidad": 5},
        {"denominacion": 50, "cantidad": 10},
        {"denominacion": 20, "cantidad": 10}
      ],
      "monedas": [],
      "total": 1200
    }
  ],
  "foto_url": "https://...",
  "observaciones": "Todo cuadrado"
}
```

**Response (si cuadra):**
```json
{
  "estado": "CUADRADO",
  "diferencias": [],
  "puede_abrir": true,
  "mensaje": "Todo cuadrado. Puedes iniciar tu jornada."
}
```

**Response (si hay diferencia):**
```json
{
  "estado": "CON_DIFERENCIA",
  "diferencias": [
    {"moneda": "USD", "esperado": 1200, "conteo": 1175, "diferencia": -25}
  ],
  "puede_abrir": false,
  "mensaje": "Diferencia detectada. Contacta a tu administrador.",
  "link_videollamada": "https://meet.google.com/..."
}
```

### POST /api/apertura-caja/:id/aprobar
Admin aprueba una apertura con diferencia.

### POST /api/apertura-caja/:id/rechazar
Admin rechaza y pide re-conteo.

---

## Flujo de Videollamada (Integración)

```
┌─────────────────────────────────────────────────────────────────┐
│  Opción 1: Integración simple (SIN videollamada embebida)       │
│                                                                 │
│  1. Operador clickea "Llamar al Administrador"                  │
│  2. Sistema genera link de Google Meet/Zoom                     │
│  3. Operador y Admin se conectan al mismo link                  │
│  4. Operador comparte pantalla del conteo                       │
│  5. Admin muestra dinero físico por cámara                      │
│  6. Admin aprueba desde su panel (marcar como verificado)       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Opción 2: Videollamada embebida (MÁS AVANZADO)                 │
│                                                                 │
│  1. Integrar con Daily.co, Twilio, o WebRTC                     │
│  2. Videollamada DENTRO de la aplicación                        │
│  3. Durante la llamada:                                         │
│     - Operador puede compartir pantalla con un clic             │
│     - Admin ve el conteo en tiempo real                         │
│     - Botón "Aprobar" disponible solo durante la llamada        │
└─────────────────────────────────────────────────────────────────┘
```

**Recomendación:** Empezar con Opción 1 (links externos) por simplicidad.

---

## Reporte Final de Apertura/Cierre

```
═══════════════════════════════════════════════════════════════════
          REPORTE DE APERTURA/CIERRE DE CAJA - OPERADOR
═══════════════════════════════════════════════════════════════════

TIPO: [APERTURA / CIERRE]
FECHA: 24 de marzo de 2026
HORA: 08:30:45 / 18:30:22

PUNTO DE ATENCIÓN: Oficina Principal
DIRECCIÓN: Av. Principal 123, Guayaquil

-------------------------------------------------------------------
RESPONSABLES
-------------------------------------------------------------------
Operador: JUAN PÉREZ              Firma: _____________________
Verificado por: ADMIN SISTEMA     Firma: _____________________
                                  (remoto por videollamada)

-------------------------------------------------------------------
CONTEO DE USD (DÓLAR AMERICANO)
-------------------------------------------------------------------
SALDO ESPERADO:                    $ 1,200.00

CONTEO FÍSICO REALIZADO POR OPERADOR:

BILLETES:
  $100  x    5 = $   500.00
  $50   x   10 = $   500.00
  $20   x   10 = $   200.00
                -------------
  Total Billetes:    $ 1,200.00

MONEDAS:
  Ninguna
                -------------
  Total Monedas:     $     0.00

═══════════════════════════════════════════════════════════════════
TOTAL CONTEO FÍSICO:               $ 1,200.00
SALDO ESPERADO:                    $ 1,200.00
───────────────────────────────────────────────────────────────────
DIFERENCIA:                        $     0.00  ✅ CUADRADO
═══════════════════════════════════════════════════════════════════

MÉTODO DE VERIFICACIÓN: Videollamada Google Meet
DURACIÓN: 5 minutos 30 segundos
HORA INICIO VC: 08:30:00

OBSERVACIONES:
___________________________________________________________________
Todo cuadrado. El operador mostró físicamente los billetes.
___________________________________________________________________

═══════════════════════════════════════════════════════════════════
Documento generado electrónicamente - Punto Cambio v2.0
ID de Verificación: uuid-del-documento
═══════════════════════════════════════════════════════════════════
```

---

## Checklist de Implementación

### Fase 1: Backend
- [ ] Crear tabla `AperturaCaja` en Prisma
- [ ] Agregar campos a tabla `CierreCaja` para verificación
- [ ] Endpoint POST /api/apertura-caja/iniciar
- [ ] Endpoint POST /api/apertura-caja/conteo
- [ ] Endpoint POST /api/apertura-caja/:id/aprobar (admin)
- [ ] Endpoint GET /api/apertura-caja/pendientes (admin)
- [ ] Modificar endpoint de cierre para incluir verificación

### Fase 2: Frontend - Operador
- [ ] Pantalla "Apertura de Caja" con conteo desglosado
- [ ] Validación automática de cuadre
- [ ] Alerta de diferencia con botón de llamada
- [ ] Integrar en flujo de inicio de jornada
- [ ] Pantalla de cierre mejorada con estados de verificación

### Fase 3: Frontend - Admin
- [ ] Panel de "Aperturas/Cierres Pendientes"
- [ ] Vista de detalle con fotos y conteos
- [ ] Botones de aprobar/rechazar/llamar
- [ ] Generación de links de videollamada

### Fase 4: Reportes
- [ ] Reporte de apertura impreso/firmado
- [ ] Reporte de cierre impreso/firmado
- [ ] Historial de verificaciones

---

**Documento actualizado:** 24 de marzo 2026  
**Versión:** 2.0 (Corregido: Operador cuenta, Admin verifica remotamente)  
**Estado:** Listo para implementación
