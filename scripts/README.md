# 🔧 Scripts de Gestión de Balances

Este directorio contiene scripts especializados para la gestión, validación y corrección de balances en el sistema Punto Cambio.

## 📁 Archivos Disponibles

### 🎯 Scripts Principales

#### `balance-management.ts` - **Script Maestro**

Script principal que proporciona acceso a todas las funcionalidades de gestión de balances.

```bash
# Mostrar ayuda
npx tsx scripts/balance-management.ts help

# Auditoría (solo lectura)
npx tsx scripts/balance-management.ts audit

# Recálculo completo (modifica BD)
npx tsx scripts/balance-management.ts recalculate

# Validación de integridad
npx tsx scripts/balance-management.ts validate

# Análisis de diferencias
npx tsx scripts/balance-management.ts analyze
```

#### `recalculate-balances-improved.ts` - **Recálculo Mejorado**

Versión mejorada del script de recálculo con mejor reporte y modo de solo lectura.

```bash
# Recálculo normal
npx tsx scripts/recalculate-balances-improved.ts

# Modo auditoría (solo lectura)
npx tsx scripts/recalculate-balances-improved.ts --read-only
```

### 🔍 Scripts de Análisis

#### `analyze-balance-differences.ts` - **Análisis Detallado**

Analiza en detalle las diferencias en balances para monedas específicas.

```bash
npx tsx scripts/analyze-balance-differences.ts
```

#### `validate-data-integrity.ts` - **Validación de Integridad**

Ejecuta múltiples pruebas para verificar la consistencia de los datos.

```bash
npx tsx scripts/validate-data-integrity.ts
```

### 📜 Scripts Históricos

#### `recalculate-balances.ts` - **Script Original**

Script original de recálculo (mantenido para referencia).

## 🚀 Flujo de Trabajo Recomendado

### 1. **Auditoría Inicial**

Antes de hacer cualquier cambio, ejecuta una auditoría para ver qué correcciones serían necesarias:

```bash
npx tsx scripts/balance-management.ts audit
```

### 2. **Validación de Integridad**

Verifica que los datos estén consistentes:

```bash
npx tsx scripts/balance-management.ts validate
```

### 3. **Análisis Detallado** (Opcional)

Si hay diferencias significativas, analiza en detalle:

```bash
npx tsx scripts/balance-management.ts analyze
```

### 4. **Aplicar Correcciones**

Si todo está correcto, aplica las correcciones:

```bash
npx tsx scripts/balance-management.ts recalculate
```

## 📊 Tipos de Movimientos Procesados

Los scripts procesan los siguientes tipos de movimientos para calcular balances:

### 1. **Saldos Iniciales**

- Saldos asignados inicialmente a cada punto de atención
- Solo se consideran los marcados como `activo: true`

### 2. **Cambios de Divisas**

- **Ingresos**: Divisas que el cliente entrega (moneda origen)
- **Egresos**: Divisas que entregamos al cliente (moneda destino)
- Maneja diferentes métodos de entrega (efectivo, transferencia)

### 3. **Transferencias**

- Movimientos entre puntos de atención
- Solo se procesan las transferencias `APROBADO`

### 4. **Servicios Externos**

- Movimientos relacionados con servicios como Western Union, MoneyGram, etc.
- Pueden ser ingresos o egresos según `tipo_movimiento`

### 5. **Saldos Servientrega**

- Saldos específicos para operaciones de Servientrega
- Se registran para auditoría pero no afectan balance principal

## 🔧 Campos de Balance

Cada balance se compone de:

- **`cantidad`**: Total general del balance
- **`billetes`**: Dinero en efectivo (billetes)
- **`monedas_fisicas`**: Monedas físicas
- **`bancos`**: Dinero en cuentas bancarias/transferencias

## ⚠️ Consideraciones Importantes

### Campos Específicos USD

El sistema maneja campos especiales para USD:

- `usd_entregado_efectivo`
- `usd_entregado_transfer`

Estos campos deben coincidir con `divisas_recibidas_total` para transacciones USD.

### Validaciones Implementadas

- ✅ No balances negativos
- ✅ Consistencia en campos USD
- ✅ No transferencias huérfanas
- ✅ No saldos iniciales duplicados
- ✅ No recibos duplicados
- ✅ Referencias a entidades activas

## 🐛 Resolución de Problemas

### Error: "Command not found: npx"

Instala Node.js y npm en tu sistema.

### Error: "Cannot find module"

Ejecuta `npm install` en el directorio raíz del proyecto.

### Error de conexión a base de datos

Verifica que la variable `DATABASE_URL` esté configurada correctamente.

### Balances negativos después del recálculo

Esto puede indicar:

1. Transacciones registradas incorrectamente
2. Transferencias no balanceadas
3. Problemas en los datos de origen

## 📝 Logs y Auditoría

Todos los scripts generan logs detallados que incluyen:

- Movimientos procesados por tipo
- Correcciones aplicadas
- Estadísticas por moneda
- Errores encontrados

## 🔄 Mantenimiento

### Ejecución Periódica

Se recomienda ejecutar auditorías periódicamente:

```bash
# Auditoría semanal
npx tsx scripts/balance-management.ts audit

# Validación mensual
npx tsx scripts/balance-management.ts validate
```

### Backup Antes de Cambios

Siempre realiza un backup de la base de datos antes de ejecutar recálculos:

```bash
pg_dump punto_cambio_new > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 📞 Soporte

Para problemas o preguntas sobre estos scripts, revisa:

1. Los logs generados por el script
2. La documentación del esquema de base de datos
3. Los comentarios en el código fuente
