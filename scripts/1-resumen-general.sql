-- 1. RESUMEN GENERAL DE MOVIMIENTOS
SELECT 'RESUMEN GENERAL DE MOVIMIENTOS' as titulo;

-- Contar todos los tipos de movimientos
SELECT 
    'Cambios de divisas' as tipo_movimiento,
    COUNT(*) as cantidad,
    SUM(monto_origen) as total_monto_origen,
    SUM(monto_destino) as total_monto_destino
FROM "CambioDivisa"
WHERE estado = 'COMPLETADO'

UNION ALL

SELECT 
    'Servicios externos' as tipo_movimiento,
    COUNT(*) as cantidad,
    SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN monto ELSE 0 END) as total_ingresos,
    SUM(CASE WHEN tipo_movimiento = 'EGRESO' THEN monto ELSE 0 END) as total_egresos
FROM "ServicioExternoMovimiento"

UNION ALL

SELECT 
    'Transferencias' as tipo_movimiento,
    COUNT(*) as cantidad,
    SUM(monto) as total_monto,
    0 as columna_extra
FROM "Transferencia"
WHERE estado = 'APROBADO';