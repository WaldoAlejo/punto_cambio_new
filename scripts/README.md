# 📁 Scripts del Sistema Punto Cambio

Este directorio contiene scripts de mantenimiento, validación y reparación para el sistema Punto Cambio.

---

## 🧹 LIMPIEZA Y MANTENIMIENTO

### `limpieza_completa_preservar_estructura.sql`
**Descripción:** Script SQL para limpiar completamente la base de datos manteniendo la estructura base.

**Preserva:**
- Usuarios (tabla `Usuario`)
- Puntos de Atención (tabla `PuntoAtencion`)
- Jornadas de trabajo (tabla `Jornada`)
- Monedas (tabla `Moneda`)

**Elimina:**
- Cambios de Divisas
- Transferencias
- Movimientos de Saldo
- Saldos actuales
- Servicios Externos (movimientos y saldos)
- Guías de Servientrega
- Recibos
- Cierres de Caja
- Historial de Saldos

**Uso:**
```bash
# Ejecutar en PostgreSQL
psql -h <host> -U postgres -d punto_cambio -f scripts/limpieza_completa_preservar_estructura.sql
```

⚠️ **ADVERTENCIA:** Este script es IRREVERSIBLE. Haz un backup antes de ejecutar.

---

## 🔧 REPARACIÓN

### `reconcile-all-points.ts`
**Descripción:** Reconcilia los saldos de todos los puntos calculando desde el último saldo inicial.

**Uso:**
```bash
npx tsx scripts/reconcile-all-points.ts
```

### `fix/normalize-saldos-breakdown.ts`
**Descripción:** Normaliza el desglose de saldos (billetes, monedas, bancos) para que sean consistentes.

### `fix/recalculate-all-saldos.ts`
**Descripción:** Recalcula todos los saldos basándose en los movimientos registrados.

---

## ✅ VALIDACIÓN

### `validate-all.ts`
**Descripción:** Ejecuta todas las validaciones disponibles y genera un reporte completo.

**Uso:**
```bash
npx tsx scripts/validate-all.ts
```

### Validaciones individuales en `validate/`:

| Script | Descripción |
|--------|-------------|
| `validate-saldos.ts` | Valida consistencia de saldos |
| `validate-transfers.ts` | Valida integridad de transferencias |
| `validate-exchanges.ts` | Valida cambios de divisas |
| `validate-servicios-externos.ts` | Valida servicios externos |
| `validate-movimiento-saldo.ts` | Valida movimientos de saldo |
| `validate-transfer-consistency.ts` | Valida consistencia de transferencias |
| `validate-saldo-reconciliation.ts` | Valida reconciliación de saldos |
| `validate-all-saldos-comprehensive.ts` | Validación exhaustiva de saldos |
| `check-banco-movements.ts` | Verifica movimientos bancarios |
| `check-movement-types.ts` | Verifica tipos de movimientos |
| `detect-duplicate-movimientos.ts` | Detecta movimientos duplicados |
| `inspect-saldos-buckets.ts` | Inspecciona buckets de saldos (CAJA/BANCOS) |
| `analizar-saldo-inicial-duplicados.ts` | Analiza saldos iniciales duplicados |

---

## 🩺 DIAGNÓSTICO

### `smoke/check-db.ts`
**Descripción:** Verificación básica de conexión a la base de datos y tablas principales.

**Uso:**
```bash
npx tsx scripts/smoke/check-db.ts
```

### `db/apply-sql-file.ts`
**Descripción:** Helper para aplicar archivos SQL a la base de datos.

**Uso:**
```bash
npx tsx scripts/db/apply-sql-file.ts ruta/al/archivo.sql
```

---

## 📝 ESTRUCTURA DE DIRECTORIOS

```
scripts/
├── README.md                           # Este archivo
├── limpieza_completa_preservar_estructura.sql  # Script de limpieza
├── reconcile-all-points.ts             # Reconciliación de saldos
├── validate-all.ts                     # Validación completa
│
├── db/                                 # Utilidades de base de datos
│   └── apply-sql-file.ts
│
├── diagnose/                           # Scripts de diagnóstico
│   └── (vacío - usar validate/ en su lugar)
│
├── fix/                                # Scripts de reparación
│   ├── normalize-saldos-breakdown.ts
│   └── recalculate-all-saldos.ts
│
├── smoke/                              # Pruebas básicas
│   └── check-db.ts
│
└── validate/                           # Validaciones
    ├── _shared.ts                      # Funciones compartidas
    ├── _validate-runner.ts             # Runner de validaciones
    ├── validate-saldos.ts
    ├── validate-transfers.ts
    ├── validate-exchanges.ts
    ├── validate-servicios-externos.ts
    ├── validate-movimiento-saldo.ts
    ├── validate-transfer-consistency.ts
    ├── validate-saldo-reconciliation.ts
    ├── validate-all-saldos-comprehensive.ts
    ├── check-banco-movements.ts
    ├── check-movement-types.ts
    ├── detect-duplicate-movimientos.ts
    ├── inspect-saldos-buckets.ts
    └── analizar-saldo-inicial-duplicados.ts
```

---

## 🚀 FLUJO DE USO RECOMENDADO

### Antes de ir a Producción:
```bash
# 1. Verificar conexión a BD
npx tsx scripts/smoke/check-db.ts

# 2. Ejecutar validaciones completas
npx tsx scripts/validate-all.ts

# 3. Si hay inconsistencias, reconciliar
npx tsx scripts/reconcile-all-points.ts
```

### Limpieza de datos de prueba:
```bash
# Ejecutar script SQL de limpieza
psql -h <host> -U postgres -d punto_cambio -f scripts/limpieza_completa_preservar_estructura.sql
```

### Mantenimiento mensual:
```bash
# Validación completa del sistema
npx tsx scripts/validate-all.ts
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Backup:** Siempre haz un backup antes de ejecutar scripts de modificación.

2. **Entorno:** Algunos scripts requieren variables de entorno configuradas (DATABASE_URL, etc.).

3. **Permisos:** Algunos scripts deben ejecutarse con permisos de administrador de base de datos.

4. **Logs:** Los scripts generan logs detallados. Revisar salida para detalles.

---

## 📞 SOPORTE

Para problemas con los scripts, contactar al equipo de desarrollo.
