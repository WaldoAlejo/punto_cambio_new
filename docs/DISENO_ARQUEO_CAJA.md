# Diseño: Sistema de Arqueo de Caja Físico

## Concepto

El **Arqueo de Caja** es el proceso de contar físicamente TODO el efectivo (billetes y monedas) y verificar que coincida con lo que dice el sistema. Es una práctica estándar de auditoría.

### Diferencias con Cierre de Caja

| Aspecto | Cierre de Caja | Arqueo de Caja |
|---------|----------------|----------------|
| **Propósito** | Cerrar operaciones del día | Verificar integridad física del dinero |
| **Quién lo hace** | Operador | Administrador (o supervisor) |
| **Frecuencia** | 1 vez al día (al salir) | 2 veces al día (entrada y salida) |
| **Qué se cuenta** | Solo movimientos del día | TODO el efectivo existente |
| **Afecta saldos** | Sí, actualiza saldo inicial del día siguiente | No, solo genera reporte de diferencias |
| **Firma requerida** | Operador | Administrador + Operador |

---

## Flujo de Arqueo

### Arqueo de ENTRADA (Inicio del día)
```
┌─────────────────────────────────────────────────────────────┐
│  1. ADMIN abre el Arqueo de Caja                            │
│  2. Selecciona: Tipo = "ENTRADA"                            │
│  3. Sistema muestra saldo teórico que debería haber         │
│  4. ADMIN cuenta FÍSICAMENTE todo el dinero:                │
│     - Billetes por denominación                             │
│     - Monedas por denominación                              │
│  5. ADMIN ingresa conteo físico                             │
│  6. Sistema calcula DIFERENCIA:                             │
│     Diferencia = Físico - Teórico                           │
│  7. Si hay diferencia > tolerancia:                         │
│     - Alerta al administrador                               │
│     - Registrar incidencia                                  │
│  8. Guardar arqueo con estado "CUADRADO" o "CON_DIFERENCIA" │
│  9. Generar reporte impreso (firma admin + operador)        │
└─────────────────────────────────────────────────────────────┘
```

### Arqueo de SALIDA (Fin del día)
```
┌─────────────────────────────────────────────────────────────┐
│  1. ADMIN abre el Arqueo de Caja                            │
│  2. Selecciona: Tipo = "SALIDA"                             │
│  3. Sistema muestra saldo teórico actual                    │
│  4. ADMIN cuenta FÍSICAMENTE todo el dinero                 │
│  5. ADMIN ingresa conteo físico                             │
│  6. Sistema calcula DIFERENCIA                              │
│  7. Comparar con arqueo de entrada:                         │
│     - Movimientos del día = Salida - Entrada                │
│  8. Guardar arqueo                                          │
│  9. Generar reporte comparativo                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Modelo de Datos

### Tabla: ArqueoCaja
```prisma
model ArqueoCaja {
  id                String        @id @default(uuid())
  punto_atencion_id String
  usuario_id        String        // Quién realizó el arqueo (admin)
  tipo              TipoArqueo    // ENTRADA o SALIDA
  fecha             DateTime      @default(now())
  estado            EstadoArqueo  // PENDIENTE, CUADRADO, CON_DIFERENCIA
  
  // Referencia al arqueo de entrada (solo para tipo=SALIDA)
  arqueo_entrada_id String?
  
  // Campos de auditoría
  observaciones     String?
  firmado_por       String?       // ID del operador que firma
  
  // Relaciones
  puntoAtencion     PuntoAtencion @relation(fields: [punto_atencion_id], references: [id])
  usuario           Usuario       @relation(fields: [usuario_id], references: [id])
  detalles          DetalleArqueoCaja[]
  
  @@index([punto_atencion_id, fecha])
  @@index([tipo, fecha])
}

enum TipoArqueo {
  ENTRADA
  SALIDA
}

