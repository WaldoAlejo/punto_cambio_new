-- Script completo para resetear y poblar la base de datos
-- Equivalente al seed-complete.ts pero en SQL puro

-- ============================================
-- PASO 1: LIMPIAR DATOS EXISTENTES
-- ============================================

-- Eliminar datos en orden correcto (por dependencias)
DELETE FROM "Recibo";
DELETE FROM "Transferencia";
DELETE FROM "DetalleCuadreCaja";
DELETE FROM "CuadreCaja";
DELETE FROM "CambioDivisa";
DELETE FROM "Movimiento";
DELETE FROM "SolicitudSaldo";
DELETE FROM "HistorialSaldo";
DELETE FROM "Saldo";
DELETE FROM "SalidaEspontanea";
DELETE FROM "Jornada";
DELETE FROM "HistorialAsignacionPunto";
DELETE FROM "Usuario";
DELETE FROM "Moneda";
DELETE FROM "PuntoAtencion";

-- ============================================
-- PASO 2: AGREGAR CAMPO es_principal SI NO EXISTE
-- ============================================

ALTER TABLE "PuntoAtencion" 
ADD COLUMN IF NOT EXISTS "es_principal" BOOLEAN DEFAULT false;

-- ============================================
-- PASO 3: CREAR PUNTOS DE ATENCIÓN
-- ============================================

INSERT INTO "PuntoAtencion" (id, nombre, direccion, ciudad, provincia, codigo_postal, telefono, activo, es_principal, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'Casa de Cambios Principal', 'Rabida y Juan Leon Mera', 'Quito', 'Pichincha', '170150', '0999999999', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'Casa de Cambios Norte', 'Av. 6 de Diciembre y Eloy Alfaro', 'Quito', 'Pichincha', '170135', '0987654321', true, false, NOW(), NOW()),
  (gen_random_uuid(), 'Casa de Cambios Sur', 'Av. Maldonado y Morán Valverde', 'Quito', 'Pichincha', '170140', '0976543210', true, false, NOW(), NOW());

-- ============================================
-- PASO 4: CREAR MONEDAS
-- ============================================

INSERT INTO "Moneda" (id, nombre, simbolo, codigo, orden_display, created_at, updated_at)
VALUES 
  -- Monedas principales
  (gen_random_uuid(), 'Dólar Estadounidense', '$', 'USD', 1, NOW(), NOW()),
  (gen_random_uuid(), 'Euro', '€', 'EUR', 2, NOW(), NOW()),
  (gen_random_uuid(), 'Libra Esterlina', '£', 'GBP', 3, NOW(), NOW()),
  (gen_random_uuid(), 'Franco Suizo', 'CHF', 'CHF', 4, NOW(), NOW()),
  (gen_random_uuid(), 'Dólar Canadiense', 'C$', 'CAD', 5, NOW(), NOW()),
  
  -- Monedas asiáticas
  (gen_random_uuid(), 'Yen Japonés', '¥', 'JPY', 6, NOW(), NOW()),
  (gen_random_uuid(), 'Yuan Chino', '¥', 'CNY', 7, NOW(), NOW()),
  (gen_random_uuid(), 'Dólar Australiano', 'A$', 'AUD', 8, NOW(), NOW()),
  
  -- Monedas latinoamericanas
  (gen_random_uuid(), 'Peso Colombiano', '$', 'COP', 9, NOW(), NOW()),
  (gen_random_uuid(), 'Sol Peruano', 'S/', 'PEN', 10, NOW(), NOW()),
  (gen_random_uuid(), 'Real Brasileño', 'R$', 'BRL', 11, NOW(), NOW()),
  (gen_random_uuid(), 'Peso Argentino', '$', 'ARS', 12, NOW(), NOW()),
  (gen_random_uuid(), 'Peso Chileno', '$', 'CLP', 13, NOW(), NOW()),
  (gen_random_uuid(), 'Peso Mexicano', '$', 'MXN', 14, NOW(), NOW()),
  (gen_random_uuid(), 'Bolívar Venezolano', 'Bs', 'VES', 15, NOW(), NOW()),
  
  -- Otras monedas importantes
  (gen_random_uuid(), 'Corona Sueca', 'kr', 'SEK', 16, NOW(), NOW()),
  (gen_random_uuid(), 'Corona Noruega', 'kr', 'NOK', 17, NOW(), NOW()),
  (gen_random_uuid(), 'Corona Danesa', 'kr', 'DKK', 18, NOW(), NOW()),
  (gen_random_uuid(), 'Zloty Polaco', 'zł', 'PLN', 19, NOW(), NOW()),
  (gen_random_uuid(), 'Rublo Ruso', '₽', 'RUB', 20, NOW(), NOW());

-- ============================================
-- PASO 5: CREAR USUARIOS DE PRUEBA
-- ============================================

-- Obtener ID del punto principal
WITH punto_principal AS (
  SELECT id FROM "PuntoAtencion" WHERE es_principal = true LIMIT 1
)

