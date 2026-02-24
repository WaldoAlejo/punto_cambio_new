-- =============================================================================
-- SCRIPT DE LIMPIEZA COMPLETA - SISTEMA PUNTO CAMBIO
-- =============================================================================
-- Descripción: Elimina todos los registros operacionales manteniendo:
--              - Usuarios
--              - Puntos de Atención  
--              - Jornadas de trabajo
--              - Monedas
--              - Configuración del sistema
--
-- ADVERTENCIA: Este script es IRREVERSIBLE. Haz un backup antes de ejecutar.
-- =============================================================================

-- Iniciar transacción
BEGIN;

-- =============================================================================
-- 1. DESACTIVAR TRIGGERS TEMPORALMENTE (si existen)
-- =============================================================================
ALTER TABLE "MovimientoSaldo" DISABLE TRIGGER ALL;
ALTER TABLE "Saldo" DISABLE TRIGGER ALL;
ALTER TABLE "CambioDivisa" DISABLE TRIGGER ALL;
ALTER TABLE "Transferencia" DISABLE TRIGGER ALL;
ALTER TABLE "ServientregaGuia" DISABLE TRIGGER ALL;
ALTER TABLE "Recibo" DISABLE TRIGGER ALL;
ALTER TABLE "CuadreCaja" DISABLE TRIGGER ALL;

-- =============================================================================
-- 2. ELIMINAR REGISTROS EN ORDEN (respetando dependencias)
-- =============================================================================

-- 2.1 Tablas de auditoría y movimientos (hojas del árbol)
DELETE FROM "MovimientoSaldo";
DELETE FROM "HistorialSaldo";
DELETE FROM "MovimientoContable";

-- 2.2 Detalles de cierres
DELETE FROM "CuadreCajaDetalle";

-- 2.3 Cierres de caja
DELETE FROM "CuadreCaja";

-- 2.4 Saldos iniciales
DELETE FROM "SaldoInicial";

-- 2.5 Recibos (referencian cambios y servicios)
DELETE FROM "Recibo";

-- 2.6 Servientrega - Destinatarios y Remitentes (referenciados por guías)
DELETE FROM "ServientregaDestinatario";
DELETE FROM "ServientregaRemitente";

-- 2.7 Guías de Servientrega
DELETE FROM "ServientregaGuia";

-- 2.8 Servicios Externos - Movimientos y Saldos
DELETE FROM "ServicioExternoMovimiento";
DELETE FROM "ServicioExternoSaldo";

-- 2.9 Cambios de Divisas
DELETE FROM "CambioDivisa";

-- 2.10 Transferencias
DELETE FROM "Transferencia";
DELETE FROM "TransferenciaAprobacion";

-- 2.11 Saldos de puntos (conservando la tabla pero vaciando registros)
DELETE FROM "Saldo";

-- 2.12 Saldos Servientrega (tabla de configuración de saldos)
DELETE FROM "ServientregaSaldo" WHERE id IS NOT NULL;

-- 2.13 Solicitudes de permisos
DELETE FROM "PermissionRequest";

-- 2.14 Notificaciones
DELETE FROM "Notification" WHERE id IS NOT NULL;

-- 2.15 Logs de auditoría de usuario (opcional - descomentar si se quiere limpiar)
-- DELETE FROM "UserAuditLog";

-- =============================================================================
-- 3. REINICIAR SECUENCIAS (IDs autoincrementales)
-- =============================================================================
-- PostgreSQL: Reiniciar sequences
ALTER SEQUENCE IF EXISTS "CambioDivisa_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "Transferencia_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "MovimientoSaldo_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "Recibo_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "CuadreCaja_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "CuadreCajaDetalle_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "ServientregaGuia_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "ServientregaRemitente_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "ServientregaDestinatario_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "ServicioExternoMovimiento_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "SaldoInicial_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "HistorialSaldo_id_seq" RESTART WITH 1;

-- =============================================================================
-- 4. REACTIVAR TRIGGERS
-- =============================================================================
ALTER TABLE "MovimientoSaldo" ENABLE TRIGGER ALL;
ALTER TABLE "Saldo" ENABLE TRIGGER ALL;
ALTER TABLE "CambioDivisa" ENABLE TRIGGER ALL;
ALTER TABLE "Transferencia" ENABLE TRIGGER ALL;
ALTER TABLE "ServientregaGuia" ENABLE TRIGGER ALL;
ALTER TABLE "Recibo" ENABLE TRIGGER ALL;
ALTER TABLE "CuadreCaja" ENABLE TRIGGER ALL;

-- =============================================================================
-- 5. VERIFICACIÓN: CONTAR REGISTROS RESTANTES
-- =============================================================================
-- Estos deben mostrar 0 registros:
SELECT 'CambioDivisa' as tabla, COUNT(*) as registros FROM "CambioDivisa"
UNION ALL
SELECT 'Transferencia', COUNT(*) FROM "Transferencia"
UNION ALL
SELECT 'MovimientoSaldo', COUNT(*) FROM "MovimientoSaldo"
UNION ALL
SELECT 'Saldo', COUNT(*) FROM "Saldo"
UNION ALL
SELECT 'ServicioExternoSaldo', COUNT(*) FROM "ServicioExternoSaldo"
UNION ALL
SELECT 'ServientregaGuia', COUNT(*) FROM "ServientregaGuia"
UNION ALL
SELECT 'Recibo', COUNT(*) FROM "Recibo"
UNION ALL
SELECT 'CuadreCaja', COUNT(*) FROM "CuadreCaja"
UNION ALL
SELECT 'SaldoInicial', COUNT(*) FROM "SaldoInicial"
UNION ALL
SELECT 'HistorialSaldo', COUNT(*) FROM "HistorialSaldo";

-- =============================================================================
-- 6. VERIFICACIÓN: CONTAR REGISTROS PRESERVADOS
-- =============================================================================
-- Estos deben mantener sus registros:
SELECT 'Usuario' as tabla, COUNT(*) as registros FROM "Usuario"
UNION ALL
SELECT 'PuntoAtencion', COUNT(*) FROM "PuntoAtencion"
UNION ALL
SELECT 'Jornada', COUNT(*) FROM "Jornada"
UNION ALL
SELECT 'Moneda', COUNT(*) FROM "Moneda";

-- =============================================================================
-- COMMIT O ROLLBACK
-- =============================================================================
-- Descomenta COMMIT para aplicar cambios, o ROLLBACK para cancelar
-- COMMIT;
-- ROLLBACK;

-- Nota: Por seguridad, dejamos esto comentado. Ejecutar manualmente:
-- COMMIT;   -- Para confirmar la limpieza
-- ROLLBACK; -- Para cancelar sin cambios
