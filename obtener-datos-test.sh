#!/bin/bash

# Script para obtener datos de prueba de la BD

DATABASE_URL="postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio"

echo "🔍 Obteniendo datos de prueba de la base de datos..."

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "👥 USUARIOS DISPONIBLES"
echo "═══════════════════════════════════════════════════════════════"

psql "$DATABASE_URL" -c "
SELECT 
  id,
  username,
  rol,
  nombre,
  punto_atencion_id
FROM \"Usuario\"
WHERE activo = true
ORDER BY rol DESC
LIMIT 10;
"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📍 PUNTOS DE ATENCIÓN"
echo "═══════════════════════════════════════════════════════════════"

psql "$DATABASE_URL" -c "
SELECT 
  id,
  nombre,
  ciudad,
  es_principal,
  servientrega_alianza,
  servientrega_oficina_alianza
FROM \"PuntoAtencion\"
ORDER BY es_principal DESC, nombre
LIMIT 10;
"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "💰 SALDOS SERVIENTREGA ACTUALES"
echo "═══════════════════════════════════════════════════════════════"

psql "$DATABASE_URL" -c "
SELECT 
  ses.id,
  pa.nombre as punto,
  ses.monto_total,
  ses.monto_usado,
  (ses.monto_total - ses.monto_usado) as disponible
FROM \"ServicioExternoSaldo\" ses
JOIN \"PuntoAtencion\" pa ON ses.punto_atencion_id = pa.id
WHERE ses.servicio_externo_id = 'SERVIENTREGA'
ORDER BY disponible DESC;
"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 ÚLTIMAS GUÍAS GENERADAS"
echo "═══════════════════════════════════════════════════════════════"

psql "$DATABASE_URL" -c "
SELECT 
  id,
  numero_guia,
  costo_envio,
  estado,
  fecha_creacion
FROM \"ServientregaGuia\"
ORDER BY fecha_creacion DESC
LIMIT 5;
"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📝 SOLICITUDES DE ANULACIÓN"
echo "═══════════════════════════════════════════════════════════════"

psql "$DATABASE_URL" -c "
SELECT 
  id,
  numero_guia,
  estado,
  motivo,
  fecha_solicitud
FROM \"ServientregaSolicitudAnulacion\"
ORDER BY fecha_solicitud DESC
LIMIT 5;
"