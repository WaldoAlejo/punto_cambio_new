-- =====================================================
-- VERIFICACIÓN: Campos de agencias Servientrega
-- =====================================================

-- 1. Verificar que las columnas existen
SELECT 
    'Verificando columnas...' as paso,
    COUNT(*) as columnas_encontradas
FROM information_schema.columns 
WHERE table_name = 'PuntoAtencion' 
AND column_name IN ('servientrega_agencia_codigo', 'servientrega_agencia_nombre');

-- 2. Mostrar detalles de las columnas
SELECT 
    column_name as "Columna", 
    data_type as "Tipo", 
    is_nullable as "Permite NULL",
    column_default as "Valor por defecto"
FROM information_schema.columns 
WHERE table_name = 'PuntoAtencion' 
AND column_name IN ('servientrega_agencia_codigo', 'servientrega_agencia_nombre')
ORDER BY column_name;

-- 3. Probar inserción de datos (opcional)
-- INSERT INTO "PuntoAtencion" (
--     id, nombre, direccion, ciudad, provincia, activo, es_principal,
--     servientrega_agencia_codigo, servientrega_agencia_nombre,
--     created_at, updated_at
-- ) VALUES (
--     gen_random_uuid(), 'Punto Prueba', 'Dirección Prueba', 'Ciudad Prueba', 
--     'Provincia Prueba', true, false, 'AG001', 'Agencia Prueba',
--     NOW(), NOW()
-- );

-- 4. Verificar datos existentes
SELECT 
    COUNT(*) as total_puntos,
    COUNT(servientrega_agencia_codigo) as puntos_con_codigo_agencia,
    COUNT(servientrega_agencia_nombre) as puntos_con_nombre_agencia
FROM "PuntoAtencion";

-- 5. Estado final
SELECT 
    CASE 
        WHEN COUNT(*) = 2 THEN '✅ MIGRACIÓN EXITOSA - Ambas columnas existen'
        WHEN COUNT(*) = 1 THEN '⚠️  MIGRACIÓN PARCIAL - Solo una columna existe'
        ELSE '❌ MIGRACIÓN FALLIDA - Columnas no encontradas'
    END as estado_migracion
FROM information_schema.columns 
WHERE table_name = 'PuntoAtencion' 
AND column_name IN ('servientrega_agencia_codigo', 'servientrega_agencia_nombre');