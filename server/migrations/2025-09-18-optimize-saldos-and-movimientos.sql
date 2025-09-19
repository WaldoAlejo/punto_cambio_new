-- Índices para acelerar consultas de saldos y movimientos contables
-- Ejecutar en producción tras verificar que no existan previamente

-- Índice compuesto para Saldo por punto/moneda (ya hay unique constraint para upsert, pero aseguramos índice)
CREATE INDEX IF NOT EXISTS idx_saldo_punto_moneda ON "Saldo" (punto_atencion_id, moneda_id);

-- Índices por columnas usadas en filtros y joins
CREATE INDEX IF NOT EXISTS idx_movsaldo_punto_fecha ON "MovimientoSaldo" (punto_atencion_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movsaldo_moneda ON "MovimientoSaldo" (moneda_id);
CREATE INDEX IF NOT EXISTS idx_movsaldo_usuario ON "MovimientoSaldo" (usuario_id);

-- Índice para ordenar por código de moneda al listar saldos
CREATE INDEX IF NOT EXISTS idx_moneda_codigo ON "Moneda" (codigo);