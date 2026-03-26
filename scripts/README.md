# Scripts de Validación y Utilidades

## Scripts Principales

### `validar-flujo-cierre-dia.ts`
Script principal de validación del flujo de cierre de caja.

**Uso:**
```bash
# Ver todos los puntos
npm run validate:cierre-dia

# Validar un punto específico (hoy)
npm run validate:cierre-dia [PUNTO_ID]

# Validar punto en fecha específica
npm run validate:cierre-dia [PUNTO_ID] [FECHA]
```

**Ejemplos:**
```bash
npm run validate:cierre-dia
npm run validate:cierre-dia 3f13bb4e-181b-4026-b1bf-4ae00f1d1391
npm run validate:cierre-dia 3f13bb4e-181b-4026-b1bf-4ae00f1d1391 2026-03-25
```

---

## Subdirectorios

### `scripts/db/`
Utilidades para aplicar archivos SQL a la base de datos.

### `scripts/diagnose/`
Scripts de diagnóstico para identificar problemas en el sistema.

### `scripts/fix/`
Scripts de corrección para arreglar datos inconsistentes.

### `scripts/smoke/`
Pruebas básicas de conectividad y funcionamiento.

### `scripts/validate/`
Scripts de validación exhaustiva de diferentes componentes:
- Saldos
- Transferencias
- Exchanges
- Servicios externos
- Movimientos de saldo

---

## Notas

- Los scripts de corrección específicos ya fueron ejecutados y eliminados
- El sistema de cierre de caja está funcionando correctamente
- Para diagnósticos temporales, revisar el historial de git