enum EstadoArqueo {
  PENDIENTE
  CUADRADO
  CON_DIFERENCIA
}
```

### Tabla: DetalleArqueoCaja
```prisma
model DetalleArqueoCaja {
  id                    String     @id @default(uuid())
  arqueo_id             String
  moneda_id             String
  
  // Saldos del sistema
  saldo_teorico         Decimal    @db.Decimal(15, 2)
  
  // Conteo físico - TOTAL
  conteo_fisico_total   Decimal    @db.Decimal(15, 2)
  
  // Conteo físico - DESGLOSE POR DENOMINACIÓN
  // Guardado como JSON: [{denominacion: 100, cantidad: 5, tipo: "billete"}, ...]
  desglose_billetes     Json       // Billetes contados por denominación
  desglose_monedas      Json       // Monedas contadas por denominación
  
  // Resultado
  diferencia            Decimal    @default(0) @db.Decimal(15, 2)
  
  // Observaciones específicas de esta moneda
  observaciones         String?
  
  // Relaciones
  arqueo                ArqueoCaja @relation(fields: [arqueo_id], references: [id], onDelete: Cascade)
  moneda                Moneda     @relation(fields: [moneda_id], references: [id])
  
  @@unique([arqueo_id, moneda_id])
  @@index([moneda_id])
}
```

### Ejemplo de JSON para desglose
```json
{
  "billetes": [
    {"denominacion": 100, "cantidad": 5, "total": 500},
    {"denominacion": 50, "cantidad": 10, "total": 500},
    {"denominacion": 20, "cantidad": 15, "total": 300},
    {"denominacion": 10, "cantidad": 20, "total": 200},
    {"denominacion": 5, "cantidad": 10, "total": 50},
    {"denominacion": 1, "cantidad": 25, "total": 25}
  ],
  "total_billetes": 1575
}
```

---

## Interfaz de Usuario

### Pantalla: Arqueo de Caja

```
┌─────────────────────────────────────────────────────────────────┐
│  🏦 ARQUEO DE CAJA FÍSICA                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Punto de Atención: [Oficina Principal ▼]                       │
│  Tipo de Arqueo:    [○ Entrada  ● Salida]                       │
│  Fecha:             [24/03/2026]                                │
│  Responsable:       Juan Pérez (Admin)                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  💵 USD - Dólar Americano                                       │
├─────────────────────────────────────────────────────────────────┤
│  Saldo según sistema: $1,575.00                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BILLETES                                                │   │
│  ├─────────────┬────────────┬───────────────────────────────┤   │
│  │ Denominación│ Cantidad   │ Total                         │   │
│  ├─────────────┼────────────┼───────────────────────────────┤   │
│  │ $100        │ [    5    ]│ $500.00                       │   │
│  │ $50         │ [   10    ]│ $500.00                       │   │
│  │ $20         │ [   15    ]│ $300.00                       │   │
│  │ $10         │ [   20    ]│ $200.00                       │   │
│  │ $5          │ [   10    ]│ $50.00                        │   │
│  │ $1          │ [   25    ]│ $25.00                        │   │
│  ├─────────────┴────────────┴───────────────────────────────┤   │
│  │ Total Billetes:                          $1,575.00       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ MONEDAS                                                 │   │
│  ├─────────────┬────────────┬───────────────────────────────┤   │
│  │ Denominación│ Cantidad   │ Total                         │   │
│  ├─────────────┼────────────┼───────────────────────────────┤   │
│  │ $1          │ [    0    ]│ $0.00                         │   │
│  │ 50¢         │ [    0    ]│ $0.00                         │   │
│  │ 25¢         │ [    0    ]│ $0.00                         │   │
│  │ 10¢         │ [    0    ]│ $0.00                         │   │
│  │ 5¢          │ [    0    ]│ $0.00                         │   │
│  │ 1¢          │ [    0    ]│ $0.00                         │   │
│  ├─────────────┴────────────┴───────────────────────────────┤   │
│  │ Total Monedas:                           $0.00           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  TOTAL CONTEO FÍSICO:                      $1,575.00           │
│  SALDO TEÓRICO:                            $1,575.00           │
│  DIFERENCIA:                               $0.00  ✅ CUADRADO  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  Observaciones:                                                 │
│  [                                                            ]│
│  [                                                            ]│
│                                                                 │
│  [✓] Firma del Operador: ___________________                   │
│  [✓] Firma del Administrador: ______________                   │
│                                                                 │
│           [Guardar Borrador]  [Generar Reporte]  [Confirmar]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Reporte de Arqueo

### Formato del Reporte Impreso

```
═══════════════════════════════════════════════════════════════════
              ARQUEO DE CAJA FÍSICA - PUNTO DE ATENCIÓN
═══════════════════════════════════════════════════════════════════

Tipo de Arqueo: [ENTRADA / SALIDA]
Fecha: 24 de marzo de 2026
Hora: 08:30:45
Punto de Atención: Oficina Principal
Dirección: Av. Principal 123

-------------------------------------------------------------------
RESPONSABLES
-------------------------------------------------------------------
Administrador: ___________________________  Firma: _______________
Operador:      ___________________________  Firma: _______________

-------------------------------------------------------------------
CONTEO FÍSICO - USD (DÓLAR AMERICANO)
-------------------------------------------------------------------
BILLETES:
  $100  x    5 = $   500.00
  $50   x   10 = $   500.00
  $20   x   15 = $   300.00
  $10   x   20 = $   200.00
  $5    x   10 = $    50.00
  $1    x   25 = $    25.00
                -------------
  Total Billetes:    $ 1,575.00

MONEDAS:
  $1    x    0 = $     0.00
  50¢   x    0 = $     0.00
  25¢   x    0 = $     0.00
  10¢   x    0 = $     0.00
  5¢    x    0 = $     0.00
  1¢    x    0 = $     0.00
                -------------
  Total Monedas:     $     0.00

═══════════════════════════════════════════════════════════════════
TOTAL CONTEO FÍSICO:                    $ 1,575.00
SALDO TEÓRICO (sistema):                $ 1,575.00
───────────────────────────────────────────────────────────────────
DIFERENCIA:                             $     0.00  ✅ CUADRADO
═══════════════════════════════════════════════════════════════════

Observaciones:
___________________________________________________________________
___________________________________________________________________


                      ==== CUADRE DIARIO ====

Si este es un ARQUEO DE SALIDA:

Arqueo Entrada (08:00):  $ 1,200.00
(+) Ingresos del día:    $   800.00
(-) Egresos del día:     $   425.00
─────────────────────────────────────
Saldo Teórico:           $ 1,575.00
Saldo Físico:            $ 1,575.00
─────────────────────────────────────
Diferencia:              $     0.00  ✅

═══════════════════════════════════════════════════════════════════
Documento generado: 24/03/2026 08:30:45
Sistema: Punto Cambio v2.0
═══════════════════════════════════════════════════════════════════
```

