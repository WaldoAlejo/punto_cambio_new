-- Script SQL para investigar la diferencia en Plaza del Valle
-- Ejecutar esto directamente en la base de datos

-- 1. Buscar el punto
SELECT id, nombre FROM "PuntoAtencion" WHERE nombre ILIKE '%Plaza del Valle%';

-- 2. Buscar la moneda USD
SELECT id, codigo FROM "Moneda" WHERE codigo = 'USD';

-- 3. Saldo en tabla (lo que ve el dashboard)
SELECT 
    cantidad,
    billetes,
    monedas_fisicas,
    bancos,
    updated_at
FROM "Saldo"
WHERE punto_atencion_id = '41df3df8-d476-4254-b459-4bffbffe2ade'
  AND moneda_id = (SELECT id FROM "Moneda" WHERE codigo = 'USD');

-- 4. Saldos iniciales
SELECT 
    id,
    cantidad_inicial,
    fecha_asignacion,
    activo,
    asignado_por
FROM "SaldoInicial"
WHERE punto_atencion_id = '41df3df8-d476-4254-b459-4bffbffe2ade'
  AND moneda_id = (SELECT id FROM "Moneda" WHERE codigo = 'USD')
ORDER BY fecha_asignacion ASC;

-- 5. Movimientos de saldo (últimos 20)
SELECT 
    fecha,
    tipo_movimiento,
    monto,
    saldo_anterior,
    saldo_nuevo,
    descripcion,
    usuario_id
FROM "MovimientoSaldo"
WHERE punto_atencion_id = '41df3df8-d476-4254-b459-4bffbffe2ade'
  AND moneda_id = (SELECT id FROM "Moneda" WHERE codigo = 'USD')
ORDER BY fecha DESC
LIMIT 20;

-- 6. Calcular saldo desde movimientos
WITH movimientos_filtrados AS (
    SELECT 
        monto,
        descripcion,
        CASE 
            WHEN descripcion ILIKE '%bancos%' AND descripcion NOT ILIKE '%(caja)%' THEN 'BANCO'
            ELSE 'CAJA'
        END as tipo_bucket
    FROM "MovimientoSaldo"
    WHERE punto_atencion_id = '41df3df8-d476-4254-b459-4bffbffe2ade'
      AND moneda_id = (SELECT id FROM "Moneda" WHERE codigo = 'USD')
)
SELECT 
    SUM(CASE WHEN tipo_bucket = 'CAJA' THEN monto ELSE 0 END) as saldo_calculado,
    SUM(CASE WHEN tipo_bucket = 'BANCO' THEN monto ELSE 0 END) as saldo_bancos,
    COUNT(*) as total_movimientos
FROM movimientos_filtrados;
