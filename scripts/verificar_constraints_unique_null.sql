-- ============================================================
-- SCRIPT: Verificar Constraints UNIQUE con Campos NULL
-- Ejecutar en pgAdmin para conocer el impacto
-- ============================================================

-- Verificar valores NULL en campos UNIQUE opcionales
SELECT 
    'Usuario.correo' as campo, 
    COUNT(*) as total_registros,
    COUNT(*) FILTER (WHERE correo IS NULL) as valores_null,
    COUNT(*) FILTER (WHERE correo IS NOT NULL) as valores_con_datos
FROM "Usuario"

UNION ALL

SELECT 
    'CambioDivisa.numero_recibo',
    COUNT(*),
    COUNT(*) FILTER (WHERE numero_recibo IS NULL),
    COUNT(*) FILTER (WHERE numero_recibo IS NOT NULL)
FROM "CambioDivisa"

UNION ALL

SELECT 
    'CambioDivisa.numero_recibo_abono',
    COUNT(*),
    COUNT(*) FILTER (WHERE numero_recibo_abono IS NULL),
    COUNT(*) FILTER (WHERE numero_recibo_abono IS NOT NULL)
FROM "CambioDivisa"

UNION ALL

SELECT 
    'CambioDivisa.numero_recibo_completar',
    COUNT(*),
    COUNT(*) FILTER (WHERE numero_recibo_completar IS NULL),
    COUNT(*) FILTER (WHERE numero_recibo_completar IS NOT NULL)
FROM "CambioDivisa"

UNION ALL

SELECT 
    'Recibo.numero_recibo',
    COUNT(*),
    COUNT(*) FILTER (WHERE numero_recibo IS NULL),
    COUNT(*) FILTER (WHERE numero_recibo IS NOT NULL)
FROM "Recibo"

ORDER BY campo;
