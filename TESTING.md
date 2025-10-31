# 🧪 Testing: Flujo Completo de Servientrega (Generación + Anulación + Reversión)

## ⚡ Quick Start (5 minutos)

```bash
# Terminal 1: Inicia servidor
npm run dev:server

# Terminal 2: Obtén datos de prueba
./obtener-datos-test.sh

# Terminal 3: Ejecuta el test
export TEST_OPERADOR_USERNAME="operador1"
export TEST_OPERADOR_PASSWORD="password123"
export TEST_ADMIN_USERNAME="admin_main"
export TEST_ADMIN_PASSWORD="adminpass"
export TEST_PUNTO_ID="punto-id"

npx tsx test-flujo-anulacion.ts
```

**Resultado esperado:**

```
✅ ¡FLUJO COMPLETO EXITOSO!
Saldo inicial: $5000.00
Saldo después generar: $5025.50
Saldo final (después anular): $5000.00
```

---

## 📋 Pasos Detallados

### 1. Validar Setup

```bash
./validar-setup-test.sh
```

Verifica:

- ✓ Node.js y npm instalados
- ✓ Dependencies disponibles
- ✓ Puerto 3001 disponible
- ✓ Conexión a BD
- ✓ Usuarios activos en BD

### 2. Obtener Datos de Prueba

```bash
./obtener-datos-test.sh
```

Obtiene automáticamente:

- Usuarios operadores y admin disponibles
- Puntos de atención
- Saldos actuales
- Últimas guías generadas

**Anota estos valores:**

```
OPERADOR_USERNAME = (usuario con rol OPERADOR)
ADMIN_USERNAME = (usuario con rol ADMIN o SUPER_USUARIO)
PUNTO_ID = (UUID del punto de atención)
```

### 3. Ejecutar Test Completo

```bash
# Configurar variables
export TEST_OPERADOR_USERNAME="tu_operador"
export TEST_OPERADOR_PASSWORD="password"
export TEST_ADMIN_USERNAME="tu_admin"
export TEST_ADMIN_PASSWORD="password"
export TEST_PUNTO_ID="uuid-punto"

# Ejecutar test
npx tsx test-flujo-anulacion.ts
```

**El test verifica 8 pasos:**

1. ✓ Login operador
2. ✓ Obtener saldos iniciales
3. ✓ Generar guía
4. ✓ Verificar incremento de saldo
5. ✓ Solicitar anulación
6. ✓ Login admin
7. ✓ Aprobar anulación
8. ✓ Verificar reversión de saldo

---

## 🔄 Lo Que Se Prueba

### Generación de Guía

```
1. Operador genera guía en Servientrega
   ↓
2. Sistema registra costo en saldo USD (INGRESO)
   ↓
3. Saldo USD aumenta automáticamente
   ↓
   Ejemplo: $5000.00 → $5025.50 (+$25.50)
```

**En BD se registra:**

- `ServientregaGuia` con número único
- `ServicioExternoMovimiento` tipo INGRESO
- `MovimientoSaldo` tipo INGRESO
- Audit trail completo

### Anulación de Guía (con Reversión)

```
1. Operador solicita anulación
   ↓
2. Admin aprueba
   ↓
3. Sistema llama API Servientrega ActualizaEstadoGuia
   ↓
4. Si respuesta exitosa: AUTOMÁTICAMENTE revierte balance
   ↓
5. Saldo USD disminuye
   ↓
   Ejemplo: $5025.50 → $5000.00 (-$25.50)
```

**En BD se registra:**

- `ServientregaSolicitudAnulacion` estado APROBADA
- `ServicioExternoMovimiento` tipo EGRESO (monto negativo)
- `MovimientoSaldo` tipo EGRESO
- Inversión exacta del movimiento de ingreso

---

## ✅ Validar Resultados

### Reporte del Test

```
═══════════════════════════════════════════════════════════════
📋 REPORTE FINAL
═══════════════════════════════════════════════════════════════

Saldos USD:
  Inicial:                   $5000.00
  Después de generar:        $5025.50
  Final (después anular):    $5000.00

Números de referencia:
  Guía:                      1000000123
  Solicitud anulación:       abc-def-123

Cambios:
  Al generar guía:           +$25.50
  Al anular:                 -$25.50
  Total (antes - después):   $0.00

═══════════════════════════════════════════════════════════════
✅ ¡FLUJO COMPLETO EXITOSO!
El saldo volvió al estado inicial después de anular la guía
═══════════════════════════════════════════════════════════════
```

### ✓ Validar en Base de Datos

```bash
psql "$DATABASE_URL"
```

**Guía creada:**

```sql
SELECT numero_guia, costo_envio, proceso, fecha_creacion
FROM "ServientregaGuia"
ORDER BY fecha_creacion DESC LIMIT 1;
```

**Movimientos de ingreso (cuando se genera):**

```sql
SELECT tipo_movimiento, monto, numero_referencia, fecha
FROM "ServicioExternoMovimiento"
WHERE tipo_movimiento = 'INGRESO'
ORDER BY fecha DESC LIMIT 1;
```

**Movimientos de egreso (cuando se anula):**

