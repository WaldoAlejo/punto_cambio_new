-- Script para calcular el balance total de todos los movimientos
-- Suma y resta: cambios de divisas, servicios externos y transferencias

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

-- 2. BALANCE DETALLADO POR PUNTO DE ATENCIÓN
SELECT 'BALANCE POR PUNTO DE ATENCIÓN' as titulo;

WITH balance_por_punto AS (
    -- Cambios de divisas por punto (origen)
    SELECT 
        pa.nombre as punto_atencion,
        'Cambios divisas (origen)' as tipo,
        COUNT(cd.id) as cantidad,
        SUM(cd.monto_origen) as total_monto,
        cd.moneda_origen_id as moneda_id
    FROM "CambioDivisa" cd
    JOIN "PuntoAtencion" pa ON cd.punto_atencion_id = pa.id
    WHERE cd.estado = 'COMPLETADO'
    GROUP BY pa.nombre, cd.moneda_origen_id
    
    UNION ALL
    
    -- Cambios de divisas por punto (destino)
    SELECT 
        pa.nombre as punto_atencion,
        'Cambios divisas (destino)' as tipo,
        COUNT(cd.id) as cantidad,
        SUM(cd.monto_destino) as total_monto,
        cd.moneda_destino_id as moneda_id
    FROM "CambioDivisa" cd
    JOIN "PuntoAtencion" pa ON cd.punto_atencion_id = pa.id
    WHERE cd.estado = 'COMPLETADO'
    GROUP BY pa.nombre, cd.moneda_destino_id
    
    UNION ALL
    
    -- Servicios externos por punto
    SELECT 
        pa.nombre as punto_atencion,
        CONCAT('Servicios externos - ', sem.tipo_movimiento) as tipo,
        COUNT(sem.id) as cantidad,
        SUM(sem.monto) as total_monto,
        sem.moneda_id
    FROM "ServicioExternoMovimiento" sem
    JOIN "PuntoAtencion" pa ON sem.punto_atencion_id = pa.id
    GROUP BY pa.nombre, sem.tipo_movimiento, sem.moneda_id
    
    UNION ALL
    
    -- Transferencias salida (origen)
    SELECT 
        pa.nombre as punto_atencion,
        'Transferencias salida' as tipo,
        COUNT(t.id) as cantidad,
        -SUM(t.monto) as total_monto, -- Negativo porque es salida
        t.moneda_id
    FROM "Transferencia" t
    JOIN "PuntoAtencion" pa ON t.origen_id = pa.id
    WHERE t.estado = 'APROBADO'
    GROUP BY pa.nombre, t.moneda_id
    
    UNION ALL
    
    -- Transferencias entrada (destino)
    SELECT 
        pa.nombre as punto_atencion,
        'Transferencias entrada' as tipo,
        COUNT(t.id) as cantidad,
        SUM(t.monto) as total_monto, -- Positivo porque es entrada
        t.moneda_id
    FROM "Transferencia" t
    JOIN "PuntoAtencion" pa ON t.destino_id = pa.id
    WHERE t.estado = 'APROBADO'
    GROUP BY pa.nombre, t.moneda_id
)
SELECT 
    bp.punto_atencion,
    bp.tipo,
    bp.cantidad,
    bp.total_monto,
    m.codigo as moneda,
    m.nombre as nombre_moneda
FROM balance_por_punto bp
JOIN "Moneda" m ON bp.moneda_id = m.id
ORDER BY bp.punto_atencion, m.codigo, bp.tipo;

-- 3. BALANCE CONSOLIDADO POR MONEDA
SELECT 'BALANCE CONSOLIDADO POR MONEDA' as titulo;

