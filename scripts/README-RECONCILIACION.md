# Scripts de Reconciliación de Saldos

Este directorio contiene scripts para reconciliar y corregir inconsistencias en los saldos del sistema.

## 📋 Scripts Disponibles

### 1. `reporte-inconsistencias-saldos.ts` (Solo Lectura)

**Propósito:** Genera un reporte de todas las inconsistencias encontradas SIN hacer ninguna modificación.

**Uso:**

```bash
npx tsx scripts/reporte-inconsistencias-saldos.ts
```

**Salida:**

- Lista de todos los saldos con inconsistencias
- Diferencia entre saldo registrado y calculado
- Número de movimientos por cada saldo
- Diferencia total acumulada

**Recomendación:** Ejecuta este script PRIMERO para ver qué inconsistencias existen antes de corregirlas.

---

### 2. `reconciliar-todos-saldos.ts` (Modifica Datos)

**Propósito:** Corrige automáticamente TODAS las inconsistencias encontradas en todos los puntos de atención.

**Uso:**

```bash
npx tsx scripts/reconciliar-todos-saldos.ts
```

**Acciones:**

- Calcula el saldo correcto basado en movimientos históricos
- Actualiza la tabla `Saldo` con el valor correcto
- NO crea movimientos de ajuste (solo actualiza el saldo)
- Genera un reporte detallado de todas las correcciones

**⚠️ IMPORTANTE:** Este script modifica datos en la base de datos. Se recomienda:

1. Ejecutar primero el script de reporte
2. Hacer un backup de la base de datos (opcional pero recomendado)
3. Ejecutar en horario de bajo tráfico

---

## 🔍 Cómo Funciona la Reconciliación

### Lógica de Cálculo

El saldo correcto se calcula siguiendo estas reglas:

1. **Saldo Inicial:** Se obtiene el saldo inicial más reciente del punto/moneda
2. **Movimientos:** Se procesan todos los movimientos en orden cronológico:
   - **INGRESO:** Se suma el valor absoluto del monto
   - **EGRESO:** Se resta el valor absoluto del monto
   - **AJUSTE:** Se suma o resta según el signo del monto
   - **SALDO_INICIAL:** Se ignora (ya incluido en paso 1)
3. **Exclusiones:** Se excluyen movimientos con descripción que contenga "bancos"
4. **Tolerancia:** Se considera inconsistencia si la diferencia es mayor a $0.01

### Ejemplo de Cálculo

```
Saldo Inicial:     $5,000.00
+ INGRESO:         $  585.00
- EGRESO:          $  595.00
- EGRESO:          $  500.00  (transferencia duplicada)
─────────────────────────────
Saldo Calculado:   $4,490.00

Saldo Registrado:  $4,194.35  ❌ Inconsistencia de -$295.65
```

---

## 📊 Ejemplo de Uso Completo

### Paso 1: Ver inconsistencias (sin modificar)

```bash
npx tsx scripts/reporte-inconsistencias-saldos.ts
```

**Salida esperada:**

```
╔════════════════════════════════════════════════════════════╗
║      REPORTE DE INCONSISTENCIAS DE SALDOS (SOLO LECTURA)  ║
╚════════════════════════════════════════════════════════════╝

📊 Analizando todos los saldos...

✅ Se encontraron 45 saldos para analizar

─────────────────────────────────────────────────────────────

Analizando... 45/45 (100%)

═════════════════════════════════════════════════════════════
                    RESUMEN DEL ANÁLISIS
═════════════════════════════════════════════════════════════

📊 Total de saldos analizados:  45
✅ Saldos correctos:            42
⚠️  Inconsistencias encontradas: 3

─────────────────────────────────────────────────────────────
INCONSISTENCIAS DETECTADAS:
─────────────────────────────────────────────────────────────

📍 PRINCIPAL - USD
   Saldo Registrado: 4194.35
   Saldo Calculado:  4694.35
   Diferencia:       -500.00 (faltante)
   Movimientos:      156

📍 AMAZONAS - COP
   Saldo Registrado: 1250000.00
   Saldo Calculado:  1200000.00
   Diferencia:       50000.00 (exceso)
   Movimientos:      89

📍 CENTRO - USD
   Saldo Registrado: 3500.50
   Saldo Calculado:  3500.00
   Diferencia:       0.50 (exceso)
   Movimientos:      45

─────────────────────────────────────────────────────────────
TOTALES:
─────────────────────────────────────────────────────────────

💰 Diferencia total acumulada: -49499.50

═════════════════════════════════════════════════════════════
⚠️  ACCIÓN RECOMENDADA:
═════════════════════════════════════════════════════════════

Para corregir estas inconsistencias, ejecuta:
  npx tsx scripts/reconciliar-todos-saldos.ts
```

