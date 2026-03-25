-- ============================================================
-- MIGRACION: Verificar CambioDivisa recibos
-- ============================================================

-- Verificar cambios completados SIN numero de recibo
-- Estos son los criticos - todos los cambios completados deberian tener recibo
SELECT 
    id,
    estado,
    numero_recibo,
    created_at
FROM "CambioDivisa"
WHERE estado = 'COMPLETADO' 
  AND numero_recibo IS NULL;

-- Contar cambios por estado con/sin recibo
SELECT 
    estado,
    COUNT(*) FILTER (WHERE numero_recibo IS NULL) as sin_recibo,
    COUNT(*) FILTER (WHERE numero_recibo IS NOT NULL) as con_recibo,
    COUNT(*) as total
FROM "CambioDivisa"
GROUP BY estado;

-- Verificar cambios parciales (abonos) sin recibo de abono
SELECT 
    id,
    abono_inicial_monto,
    numero_recibo_abono,
    estado
FROM "CambioDivisa"
WHERE abono_inicial_monto IS NOT NULL 
  AND numero_recibo_abono IS NULL;
