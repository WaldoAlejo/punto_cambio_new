/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMINISTRACIÓN DE APERTURAS DE CAJA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Endpoints para que los administradores gestionen aperturas de caja
 * con diferencias o pendientes de aprobación.
 */

import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { EstadoApertura } from "@prisma/client";
import { nowEcuador } from "../utils/timezone.js";

const router = express.Router();

/**
 * GET /admin-aperturas/pendientes
 * 
 * Lista todas las aperturas pendientes de aprobación (con diferencias)
 * Solo para ADMIN y SUPER_USUARIO
 */
router.get(
  "/pendientes",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { punto_atencion_id, fecha } = req.query;

      const whereClause: any = {
        estado: EstadoApertura.CON_DIFERENCIA,
        requiere_aprobacion: true,
      };

      if (punto_atencion_id) {
        whereClause.punto_atencion_id = punto_atencion_id as string;
      }

      if (fecha) {
        whereClause.fecha = new Date(fecha as string);
      }

      const aperturas = await prisma.aperturaCaja.findMany({
        where: whereClause,
        include: {
          usuario: {
            select: { id: true, nombre: true, username: true },
          },
          puntoAtencion: {
            select: { id: true, nombre: true, ciudad: true },
          },
          jornada: {
            select: { id: true, estado: true, fecha_inicio: true },
          },
        },
        orderBy: { hora_inicio_conteo: "desc" },
      });

      // Formatear respuesta
      const aperturasFormateadas = aperturas.map((a) => {
        const diferencias = (a.diferencias as any[]) || [];
        const diferenciasCriticas = diferencias.filter((d: any) => d.fuera_tolerancia);

        return {
          id: a.id,
          fecha: a.fecha,
          hora_inicio_conteo: a.hora_inicio_conteo,
          estado: a.estado,
          requiere_aprobacion: a.requiere_aprobacion,
          observaciones_operador: a.observaciones_operador,
          observaciones_admin: a.observaciones_admin,
          usuario: a.usuario,
          punto: a.puntoAtencion,
          jornada: a.jornada,
          diferencias: diferenciasCriticas,
          total_diferencias: diferenciasCriticas.length,
        };
      });

      return res.json({
        success: true,
        aperturas: aperturasFormateadas,
        count: aperturasFormateadas.length,
      });
    } catch (error) {
      logger.error("Error al listar aperturas pendientes", {
        error: error instanceof Error ? error.message : String(error),
        admin_id: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

/**
 * GET /admin-aperturas/:id
 * 
 * Obtiene detalle de una apertura específica
 */
router.get(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const apertura = await prisma.aperturaCaja.findUnique({
        where: { id },
        include: {
          usuario: {
            select: { id: true, nombre: true, username: true, telefono: true },
          },
          puntoAtencion: {
            select: { id: true, nombre: true, direccion: true, ciudad: true },
          },
          jornada: {
            select: { id: true, estado: true, fecha_inicio: true },
          },
          aprobador: {
            select: { id: true, nombre: true, username: true },
          },
        },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      return res.json({
        success: true,
        apertura: {
          ...apertura,
          saldo_esperado: apertura.saldo_esperado as any,
          conteo_fisico: apertura.conteo_fisico as any,
          diferencias: apertura.diferencias as any,
        },
      });
    } catch (error) {
      logger.error("Error al obtener apertura", {
        error: error instanceof Error ? error.message : String(error),
        apertura_id: req.params.id,
        admin_id: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

/**
 * POST /admin-aperturas/:id/aprobar
 * 
 * Aprueba una apertura con diferencias y crea el cuadre de caja
 */
router.post(
  "/:id/aprobar",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { observaciones, ajustar_saldos } = req.body;
      const adminId = req.user?.id;

      const apertura = await prisma.aperturaCaja.findUnique({
        where: { id },
        include: {
          puntoAtencion: true,
        },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      if (apertura.estado !== EstadoApertura.CON_DIFERENCIA) {
        return res.status(400).json({
          success: false,
          error: "Solo se pueden aprobar aperturas con diferencias",
        });
      }

      // Transacción para aprobar apertura y crear cuadre
      const result = await prisma.$transaction(async (tx) => {
        // 1. Actualizar apertura
        const aperturaActualizada = await tx.aperturaCaja.update({
          where: { id },
          data: {
            estado: EstadoApertura.ABIERTA,
            aprobado_por: adminId,
            hora_aprobacion: nowEcuador(),
            hora_apertura: nowEcuador(),
            metodo_verificacion: "APROBACION_ADMIN",
            observaciones_admin: observaciones || null,
            requiere_aprobacion: false,
          },
        });

        // 2. Obtener conteo físico
        const conteoFisico = (apertura.conteo_fisico as any[]) || [];
        const saldoEsperado = (apertura.saldo_esperado as any[]) || [];

        // 3. Verificar si ya existe cuadre para el día
        const fechaHoy = apertura.fecha.toISOString().split("T")[0];
        const cuadreExistente = await tx.cuadreCaja.findFirst({
          where: {
            punto_atencion_id: apertura.punto_atencion_id,
            fecha: {
              gte: new Date(fechaHoy + "T00:00:00.000Z"),
              lt: new Date(fechaHoy + "T23:59:59.999Z"),
            },
          },
        });

        let cuadre;
        if (!cuadreExistente) {
          // 4. Crear cuadre de caja
          cuadre = await tx.cuadreCaja.create({
            data: {
              estado: "ABIERTO",
              fecha: new Date(fechaHoy + "T00:00:00.000Z"),
              punto_atencion_id: apertura.punto_atencion_id,
              usuario_id: apertura.usuario_id,
              observaciones: `Cuadre creado desde apertura aprobada por admin (${id})`,
            },
          });

          // 5. Crear detalles del cuadre
          for (const saldo of saldoEsperado) {
            const conteo = conteoFisico.find((c: any) => c.moneda_id === saldo.moneda_id);
            const conteoTotal = conteo ? conteo.total : 0;

            await tx.detalleCuadreCaja.create({
              data: {
                cuadre_id: cuadre.id,
                moneda_id: saldo.moneda_id,
                saldo_apertura: conteoTotal,
                saldo_cierre: saldo.cantidad,
                conteo_fisico: conteoTotal,
                diferencia: conteoTotal - saldo.cantidad,
                billetes: conteo ? conteo.billetes.reduce((sum: number, b: any) => sum + b.denominacion * b.cantidad, 0) : 0,
                monedas_fisicas: conteo ? conteo.monedas.reduce((sum: number, m: any) => sum + m.denominacion * m.cantidad, 0) : 0,
                movimientos_periodo: 0,
              },
            });
          }

          // 6. Opcional: Ajustar saldos del sistema para que coincidan con el físico
          if (ajustar_saldos) {
            for (const conteo of conteoFisico) {
              const saldoActual = await tx.saldo.findUnique({
                where: {
                  punto_atencion_id_moneda_id: {
                    punto_atencion_id: apertura.punto_atencion_id,
                    moneda_id: conteo.moneda_id,
                  },
                },
              });

              if (saldoActual) {
                const diferencia = conteo.total - Number(saldoActual.cantidad);

                if (diferencia !== 0) {
                  await tx.saldo.update({
                    where: {
                      punto_atencion_id_moneda_id: {
                        punto_atencion_id: apertura.punto_atencion_id,
                        moneda_id: conteo.moneda_id,
                      },
                    },
                    data: {
                      cantidad: conteo.total,
                      billetes: conteo.billetes.reduce(
                        (sum: number, b: any) => sum + b.denominacion * b.cantidad,
                        0
                      ),
                      monedas_fisicas: conteo.monedas.reduce(
                        (sum: number, m: any) => sum + m.denominacion * m.cantidad,
                        0
                      ),
                    },
                  });

                  logger.info("Saldo ajustado por aprobación de apertura", {
                    apertura_id: id,
                    moneda_id: conteo.moneda_id,
                    diferencia,
                    admin_id: adminId,
                  });
                }
              }
            }
          }
        } else {
          cuadre = cuadreExistente;
        }

        return { apertura: aperturaActualizada, cuadre };
      });

      logger.info("Apertura aprobada por admin", {
        apertura_id: id,
        admin_id: adminId,
        ajustar_saldos: !!ajustar_saldos,
        cuadre_id: result.cuadre?.id,
      });

      return res.json({
        success: true,
        apertura: {
          id: result.apertura.id,
          estado: result.apertura.estado,
        },
        cuadre: result.cuadre ? {
          id: result.cuadre.id,
          estado: result.cuadre.estado,
        } : null,
        message: ajustar_saldos
          ? "Apertura aprobada y saldos ajustados. El operador puede iniciar operaciones."
          : "Apertura aprobada. El operador puede iniciar operaciones.",
      });
    } catch (error) {
      logger.error("Error al aprobar apertura", {
        error: error instanceof Error ? error.message : String(error),
        apertura_id: req.params.id,
        admin_id: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

/**
 * POST /admin-aperturas/:id/rechazar
 * 
 * Rechaza una apertura con diferencias
 */
router.post(
  "/:id/rechazar",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { observaciones } = req.body;
      const adminId = req.user?.id;

      const apertura = await prisma.aperturaCaja.findUnique({
        where: { id },
        include: {
          jornada: true,
        },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      if (apertura.estado !== EstadoApertura.CON_DIFERENCIA) {
        return res.status(400).json({
          success: false,
          error: "Solo se pueden rechazar aperturas con diferencias",
        });
      }

      // Transacción para rechazar apertura y cancelar jornada
      await prisma.$transaction(async (tx) => {
        // 1. Actualizar apertura
        await tx.aperturaCaja.update({
          where: { id },
          data: {
            estado: EstadoApertura.RECHAZADO,
            aprobado_por: adminId,
            hora_aprobacion: nowEcuador(),
            observaciones_admin: observaciones || "Apertura rechazada por diferencias",
            requiere_aprobacion: false,
          },
        });

        // 2. Cancelar jornada asociada
        if (apertura.jornada_id) {
          await tx.jornada.update({
            where: { id: apertura.jornada_id },
            data: {
              estado: "CANCELADO",
              fecha_salida: new Date(),
              observaciones: `Jornada cancelada porque la apertura fue rechazada. ${observaciones || ""}`,
            },
          });

          // 3. Liberar punto del usuario
          await tx.usuario.update({
            where: { id: apertura.usuario_id },
            data: { punto_atencion_id: null },
          });
        }
      });

      logger.info("Apertura rechazada por admin", {
        apertura_id: id,
        admin_id: adminId,
        jornada_id: apertura.jornada_id,
      });

      return res.json({
        success: true,
        message: "Apertura rechazada. El operador debe realizar un nuevo conteo e iniciar jornada nuevamente.",
      });
    } catch (error) {
      logger.error("Error al rechazar apertura", {
        error: error instanceof Error ? error.message : String(error),
        apertura_id: req.params.id,
        admin_id: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

/**
 * GET /admin-aperturas/historial/lista
 * 
 * Lista historial de aperturas (aprobadas y rechazadas)
 */
router.get(
  "/historial/lista",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { punto_atencion_id, fecha_desde, fecha_hasta, estado } = req.query;

      const whereClause: any = {
        estado: {
          in: [EstadoApertura.ABIERTA, EstadoApertura.RECHAZADO],
        },
      };

      if (punto_atencion_id) {
        whereClause.punto_atencion_id = punto_atencion_id as string;
      }

      if (estado) {
        whereClause.estado = estado as EstadoApertura;
      }

      if (fecha_desde || fecha_hasta) {
        whereClause.fecha = {};
        if (fecha_desde) {
          whereClause.fecha.gte = new Date(fecha_desde as string);
        }
        if (fecha_hasta) {
          whereClause.fecha.lte = new Date(fecha_hasta as string);
        }
      }

      const aperturas = await prisma.aperturaCaja.findMany({
        where: whereClause,
        include: {
          usuario: {
            select: { id: true, nombre: true, username: true },
          },
          puntoAtencion: {
            select: { id: true, nombre: true, ciudad: true },
          },
          aprobador: {
            select: { id: true, nombre: true, username: true },
          },
        },
        orderBy: { hora_aprobacion: "desc" },
        take: 100,
      });

      return res.json({
        success: true,
        aperturas,
        count: aperturas.length,
      });
    } catch (error) {
      logger.error("Error al listar historial", {
        error: error instanceof Error ? error.message : String(error),
        admin_id: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

export default router;
