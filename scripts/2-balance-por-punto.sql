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