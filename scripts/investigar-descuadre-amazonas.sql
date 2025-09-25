-- =====================================================
-- INVESTIGACIÓN DESCUADRE AMAZONAS - $13.12 USD
-- =====================================================

-- 1. INFORMACIÓN BÁSICA DEL PUNTO AMAZONAS
SELECT 
    id,
    nombre,
    ciudad,
    estado,
    created_at
FROM PuntoAtencion 
WHERE UPPER(nombre) LIKE '%AMAZONAS%';

-- 2. SALDO ACTUAL EN USD PARA AMAZONAS
SELECT 
    pa.nombre as punto,
    m.codigo as moneda,
    s.saldo_actual,
    s.saldo_inicial,
    s.diferencia,
    s.updated_at as ultima_actualizacion
FROM Saldo s
JOIN PuntoAtencion pa ON s.punto_atencion_id = pa.id
JOIN Moneda m ON s.moneda_id = m.id
WHERE UPPER(pa.nombre) LIKE '%AMAZONAS%' 
    AND m.codigo = 'USD'
ORDER BY s.updated_at DESC;

-- 3. MOVIMIENTOS DE SALDO RECIENTES EN USD (ÚLTIMAS 24 HORAS)
SELECT 
    ms.id,
    pa.nombre as punto,
    m.codigo as moneda,
    ms.tipo_movimiento,
    ms.monto,
    ms.saldo_anterior,
    ms.saldo_nuevo,
    ms.descripcion,
    ms.tipo_referencia,
    ms.referencia_id,
    ms.created_at,
    u.nombre as usuario
FROM MovimientoSaldo ms
JOIN PuntoAtencion pa ON ms.punto_atencion_id = pa.id
JOIN Moneda m ON ms.moneda_id = m.id
LEFT JOIN Usuario u ON ms.usuario_id = u.id
WHERE UPPER(pa.nombre) LIKE '%AMAZONAS%' 
    AND m.codigo = 'USD'
    AND ms.created_at >= NOW() - INTERVAL 24 HOUR
ORDER BY ms.created_at DESC;

-- 4. CAMBIOS DE DIVISAS COMPLETADOS HOY EN AMAZONAS (USD INVOLUCRADO)
SELECT 
    cd.id,
    cd.numero_operacion,
    pa.nombre as punto,
    mo.codigo as moneda_origen,
    cd.monto_origen,
    md.codigo as moneda_destino,
    cd.monto_destino,
    cd.tasa_cambio,
    cd.estado,
    cd.created_at,
    cd.completed_at,
    u.nombre as usuario
FROM CambioDivisa cd
JOIN PuntoAtencion pa ON cd.punto_atencion_id = pa.id
JOIN Moneda mo ON cd.moneda_origen_id = mo.id
JOIN Moneda md ON cd.moneda_destino_id = md.id
LEFT JOIN Usuario u ON cd.usuario_id = u.id
WHERE UPPER(pa.nombre) LIKE '%AMAZONAS%'
    AND (mo.codigo = 'USD' OR md.codigo = 'USD')
    AND cd.estado = 'COMPLETADO'
    AND DATE(cd.completed_at) = CURDATE()
ORDER BY cd.completed_at DESC;

-- 5. SERVICIOS EXTERNOS HOY EN AMAZONAS (USD)
SELECT 
    sem.id,
    se.nombre as servicio,
    pa.nombre as punto,
    m.codigo as moneda,
    sem.tipo_movimiento,
    sem.monto,
    sem.descripcion,
    sem.numero_referencia,
    sem.created_at,
    u.nombre as usuario
FROM ServicioExternoMovimiento sem
JOIN ServicioExterno se ON sem.servicio_externo_id = se.id
JOIN PuntoAtencion pa ON sem.punto_atencion_id = pa.id
JOIN Moneda m ON sem.moneda_id = m.id
LEFT JOIN Usuario u ON sem.usuario_id = u.id
WHERE UPPER(pa.nombre) LIKE '%AMAZONAS%'
    AND m.codigo = 'USD'
    AND DATE(sem.created_at) = CURDATE()
ORDER BY sem.created_at DESC;

-- 6. TRANSFERENCIAS HOY DONDE AMAZONAS ES ORIGEN O DESTINO (USD)
SELECT 
    t.id,
    t.numero_transferencia,
    po.nombre as punto_origen,
    pd.nombre as punto_destino,
    m.codigo as moneda,
    t.monto,
    t.estado,
    t.motivo,
    t.created_at,
    t.approved_at,
    uc.nombre as usuario_creador,
    ua.nombre as usuario_aprobador
FROM Transferencia t
JOIN PuntoAtencion po ON t.punto_origen_id = po.id
JOIN PuntoAtencion pd ON t.punto_destino_id = pd.id
JOIN Moneda m ON t.moneda_id = m.id
LEFT JOIN Usuario uc ON t.usuario_creador_id = uc.id
LEFT JOIN Usuario ua ON t.usuario_aprobador_id = ua.id
WHERE (UPPER(po.nombre) LIKE '%AMAZONAS%' OR UPPER(pd.nombre) LIKE '%AMAZONAS%')
    AND m.codigo = 'USD'
    AND t.estado = 'APROBADA'
    AND DATE(t.approved_at) = CURDATE()
ORDER BY t.approved_at DESC;

