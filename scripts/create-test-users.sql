-- Script para crear usuarios de prueba y punto principal
-- Ejecutar en la base de datos PostgreSQL

-- 1. Crear punto principal si no existe
INSERT INTO "PuntoAtencion" (id, nombre, direccion, ciudad, provincia, codigo_postal, telefono, activo, es_principal, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'PUNTO PRINCIPAL',
  'Oficina Central',
  'Quito',
  'Pichincha',
  '170150',
  '0999999999',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (nombre) DO NOTHING;

-- 2. Obtener el ID del punto principal
WITH punto_principal AS (
  SELECT id FROM "PuntoAtencion" WHERE nombre = 'PUNTO PRINCIPAL' LIMIT 1
)

-- 3. Crear usuario ADMIN
INSERT INTO "Usuario" (id, username, password, nombre, rol, punto_atencion_id, activo, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: admin123
  'Administrador Principal',
  'ADMIN',
  punto_principal.id,
  true,
  NOW(),
  NOW()
FROM punto_principal
ON CONFLICT (username) DO UPDATE SET
  password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  punto_atencion_id = EXCLUDED.punto_atencion_id,
  activo = true;

-- 4. Crear usuario OPERADOR
INSERT INTO "Usuario" (id, username, password, nombre, rol, activo, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'operador',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: operador123
  'Operador de Prueba',
  'OPERADOR',
  true,
  NOW(),
  NOW()
) ON CONFLICT (username) DO UPDATE SET
  password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  activo = true;

-- 5. Crear usuario CONCESION
INSERT INTO "Usuario" (id, username, password, nombre, rol, punto_atencion_id, activo, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'concesion',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: concesion123
  'Usuario Concesión',
  'CONCESION',
  punto_principal.id,
  true,
  NOW(),
  NOW()
FROM (SELECT id FROM "PuntoAtencion" WHERE nombre = 'PUNTO PRINCIPAL' LIMIT 1) punto_principal
ON CONFLICT (username) DO UPDATE SET
  password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  punto_atencion_id = EXCLUDED.punto_atencion_id,
  activo = true;

-- 6. Verificar usuarios creados
SELECT 
  u.username,
  u.nombre,
  u.rol,
  u.activo,
  pa.nombre as punto_nombre
FROM "Usuario" u
LEFT JOIN "PuntoAtencion" pa ON u.punto_atencion_id = pa.id
WHERE u.username IN ('admin', 'operador', 'concesion')
ORDER BY u.rol, u.username;