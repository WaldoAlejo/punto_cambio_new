# Analisis de Constraints UNIQUE con Campos Opcionales

## Resumen Ejecutivo

Se identificaron **5 campos** con constraint `@unique` que son opcionales (`String?`). En PostgreSQL, esto permite multiples valores NULL.

## Campos Identificados

| # | Modelo | Campo | Tipo | Constraint |
|---|--------|-------|------|------------|
| 1 | Usuario | correo | String? | @unique |
| 2 | CambioDivisa | numero_recibo | String? | @unique |
| 3 | CambioDivisa | numero_recibo_abono | String? | @unique |
| 4 | CambioDivisa | numero_recibo_completar | String? | @unique |
| 5 | Recibo | numero_recibo | String? | @unique |

## Problema Tecnico

### Comportamiento de PostgreSQL

En PostgreSQL, los constraints UNIQUE permiten **multiples valores NULL**:

```sql
-- Esto es VALIDO en PostgreSQL:
INSERT INTO Usuario (correo) VALUES (NULL);  -- Fila 1
INSERT INTO Usuario (correo) VALUES (NULL);  -- Fila 2 (tambien valido)
```

### Impacto por Campo

#### 1. Usuario.correo
- **Uso**: Email opcional del usuario
- **Riesgo**: Bajo - Es valido tener multiples usuarios sin email
- **Decision**: **MANTENER** - El diseno actual permite usuarios sin email

#### 2-4. CambioDivisa (numero_recibo*)
- **Uso**: Numeros de recibo para cambios y abonos
- **Riesgo**: Medio - Un cambio deberia tener siempre un recibo generado
- **Decision**: **REVISAR** - Los cambios completados deben tener recibo

#### 5. Recibo.numero_recibo
- **Uso**: Numero unico del recibo
- **Riesgo**: **CRITICO** - Todos los recibos deben tener numero
- **Decision**: **CORREGIR** - Deberia ser `String` (no opcional)

## Soluciones Propuestas

### Opcion A: Mantener (Recomendado para campos realmente opcionales)

Para campos donde es valido no tener valor (como correo opcional).

### Opcion B: Hacer campo obligatorio (Para campos criticos)

Cambiar `String?` a `String`:

```prisma
// Antes
numero_recibo String? @unique

// Despues
numero_recibo String @unique
```

**Ventajas:**
- Integridad de datos garantizada
- Sin ambiguedades

**Desventajas:**
- Requiere generar valores para registros existentes

## Recomendaciones Especificas

| Campo | Recomendacion | Accion |
|-------|---------------|--------|
| Usuario.correo | Mantener como esta | Ninguna |
| CambioDivisa.numero_recibo | Hacer obligatorio | Migracion necesaria |
| CambioDivisa.numero_recibo_abono | Hacer obligatorio | Migracion necesaria |
| CambioDivisa.numero_recibo_completar | Hacer obligatorio | Migracion necesaria |
| Recibo.numero_recibo | Hacer obligatorio | **Prioridad Alta** |

## Script de Verificacion

```sql
-- Ejecutar: scripts/verificar_constraints_unique_null.sql
```

## Proximos Pasos

1. Ejecutar script de verificacion para conocer el impacto
2. Decidir cuales campos hacer obligatorios
3. Crear migracion para corregir datos existentes
4. Actualizar schema.prisma
5. Aplicar cambios en produccion
