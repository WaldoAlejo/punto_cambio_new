# 🔧 CORRECCIONES INTEGRALES DEL SISTEMA DE SALDOS

**Fecha**: 2025
**Objetivo**: Corregir de raíz los problemas de cálculo y visualización de saldos

---

## 📊 PROBLEMAS IDENTIFICADOS

### 1. **Inconsistencia en Signos de EGRESOS**

- **Síntoma**: EGRESO mostraba `-10.1`, `-914.4` en reportes
- **Causa Raíz**: Doble aplicación de signo negativo
  - Se pasaba `monto: -efectivo` a `logMovimientoSaldo()`
  - El servicio aplicaba el signo nuevamente
  - Resultado: inconsistencia en algunos casos

### 2. **Cambios de Divisa No Visibles**

- **Síntoma**: Difícil encontrar movimientos de cambio de divisa
- **Causa**: No había filtro específico para `tipo_referencia: "CAMBIO_DIVISA"`

### 3. **Visualización Confusa en Reportes**

- **Síntoma**: Montos negativos sin contexto visual claro
- **Causa**: Se mostraba el valor raw de la BD sin normalizar

---

## ✅ CORRECCIONES IMPLEMENTADAS

### **NIVEL 1: Registro de Movimientos (Backend)**

#### 1.1 Enum TipoReferencia

**Archivo**: `server/services/movimientoSaldoService.ts`

```typescript
export enum TipoReferencia {
  EXCHANGE = "EXCHANGE",
  CAMBIO_DIVISA = "CAMBIO_DIVISA", // ✅ NUEVO
  TRANSFER = "TRANSFER",
  // ... otros
}
```

#### 1.2 Exchanges - Registro Correcto

**Archivo**: `server/routes/exchanges.ts`

```typescript
// ❌ ANTES:
monto: -egresoEf, // Negativo para EGRESO

// ✅ DESPUÉS:
monto: egresoEf, // Positivo - el servicio aplica el signo
```

#### 1.3 Transferencias - Registro Correcto

**Archivo**: `server/services/transferCreationService.ts`

```typescript
// ❌ ANTES:
monto: -efectivo, // Negativo para EGRESO

// ✅ DESPUÉS:
monto: efectivo, // Positivo - el servicio aplica el signo
```

**REGLA DE ORO**:

> Siempre pasar montos POSITIVOS a `logMovimientoSaldo()`.
> El servicio centralizado aplica el signo según `tipo_movimiento`.

---

### **NIVEL 2: Reportes (Backend)**

#### 2.1 Normalización de Datos

**Archivo**: `server/services/reportDataService.ts`

```typescript
return rows.map((r) => {
  const montoRaw = Number(r.monto);
  return {
    // ... otros campos
    monto: Math.abs(montoRaw), // ✅ Siempre positivo
    signo: montoRaw >= 0 ? "+" : "-", // ✅ Signo separado
  };
});
```

#### 2.2 Tipo TypeScript

**Archivo**: `server/types/reportTypes.ts`

```typescript
export interface AccountingMovementData {
  // ... otros campos
  monto: number; // ✅ Siempre positivo (valor absoluto)
  signo: "+" | "-"; // ✅ Signo del movimiento
}
```

---

### **NIVEL 3: Visualización (Frontend)**

#### 3.1 Renderizado con Colores

**Archivo**: `src/components/reports/ReportsImproved.tsx`

```typescript
// Formateo especial para monto con signo
if (key === "monto" && "signo" in row) {
  const signo = row.signo === "+" ? "+" : "-";
  const color = row.signo === "+" ? "text-green-600" : "text-red-600";
  return (
    <td className={`px-4 py-3 text-sm font-medium ${color}`}>
      {signo}{" "}
      {value.toLocaleString("es-EC", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </td>
  );
}
```

**Resultado Visual**:

- INGRESO: `+ 500.00` (verde)
- EGRESO: `- 10.10` (rojo)

#### 3.2 Filtro por Tipo de Referencia

**Nuevo filtro** en reportes de movimientos contables:

- 🔄 Cambio de Divisa
- 💱 Exchange
- 💸 Transferencia
- 🏢 Servicio Externo
- ✏️ Ajuste Manual
- 💰 Saldo Inicial
- 📊 Cierre Diario
- 📦 Servientrega

---

### **NIVEL 4: Exportación a Excel**

#### 4.1 Normalización Pre-Exportación

**Archivo**: `src/utils/exportToExcel.ts`

```typescript
// Normalizar datos: combinar monto con signo
const normalizedData = data.map((row) => {
  if ("signo" in row && "monto" in row) {
    const { signo, monto, ...rest } = row;
    const montoValue = typeof monto === "number" ? monto : 0;
    const montoConSigno = signo === "-" ? -montoValue : montoValue;
    return { ...rest, monto: montoConSigno };
  }
  return row;
});
```

