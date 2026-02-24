import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import saldoReconciliationService from "../services/saldoReconciliationService.js";
import logger from "../utils/logger.js";
import { z } from "zod";
import { default as prisma } from "../lib/prisma.js";

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

// Schema para validar query params de calcular-real
const calcularRealQuerySchema = z.object({
  puntoAtencionId: z.string().uuid("ID de punto de atención inválido"),
  monedaId: z.string().uuid("ID de moneda inválido").optional(),
});

/**
 * GET /saldo-reconciliation/calcular-real
 * Calcula el saldo real basado en movimientos históricos desde el último saldo inicial
 * Endpoint compatible con /api/saldos/calcular-real
 */
router.get(
  "/calcular-real",
  authenticateToken,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      const parsed = calcularRealQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message ?? "Parámetros inválidos",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { puntoAtencionId, monedaId } = parsed.data;

      // Si no se especifica moneda, calcular para la primera disponible
      let targetMonedaId = monedaId;
      if (!targetMonedaId) {
        const saldo = await prisma.saldo.findFirst({
          where: { punto_atencion_id: puntoAtencionId },
          select: { moneda_id: true },
        });
        if (!saldo) {
          res.status(404).json({
            error: "No se encontraron saldos para el punto de atención",
            success: false,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        targetMonedaId = saldo.moneda_id;
      }

      const saldoCalculado = await saldoReconciliationService.calcularSaldoReal(
        puntoAtencionId,
        targetMonedaId!
      );

      // Obtener información del saldo inicial usado
      const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: targetMonedaId,
        },
        orderBy: { fecha_asignacion: "desc" },
        select: { id: true, fecha_asignacion: true },
      });

      // Contar movimientos desde el saldo inicial
      const movimientosCount = await prisma.movimientoSaldo.count({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: targetMonedaId,
          fecha: {
            gte: saldoInicial?.fecha_asignacion ?? new Date("2000-01-01"),
          },
        },
      });

      res.status(200).json({
        success: true,
        data: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: targetMonedaId,
          saldo_calculado: saldoCalculado,
          basado_en: {
            saldo_inicial_id: saldoInicial?.id,
            fecha_saldo_inicial: saldoInicial?.fecha_asignacion,
            movimientos_contados: movimientosCount,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error calculando saldo real", {
        error: error instanceof Error ? error.message : "Unknown error",
        puntoAtencionId: req.query.puntoAtencionId,
        monedaId: req.query.monedaId,
      });

      res.status(500).json({
        error: "Error interno al calcular saldo real",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Schema para validar body de reconciliar
const reconciliarBodySchema = z.object({
  puntoAtencionId: z.string().uuid("ID de punto de atención inválido"),
  monedaId: z.string().uuid("ID de moneda inválido").optional(),
});

/**
 * POST /saldo-reconciliation/reconciliar
 * Reconcilia el saldo registrado con el calculado
 * Endpoint compatible con /api/saldos/reconciliar
 */
router.post(
  "/reconciliar",
  authenticateToken,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      const parsed = reconciliarBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message ?? "Parámetros inválidos",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { puntoAtencionId, monedaId } = parsed.data;
      const usuarioId = req.user?.id;

      // Si no se especifica moneda, reconciliar la primera disponible
      let targetMonedaId = monedaId;
      if (!targetMonedaId) {
        const saldo = await prisma.saldo.findFirst({
          where: { punto_atencion_id: puntoAtencionId },
          select: { moneda_id: true },
        });
        if (!saldo) {
          res.status(404).json({
            error: "No se encontraron saldos para el punto de atención",
            success: false,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        targetMonedaId = saldo.moneda_id;
      }

      const resultado = await saldoReconciliationService.reconciliarSaldo(
        puntoAtencionId,
        targetMonedaId!,
        usuarioId
      );

      res.status(200).json({
        success: true,
        data: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: targetMonedaId,
          saldo_registrado: resultado.saldoAnterior,
          saldo_calculado: resultado.saldoCalculado,
          diferencia: resultado.diferencia,
          ajustado: resultado.corregido,
        },
        message: resultado.corregido
          ? `Saldo ajustado de ${resultado.saldoAnterior} a ${resultado.saldoCalculado}`
          : "El saldo ya estaba correcto",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error reconciliando saldo", {
        error: error instanceof Error ? error.message : "Unknown error",
        puntoAtencionId: req.body.puntoAtencionId,
        monedaId: req.body.monedaId,
      });

      res.status(500).json({
        error: "Error interno al reconciliar saldo",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /saldo-reconciliation/validar-consistencia
 * Valida la consistencia de todos los saldos
 * Endpoint compatible con /api/saldos/validar-consistencia
 */
router.get(
  "/validar-consistencia",
  authenticateToken,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      const inconsistencias =
        await saldoReconciliationService.generarReporteInconsistencias();

      res.status(200).json({
        success: true,
        data: {
          valido: inconsistencias.length === 0,
          inconsistencias: inconsistencias.map((inc) => ({
            punto_atencion_id: inc.puntoAtencionId,
            punto_nombre: inc.puntoNombre,
            moneda_id: inc.monedaId,
            moneda_codigo: inc.monedaCodigo,
            saldo_registrado: inc.saldoRegistrado,
            saldo_calculado: inc.saldoCalculado,
            diferencia: inc.diferencia,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error validando consistencia de saldos", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      res.status(500).json({
        error: "Error interno al validar consistencia",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
