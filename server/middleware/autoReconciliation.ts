import { Request, Response, NextFunction } from "express";
import { saldoReconciliationService } from "../services/saldoReconciliationService.js";
import logger from "../utils/logger.js";

interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Middleware de Auto-Reconciliación
 *
 * Este middleware se ejecuta después de operaciones que pueden afectar saldos
 * para garantizar que siempre estén cuadrados con los movimientos registrados.
 */

/**
 * Middleware que ejecuta reconciliación automática después de operaciones de saldo
 * Se debe usar en rutas que modifiquen saldos (transferencias, cambios, etc.)
 */
export const autoReconciliationMiddleware = (options?: {
  pointIdParam?: string;
  currencyIdParam?: string;
  pointIdBody?: string;
  currencyIdBody?: string;
  skipOnError?: boolean;
}) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Solo ejecutar si la respuesta fue exitosa
    const originalSend = res.send;

    type SendBody = Parameters<Response["send"]>[0];

    res.send = function (this: Response, data: SendBody) {
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
    } as typeof res.send;

    next();
  };
};

/**
 * Función que ejecuta la reconciliación automática
 */
async function executeAutoReconciliation(
  req: AuthenticatedRequest,
  options?: {
    pointIdParam?: string;
    currencyIdParam?: string;
    pointIdBody?: string;
    currencyIdBody?: string;
    skipOnError?: boolean;
  }
) {
  try {
    const userId = req.user?.id;

    // Extraer IDs de punto y moneda según configuración
    let pointId: string | undefined;
    let currencyId: string | undefined;

    // Intentar obtener desde parámetros de URL
    if (options?.pointIdParam) {
      pointId = req.params[options.pointIdParam];
    }
    if (options?.currencyIdParam) {
      currencyId = req.params[options.currencyIdParam];
    }

    // Intentar obtener desde body
    if (!pointId && options?.pointIdBody) {
      pointId = req.body[options.pointIdBody];
    }
    if (!currencyId && options?.currencyIdBody) {
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
 * Reconcilia tanto el origen como el destino
 */
export const transferAutoReconciliation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Solo ejecutar si la respuesta fue exitosa
  const originalSend = res.send;

  type SendBody = Parameters<Response["send"]>[0];

  res.send = function (this: Response, data: SendBody) {
    // Ejecutar reconciliación solo si la operación fue exitosa
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Ejecutar reconciliación de forma asíncrona para no bloquear la respuesta
      setImmediate(async () => {
        try {
          const currencyId = req.body.moneda_id;
          const destinoId = req.body.destino_id;
          const origenId = req.body.origen_id;
          const userId = req.user?.id;

          // Reconciliar destino
          if (destinoId && currencyId) {
            logger.info(
              "🔄 Ejecutando auto-reconciliación en DESTINO después de transferencia",
              {
                pointId: destinoId,
                currencyId,
                userId,
              }
            );

            const resultadoDestino =
              await saldoReconciliationService.reconciliarSaldo(
                destinoId,
                currencyId,
                userId
              );

            if (resultadoDestino.corregido) {
              logger.warn(
                "🔧 Auto-reconciliación DESTINO detectó y corrigió inconsistencia",
                {
                  pointId: destinoId,
                  currencyId,
                  saldoAnterior: resultadoDestino.saldoAnterior,
                  saldoCalculado: resultadoDestino.saldoCalculado,
                  diferencia: resultadoDestino.diferencia,
                  userId,
                }
              );
            }
          }

          // Reconciliar origen (si existe)
          if (origenId && currencyId) {
            logger.info(
              "🔄 Ejecutando auto-reconciliación en ORIGEN después de transferencia",
              {
                pointId: origenId,
                currencyId,
                userId,
              }
            );

            const resultadoOrigen =
              await saldoReconciliationService.reconciliarSaldo(
                origenId,
                currencyId,
                userId
              );

            if (resultadoOrigen.corregido) {
              logger.warn(
                "🔧 Auto-reconciliación ORIGEN detectó y corrigió inconsistencia",
                {
                  pointId: origenId,
                  currencyId,
                  saldoAnterior: resultadoOrigen.saldoAnterior,
                  saldoCalculado: resultadoOrigen.saldoCalculado,
                  diferencia: resultadoOrigen.diferencia,
                  userId,
                }
              );
            }
          }
        } catch (error) {
          logger.error("Error en auto-reconciliación de transferencia", {
            error: error instanceof Error ? error.message : "Unknown error",
            path: req.path,
            method: req.method,
            userId: req.user?.id,
          });
        }
      });
    }

    return originalSend.call(this, data);
  } as typeof res.send;

  next();
};

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
