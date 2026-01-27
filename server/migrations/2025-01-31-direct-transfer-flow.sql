-- Migración para implementar flujo directo de transferencias
-- Fecha: 2025-01-31
-- Descripción: Las transferencias ahora pasan directamente del punto origen al punto destino
--              sin requerir aprobación del administrador. El origen se debita inmediatamente
--              cuando se crea la transferencia (estado EN_TRANSITO), y el destino acepta
--              cuando recibe el efectivo (estado COMPLETADO).

-- Los cambios en el enum y campos ya están en el schema.prisma:
-- - EstadoTransferencia: Agregado EN_TRANSITO, COMPLETADO, CANCELADO
-- - Transferencia: Agregado aceptado_por, fecha_envio, fecha_aceptacion, observaciones_aceptacion
-- - Índice en origen_id para mejorar performance

-- Esta migración NO requiere cambios SQL directos porque los cambios se aplicarán
-- automáticamente cuando ejecutes:
-- npx prisma migrate dev --name direct_transfer_flow

-- NOTA IMPORTANTE:
-- Las transferencias existentes con estado PENDIENTE seguirán funcionando con el
-- flujo antiguo (requieren aprobación del admin).
-- Las nuevas transferencias usarán el nuevo flujo (EN_TRANSITO -> COMPLETADO).

-- Verificación post-migración:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'Transferencia'
-- AND column_name IN ('aceptado_por', 'fecha_envio', 'fecha_aceptacion', 'observaciones_aceptacion');
