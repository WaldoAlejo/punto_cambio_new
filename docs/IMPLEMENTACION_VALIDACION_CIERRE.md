# Implementación de Validación de Cierre de Caja

## Resumen

Se ha implementado un sistema completo para validar que los cierres de caja coincidan con las aperturas del día siguiente, permitiendo detectar y corregir inconsistencias en los saldos.

## Componentes Implementados

### 1. Backend - Nuevos Endpoints

#### `GET /api/validacion-cierre/comparacion`
Compara el cierre de un día con la apertura del día siguiente para un punto específico.

**Parámetros:**
- `fecha`: Fecha del cierre (YYYY-MM-DD)
- `punto_id`: ID del punto de atención (opcional para admins)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "punto": { "id": "...", "nombre": "AMAZONAS" },
    "fecha_cierre": "2026-04-01",
    "fecha_apertura": "2026-04-02",
    "cuadre_cierre_id": "...",
    "cuadre_apertura_id": "...",
    "estado": "CERRADO",
    "comparacion_monedas": [
      {
        "moneda_id": "...",
        "codigo": "USD",
        "nombre": "Dólar Americano",
        "cierre_dia_anterior": 974.86,
        "apertura_dia_actual": 974.86,
        "diferencia": 0,
        "consistente": true
      }
    ],
    "resumen": {
      "total_monedas": 1,
      "consistentes": 1,
      "inconsistentes": 0,
      "faltantes": 0,
      "todas_consistentes": true,
      "hay_inconsistencias": false
    }
  }
}
```

#### `GET /api/validacion-cierre/reporte-inconsistencias`
Genera un reporte de todas las inconsistencias encontradas en un rango de fechas.

**Parámetros:**
- `desde`: Fecha inicial (YYYY-MM-DD)
- `hasta`: Fecha final (YYYY-MM-DD)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "total_inconsistencias": 5,
    "inconsistencias": [
      {
        "punto_id": "...",
        "punto_nombre": "AMAZONAS",
        "fecha_cierre": "2026-04-01",
        "fecha_apertura": "2026-04-02",
        "moneda_codigo": "USD",
        "cierre_dia_anterior": 974.86,
        "apertura_dia_actual": 900.00,
        "diferencia": -74.86
      }
    ]
  }
}
```

### 2. Frontend - Nuevas Páginas

#### Validación de Cierre de Caja (`/validacion-cierre`)
Página para comparar el cierre de un día con la apertura del siguiente.

**Características:**
- Selector de punto de atención (todos para admins, solo el asignado para operadores)
- Selector de fecha
- Tabla comparativa con:
  - Cierre del día anterior
  - Apertura del día actual
  - Diferencia calculada
  - Estado (consistente/inconsistente)
- Alertas visuales cuando hay inconsistencias
- Referencias de IDs del sistema (para admins)

#### Reporte de Inconsistencias (`/reporte-inconsistencias`)
Página para ver todas las inconsistencias históricas.

**Características:**
- Filtro por rango de fechas
- Agrupación por punto de atención
- Exportación a CSV
- Visualización de diferencias positivas/negativas

### 3. Scripts de Corrección

#### `scripts/cierre-automatico-cuadres-v2.ts`
Cierra automáticamente todos los cuadres de caja que quedaron abiertos.

#### `scripts/corregir-saldos-apertura.ts`
Corrige los saldos de apertura para que reflejen el cierre del día anterior.

#### `scripts/corregir-saldos-apertura-2abril.ts`
Corrige los saldos específicos para el 2 de abril según los valores proporcionados por los operadores.

## Acceso a las Nuevas Funcionalidades

### Menú de Navegación
Las nuevas páginas están disponibles en el menú lateral bajo la sección de Administración:

1. **Validación Cierre vs Apertura**: Para comparar cierre y apertura de días específicos
2. **Reporte de Inconsistencias**: Para ver el historial de inconsistencias

### Permisos
- **Administradores y Super Usuarios**: Acceso completo a todas las funcionalidades
- **Administrativos**: Acceso a validación y reportes
- **Operadores**: Solo pueden ver la validación de su punto asignado

## Flujo de Uso Recomendado

### Para Administradores

1. **Revisar inconsistencias diariamente:**
   - Ir a "Reporte de Inconsistencias"
   - Filtrar por el día anterior
   - Identificar puntos con problemas

2. **Validar cierre específico:**
   - Ir a "Validación Cierre vs Apertura"
   - Seleccionar el punto y fecha
   - Verificar que los valores coincidan
   - Si hay diferencias, investigar con el operador

3. **Corregir saldos:**
   - Usar los scripts de corrección cuando sea necesario
   - Documentar las correcciones realizadas

### Para Operadores

1. **Al iniciar el día:**
   - Verificar que el saldo de apertura coincida con el cierre del día anterior
   - Reportar inmediatamente cualquier discrepancia

2. **Al cerrar el día:**
   - Contar físicamente todo el efectivo
   - Ingresar el conteo exacto en el sistema
   - Verificar que no haya diferencias antes de confirmar

## Próximos Pasos Sugeridos

1. **Agregar notificaciones automáticas** cuando se detecten inconsistencias
2. **Crear un dashboard** con métricas de consistencia por punto
3. **Implementar bloqueos** que impidan operar si hay inconsistencias sin resolver
4. **Agregar auditoría** de quién realizó las correcciones y cuándo

## Notas Técnicas

### Base de Datos
Las tablas involucradas son:
- `AperturaCaja`: Guarda el conteo físico de apertura
- `CuadreCaja`: Guarda el saldo de apertura y cierre
- `DetalleCuadreCaja`: Guarda los detalles por moneda
- `Saldo`: Guarda el saldo actual de cada punto

### Flujo de Datos Correcto
1. Apertura: `conteo_fisico` → `saldo_apertura` (cuadre)
2. Durante el día: Movimientos actualizan `saldo_cierre` (teórico)
3. Cierre: Operador ingresa `conteo_fisico` → debe igualar `saldo_cierre`
4. Siguiente día: `conteo_fisico` (cierre anterior) → `saldo_apertura` (nuevo cuadre)
