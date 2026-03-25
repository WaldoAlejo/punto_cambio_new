-- ============================================================
-- SCRIPT DE VALIDACIÓN PRE-DESPLIEGUE - PRODUCCIÓN
-- Ejecutar ANTES de aplicar cualquier fix
-- Guardar resultados para comparación post-deploy
-- ============================================================

\echo '============================================================'
\echo 'INICIANDO VALIDACIÓN PRE-DESPLIEGUE'
\echo 'Fecha y hora:' :'NOW'
\echo '============================================================'

-- ============================================================
-- 1. ESTADÍSTICAS GENERALES
-- ============================================================
\echo '\n### 1. ESTADÍSTICAS GENERALES ###'

SELECT 
  'Total Cambios Divisa (hoy)' as metrica,
  COUNT(*)::text as valor
FROM "CambioDivisa"
WHERE DATE(fecha) = CURRENT_DATE

UNION ALL

SELECT 
  'Total Transferencias (hoy)' as metrica,
  COUNT(*)::text as valor
FROM "Transferencia"
WHERE DATE(fecha) = CURRENT_DATE

UNION ALL

SELECT 
  'Total Movimientos Saldo (hoy)' as metrica,
  COUNT(*)::text as valor
FROM "MovimientoSaldo"
WHERE DATE(fecha) = CURRENT_DATE

UNION ALL

SELECT 
  'Total Asignaciones Saldo (hoy)' as metrica,
  COUNT(*)::text as valor
FROM "SaldoInicial"
WHERE DATE(created_at) = CURRENT_DATE;

-- ============================================================
-- 2. DETECTAR CAMBIOS DE DIVISA DUPLICADOS
-- ============================================================
\echo '\n### 2. CAMBIOS DE DIVISA DUPLICADOS (Últimos 7 días) ###'

WITH cambios_potencialmente_duplicados AS (
  SELECT 
    usuario_id,
    punto_atencion_id,
    moneda_origen_id,
    moneda_destino_id,
    monto_origen::numeric(15,2),
    monto_destino::numeric(15,2),
    DATE_TRUNC('second', fecha) as fecha_segundo,
    COUNT(*) as cantidad,
    ARRAY_AGG(id ORDER BY fecha) as ids,
    ARRAY_AGG(numero_recibo ORDER BY fecha) as recibos
  FROM "CambioDivisa"
  WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY 1,2,3,4,5,6,7
  HAVING COUNT(*) > 1
)
SELECT 
  cantidad as veces_repetido,
  fecha_segundo,
  monto_origen,
  monto_destino,
  ids,
  recibos
FROM cambios_potencialmente_duplicados
ORDER BY cantidad DESC, fecha_segundo DESC
LIMIT 20;

-- ============================================================
-- 3. DETECTAR MOVIMIENTOS DE SALDO DUPLICADOS
-- ============================================================
\echo '\n### 3. MOVIMIENTOS DE SALDO DUPLICADOS (Últimos 7 días) ###'

WITH movimientos_duplicados AS (
  SELECT 
    punto_atencion_id,
    moneda_id,
    tipo_movimiento,
    tipo_referencia,
    referencia_id,
    monto::numeric(15,2),
    DATE_TRUNC('second', fecha) as fecha_segundo,
    COUNT(*) as cantidad,
    ARRAY_AGG(id ORDER BY fecha) as ids
  FROM "MovimientoSaldo"
  WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
  AND referencia_id IS NOT NULL
  GROUP BY 1,2,3,4,5,6,7
  HAVING COUNT(*) > 1
)
SELECT 
  cantidad as veces_repetido,
  tipo_referencia,
  referencia_id,
  tipo_movimiento,
  monto,
  fecha_segundo,
  ids
FROM movimientos_duplicados
ORDER BY cantidad DESC, fecha_segundo DESC
LIMIT 20;

-- ============================================================
-- 4. DETECTAR TRANSFERENCIAS DUPLICADAS
-- ============================================================
\echo '\n### 4. TRANSFERENCIAS DUPLICADAS (Últimos 7 días) ###'

WITH transferencias_duplicadas AS (
  SELECT 
    solicitado_por,
    COALESCE(origen_id, 'NULL') as origen_id,
    destino_id,
    moneda_id,
    monto::numeric(15,2),
    DATE_TRUNC('second', fecha) as fecha_segundo,
    COUNT(*) as cantidad,
    ARRAY_AGG(id ORDER BY fecha) as ids
  FROM "Transferencia"
  WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY 1,2,3,4,5,6
  HAVING COUNT(*) > 1
)
SELECT 
  cantidad as veces_repetido,
  fecha_segundo,
  monto,
  ids
FROM transferencias_duplicadas
ORDER BY cantidad DESC, fecha_segundo DESC
LIMIT 20;

-- ============================================================
-- 5. VERIFICAR CONSISTENCIA DE SALDOS
-- ============================================================
\echo '\n### 5. SALDOS INCONSISTENTES ###'

SELECT 
  s.id,
  s.punto_atencion_id,
  p.nombre as punto_nombre,
  m.codigo as moneda,
  s.cantidad::numeric(15,2) as cantidad_registrada,
  (COALESCE(s.billetes,0) + COALESCE(s.monedas_fisicas,0) + COALESCE(s.bancos,0))::numeric(15,2) as suma_componentes,
  (s.cantidad - (COALESCE(s.billetes,0) + COALESCE(s.monedas_fisicas,0) + COALESCE(s.bancos,0)))::numeric(15,2) as diferencia
