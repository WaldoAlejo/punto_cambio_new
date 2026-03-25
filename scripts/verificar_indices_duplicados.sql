-- Script para verificar índices duplicados antes de eliminarlos
-- Ejecutar en PostgreSQL para confirmar los nombres exactos de los índices

-- Ver índices de la tabla Moneda
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'Moneda'
ORDER BY indexname;

-- Ver índices de la tabla MovimientoSaldo
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'MovimientoSaldo'
ORDER BY indexname;

-- Ver índices de la tabla CierreDiario
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'CierreDiario'
ORDER BY indexname;

-- Buscar índices que podrían ser duplicados
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    -- Índices que contienen las columnas problemáticas
    indexdef LIKE '%(codigo)%'
    OR indexdef LIKE '%(moneda_id)%'
    OR indexdef LIKE '%(fecha, punto_atencion_id)%'
)
ORDER BY tablename, indexname;