### Paso 2: Corregir inconsistencias

```bash
npx tsx scripts/reconciliar-todos-saldos.ts
```

**Salida esperada:**

```
╔════════════════════════════════════════════════════════════╗
║   RECONCILIACIÓN MASIVA DE SALDOS - TODOS LOS PUNTOS      ║
╚════════════════════════════════════════════════════════════╝

📊 Obteniendo todos los saldos...

✅ Se encontraron 45 saldos para reconciliar

─────────────────────────────────────────────────────────────

⚠️  PRINCIPAL - USD: Inconsistencia detectada
   Saldo Registrado: 4194.35
   Saldo Calculado:  4694.35
   Diferencia:       -500.00
   Movimientos:      156
   ✅ Saldo corregido a: 4694.35

⚠️  AMAZONAS - COP: Inconsistencia detectada
   Saldo Registrado: 1250000.00
   Saldo Calculado:  1200000.00
   Diferencia:       50000.00
   Movimientos:      89
   ✅ Saldo corregido a: 1200000.00

⚠️  CENTRO - USD: Inconsistencia detectada
   Saldo Registrado: 3500.50
   Saldo Calculado:  3500.00
   Diferencia:       0.50
   Movimientos:      45
   ✅ Saldo corregido a: 3500.00

═════════════════════════════════════════════════════════════
                    RESUMEN DE RECONCILIACIÓN
═════════════════════════════════════════════════════════════

📊 Total de saldos procesados:  45
✅ Saldos corregidos:           3
✓  Saldos sin cambios:          42
❌ Errores:                     0

─────────────────────────────────────────────────────────────
SALDOS CORREGIDOS:
─────────────────────────────────────────────────────────────

📍 PRINCIPAL - USD
   Anterior:   4194.35
   Corregido:  4694.35
   Diferencia: -500.00
   Movimientos: 156

📍 AMAZONAS - COP
   Anterior:   1250000.00
   Corregido:  1200000.00
   Diferencia: 50000.00
   Movimientos: 89

📍 CENTRO - USD
   Anterior:   3500.50
   Corregido:  3500.00
   Diferencia: 0.50
   Movimientos: 45

═════════════════════════════════════════════════════════════
✅ RECONCILIACIÓN COMPLETADA EXITOSAMENTE
═════════════════════════════════════════════════════════════

✅ Script finalizado correctamente
```

---

## 🔧 Requisitos

- Node.js instalado
- Acceso a la base de datos (variable `DATABASE_URL` configurada en `.env`)
- Paquete `tsx` para ejecutar TypeScript directamente

---

## ⚠️ Notas Importantes

1. **Backup:** Aunque el script es seguro, se recomienda hacer backup antes de ejecutar correcciones masivas
2. **Horario:** Ejecutar en horario de bajo tráfico para evitar conflictos
3. **Logs:** Los scripts generan logs detallados de todas las operaciones
4. **Reversión:** Si necesitas revertir, puedes usar los valores "Anterior" del reporte
5. **Validación:** Después de ejecutar, verifica los saldos en el sistema

---

## 🐛 Solución de Problemas

### Error: "Cannot find module '@prisma/client'"

**Solución:**

```bash
npm install
npx prisma generate
```

### Error: "DATABASE_URL not found"

**Solución:**
Asegúrate de tener el archivo `.env` o `.env.local` con la variable `DATABASE_URL` configurada.

### Error: "Connection timeout"

**Solución:**
Verifica que tu máquina local tenga acceso a la base de datos en GCP. Puede que necesites:

- Configurar reglas de firewall
- Usar Cloud SQL Proxy
- Verificar credenciales

---

## 📞 Soporte

Si encuentras algún problema o inconsistencia después de ejecutar los scripts, contacta al equipo de desarrollo con:

- Logs completos del script
- Punto de atención y moneda afectados
- Captura de pantalla del reporte

---

## 📝 Historial de Cambios

### 2025-01-06

- ✅ Creación de scripts de reconciliación masiva
- ✅ Implementación de reporte de solo lectura
- ✅ Deshabilitación de auto-reconciliación en transferencias
- ✅ Corrección del problema de doble actualización de saldos
