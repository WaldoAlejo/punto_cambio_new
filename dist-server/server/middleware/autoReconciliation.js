import saldoReconciliationService from "../services/saldoReconciliationService.js";
import logger from "../utils/logger.js";
/**
 * Middleware de Auto-Reconciliación
 *
 * Este middleware se ejecuta después de operaciones que pueden afectar saldos
 * para garantizar que siempre estén cuadrados con los movimientos registrados.
 */
export const autoReconciliationMiddleware = (options = {}) => {
  return async (req, res, next) => {
    // Solo ejecutar si la respuesta fue exitosa
    const originalSend = res.send;
    res.send = function (data) {
      // Ejecutar reconciliación solo si la operación fue exitosa
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Ejecutar reconciliación de forma asíncrona para no bloquear la respuesta
        setImmediate(async () => {
          try {
            await executeAutoReconciliation(req, options);
          } catch (error) {
            logger.error("Error en auto-reconciliación middleware", {
              error: error instanceof Error ? error.message : "Unknown error",
              path: req.path,
              method: req.method,
              userId: req.user?.id,
            });
          }
        });
      }
      return originalSend.call(this, data);
    };
    next();
  };
};
/**
 * Función que ejecuta la reconciliación automática
 */
async function executeAutoReconciliation(req, options) {
  try {
    const userId = req.user?.id;
    // Extraer IDs de punto y moneda según configuración
    let pointId;
    let currencyId;
    // Intentar obtener desde parámetros configurados
    if (options?.pointIdParam) {
      pointId = req.params[options.pointIdParam];
    }
    if (options?.currencyIdParam) {
      currencyId = req.params[options.currencyIdParam];
    }
    // Intentar obtener desde body configurado
    if (options?.pointIdBody) {
      pointId = req.body[options.pointIdBody];
    }
    if (options?.currencyIdBody) {
      currencyId = req.body[options.currencyIdBody];
    }
    // Intentar obtener desde campos comunes
    if (!pointId) {
      pointId =
        req.body.destino_id || req.body.punto_atencion_id || req.params.pointId;
    }
    if (!currencyId) {
      currencyId = req.body.moneda_id || req.params.currencyId;
    }
    if (pointId && currencyId) {
      logger.info("🔄 Ejecutando auto-reconciliación después de operación", {
        pointId,
        currencyId,
        userId,
        path: req.path,
        method: req.method,
      });
      const resultado = await saldoReconciliationService.reconciliarSaldo(
        pointId,
        currencyId,
        userId
      );
      if (resultado.corregido) {
        logger.warn(
          "🔧 Auto-reconciliación detectó y corrigió inconsistencia",
          {
            pointId,
            currencyId,
            saldoAnterior: resultado.saldoAnterior,
            saldoCalculado: resultado.saldoCalculado,
            diferencia: resultado.diferencia,
            userId,
            path: req.path,
            method: req.method,
          }
        );
      } else if (resultado.success) {
        logger.info("✅ Auto-reconciliación: saldo ya estaba cuadrado", {
          pointId,
          currencyId,
          saldo: resultado.saldoCalculado,
          userId,
        });
      }
    } else {
      logger.debug(
        "Auto-reconciliación omitida: no se pudieron extraer pointId/currencyId",
        {
          pointId,
          currencyId,
          path: req.path,
          method: req.method,
          params: req.params,
          bodyKeys: Object.keys(req.body || {}),
        }
      );
    }
  } catch (error) {
    if (!options?.skipOnError) {
      logger.error("Error en auto-reconciliación", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
      });
    }
  }
}
/**
 * Middleware específico para transferencias
 */
export const transferAutoReconciliation = autoReconciliationMiddleware({
  pointIdBody: "destino_id",
  currencyIdBody: "moneda_id",
});
/**
 * Middleware específico para cambios de divisa
 */
export const exchangeAutoReconciliation = autoReconciliationMiddleware({
  pointIdBody: "punto_atencion_id",
  currencyIdBody: "moneda_origen_id", // También podríamos reconciliar moneda_destino_id
});
/**
 * Middleware específico para actualizaciones de saldo directo
 */
export const balanceUpdateAutoReconciliation = autoReconciliationMiddleware({
  pointIdParam: "pointId",
  currencyIdParam: "currencyId",
});
/**
 * Middleware genérico que intenta detectar automáticamente los campos
 */
export const genericAutoReconciliation = autoReconciliationMiddleware();
export default {
  autoReconciliationMiddleware,
  transferAutoReconciliation,
  exchangeAutoReconciliation,
  balanceUpdateAutoReconciliation,
  genericAutoReconciliation,
};
