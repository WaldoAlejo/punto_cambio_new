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