-- 7. HISTORIAL DE SALDO USD AMAZONAS (ÚLTIMOS CAMBIOS)
SELECT 
    hs.id,
    pa.nombre as punto,
    m.codigo as moneda,
    hs.saldo_anterior,
    hs.saldo_nuevo,
    hs.diferencia,
    hs.motivo,
    hs.created_at,
    u.nombre as usuario
FROM HistorialSaldo hs
JOIN PuntoAtencion pa ON hs.punto_atencion_id = pa.id
JOIN Moneda m ON hs.moneda_id = m.id
LEFT JOIN Usuario u ON hs.usuario_id = u.id
WHERE UPPER(pa.nombre) LIKE '%AMAZONAS%'
    AND m.codigo = 'USD'
ORDER BY hs.created_at DESC
LIMIT 20;

-- 8. VERIFICACIÓN DE INTEGRIDAD: SUMA DE MOVIMIENTOS VS SALDO ACTUAL
SELECT 
    'Verificación de Integridad' as tipo,
    pa.nombre as punto,
    m.codigo as moneda,
    s.saldo_inicial,
    COALESCE(SUM(ms.monto), 0) as suma_movimientos,
    s.saldo_actual,
    (s.saldo_inicial + COALESCE(SUM(ms.monto), 0)) as saldo_calculado,
    (s.saldo_actual - (s.saldo_inicial + COALESCE(SUM(ms.monto), 0))) as diferencia_encontrada
FROM Saldo s
JOIN PuntoAtencion pa ON s.punto_atencion_id = pa.id
JOIN Moneda m ON s.moneda_id = m.id
LEFT JOIN MovimientoSaldo ms ON ms.punto_atencion_id = pa.id AND ms.moneda_id = m.id
WHERE UPPER(pa.nombre) LIKE '%AMAZONAS%'
    AND m.codigo = 'USD'
GROUP BY s.id, pa.nombre, m.codigo, s.saldo_inicial, s.saldo_actual;

-- 9. MOVIMIENTOS SOSPECHOSOS: MONTOS EXACTOS O CERCANOS A $13.12
SELECT 
    'Movimientos cercanos a 13.12' as tipo,
    ms.id,
    pa.nombre as punto,
    m.codigo as moneda,
    ms.tipo_movimiento,
    ms.monto,
    ms.descripcion,
    ms.tipo_referencia,
    ms.referencia_id,
    ms.created_at
FROM MovimientoSaldo ms
JOIN PuntoAtencion pa ON ms.punto_atencion_id = pa.id
JOIN Moneda m ON ms.moneda_id = m.id
WHERE UPPER(pa.nombre) LIKE '%AMAZONAS%'
    AND m.codigo = 'USD'
    AND (
        ABS(ms.monto - 13.12) < 0.01 OR
        ABS(ms.monto - (-13.12)) < 0.01 OR
        ABS(ms.monto) BETWEEN 13.00 AND 13.25
    )
ORDER BY ms.created_at DESC;

-- 10. CAMBIOS DE DIVISAS CON MONTOS SOSPECHOSOS
SELECT 
    'Cambios con montos sospechosos' as tipo,
    cd.id,
    cd.numero_operacion,
    pa.nombre as punto,
    mo.codigo as moneda_origen,
    cd.monto_origen,
    md.codigo as moneda_destino,
    cd.monto_destino,
    cd.tasa_cambio,
    cd.created_at,
    cd.completed_at
FROM CambioDivisa cd
JOIN PuntoAtencion pa ON cd.punto_atencion_id = pa.id
JOIN Moneda mo ON cd.moneda_origen_id = mo.id
JOIN Moneda md ON cd.moneda_destino_id = md.id
WHERE UPPER(pa.nombre) LIKE '%AMAZONAS%'
    AND cd.estado = 'COMPLETADO'
    AND (
        (mo.codigo = 'USD' AND (ABS(cd.monto_origen - 13.12) < 0.01 OR ABS(cd.monto_origen) BETWEEN 13.00 AND 13.25)) OR
        (md.codigo = 'USD' AND (ABS(cd.monto_destino - 13.12) < 0.01 OR ABS(cd.monto_destino) BETWEEN 13.00 AND 13.25))
    )
ORDER BY cd.completed_at DESC;

-- 11. RESUMEN EJECUTIVO DEL DÍA
SELECT 
    'RESUMEN DEL DÍA' as seccion,
    COUNT(DISTINCT cd.id) as cambios_divisas,
    COUNT(DISTINCT sem.id) as servicios_externos,
    COUNT(DISTINCT t.id) as transferencias,
    COUNT(DISTINCT ms.id) as movimientos_saldo
FROM PuntoAtencion pa
LEFT JOIN CambioDivisa cd ON cd.punto_atencion_id = pa.id 
    AND cd.estado = 'COMPLETADO' 
    AND DATE(cd.completed_at) = CURDATE()
LEFT JOIN ServicioExternoMovimiento sem ON sem.punto_atencion_id = pa.id 
    AND DATE(sem.created_at) = CURDATE()
LEFT JOIN Transferencia t ON (t.punto_origen_id = pa.id OR t.punto_destino_id = pa.id)
    AND t.estado = 'APROBADA' 
    AND DATE(t.approved_at) = CURDATE()
LEFT JOIN MovimientoSaldo ms ON ms.punto_atencion_id = pa.id 
    AND DATE(ms.created_at) = CURDATE()
WHERE UPPER(pa.nombre) LIKE '%AMAZONAS%';