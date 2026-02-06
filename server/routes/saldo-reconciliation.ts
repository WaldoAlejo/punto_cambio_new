import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import saldoReconciliationService from "../services/saldoReconciliationService.js";
import logger from "../utils/logger.js";
import { z } from "zod";

interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}

type AuthedRequest = Request & { user?: AuthenticatedUser | null };

const router = express.Router();

// Schema para validar parámetros
const reconcilePointSchema = z.object({
  pointId: z.string().uuid("ID de punto de atención inválido"),
});

const reconcileSingleSchema = z.object({
  pointId: z.string().uuid("ID de punto de atención inválido"),
  currencyId: z.string().uuid("ID de moneda inválido"),
});

/**
 * POST /saldo-reconciliation/reconcile-point/:pointId
 * Reconcilia todos los saldos de un punto de atención específico
 */
router.post(
  "/reconcile-point/:pointId",
  authenticateToken,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      // Validar parámetros
      const parsed = reconcilePointSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message ?? "Parámetros inválidos",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { pointId } = parsed.data;
      const usuarioId = req.user?.id;

      logger.info("🔄 Iniciando reconciliación manual de punto", {
        pointId,
        usuarioId,
        solicitadoPor: req.user?.nombre,
      });

      // Ejecutar reconciliación
      const resultados =
        await saldoReconciliationService.reconciliarTodosPuntoAtencion(
          pointId,
          usuarioId
        );

      const corregidos = resultados.filter((r) => r.corregido);
      const exitosos = resultados.filter((r) => r.success);

      res.status(200).json({
        success: true,
        message: `Reconciliación completada: ${corregidos.length} saldos corregidos de ${resultados.length}`,
        data: {
          totalSaldos: resultados.length,
          saldosCorregidos: corregidos.length,
          saldosExitosos: exitosos.length,
          resultados: resultados.map((r) => ({
            success: r.success,
            saldoAnterior: r.saldoAnterior,
            saldoCalculado: r.saldoCalculado,
            diferencia: r.diferencia,
            corregido: r.corregido,
            movimientosCount: r.movimientosCount,
            error: r.error,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en reconciliación manual de punto", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        pointId: req.params.pointId,
        usuarioId: req.user?.id,
      });

      res.status(500).json({
        error: "Error interno al ejecutar reconciliación",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * POST /saldo-reconciliation/reconcile-single/:pointId/:currencyId
 * Reconcilia un saldo específico (punto + moneda)
 */
router.post(
  "/reconcile-single/:pointId/:currencyId",
  authenticateToken,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      // Validar parámetros
      const parsed = reconcileSingleSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message ?? "Parámetros inválidos",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { pointId, currencyId } = parsed.data;
      const usuarioId = req.user?.id;

      logger.info("🔄 Iniciando reconciliación manual de saldo específico", {
        pointId,
        currencyId,
        usuarioId,
        solicitadoPor: req.user?.nombre,
      });

      // Ejecutar reconciliación
      const resultado = await saldoReconciliationService.reconciliarSaldo(
        pointId,
        currencyId,
        usuarioId
      );

      res.status(200).json({
        success: true,
        message: resultado.corregido
          ? `Saldo corregido: diferencia de ${resultado.diferencia} ajustada`
          : "Saldo ya estaba cuadrado",
        data: {
          success: resultado.success,
          saldoAnterior: resultado.saldoAnterior,
          saldoCalculado: resultado.saldoCalculado,
          diferencia: resultado.diferencia,
          corregido: resultado.corregido,
          movimientosCount: resultado.movimientosCount,
          error: resultado.error,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en reconciliación manual de saldo específico", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        pointId: req.params.pointId,
        currencyId: req.params.currencyId,
        usuarioId: req.user?.id,
      });

      res.status(500).json({
        error: "Error interno al ejecutar reconciliación",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /saldo-reconciliation/report
 * Genera un reporte de todas las inconsistencias encontradas
 */
router.get(
  "/report",
  authenticateToken,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      logger.info("📊 Generando reporte de inconsistencias", {
        usuarioId: req.user?.id,
        solicitadoPor: req.user?.nombre,
      });

      // Generar reporte
      const inconsistencias =
        await saldoReconciliationService.generarReporteInconsistencias();

      res.status(200).json({
        success: true,
        message: `Reporte generado: ${inconsistencias.length} inconsistencias encontradas`,
        data: {
          totalInconsistencias: inconsistencias.length,
          inconsistencias: inconsistencias.map((inc) => ({
            puntoAtencionId: inc.puntoAtencionId,
            puntoNombre: inc.puntoNombre,
            monedaId: inc.monedaId,
            monedaCodigo: inc.monedaCodigo,
            saldoRegistrado: inc.saldoRegistrado,
            saldoCalculado: inc.saldoCalculado,
            diferencia: inc.diferencia,
            requiereCorreccion: inc.requiereCorreccion,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error generando reporte de inconsistencias", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        usuarioId: req.user?.id,
      });

      res.status(500).json({
        error: "Error interno al generar reporte",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * POST /saldo-reconciliation/fix-all
 * Corrige automáticamente TODAS las inconsistencias encontradas
 * ⚠️ USAR CON PRECAUCIÓN - Solo para administradores
 */
router.post(
  "/fix-all",
  authenticateToken,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      // Verificar que el usuario sea administrador
      if (req.user?.rol !== "ADMIN" && req.user?.rol !== "SUPER_USUARIO") {
        res.status(403).json({
          error: "Solo los administradores pueden ejecutar corrección masiva",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.warn("⚠️ Iniciando corrección masiva de inconsistencias", {
        usuarioId: req.user?.id,
        solicitadoPor: req.user?.nombre,
        rol: req.user?.rol,
      });

      // Obtener todas las inconsistencias
      const inconsistencias =
        await saldoReconciliationService.generarReporteInconsistencias();

      if (inconsistencias.length === 0) {
        res.status(200).json({
          success: true,
          message: "No se encontraron inconsistencias para corregir",
          data: { totalCorregidos: 0, inconsistencias: [] },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Corregir cada inconsistencia
      const resultados = [];
      let corregidos = 0;

      for (const inc of inconsistencias) {
        try {
          const resultado = await saldoReconciliationService.reconciliarSaldo(
            inc.puntoAtencionId,
            inc.monedaId,
            req.user?.id
          );

          if (resultado.corregido) {
            corregidos++;
          }

          resultados.push({
            punto: inc.puntoNombre,
            moneda: inc.monedaCodigo,
            resultado,
          });
        } catch (error) {
          logger.error("Error corrigiendo inconsistencia específica", {
            error: error instanceof Error ? error.message : "Unknown error",
            puntoId: inc.puntoAtencionId,
            monedaId: inc.monedaId,
          });

          resultados.push({
            punto: inc.puntoNombre,
            moneda: inc.monedaCodigo,
            resultado: {
              success: false,
              error:
                error instanceof Error ? error.message : "Error desconocido",
            },
          });
        }
      }

      logger.warn(
        `✅ Corrección masiva completada: ${corregidos} saldos corregidos`,
        {
          usuarioId: req.user?.id,
          totalInconsistencias: inconsistencias.length,
          totalCorregidos: corregidos,
        }
      );

      res.status(200).json({
        success: true,
        message: `Corrección masiva completada: ${corregidos} saldos corregidos de ${inconsistencias.length} inconsistencias`,
        data: {
          totalInconsistencias: inconsistencias.length,
          totalCorregidos: corregidos,
          resultados,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en corrección masiva", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        usuarioId: req.user?.id,
      });

      res.status(500).json({
        error: "Error interno en corrección masiva",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
