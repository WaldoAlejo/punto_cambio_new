# Scripts de Corrección de Balances

Este conjunto de scripts está diseñado para corregir las inconsistencias en los balances causadas por el bug en el cálculo de egresos para monedas no-USD en cambios de divisas.

## 🐛 Problema Identificado

El bug estaba en el archivo `/server/routes/exchanges.ts` en las líneas 555-590. El sistema usaba incorrectamente los campos `usd_entregado_efectivo` y `usd_entregado_transfer` para calcular egresos de TODAS las monedas destino, no solo USD. Esto causaba que:

- ✅ Los balances de USD se actualizaran correctamente
- ❌ Los balances de otras monedas (COP, EUR, etc.) no se descontaran correctamente

## 📁 Scripts Disponibles

### 1. `validate-balances.ts` - Validación de Balances

**Propósito**: Valida la consistencia de los balances actuales sin modificar nada.

```bash
tsx scripts/validate-balances.ts
```

**Qué hace**:

- Analiza todos los balances actuales
- Calcula el saldo esperado basado en movimientos
- Identifica diferencias y problemas específicos
- Detecta transacciones afectadas por el bug
- Genera estadísticas por moneda y punto

### 2. `balance-audit-report.ts` - Reporte de Auditoría

**Propósito**: Genera reportes detallados de todos los movimientos que afectan cada balance.

```bash
tsx scripts/balance-audit-report.ts
```

**Qué hace**:

- Analiza todos los movimientos históricos
- Genera archivo JSON con detalles completos
- Crea archivo CSV para análisis en Excel
- Identifica la causa raíz de cada diferencia
- Guarda reportes en la carpeta `reports/`

### 3. `recalculate-balances.ts` - Recálculo de Balances

**Propósito**: Recalcula y corrige todos los balances desde cero.

```bash
tsx scripts/recalculate-balances.ts
```

**Qué hace**:

- Recalcula balances basándose en:
  - Saldos iniciales asignados
  - Cambios de divisas (con lógica corregida)
  - Transferencias entre puntos
  - Operaciones de servicios externos
  - Saldos de Servientrega
- Actualiza los balances en la base de datos
- Muestra un resumen de cambios realizados

### 4. `fix-balances.ts` - Script Maestro

**Propósito**: Ejecuta todo el proceso de corrección de manera ordenada.

```bash
tsx scripts/fix-balances.ts
```

**Qué hace**:

- Ejecuta validación inicial
- Genera reportes de auditoría
- Solicita confirmación antes de modificar datos
- Ejecuta recálculo de balances
- Realiza validación final
- Proporciona resumen completo

## 🚀 Uso Recomendado

### Opción 1: Proceso Completo (Recomendado)

```bash
# Ejecutar el script maestro que guía todo el proceso
tsx scripts/fix-balances.ts
```

### Opción 2: Paso a Paso

```bash
# 1. Validar estado actual
tsx scripts/validate-balances.ts

# 2. Generar reportes de auditoría
tsx scripts/balance-audit-report.ts

# 3. Revisar reportes en la carpeta reports/

# 4. Ejecutar corrección (solo si estás seguro)
tsx scripts/recalculate-balances.ts

# 5. Validar resultado final
tsx scripts/validate-balances.ts
```

## 📊 Archivos Generados

Los scripts generan varios archivos en la carpeta `reports/`:

- `balance-audit-report-YYYY-MM-DD.json`: Reporte detallado en formato JSON
- `balance-audit-summary-YYYY-MM-DD.csv`: Resumen en formato CSV para Excel

## ⚠️ Precauciones Importantes

1. **Backup de Base de Datos**: Asegúrate de tener un backup antes de ejecutar el recálculo
2. **Ambiente de Prueba**: Ejecuta primero en un ambiente de desarrollo/prueba
3. **Validación Manual**: Después del recálculo, verifica algunos balances manualmente
4. **Horario de Mantenimiento**: Ejecuta durante horarios de bajo tráfico

## 🔧 Requisitos Técnicos

- Node.js con soporte para TypeScript
- Acceso a la base de datos PostgreSQL
- Variables de entorno configuradas (DATABASE_URL)
- Dependencias del proyecto instaladas

## 📈 Lógica de Corrección

### Antes (Bug)

```typescript
// INCORRECTO: Usaba campos USD para todas las monedas
const egresoEfectivo = Number(cambio.usd_entregado_efectivo || 0);
const egresoTransfer = Number(cambio.usd_entregado_transfer || 0);
```

### Después (Corregido)

```typescript
// CORRECTO: Lógica específica por moneda
if (monedaDestino.codigo === "USD") {
  // Para USD, usar campos específicos
  egresoEfectivo = Number(cambio.usd_entregado_efectivo || 0);
  egresoTransfer = Number(cambio.usd_entregado_transfer || 0);
} else {
  // Para otras monedas, usar divisas_recibidas_total_final
  const totalEgreso = Number(cambio.divisas_recibidas_total_final || 0);
  // Distribuir según método de entrega
}
```

## 🎯 Casos de Uso Específicos

### Caso 1: Solo Validar (Sin Modificar)

```bash
tsx scripts/validate-balances.ts
```

### Caso 2: Generar Reportes para Análisis

```bash
tsx scripts/balance-audit-report.ts
```

### Caso 3: Corrección Completa

```bash
tsx scripts/fix-balances.ts
```

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs de error detallados
2. Verifica la conexión a la base de datos
3. Asegúrate de que las dependencias estén instaladas
4. Ejecuta los scripts individuales para aislar el problema

## 📝 Notas de Desarrollo

- Los scripts usan Prisma para acceso a la base de datos
- Incluyen logging detallado para debugging
- Manejan errores gracefully
- Generan reportes en múltiples formatos
- Respetan las relaciones de integridad referencial