-- Insertar usuarios
INSERT INTO "Usuario" (id, username, password, nombre, rol, correo, telefono, punto_atencion_id, activo, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- admin123
  'Administrador Principal',
  'ADMIN',
  'admin@casadecambios.com',
  '0999999999',
  punto_principal.id,
  true,
  NOW(),
  NOW()
FROM punto_principal

UNION ALL

SELECT 
  gen_random_uuid(),
  'operador',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- operador123
  'Operador de Prueba',
  'OPERADOR',
  'operador@casadecambios.com',
  '0988888888',
  NULL, -- Operador sin punto asignado inicialmente
  true,
  NOW(),
  NOW()

UNION ALL

SELECT 
  gen_random_uuid(),
  'concesion',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- concesion123
  'Usuario Concesión',
  'CONCESION',
  'concesion@casadecambios.com',
  '0977777777',
  punto_principal.id,
  true,
  NOW(),
  NOW()
FROM (SELECT id FROM "PuntoAtencion" WHERE es_principal = true LIMIT 1) punto_principal;

-- ============================================
-- PASO 6: CREAR SALDOS INICIALES
-- ============================================

-- Crear saldos para todas las combinaciones punto-moneda
WITH admin_user AS (
  SELECT id FROM "Usuario" WHERE username = 'admin' LIMIT 1
)
INSERT INTO "Saldo" (id, punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  p.id,
  m.id,
  CASE WHEN m.codigo = 'USD' THEN 50000 ELSE 10000 END,
  CASE WHEN m.codigo = 'USD' THEN 50000 ELSE 10000 END,
  0,
  NOW(),
  NOW()
FROM "PuntoAtencion" p
CROSS JOIN "Moneda" m;

-- Crear historial de saldos iniciales
WITH admin_user AS (
  SELECT id FROM "Usuario" WHERE username = 'admin' LIMIT 1
)
INSERT INTO "HistorialSaldo" (id, punto_atencion_id, moneda_id, usuario_id, cantidad_anterior, cantidad_incrementada, cantidad_nueva, tipo_movimiento, descripcion, numero_referencia, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  p.id,
  m.id,
  admin_user.id,
  0,
  CASE WHEN m.codigo = 'USD' THEN 50000 ELSE 10000 END,
  CASE WHEN m.codigo = 'USD' THEN 50000 ELSE 10000 END,
  'INGRESO',
  'Saldo inicial para ' || m.nombre || ' en ' || p.nombre,
  'INIT-' || REPLACE(p.nombre, ' ', '') || '-' || m.codigo,
  NOW(),
  NOW()
FROM "PuntoAtencion" p
CROSS JOIN "Moneda" m
CROSS JOIN admin_user;

-- ============================================
-- PASO 7: CREAR CUADRES DE CAJA INICIALES
-- ============================================

-- Crear cuadres de caja para cada punto
WITH admin_user AS (
  SELECT id FROM "Usuario" WHERE username = 'admin' LIMIT 1
)
INSERT INTO "CuadreCaja" (id, usuario_id, punto_atencion_id, estado, fecha, observaciones, total_cambios, total_transferencias_entrada, total_transferencias_salida, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  admin_user.id,
  p.id,
  'ABIERTO',
  NOW(),
  'Cuadre inicial del sistema - ' || p.nombre,
  0,
  0,
  0,
  NOW(),
  NOW()
FROM "PuntoAtencion" p
CROSS JOIN admin_user;

-- Crear detalles de cuadre para cada combinación cuadre-moneda
INSERT INTO "DetalleCuadreCaja" (id, cuadre_id, moneda_id, saldo_apertura, saldo_cierre, conteo_fisico, billetes, monedas_fisicas, diferencia, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  c.id,
  m.id,
  CASE WHEN m.codigo = 'USD' THEN 50000 ELSE 10000 END,
  CASE WHEN m.codigo = 'USD' THEN 50000 ELSE 10000 END,
  CASE WHEN m.codigo = 'USD' THEN 50000 ELSE 10000 END,
  CASE WHEN m.codigo = 'USD' THEN 50000 ELSE 10000 END,
  0,
  0,
  NOW(),
  NOW()
FROM "CuadreCaja" c
CROSS JOIN "Moneda" m;

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

-- Mostrar resumen de datos creados
SELECT 'PUNTOS DE ATENCIÓN' as tabla, COUNT(*) as total FROM "PuntoAtencion"
UNION ALL
SELECT 'MONEDAS' as tabla, COUNT(*) as total FROM "Moneda"
UNION ALL
SELECT 'USUARIOS' as tabla, COUNT(*) as total FROM "Usuario"
UNION ALL
SELECT 'SALDOS' as tabla, COUNT(*) as total FROM "Saldo"
UNION ALL
SELECT 'CUADRES CAJA' as tabla, COUNT(*) as total FROM "CuadreCaja"
UNION ALL
SELECT 'DETALLES CUADRE' as tabla, COUNT(*) as total FROM "DetalleCuadreCaja";

-- Mostrar usuarios creados
SELECT username, nombre, rol, 
       CASE WHEN punto_atencion_id IS NOT NULL THEN 'CON PUNTO' ELSE 'SIN PUNTO' END as estado_punto
FROM "Usuario"
ORDER BY rol, username;

-- Mostrar puntos creados
SELECT nombre, ciudad, activo, es_principal
FROM "PuntoAtencion"
ORDER BY es_principal DESC, nombre;