---

## Endpoints API

### POST /api/arqueo-caja
Crear un nuevo arqueo de caja.

**Request:**
```json
{
  "punto_atencion_id": "uuid-punto",
  "tipo": "ENTRADA",
  "detalles": [
    {
      "moneda_id": "uuid-usd",
      "desglose_billetes": [
        {"denominacion": 100, "cantidad": 5, "total": 500},
        {"denominacion": 50, "cantidad": 10, "total": 500}
      ],
      "desglose_monedas": [],
      "conteo_fisico_total": 1575,
      "observaciones": null
    }
  ],
  "observaciones_general": "Todo cuadrado"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "arqueo_id": "uuid-arqueo",
    "estado": "CUADRADO",
    "diferencias": [
      {
        "moneda_codigo": "USD",
        "saldo_teorico": 1575,
        "conteo_fisico": 1575,
        "diferencia": 0
      }
    ]
  }
}
```

### GET /api/arqueo-caja/:puntoId
Obtener historial de arqueos de un punto.

### GET /api/arqueo-caja/reporte/:arqueoId
Generar reporte PDF/imprimible del arqueo.

### GET /api/arqueo-caja/comparativo
Comparar arqueo de entrada vs salida del día.

---

## Implementación Sugerida

### Fase 1: Modelo de Datos
1. Crear migración Prisma con tablas `ArqueoCaja` y `DetalleArqueoCaja`
2. Ejecutar migración en producción

### Fase 2: Backend
1. Crear endpoints en `server/routes/arqueoCaja.ts`
2. Servicio de generación de reportes en `server/services/arqueoCajaService.ts`
3. Integrar con sistema de saldos existente

### Fase 3: Frontend
1. Crear componente `src/components/arqueo/ArqueoCajaPage.tsx`
2. Sub-componentes:
   - `ConteoBilletes.tsx` - Grid de denominaciones de billetes
   - `ConteoMonedas.tsx` - Grid de denominaciones de monedas
   - `ResumenArqueo.tsx` - Diferencias y totales
   - `ReporteArqueo.tsx` - Vista para imprimir
3. Agregar al menú de navegación

### Fase 4: Reportes
1. Vista de reporte para impresión
2. Exportación a PDF
3. Dashboard de arqueos para administrador

---

## Flujo de Integración con Sistema Actual

```
┌─────────────────────────────────────────────────────────────────┐
│                    INICIO DEL DÍA (08:00)                       │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. ADMIN abre "Arqueo de Caja"                                  │
│     - Selecciona Tipo: ENTRADA                                   │
│     - Sistema muestra saldo teórico = $1,200                     │
│     - ADMIN cuenta físicamente                                   │
│     - Ingresa: Billetes $1,000 + Monedas $200 = $1,200          │
│     - Sistema: ✅ CUADRADO                                       │
│     - Guarda arqueo de entrada                                   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. OPERADOR trabaja todo el día                                  │
│     - Realiza cambios de divisa                                  │
│     - Saldo va variando                                          │
│     - Al final: Saldo teórico = $1,575                           │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. ADMIN cierra el día (18:00)                                  │
│     - Abre "Arqueo de Caja"                                      │
│     - Selecciona Tipo: SALIDA                                    │
│     - Sistema muestra saldo teórico = $1,575                     │
│     - ADMIN cuenta físicamente                                   │
│     - Ingresa: Billetes $1,500 + Monedas $75 = $1,575           │
│     - Sistema: ✅ CUADRADO                                       │
│     - Genera reporte comparativo                                 │
│     - Firman admin y operador                                    │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. ADMIN revisa cuadre del día:                                 │
│     Arqueo Entrada:  $1,200                                     │
│     + Ingresos:      $  800                                     │
│     - Egresos:       $  425                                     │
│     = Teórico:       $1,575                                     │
│     Arqueo Salida:   $1,575  ✅ CUADRADO                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Consideraciones de Seguridad

1. **Solo administradores** pueden crear arqueos
2. **Doble firma:** Requiere firma del operador y del administrador
3. **No editable:** Una vez confirmado, no se puede modificar (solo anular y recrear)
4. **Auditoría:** Todos los cambios se registran con timestamp y usuario
5. **Conciliación:** Si hay diferencias, se debe crear un ajuste contable justificado

---

**Documento generado:** 24 de marzo 2026
**Versión:** 1.0
**Estado:** Diseño completo, listo para implementación
