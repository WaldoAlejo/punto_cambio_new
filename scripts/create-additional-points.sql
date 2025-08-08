-- Script para crear puntos adicionales para pruebas de operadores

-- Crear punto secundario
INSERT INTO "PuntoAtencion" (id, nombre, direccion, ciudad, provincia, codigo_postal, telefono, activo, es_principal, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'PUNTO NORTE',
  'Av. 6 de Diciembre y Eloy Alfaro',
  'Quito',
  'Pichincha',
  '170135',
  '0987654321',
  true,
  false,
  NOW(),
  NOW()
) ON CONFLICT (nombre) DO NOTHING;

-- Crear punto sur
INSERT INTO "PuntoAtencion" (id, nombre, direccion, ciudad, provincia, codigo_postal, telefono, activo, es_principal, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'PUNTO SUR',
  'Av. Maldonado y Morán Valverde',
  'Quito',
  'Pichincha',
  '170140',
  '0976543210',
  true,
  false,
  NOW(),
  NOW()
) ON CONFLICT (nombre) DO NOTHING;

-- Verificar puntos creados
SELECT 
  id,
  nombre,
  direccion,
  ciudad,
  activo,
  es_principal,
  created_at
FROM "PuntoAtencion"
ORDER BY es_principal DESC, nombre;