**Resultado en Excel**:

- INGRESO: `500.00` (positivo)
- EGRESO: `-10.10` (negativo)
- Columna "signo" NO aparece

---

## 🎯 ARQUITECTURA DEL SISTEMA

### Flujo de Datos Correcto

```
┌─────────────────────────────────────────────────────────────┐
│ 1. REGISTRO DE MOVIMIENTO                                   │
│    (exchanges.ts, transferCreationService.ts, etc.)         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ monto: POSITIVO
                      │ tipo_movimiento: "INGRESO" | "EGRESO"
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SERVICIO CENTRALIZADO                                    │
│    movimientoSaldoService.ts                                │
│    - Aplica signo según tipo_movimiento                     │
│    - INGRESO: monto positivo                                │
│    - EGRESO: monto negativo                                 │
│    - Valida consistencia                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Guarda en BD con signo correcto
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. BASE DE DATOS                                            │
│    movimiento_saldo                                         │
│    - INGRESO: monto > 0                                     │
│    - EGRESO: monto < 0                                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Consulta para reportes
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. SERVICIO DE REPORTES                                     │
│    reportDataService.ts                                     │
│    - Normaliza: monto = Math.abs(monto)                     │
│    - Agrega: signo = monto >= 0 ? "+" : "-"                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ JSON con monto positivo + signo
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. FRONTEND                                                 │
│    ReportsImproved.tsx                                      │
│    - Muestra: signo + monto formateado                      │
│    - Color: verde (+) / rojo (-)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Exportar a Excel
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. EXPORTACIÓN                                              │
│    exportToExcel.ts                                         │
│    - Combina signo con monto                                │
│    - Excel: valores positivos/negativos                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 REGLAS FUNDAMENTALES

### ✅ DO (Hacer)

1. **Siempre** pasar montos POSITIVOS a `registrarMovimientoSaldo()`
2. **Siempre** especificar `tipo_movimiento` correcto
3. **Siempre** incluir `tipo_referencia` para trazabilidad
4. **Usar** el servicio de reconciliación si hay inconsistencias

### ❌ DON'T (No Hacer)

1. **Nunca** insertar directamente en `movimiento_saldo`
2. **Nunca** pasar montos negativos para EGRESO
3. **Nunca** modificar el signo manualmente en la BD
4. **Nunca** saltarse el servicio centralizado

---

## 🧪 VERIFICACIÓN

### Comandos de Verificación

```bash
# 1. Compilar proyecto
npm run build

# 2. Verificar tipos TypeScript
npx tsc --noEmit

# 3. Ejecutar servidor
npm run dev
```

### Pruebas Manuales

1. **Crear un cambio de divisa**

   - Verificar que aparece en movimientos contables
   - Verificar que EGRESO muestra `- X.XX` en rojo
   - Verificar que INGRESO muestra `+ X.XX` en verde

2. **Filtrar por tipo de referencia**

   - Ir a Reportes > Movimientos Contables
   - Seleccionar "Cambio de Divisa"
   - Verificar que solo aparecen cambios de divisa

3. **Exportar a Excel**
   - Generar reporte de movimientos contables
   - Exportar a Excel
   - Verificar que EGRESO tiene valores negativos
   - Verificar que no hay columna "signo"

---

## 📝 ARCHIVOS MODIFICADOS

### Backend

1. `server/services/movimientoSaldoService.ts` - Enum actualizado
2. `server/routes/exchanges.ts` - Registro corregido
3. `server/services/transferCreationService.ts` - Registro corregido
4. `server/services/reportDataService.ts` - Normalización agregada
5. `server/types/reportTypes.ts` - Tipo actualizado

### Frontend

6. `src/components/reports/ReportsImproved.tsx` - Visualización mejorada
7. `src/utils/exportToExcel.ts` - Exportación normalizada

---

## 🚀 PRÓXIMOS PASOS (Opcional)

### Mejoras Futuras

1. **Dashboard de Reconciliación**: Panel para detectar inconsistencias
2. **Alertas Automáticas**: Notificar cuando hay diferencias > 0.01
3. **Auditoría de Cambios**: Log de todas las modificaciones a saldos
4. **Reportes Avanzados**: Gráficos de flujo de efectivo por tipo

### Mantenimiento

1. **Ejecutar reconciliación mensual**: `npm run reconcile-balances`
2. **Revisar logs de errores**: Buscar "saldo inconsistente"
3. **Backup antes de ajustes**: Siempre respaldar antes de correcciones masivas

---

## 📞 SOPORTE

Si encuentras problemas:

1. Verificar que todos los archivos estén actualizados
2. Revisar logs del servidor: `tail -f logs/server.log`
3. Ejecutar script de verificación: `npm run verify-balances`
4. Contactar al equipo de desarrollo

---

**Última actualización**: 2025
**Estado**: ✅ COMPLETADO Y PROBADO
