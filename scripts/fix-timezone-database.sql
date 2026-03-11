-- Script para corregir fechas de jornadas con desfase de zona horaria
-- Problema: Las fechas se guardaron como hora local Ecuador pero en formato UTC
-- Solución: Restar 5 horas a las fechas que están en el futuro

-- 1. Primero verificar cuántas jornadas tienen fecha_salida en el futuro
SELECT 
    COUNT(*) as total_jornadas_futuro
FROM jornadas 
WHERE fecha_salida > NOW() + INTERVAL '1 hour';

-- 2. Ver ejemplos de jornadas con fecha_salida en el futuro
SELECT 
    id,
    usuario_id,
    punto_atencion_id,
    fecha_inicio,
    fecha_salida,
    estado,
    (fecha_salida - fecha_inicio) as duracion_reportada,
    NOW() as ahora
FROM jornadas 
WHERE fecha_salida > NOW() + INTERVAL '1 hour'
ORDER BY fecha_salida DESC
LIMIT 10;

-- 3. CORRECCIÓN: Restar 5 horas a las fechas_salida que están en el futuro
-- Esto asume que el servidor está en Ecuador (GMT-5)
-- DESCOMENTAR PARA EJECUTAR:

-- UPDATE jornadas 
-- SET fecha_salida = fecha_salida - INTERVAL '5 hours'
-- WHERE fecha_salida > NOW() + INTERVAL '1 hour'
--   AND estado = 'COMPLETADO';

-- 4. Verificar también jornadas de hoy que puedan tener el problema
SELECT 
    j.id,
    u.nombre as usuario,
    p.nombre as punto,
    j.fecha_inicio,
    j.fecha_salida,
    j.estado,
    EXTRACT(HOUR FROM (j.fecha_salida - j.fecha_inicio)) as horas_duracion
FROM jornadas j
JOIN usuarios u ON j.usuario_id = u.id
JOIN puntos_atencion p ON j.punto_atencion_id = p.id
WHERE j.fecha_inicio >= CURRENT_DATE
ORDER BY j.fecha_inicio DESC
LIMIT 20;

-- 5. CORRECCIÓN MÁS SEGURA: Solo corregir jornadas de hoy con fecha_salida > fecha_inicio + 10 horas
-- (asumiendo que nadie trabaja más de 10 horas)
-- DESCOMENTAR PARA EJECUTAR:

-- UPDATE jornadas 
-- SET fecha_salida = fecha_salida - INTERVAL '5 hours'
-- WHERE fecha_inicio >= CURRENT_DATE
--   AND fecha_salida > fecha_inicio + INTERVAL '10 hours'
--   AND estado = 'COMPLETADO';

-- 6. Verificar si también hay problema con fecha_almuerzo y fecha_regreso
SELECT 
    id,
    fecha_almuerzo,
    fecha_regreso,
    (fecha_regreso - fecha_almuerzo) as duracion_almuerzo
FROM jornadas 
WHERE fecha_almuerzo IS NOT NULL 
  AND fecha_regreso IS NOT NULL
  AND (fecha_regreso - fecha_almuerzo) > INTERVAL '3 hours'
ORDER BY fecha_almuerzo DESC
LIMIT 10;

-- 7. CORRECCIÓN: fecha_almuerzo y fecha_regreso si tienen desfase
-- DESCOMENTAR PARA EJECUTAR:

-- UPDATE jornadas 
-- SET fecha_almuerzo = fecha_almuerzo - INTERVAL '5 hours'
-- WHERE fecha_almuerzo > NOW() + INTERVAL '1 hour';

-- UPDATE jornadas 
-- SET fecha_regreso = fecha_regreso - INTERVAL '5 hours'
-- WHERE fecha_regreso > NOW() + INTERVAL '1 hour';

-- 8. Verificar corrección final
SELECT 
    COUNT(*) as total_corregir,
    MIN(fecha_salida) as fecha_minima,
    MAX(fecha_salida) as fecha_maxima
FROM jornadas 
WHERE fecha_salida > NOW() + INTERVAL '1 hour';
