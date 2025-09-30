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