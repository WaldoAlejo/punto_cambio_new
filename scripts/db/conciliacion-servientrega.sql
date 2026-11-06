-- Conciliación de guías Servientrega (solo lectura).
-- Solo guías desde 2026-05-15: el 2026-05-14 se limpiaron todos los movimientos (commit bbb67c3).
-- Uso dentro de psql:  \i /home/ubuntu/punto_cambio_new/scripts/db/conciliacion-servientrega.sql
-- Esperado por guía:
--   Activa operador:   crédito Servientrega usado = costo, sin devolución, neto saldo punto = +costo
--   Activa franquicia: crédito usado = costo, sin devolución, neto saldo punto = 0
--   Anulada:           una sola devolución, neto saldo punto = 0

\echo '=== RESUMEN POR PROBLEMA ==='
WITH g AS (
  SELECT g.numero_guia, g.estado, COALESCE(g.costo_envio,0) AS costo, g.created_at, p.nombre AS punto, u.rol
  FROM "ServientregaGuia" g
  LEFT JOIN "PuntoAtencion" p ON p.id = g.punto_atencion_id
  LEFT JOIN "Usuario" u ON u.id = g.usuario_id
  WHERE g.created_at >= DATE '2026-05-15'
),
se AS (
  SELECT numero_referencia,
    SUM(CASE WHEN descripcion LIKE 'Uso de crédito%' THEN ABS(monto) ELSE 0 END) AS credito_usado,
    SUM(CASE WHEN descripcion LIKE 'Reversión por cancelación%' OR descripcion LIKE 'Devolución de crédito por anulación%' THEN 1 WHEN descripcion LIKE 'Ajuste devolución duplicada%' THEN -1 ELSE 0 END) AS devoluciones
  FROM "ServicioExternoMovimiento" WHERE servicio = 'SERVIENTREGA' GROUP BY 1
),
ms AS (
  SELECT referencia_id, SUM(monto) AS neto_punto
  FROM "MovimientoSaldo" WHERE tipo_referencia = 'SERVIENTREGA' GROUP BY 1
),
r AS (
  SELECT g.*, COALESCE(se.credito_usado,0) AS credito_usado, COALESCE(se.devoluciones,0) AS devoluciones,
    COALESCE(ms.neto_punto,0) AS neto_punto,
    CASE WHEN g.estado = 'ANULADA' OR g.rol = 'CONCESION' THEN 0 ELSE g.costo END AS esperado_punto
  FROM g LEFT JOIN se ON se.numero_referencia = g.numero_guia LEFT JOIN ms ON ms.referencia_id = g.numero_guia
),
p AS (
  SELECT r.*,
    CONCAT_WS(' | ',
      CASE WHEN devoluciones > 1 THEN 'DEVOLUCION DUPLICADA' END,
      CASE WHEN estado = 'ANULADA' AND costo > 0 AND devoluciones = 0 THEN 'ANULADA SIN DEVOLVER SERVIENTREGA' END,
      CASE WHEN estado <> 'ANULADA' AND devoluciones > 0 THEN 'ACTIVA CON DEVOLUCION' END,
      CASE WHEN ABS(neto_punto - esperado_punto) > 0.009 THEN 'SALDO PUNTO DESCUADRADO' END
    ) AS problema
  FROM r
)
SELECT problema, COUNT(*) AS guias, SUM(neto_punto - esperado_punto) AS diferencia_saldo_punto
FROM p WHERE problema <> '' GROUP BY problema ORDER BY guias DESC;

\echo '=== DETALLE (ultimas 40) ==='
WITH g AS (
  SELECT g.numero_guia, g.estado, COALESCE(g.costo_envio,0) AS costo, g.created_at, p.nombre AS punto, u.rol
  FROM "ServientregaGuia" g
  LEFT JOIN "PuntoAtencion" p ON p.id = g.punto_atencion_id
  LEFT JOIN "Usuario" u ON u.id = g.usuario_id
  WHERE g.created_at >= DATE '2026-05-15'
),
se AS (
  SELECT numero_referencia,
    SUM(CASE WHEN descripcion LIKE 'Uso de crédito%' THEN ABS(monto) ELSE 0 END) AS credito_usado,
    SUM(CASE WHEN descripcion LIKE 'Reversión por cancelación%' OR descripcion LIKE 'Devolución de crédito por anulación%' THEN 1 WHEN descripcion LIKE 'Ajuste devolución duplicada%' THEN -1 ELSE 0 END) AS devoluciones
  FROM "ServicioExternoMovimiento" WHERE servicio = 'SERVIENTREGA' GROUP BY 1
),
ms AS (
  SELECT referencia_id, SUM(monto) AS neto_punto
  FROM "MovimientoSaldo" WHERE tipo_referencia = 'SERVIENTREGA' GROUP BY 1
),
r AS (
  SELECT g.*, COALESCE(se.credito_usado,0) AS credito_usado, COALESCE(se.devoluciones,0) AS devoluciones,
    COALESCE(ms.neto_punto,0) AS neto_punto,
    CASE WHEN g.estado = 'ANULADA' OR g.rol = 'CONCESION' THEN 0 ELSE g.costo END AS esperado_punto
  FROM g LEFT JOIN se ON se.numero_referencia = g.numero_guia LEFT JOIN ms ON ms.referencia_id = g.numero_guia
),
p AS (
  SELECT r.*,
    CONCAT_WS(' | ',
      CASE WHEN devoluciones > 1 THEN 'DEVOLUCION DUPLICADA' END,
      CASE WHEN estado = 'ANULADA' AND costo > 0 AND devoluciones = 0 THEN 'ANULADA SIN DEVOLVER SERVIENTREGA' END,
      CASE WHEN estado <> 'ANULADA' AND devoluciones > 0 THEN 'ACTIVA CON DEVOLUCION' END,
      CASE WHEN ABS(neto_punto - esperado_punto) > 0.009 THEN 'SALDO PUNTO DESCUADRADO' END
    ) AS problema
  FROM r
)
SELECT punto, numero_guia, estado, rol, costo, credito_usado, devoluciones, neto_punto, esperado_punto,
  created_at::date AS fecha, problema
FROM p WHERE problema <> ''
ORDER BY created_at DESC
LIMIT 40;