FROM "Saldo" s
JOIN "PuntoAtencion" p ON p.id = s.punto_atencion_id
JOIN "Moneda" m ON m.id = s.moneda_id
WHERE ABS(s.cantidad - (COALESCE(s.billetes,0) + COALESCE(s.monedas_fisicas,0) + COALESCE(s.bancos,0))) > 0.01
ORDER BY ABS(s.cantidad - (COALESCE(s.billetes,0) + COALESCE(s.monedas_fisicas,0) + COALESCE(s.bancos,0))) DESC
LIMIT 20;

-- ============================================================
-- 6. ASIGNACIONES DE SALDO RECIENTES (PARA VERIFICAR SUMA)
-- ============================================================
\echo '\n### 6. ASIGNACIONES DE SALDO RECIENTES (Últimas 24h) ###'

SELECT 
  si.id as asignacion_id,
  si.punto_atencion_id,
  p.nombre as punto_nombre,
  m.codigo as moneda,
  si.cantidad_inicial::numeric(15,2) as monto_asignado,
  s.cantidad::numeric(15,2) as saldo_actual,
  (s.cantidad - si.cantidad_inicial)::numeric(15,2) as diferencia,
  u.nombre as asignado_por,
  si.created_at,
  CASE 
    WHEN s.cantidad < si.cantidad_inicial THEN '⚠️ SALDO MENOR QUE ASIGNACIÓN'
    WHEN s.cantidad = si.cantidad_inicial THEN '✅ IGUAL (podría ser nuevo)'
    ELSE '✅ MAYOR (sumó correctamente)'
  END as estado
FROM "SaldoInicial" si
JOIN "Saldo" s ON s.punto_atencion_id = si.punto_atencion_id AND s.moneda_id = si.moneda_id
JOIN "PuntoAtencion" p ON p.id = si.punto_atencion_id
JOIN "Moneda" m ON m.id = si.moneda_id
JOIN "Usuario" u ON u.id = si.asignado_por
WHERE si.created_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY si.created_at DESC
LIMIT 30;

-- ============================================================
-- 7. VERIFICAR ÍNDICES EXISTENTES
-- ============================================================
\echo '\n### 7. ÍNDICES ÚNICOS EXISTENTES ###'

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexdef LIKE '%UNIQUE%'
AND (
  indexname ILIKE '%movimiento%'
  OR indexname ILIKE '%cambio%'
  OR indexname ILIKE '%transfer%'
  OR indexname ILIKE '%idempotency%'
)
ORDER BY indexname;

-- ============================================================
-- 8. RESUMEN DE PROBLEMAS ENCONTRADOS
-- ============================================================
\echo '\n### 8. RESUMEN DE PROBLEMAS ###'

WITH 
cambios_dup AS (
  SELECT COUNT(*) as total
  FROM (
    SELECT 1
    FROM "CambioDivisa"
    WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY usuario_id, punto_atencion_id, moneda_origen_id, moneda_destino_id, monto_origen, monto_destino, DATE_TRUNC('second', fecha)
    HAVING COUNT(*) > 1
  ) t
),
movimientos_dup AS (
  SELECT COUNT(*) as total
  FROM (
    SELECT 1
    FROM "MovimientoSaldo"
    WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
    AND referencia_id IS NOT NULL
    GROUP BY punto_atencion_id, moneda_id, tipo_movimiento, tipo_referencia, referencia_id, monto, DATE_TRUNC('second', fecha)
    HAVING COUNT(*) > 1
  ) t
),
transferencias_dup AS (
  SELECT COUNT(*) as total
  FROM (
    SELECT 1
    FROM "Transferencia"
    WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY solicitado_por, origen_id, destino_id, moneda_id, monto, DATE_TRUNC('second', fecha)
    HAVING COUNT(*) > 1
  ) t
),
saldos_inconsistentes AS (
  SELECT COUNT(*) as total
  FROM "Saldo"
  WHERE ABS(cantidad - (COALESCE(billetes,0) + COALESCE(monedas_fisicas,0) + COALESCE(bancos,0))) > 0.01
)
SELECT 
  'Duplicados en Cambios (7d)' as problema,
  total as cantidad,
  CASE WHEN total = 0 THEN '✅ OK' ELSE '❌ REQUIERE ATENCIÓN' END as estado
FROM cambios_dup

UNION ALL

SELECT 
  'Duplicados en Movimientos (7d)' as problema,
  total as cantidad,
  CASE WHEN total = 0 THEN '✅ OK' ELSE '❌ REQUIERE ATENCIÓN' END as estado
FROM movimientos_dup

UNION ALL

SELECT 
  'Duplicados en Transferencias (7d)' as problema,
  total as cantidad,
  CASE WHEN total = 0 THEN '✅ OK' ELSE '❌ REQUIERE ATENCIÓN' END as estado
FROM transferencias_dup

UNION ALL

SELECT 
  'Saldos Inconsistentes' as problema,
  total as cantidad,
  CASE WHEN total = 0 THEN '✅ OK' ELSE '⚠️ REVISAR' END as estado
FROM saldos_inconsistentes;

\echo '\n============================================================'
\echo 'VALIDACIÓN COMPLETADA'
\echo '============================================================'
\echo 'GUARDAR ESTOS RESULTADOS PARA COMPARACIÓN POST-DEPLOY'
\echo '============================================================'