WITH movimientos_consolidados AS (
    -- Cambios de divisas - moneda origen (salida)
    SELECT 
        cd.moneda_origen_id as moneda_id,
        'Cambio divisa origen' as concepto,
        -SUM(cd.monto_origen) as monto -- Negativo porque sale esta moneda
    FROM "CambioDivisa" cd
    WHERE cd.estado = 'COMPLETADO'
    GROUP BY cd.moneda_origen_id
    
    UNION ALL
    
    -- Cambios de divisas - moneda destino (entrada)
    SELECT 
        cd.moneda_destino_id as moneda_id,
        'Cambio divisa destino' as concepto,
        SUM(cd.monto_destino) as monto -- Positivo porque entra esta moneda
    FROM "CambioDivisa" cd
    WHERE cd.estado = 'COMPLETADO'
    GROUP BY cd.moneda_destino_id
    
    UNION ALL
    
    -- Servicios externos - ingresos
    SELECT 
        sem.moneda_id,
        CONCAT('Servicio externo - ', sem.servicio) as concepto,
        CASE 
            WHEN sem.tipo_movimiento = 'INGRESO' THEN SUM(sem.monto)
            WHEN sem.tipo_movimiento = 'EGRESO' THEN -SUM(sem.monto)
        END as monto
    FROM "ServicioExternoMovimiento" sem
    GROUP BY sem.moneda_id, sem.servicio, sem.tipo_movimiento
    
    UNION ALL
    
    -- Transferencias (no afectan el balance total, solo redistribuyen)
    -- Pero las incluimos para completitud
    SELECT 
        t.moneda_id,
        'Transferencias netas' as concepto,
        0 as monto -- Las transferencias no cambian el balance total
    FROM "Transferencia" t
    WHERE t.estado = 'APROBADO'
    GROUP BY t.moneda_id
)
SELECT 
    m.codigo as moneda,
    m.nombre as nombre_moneda,
    mc.concepto,
    mc.monto,
    SUM(mc.monto) OVER (PARTITION BY mc.moneda_id) as balance_total_moneda
FROM movimientos_consolidados mc
JOIN "Moneda" m ON mc.moneda_id = m.id
WHERE mc.monto != 0
ORDER BY m.codigo, mc.concepto;

-- 4. RESUMEN FINAL - BALANCE TOTAL POR MONEDA
SELECT 'BALANCE FINAL POR MONEDA' as titulo;

WITH balance_final AS (
    -- Cambios de divisas - salidas
    SELECT 
        moneda_origen_id as moneda_id,
        -SUM(monto_origen) as balance
    FROM "CambioDivisa"
    WHERE estado = 'COMPLETADO'
    GROUP BY moneda_origen_id
    
    UNION ALL
    
    -- Cambios de divisas - entradas
    SELECT 
        moneda_destino_id as moneda_id,
        SUM(monto_destino) as balance
    FROM "CambioDivisa"
    WHERE estado = 'COMPLETADO'
    GROUP BY moneda_destino_id
    
    UNION ALL
    
    -- Servicios externos
    SELECT 
        moneda_id,
        SUM(CASE 
            WHEN tipo_movimiento = 'INGRESO' THEN monto
            WHEN tipo_movimiento = 'EGRESO' THEN -monto
            ELSE 0
        END) as balance
    FROM "ServicioExternoMovimiento"
    GROUP BY moneda_id
)
SELECT 
    m.codigo as moneda,
    m.nombre as nombre_moneda,
    SUM(bf.balance) as balance_total,
    CASE 
        WHEN SUM(bf.balance) > 0 THEN 'POSITIVO (Ganancia)'
        WHEN SUM(bf.balance) < 0 THEN 'NEGATIVO (Pérdida)'
        ELSE 'NEUTRO'
    END as estado_balance
FROM balance_final bf
JOIN "Moneda" m ON bf.moneda_id = m.id
GROUP BY m.id, m.codigo, m.nombre
ORDER BY SUM(bf.balance) DESC;

-- 5. ESTADÍSTICAS ADICIONALES
SELECT 'ESTADÍSTICAS ADICIONALES' as titulo;

SELECT 
    'Total cambios completados' as descripcion,
    COUNT(*) as valor,
    'transacciones' as unidad
FROM "CambioDivisa"
WHERE estado = 'COMPLETADO'

UNION ALL

SELECT 
    'Total servicios externos',
    COUNT(*),
    'movimientos'
FROM "ServicioExternoMovimiento"

UNION ALL

SELECT 
    'Total transferencias aprobadas',
    COUNT(*),
    'transferencias'
FROM "Transferencia"
WHERE estado = 'APROBADO'

UNION ALL

SELECT 
    'Puntos de atención activos',
    COUNT(*),
    'puntos'
FROM "PuntoAtencion"
WHERE activo = true

UNION ALL

SELECT 
    'Monedas configuradas',
    COUNT(*),
    'monedas'
FROM "Moneda"
WHERE activo = true;