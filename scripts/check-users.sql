-- Verificar usuarios existentes
SELECT 
    u.id,
    u.username,
    u.nombre,
    u.rol,
    u.activo,
    u.punto_atencion_id,
    pa.nombre as punto_nombre
FROM "Usuario" u
LEFT JOIN "PuntoAtencion" pa ON u.punto_atencion_id = pa.id
ORDER BY u.rol, u.username;

-- Verificar puntos de atención
SELECT 
    id,
    nombre,
    direccion,
    activo,
    es_principal
FROM "PuntoAtencion"
ORDER BY es_principal DESC, nombre;