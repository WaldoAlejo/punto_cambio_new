import express, { Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { Prisma, EstadoApertura, ServicioExterno } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { todayGyeDateOnly, nowEcuador } from "../utils/timezone.js";

const router = express.Router();

// Tipos
interface ConteoMoneda {
  moneda_id: string;
  billetes: { denominacion: number; cantidad: number }[];
  monedas: { denominacion: number; cantidad: number }[];
  total: number;
}

interface DiferenciaMoneda {
  moneda_id: string;
  codigo: string;
  esperado: number;
  fisico: number;
  diferencia: number;
  fuera_tolerancia: boolean;
}

// Helper para calcular totales del desglose
function calcularTotalDesglose(
  billetes: { denominacion: number; cantidad: number }[],
  monedas: { denominacion: number; cantidad: number }[]
): number {
  const totalBilletes = billetes.reduce(
    (sum, b) => sum + b.denominacion * b.cantidad,
    0
  );
  const totalMonedas = monedas.reduce(
    (sum, m) => sum + m.denominacion * m.cantidad,
    0
  );
  return totalBilletes + totalMonedas;
}

// Helper para validar diferencias
function validarDiferencias(
  saldoEsperado: { moneda_id: string; codigo: string; cantidad: number }[],
  conteoFisico: ConteoMoneda[],
  toleranciaUSD: number = 1.0,
  toleranciaOtras: number = 0.01
): { diferencias: DiferenciaMoneda[]; cuadrado: boolean } {
  const diferencias: DiferenciaMoneda[] = [];
  let cuadrado = true;

  for (const esperado of saldoEsperado) {
    const fisico = conteoFisico.find((c) => c.moneda_id === esperado.moneda_id);
    const totalFisico = fisico ? fisico.total : 0;
    const diferencia = totalFisico - esperado.cantidad;
    const tolerancia = esperado.codigo === "USD" ? toleranciaUSD : toleranciaOtras;
    const fueraTolerancia = Math.abs(diferencia) > tolerancia;

    if (fueraTolerancia) {
      cuadrado = false;
    }

    diferencias.push({
      moneda_id: esperado.moneda_id,
      codigo: esperado.codigo,
      esperado: esperado.cantidad,
      fisico: totalFisico,
      diferencia,
      fuera_tolerancia: fueraTolerancia,
    });
  }

  return { diferencias, cuadrado };
}

// ======================= POST: Iniciar apertura de caja =======================
router.post(
  "/iniciar",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { jornada_id } = req.body;
      const usuario_id = req.user?.id;

      if (!jornada_id) {
        return res.status(400).json({
          success: false,
          error: "Se requiere jornada_id",
        });
      }

      // Verificar que la jornada existe y pertenece al usuario
      const jornada = await prisma.jornada.findFirst({
        where: {
          id: jornada_id,
          usuario_id: usuario_id,
        },
        include: {
          puntoAtencion: true,
        },
      });

      if (!jornada) {
        return res.status(404).json({
          success: false,
          error: "Jornada no encontrada",
        });
      }

      // Verificar si ya existe una apertura para esta jornada
      const aperturaExistente = await prisma.aperturaCaja.findUnique({
        where: { jornada_id },
      });

      if (aperturaExistente) {
        return res.json({
          success: true,
          apertura: aperturaExistente,
          message: "Ya existe una apertura para esta jornada",
        });
      }

      // Obtener saldos actuales del punto
      const saldos = await prisma.saldo.findMany({
        where: {
          punto_atencion_id: jornada.punto_atencion_id,
        },
        include: {
          moneda: {
            select: { id: true, codigo: true, nombre: true, simbolo: true },
          },
        },
      });

      // Formatear saldo esperado
      const saldoEsperado = saldos.map((s) => ({
        moneda_id: s.moneda_id,
        codigo: s.moneda.codigo,
        nombre: s.moneda.nombre,
        simbolo: s.moneda.simbolo,
        cantidad: Number(s.cantidad),
        billetes: Number(s.billetes),
        monedas: Number(s.monedas_fisicas),
      }));

      // Obtener saldos de servicios externos
      const serviciosExternosSaldos = await prisma.servicioExternoSaldo.findMany({
        where: {
          punto_atencion_id: jornada.punto_atencion_id,
        },
        include: {
          moneda: {
            select: { id: true, codigo: true, nombre: true, simbolo: true },
          },
        },
      });

      // Formatear saldos de servicios externos
      const saldosServiciosExternos = serviciosExternosSaldos.map((s) => ({
        servicio: s.servicio,
        servicio_nombre: s.servicio.replace(/_/g, " "),
        moneda_id: s.moneda_id,
        codigo: s.moneda.codigo,
        nombre: s.moneda.nombre,
        simbolo: s.moneda.simbolo,
        cantidad: Number(s.cantidad),
        billetes: Number(s.billetes),
        monedas: Number(s.monedas_fisicas),
        bancos: Number(s.bancos || 0),
      }));

      // Crear registro de apertura
      const fechaHoy = todayGyeDateOnly();
      const apertura = await prisma.aperturaCaja.create({
        data: {
          jornada_id,
          usuario_id: usuario_id!,
          punto_atencion_id: jornada.punto_atencion_id,
          fecha: fechaHoy,
          hora_inicio_conteo: nowEcuador(),
          estado: EstadoApertura.EN_CONTEO,
          saldo_esperado: JSON.parse(JSON.stringify(saldoEsperado)),
          conteo_fisico: JSON.parse(JSON.stringify([])),
          tolerancia_usd: new Prisma.Decimal(1.0),
          tolerancia_otras: new Prisma.Decimal(0.01),
        },
      });

      logger.info("Apertura de caja iniciada", {
        apertura_id: apertura.id,
        jornada_id,
        usuario_id,
        punto_id: jornada.punto_atencion_id,
      });

      return res.json({
        success: true,
        apertura: {
          ...apertura,
          saldo_esperado: saldoEsperado,
          saldos_servicios_externos: saldosServiciosExternos,
        },
        message: "Proceso de apertura iniciado. Por favor cuente el efectivo físico y valide los saldos de servicios externos.",
      });
    } catch (error) {
      logger.error("Error al iniciar apertura de caja", {
        error: error instanceof Error ? error.message : "Unknown error",
        user_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= POST: Guardar conteo físico =======================
router.post(
  "/conteo",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { apertura_id, conteos, fotos_urls, observaciones, servicios_externos } = req.body;
      const usuario_id = req.user?.id;

      if (!apertura_id || !conteos || !Array.isArray(conteos)) {
        return res.status(400).json({
          success: false,
          error: "Se requiere apertura_id y conteos",
        });
      }

      // Verificar que la apertura existe y pertenece al usuario
      const apertura = await prisma.aperturaCaja.findFirst({
        where: {
          id: apertura_id,
          usuario_id: usuario_id,
        },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      if (apertura.estado === EstadoApertura.ABIERTA) {
        return res.status(400).json({
          success: false,
          error: "Esta apertura ya fue completada",
        });
      }

      // Parsear saldo esperado
      const saldoEsperado = (apertura.saldo_esperado as any[]) || [];

      // Validar y calcular totales de cada conteo
      const conteosValidados: ConteoMoneda[] = conteos.map((c: ConteoMoneda) => {
        const totalCalculado = calcularTotalDesglose(c.billetes || [], c.monedas || []);
        return {
          ...c,
          total: totalCalculado,
        };
      });

      // Calcular diferencias
      const { diferencias, cuadrado } = validarDiferencias(
        saldoEsperado.map((s) => ({
          moneda_id: s.moneda_id,
          codigo: s.codigo,
          cantidad: Number(s.cantidad),
        })),
        conteosValidados,
        Number(apertura.tolerancia_usd),
        Number(apertura.tolerancia_otras)
      );

      // Determinar nuevo estado
      let nuevoEstado: EstadoApertura;
      let requiereAprobacion = false;

      if (cuadrado) {
        nuevoEstado = EstadoApertura.CUADRADO;
      } else {
        nuevoEstado = EstadoApertura.CON_DIFERENCIA;
        requiereAprobacion = true;
      }

      // Preparar datos de servicios externos si existen
      const serviciosData = servicios_externos ? JSON.parse(JSON.stringify(servicios_externos)) : null;

      // Actualizar apertura
      const aperturaActualizada = await prisma.aperturaCaja.update({
        where: { id: apertura_id },
        data: {
          conteo_fisico: JSON.parse(JSON.stringify(conteosValidados)),
          diferencias: JSON.parse(JSON.stringify(diferencias)),
          estado: nuevoEstado,
          hora_fin_conteo: nowEcuador(),
          requiere_aprobacion: requiereAprobacion,
          fotos_urls: fotos_urls ? JSON.parse(JSON.stringify(fotos_urls)) : null,
          observaciones_operador: observaciones || null,
          conteo_servicios_externos: serviciosData,
        },
      });

      logger.info("Conteo de apertura guardado", {
        apertura_id,
        estado: nuevoEstado,
        cuadrado,
        diferencias_count: diferencias.filter((d) => d.fuera_tolerancia).length,
        servicios_count: servicios_externos?.length || 0,
      });

      return res.json({
        success: true,
        apertura: aperturaActualizada,
        diferencias,
        cuadrado,
        puede_abrir: true, // Siempre permitir abrir, incluso con diferencias
        message: cuadrado
          ? "Todo cuadrado. Puedes confirmar la apertura."
          : "Hay diferencias registradas. Puedes confirmar la apertura - el administrador será notificado.",
      });
    } catch (error) {
      logger.error("Error al guardar conteo de apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
        user_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= POST: Confirmar apertura (cuando cuadra) =======================
router.post(
  "/confirmar",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { apertura_id } = req.body;
      const usuario_id = req.user?.id;

      if (!apertura_id) {
        return res.status(400).json({
          success: false,
          error: "Se requiere apertura_id",
        });
      }

      // Verificar que la apertura existe y pertenece al usuario
      const apertura = await prisma.aperturaCaja.findFirst({
        where: {
          id: apertura_id,
          usuario_id: usuario_id,
        },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      // Permitir confirmar si está CUADRADO o CON_DIFERENCIA
      if (apertura.estado !== EstadoApertura.CUADRADO && 
          apertura.estado !== EstadoApertura.CON_DIFERENCIA) {
        return res.status(400).json({
          success: false,
          error: "La apertura debe estar en estado CUADRADO o CON_DIFERENCIA para confirmar",
        });
      }

      // Determinar método de verificación
      const metodoVerificacion = apertura.estado === EstadoApertura.CUADRADO 
        ? "AUTOMATICO" 
        : "CON_DIFERENCIA_PENDIENTE";

      // Actualizar estado a ABIERTA (incluso con diferencias, queda marcado para revisión)
      const aperturaActualizada = await prisma.aperturaCaja.update({
        where: { id: apertura_id },
        data: {
          estado: EstadoApertura.ABIERTA,
          hora_apertura: nowEcuador(),
          metodo_verificacion: metodoVerificacion,
          // Si hay diferencias, marcar que requiere revisión de admin
          requiere_aprobacion: apertura.estado === EstadoApertura.CON_DIFERENCIA,
        },
      });

      logger.info("Apertura de caja confirmada", {
        apertura_id,
        usuario_id,
        con_diferencia: apertura.estado === EstadoApertura.CON_DIFERENCIA,
      });

      const message = apertura.estado === EstadoApertura.CON_DIFERENCIA
        ? "Apertura confirmada con diferencias. La novedad ha sido registrada para revisión del administrador. Puedes iniciar a operar."
        : "Apertura confirmada. Jornada iniciada correctamente.";

      return res.json({
        success: true,
        apertura: aperturaActualizada,
        con_diferencia: apertura.estado === EstadoApertura.CON_DIFERENCIA,
        message,
      });
    } catch (error) {
      logger.error("Error al confirmar apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
        user_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= GET: Obtener apertura por ID =======================
router.get(
  "/:id",
  authenticateToken,
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const usuario_id = req.user?.id;
      const rol = req.user?.rol;

      const whereClause: any = { id };

      // Si no es admin, solo puede ver sus propias aperturas
      if (rol !== "ADMIN" && rol !== "SUPER_USUARIO") {
        whereClause.usuario_id = usuario_id;
      }

      const apertura = await prisma.aperturaCaja.findFirst({
        where: whereClause,
        include: {
          usuario: {
            select: { id: true, nombre: true, username: true },
          },
          puntoAtencion: {
            select: { id: true, nombre: true, direccion: true, ciudad: true },
          },
          aprobador: {
            select: { id: true, nombre: true, username: true },
          },
          jornada: {
            select: { id: true, estado: true, fecha_inicio: true },
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
        apertura,
      });
    } catch (error) {
      logger.error("Error al obtener apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
        apertura_id: req.params.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= GET: Listar aperturas pendientes (Admin) =======================
router.get(
  "/pendientes/admin",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    try {
      const { punto_atencion_id, fecha } = req.query;

      const whereClause: any = {
        estado: {
          in: [EstadoApertura.CON_DIFERENCIA, EstadoApertura.EN_CONTEO],
        },
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
        },
        orderBy: { hora_inicio_conteo: "desc" },
      });

      return res.json({
        success: true,
        aperturas,
        count: aperturas.length,
      });
    } catch (error) {
      logger.error("Error al listar aperturas pendientes", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= GET: Mis aperturas (Operador) =======================
router.get(
  "/mis-aperturas/lista",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const usuario_id = req.user?.id;
      const { estado, fecha } = req.query;

      const whereClause: any = { usuario_id };

      if (estado) {
        whereClause.estado = estado as EstadoApertura;
      }

      if (fecha) {
        whereClause.fecha = new Date(fecha as string);
      }

      const aperturas = await prisma.aperturaCaja.findMany({
        where: whereClause,
        include: {
          puntoAtencion: {
            select: { id: true, nombre: true, ciudad: true },
          },
          aprobador: {
            select: { id: true, nombre: true },
          },
        },
        orderBy: { hora_inicio_conteo: "desc" },
      });

      return res.json({
        success: true,
        aperturas,
      });
    } catch (error) {
      logger.error("Error al listar mis aperturas", {
        error: error instanceof Error ? error.message : "Unknown error",
        user_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= POST: Aprobar apertura con diferencia (Admin) =======================
router.post(
  "/:id/aprobar",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const { observaciones, ajustar_saldos } = req.body;
      const admin_id = req.user?.id;

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

      // Actualizar apertura
      const aperturaActualizada = await prisma.aperturaCaja.update({
        where: { id },
        data: {
          estado: EstadoApertura.ABIERTA,
          aprobado_por: admin_id,
          hora_aprobacion: nowEcuador(),
          hora_apertura: nowEcuador(),
          observaciones_admin: observaciones || null,
          metodo_verificacion: "VIDEOCALL",
        },
      });

      // Si se solicita ajustar saldos para que coincidan con el físico
      if (ajustar_saldos) {
        const conteoFisico = (apertura.conteo_fisico as any[]) || [];
        
        for (const conteo of conteoFisico) {
          const saldoActual = await prisma.saldo.findUnique({
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
              await prisma.saldo.update({
                where: {
                  punto_atencion_id_moneda_id: {
                    punto_atencion_id: apertura.punto_atencion_id,
                    moneda_id: conteo.moneda_id,
                  },
                },
                data: {
                  cantidad: new Prisma.Decimal(conteo.total),
                  billetes: new Prisma.Decimal(
                    conteo.billetes.reduce(
                      (sum: number, b: any) => sum + b.denominacion * b.cantidad,
                      0
                    )
                  ),
                  monedas_fisicas: new Prisma.Decimal(
                    conteo.monedas.reduce(
                      (sum: number, m: any) => sum + m.denominacion * m.cantidad,
                      0
                    )
                  ),
                },
              });

              logger.info("Saldo ajustado por apertura con diferencia", {
                apertura_id: id,
                moneda_id: conteo.moneda_id,
                diferencia,
                admin_id,
              });
            }
          }
        }
      }

      logger.info("Apertura con diferencia aprobada por admin", {
        apertura_id: id,
        admin_id,
        ajustar_saldos: !!ajustar_saldos,
      });

      return res.json({
        success: true,
        apertura: aperturaActualizada,
        message: "Apertura aprobada correctamente. La jornada puede iniciar.",
      });
    } catch (error) {
      logger.error("Error al aprobar apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
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

// ======================= POST: Rechazar apertura (Admin) =======================
router.post(
  "/:id/rechazar",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const { observaciones } = req.body;
      const admin_id = req.user?.id;

      const apertura = await prisma.aperturaCaja.findUnique({
        where: { id },
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

      const aperturaActualizada = await prisma.aperturaCaja.update({
        where: { id },
        data: {
          estado: EstadoApertura.RECHAZADO,
          aprobado_por: admin_id,
          hora_aprobacion: nowEcuador(),
          observaciones_admin: observaciones || null,
        },
      });

      logger.info("Apertura rechazada por admin", {
        apertura_id: id,
        admin_id,
      });

      return res.json({
        success: true,
        apertura: aperturaActualizada,
        message: "Apertura rechazada. El operador debe realizar un nuevo conteo.",
      });
    } catch (error) {
      logger.error("Error al rechazar apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
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

export default router;
