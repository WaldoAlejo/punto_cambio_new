-- Validación de inclusión de servicios externos en cuadre de caja
-- Este script verifica si los movimientos de servicios externos están incluidos en los totales del cuadre

-- 1. Verificar cuántos cuadres de caja existen
SELECT 
    'Total de cuadres de caja' as descripcion,
    COUNT(*) as cantidad
FROM "CuadreCaja";

-- 2. Verificar cuántos movimientos de servicios externos existen
SELECT 
    'Total de movimientos servicios externos' as descripcion,
    COUNT(*) as cantidad
FROM "ServicioExternoMovimiento";

-- 3. Obtener los últimos 5 cuadres con información básica
SELECT 
    cc.id,
    pa.nombre as punto_atencion,
    cc.fecha,
    cc.estado,
    cc.total_ingresos,
    cc.total_egresos,
    cc.total_cambios,
    cc.total_transferencias_entrada,
    cc.total_transferencias_salida
FROM "CuadreCaja" cc
JOIN "PuntoAtencion" pa ON cc.punto_atencion_id = pa.id
ORDER BY cc.fecha DESC
LIMIT 5;

-- 4. Para cada cuadre, mostrar los servicios externos del mismo día
WITH cuadres_recientes AS (
    SELECT 
        cc.id as cuadre_id,
        cc.punto_atencion_id,
        pa.nombre as punto_nombre,
        cc.fecha::date as fecha_cuadre,
        cc.total_ingresos,
        cc.total_egresos
    FROM "CuadreCaja" cc
    JOIN "PuntoAtencion" pa ON cc.punto_atencion_id = pa.id
    ORDER BY cc.fecha DESC
    LIMIT 5
),
servicios_por_cuadre AS (
    SELECT 
        cr.cuadre_id,
        cr.punto_nombre,
        cr.fecha_cuadre,
        cr.total_ingresos as cuadre_ingresos,
        cr.total_egresos as cuadre_egresos,
        COUNT(sem.id) as movimientos_servicios,
        SUM(CASE WHEN sem.tipo_movimiento = 'INGRESO' THEN sem.monto ELSE 0 END) as servicios_ingresos,
        SUM(CASE WHEN sem.tipo_movimiento = 'EGRESO' THEN sem.monto ELSE 0 END) as servicios_egresos
    FROM cuadres_recientes cr
    LEFT JOIN "ServicioExternoMovimiento" sem ON (
        cr.punto_atencion_id = sem.punto_atencion_id 
        AND cr.fecha_cuadre = sem.fecha::date
    )
    GROUP BY cr.cuadre_id, cr.punto_nombre, cr.fecha_cuadre, cr.total_ingresos, cr.total_egresos
)
SELECT 
    punto_nombre,
    fecha_cuadre,
    cuadre_ingresos,
    cuadre_egresos,
    movimientos_servicios,
    COALESCE(servicios_ingresos, 0) as servicios_ingresos,
    COALESCE(servicios_egresos, 0) as servicios_egresos,
    CASE 
        WHEN movimientos_servicios = 0 THEN 'Sin servicios externos'
        WHEN cuadre_ingresos >= COALESCE(servicios_ingresos, 0) 
             AND cuadre_egresos >= COALESCE(servicios_egresos, 0) 
        THEN 'Servicios INCLUIDOS'
        ELSE 'Servicios NO INCLUIDOS'
    END as estado_inclusion
FROM servicios_por_cuadre
ORDER BY fecha_cuadre DESC;

-- 5. Detalle de servicios externos por tipo
SELECT 
    'Resumen por tipo de servicio' as titulo,
    servicio as tipo_servicio,
    tipo_movimiento,
    COUNT(*) as cantidad_movimientos,
    SUM(monto) as total_monto
FROM "ServicioExternoMovimiento"
GROUP BY servicio, tipo_movimiento
ORDER BY servicio, tipo_movimiento;

-- 6. Verificar si hay cuadres con servicios externos del mismo día
SELECT 
    'Cuadres que coinciden con servicios externos' as descripcion,
    COUNT(DISTINCT cc.id) as cuadres_con_servicios
FROM "CuadreCaja" cc
INNER JOIN "ServicioExternoMovimiento" sem 
    ON cc.punto_atencion_id = sem.punto_atencion_id 
    AND cc.fecha::date = sem.fecha::date;