```sql
SELECT tipo_movimiento, monto, numero_referencia, fecha
FROM "ServicioExternoMovimiento"
WHERE tipo_movimiento = 'EGRESO'
ORDER BY fecha DESC LIMIT 1;
```

**Historial completo de movimientos de saldo:**

```sql
SELECT ms.tipo_movimiento, ms.monto, ms.referencia_id, ms.fecha_creacion
FROM "MovimientoSaldo" ms
WHERE ms.referencia_id LIKE '100000%'
ORDER BY ms.fecha_creacion DESC;
```

---

## 🐛 Troubleshooting

### Error: "No se pudo autenticar al operador"

✓ Verificar:

- Username exacto (case-sensitive)
- Usuario tenga rol OPERADOR
- Usuario esté activo

Solución:

```bash
./obtener-datos-test.sh   # Obtener username exacto
# Copiar username de salida
# Usar contraseña correcta
```

### Error: "No se pudo obtener número de guía"

✓ Verificar:

- punto_atencion_id existe
- punto_atencion_id está asignado al usuario
- Credenciales de Servientrega en .env

Solución:

```bash
./obtener-datos-test.sh   # Obtener punto_atencion_id existente
# Usar ID del punto existente
```

### Error: "Error al aprobar anulación"

✓ Verificar:

- admin tenga rol ADMIN o SUPER_USUARIO
- Credenciales Servientrega en .env.production
- API de Servientrega disponible

### Saldos no coinciden al final

✓ Verificar:

- Ejecutar nuevamente después de 5 segundos
- Revisar logs del servidor: `npm run pm2:logs`
- Consultar BD para ver todos los movimientos

---

## 🧹 Limpiar Base de Datos (Seguro)

Si necesitas limpiar datos de prueba:

```bash
# Solo elimina datos de TEST que no afectan el sistema
./clean-test-data.sh

# Este script:
# - Busca guías con número >= 999999000
# - Elimina solicitudes de anulación asociadas
# - Elimina movimientos de balance asociados
# - NO toca datos de producción
# - Crea backup antes de limpiar
```

---

## 📚 Archivos Importantes

| Archivo                                      | Propósito                                               |
| -------------------------------------------- | ------------------------------------------------------- |
| `test-flujo-anulacion.ts`                    | Script principal de test (TypeScript)                   |
| `obtener-datos-test.sh`                      | Obtener usuarios/puntos/saldos de BD                    |
| `validar-setup-test.sh`                      | Validar configuración previa                            |
| `clean-test-data.sh`                         | Limpiar datos de prueba (seguro)                        |
| `/server/routes/servientrega/shipping.ts`    | Generación de guías + ingreso automático                |
| `/server/routes/servientrega/anulaciones.ts` | Anulación de guías + reversión automática               |
| `/server/services/servientregaDBService.ts`  | Funciones de balance (registrarIngreso/revertirIngreso) |

---

## 🎯 Flujo Implementado

```
┌─────────────────────────────────────────────────┐
│ OPERADOR GENERA GUÍA                            │
└────────────────┬────────────────────────────────┘
                 │
                 ├─> POST /api/servientrega/generar-guia
                 │
                 ├─> API Servientrega genera guía
                 │
                 └─> 🔄 AUTOMÁTICO: registrarIngresoServicioExterno()
                     ├─> Saldo USD += $25.50
                     ├─> ServicioExternoMovimiento(INGRESO)
                     └─> MovimientoSaldo(INGRESO)


┌─────────────────────────────────────────────────┐
│ OPERADOR SOLICITA ANULACIÓN                     │
└────────────────┬────────────────────────────────┘
                 │
                 ├─> POST /api/servientrega/solicitudes-anulacion
                 └─> Estado: PENDIENTE


┌─────────────────────────────────────────────────┐
│ ADMIN APRUEBA ANULACIÓN                         │
└────────────────┬────────────────────────────────┘
                 │
                 ├─> PUT /api/servientrega/solicitudes-anulacion/:id/responder
                 │
                 ├─> API Servientrega: ActualizaEstadoGuia
                 │
                 ├─> Respuesta exitosa: {"fetch":{"proceso":"Guia Actualizada"}}
                 │
                 └─> 🔄 AUTOMÁTICO: revertirIngresoServicioExterno()
                     ├─> Saldo USD -= $25.50
                     ├─> ServicioExternoMovimiento(EGRESO)
                     └─> MovimientoSaldo(EGRESO)


RESULTADO: Saldo vuelve al inicial
✅ FLUJO COMPLETO Y REVERSIBLE
```

---

## 🔐 Características de Seguridad

- ✓ **Atómico**: Transacciones garantizadas (todo o nada)
- ✓ **Solo Admin**: Solo admin puede aprobar anulaciones
- ✓ **Validaciones**: Punto de atención, costo > 0, API response válida
- ✓ **Precisión**: Uso de `Prisma.Decimal` (sin redondeos)
- ✓ **Auditoría**: Todos los movimientos registrados con timestamp y usuario
- ✓ **Reversible**: Ingreso y egreso son exactamente opuestos

---

## 📝 Última Actualización

- **Fecha**: 2025-01-30
- **Estado**: ✅ Implementación Completa
- **Test**: 8 pasos automatizados
- **Documentación**: Consolidada en este archivo
