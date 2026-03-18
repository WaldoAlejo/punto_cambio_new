import express from "express";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import prisma from "../../lib/prisma.js";
import {
  nowEcuador,
  todayGyeDateOnly,
  gyeDayRangeUtcFromDateOnly,
  gyeDayRangeUtcFromDate,
  formatEcuadorTime,
} from "../../utils/timezone.js";
import { authenticateToken, requireRole } from "../../middleware/auth.js";

const router = express.Router();

// =============================
// 💰 Gestión de Saldos
// =============================

router.get(
  "/saldo/historial",
  async (_: express.Request, res: express.Response) => {
    try {
      const dbService = new ServientregaDBService();
      const historial = await dbService.obtenerHistorialSaldos();

      res.json(historial);
    } catch (error) {
      console.error("Error al obtener historial Servientrega:", error);
      res.status(500).json({
        error: "Error al obtener historial",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

router.get(
  "/saldo/validar/:puntoAtencionId",
  async (req: express.Request, res: express.Response) => {
    try {
      const { puntoAtencionId } = req.params;
      const { monto } = req.query;

      console.log(
        `🔍 Servientrega: Validando saldo para punto ${puntoAtencionId}, monto: ${monto}`
      );

      if (!puntoAtencionId) {
        return res.status(400).json({
          estado: "ERROR",
          mensaje: "El ID del punto de atención es requerido",
        });
      }

      const dbService = new ServientregaDBService();
      const saldo = await dbService.obtenerSaldo(puntoAtencionId);

      if (!saldo) {
        console.log(
          `❌ Servientrega: No se encontró saldo para punto ${puntoAtencionId}`
        );
        return res.json({
          estado: "SIN_SALDO",
          mensaje: "No hay saldo asignado para este punto de atención",
          disponible: 0,
        });
      }

      const disponible = saldo.monto_total.sub(saldo.monto_usado).toNumber();
      const montoRequerido = monto ? parseFloat(monto as string) : 0;

      console.log(
        `💰 Servientrega: Saldo disponible: ${disponible}, Monto requerido: ${montoRequerido}`
      );

      if (disponible <= 0) {
        return res.json({
          estado: "SALDO_AGOTADO",
          mensaje: "El saldo disponible se ha agotado",
          disponible: disponible,
          monto_requerido: montoRequerido,
        });
      }

      if (montoRequerido > 0 && disponible < montoRequerido) {
        return res.json({
          estado: "SALDO_INSUFICIENTE",
          mensaje: `Saldo insuficiente. Disponible: $${disponible.toFixed(
            2
          )}, Requerido: $${montoRequerido.toFixed(2)}`,
          disponible: disponible,
          monto_requerido: montoRequerido,
        });
      }

      return res.json({
        estado: "OK",
        mensaje: "Saldo suficiente para la operación",
        disponible: disponible,
        monto_requerido: montoRequerido,
        monto_total: saldo.monto_total.toNumber(),
        monto_usado: saldo.monto_usado.toNumber(),
      });
    } catch (error) {
      console.error(
        `❌ Servientrega: Error al validar saldo para punto ${req.params.puntoAtencionId}:`,
        error
      );
      res.status(500).json({
        estado: "ERROR",
        mensaje: "Error interno al validar saldo",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

router.get(
  "/saldo/:puntoAtencionId",
  async (req: express.Request, res: express.Response) => {
    try {
      const { puntoAtencionId } = req.params;

      console.log(
        `💰 Servientrega: Consultando saldo para punto ${puntoAtencionId}`
      );

      if (!puntoAtencionId) {
        console.error(
          "❌ Servientrega: ID de punto de atención no proporcionado"
        );
        return res
          .status(400)
          .json({ error: "El ID del punto de atención es requerido" });
      }

      const dbService = new ServientregaDBService();
      const saldo = await dbService.obtenerSaldo(puntoAtencionId);

      if (!saldo) {
        console.log(
          `💰 Servientrega: No se encontró saldo para punto ${puntoAtencionId}, devolviendo 0`
        );
        return res.json({ disponible: 0 });
      }

      const disponible = saldo.monto_total.sub(saldo.monto_usado);
      const resultado = {
        disponible: disponible.toNumber(),
        monto_total: saldo.monto_total.toNumber(),
        monto_usado: saldo.monto_usado.toNumber(),
      };

      console.log(
        `✅ Servientrega: Saldo para punto ${puntoAtencionId}:`,
        resultado
      );
      res.json(resultado);
    } catch (error) {
      console.error(
        `❌ Servientrega: Error al obtener saldo para punto ${req.params.puntoAtencionId}:`,
        error
      );
      res.status(500).json({
        error: "Error al obtener saldo",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

router.post("/saldo", async (req: express.Request, res: express.Response) => {
  try {
    const { monto_total, creado_por, punto_atencion_id } = req.body;

    // Validaciones
    if (!punto_atencion_id) {
      return res
        .status(400)
        .json({ error: "El ID del punto de atención es requerido" });
    }

    if (!monto_total || isNaN(parseFloat(monto_total))) {
      return res
        .status(400)
        .json({ error: "El monto total debe ser un número válido" });
    }

    const dbService = new ServientregaDBService();
    const resultado = await dbService.gestionarSaldo({
      punto_atencion_id,
      monto_total: parseFloat(monto_total),
      creado_por,
    });

    res.json({
      success: true,
      saldo: {
        ...resultado,
        monto_total: resultado.monto_total.toNumber(),
        monto_usado: resultado.monto_usado.toNumber(),
      },
    });
  } catch (error) {
    console.error("Error al gestionar saldo:", error);
    res.status(500).json({
      success: false,
      error: "Error al gestionar saldo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// =============================
// 📋 Solicitudes de Saldo
// =============================

router.post(
  "/solicitar-saldo",
  async (req: express.Request, res: express.Response) => {
    try {
      const { punto_atencion_id, monto_solicitado, observaciones, creado_por } =
        req.body;

      // Validaciones
      if (!punto_atencion_id) {
        return res
          .status(400)
          .json({ error: "El ID del punto de atención es requerido" });
      }

      if (!monto_solicitado || isNaN(parseFloat(monto_solicitado))) {
        return res
          .status(400)
          .json({ error: "El monto solicitado debe ser un número válido" });
      }

      const dbService = new ServientregaDBService();
      const solicitud = await dbService.crearSolicitudSaldo({
        punto_atencion_id,
        monto_solicitado: parseFloat(monto_solicitado),
        observaciones: observaciones || "",
        creado_por: creado_por || "Sistema",
      });

      res.json({
        success: true,
        solicitud,
        message: "Solicitud de saldo creada correctamente",
      });
    } catch (error) {
      console.error("Error al crear solicitud de saldo:", error);
      res.status(500).json({
        success: false,
        error: "Error al crear solicitud de saldo",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

router.get(
  "/solicitar-saldo/listar",
  async (req: express.Request, res: express.Response) => {
    try {
      const { estado, punto_atencion_id } = req.query;

      const dbService = new ServientregaDBService();
      const solicitudes = await dbService.listarSolicitudesSaldo({
        estado: estado as string,
        punto_atencion_id: punto_atencion_id as string,
      });

      res.json({
        success: true,
        solicitudes,
      });
    } catch (error) {
      console.error("Error al listar solicitudes de saldo:", error);
      res.status(500).json({
        success: false,
        error: "Error al listar solicitudes de saldo",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

router.put(
  "/solicitar-saldo/:id/estado",
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const { estado, aprobado_por } = req.body;

      if (!id) {
        return res
          .status(400)
          .json({ error: "El ID de la solicitud es requerido" });
      }

      if (!["PENDIENTE", "APROBADA", "RECHAZADA"].includes(estado)) {
        return res.status(400).json({ error: "Estado inválido" });
      }

      const dbService = new ServientregaDBService();
      const solicitud = await dbService.actualizarEstadoSolicitudSaldo(
        id,
        estado,
        aprobado_por
      );

      res.json({
        success: true,
        solicitud,
        message: `Solicitud ${estado.toLowerCase()} correctamente`,
      });
    } catch (error) {
      console.error("Error al actualizar estado de solicitud:", error);
      res.status(500).json({
        success: false,
        error: "Error al actualizar estado de solicitud",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// =============================
// 🔍 Investigación de Saldos
// =============================

router.get(
  "/investigacion/auditoria",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { punto_id, fecha_desde, fecha_hasta } = req.query;

      if (!punto_id) {
        return res
          .status(400)
          .json({ success: false, message: "Faltan parámetros obligatorios" });
      }

      // 1. Encontrar la primera asignación para este punto
      const primeraAsignacion = await prisma.servientregaHistorialSaldo.findFirst({
        where: {
          punto_atencion_id: punto_id as string,
        },
        orderBy: { creado_en: "asc" },
      });

      if (!primeraAsignacion) {
        return res.json({
          success: true,
          dias: [],
          message: "No se encontraron asignaciones para este punto",
        });
      }

      // 2. Determinar rango de fechas
      const fechaInicio = fecha_desde
        ? new Date(fecha_desde as string)
        : primeraAsignacion.creado_en;
      const fechaFin = fecha_hasta ? new Date(fecha_hasta as string) : nowEcuador();

      // Ajustar a medianoche GYE para iterar
      const startStr = todayGyeDateOnly(fechaInicio);
      const endStr = todayGyeDateOnly(fechaFin);

      const currentDay = new Date(gyeDayRangeUtcFromDateOnly(startStr).gte);
      const lastDay = new Date(gyeDayRangeUtcFromDateOnly(endStr).gte);

      const resultados = [];
      let saldoAcumulado = 0;

      // Calcular el saldo acumulado hasta el día anterior al inicio
      // Saldo disponible = suma de historial (positivos=asignación, negativos=gasto)
      const historialAnterior = await prisma.servientregaHistorialSaldo.aggregate({
        where: {
          punto_atencion_id: punto_id as string,
          creado_en: { lt: currentDay },
        },
        _sum: { monto_total: true },
      });

      saldoAcumulado = Number(historialAnterior._sum.monto_total || 0);

      // Iterar día a día
      const dayIter = new Date(currentDay);
      let daysProcessed = 0;
      while (dayIter <= lastDay && daysProcessed < 90) {
        const { gte, lt } = gyeDayRangeUtcFromDate(dayIter);
        const dayStr = todayGyeDateOnly(dayIter);

        // Historial del día (incluye asignaciones (+) y gastos (-))
        const items = await prisma.servientregaHistorialSaldo.findMany({
          where: {
            punto_atencion_id: punto_id as string,
            creado_en: { gte, lt },
          },
          orderBy: { creado_en: "asc" },
        });

        const asigs = items.filter((i) => Number(i.monto_total) > 0);
        const gastos = items.filter((i) => Number(i.monto_total) < 0);

        const totalAsig = asigs.reduce((acc, curr) => acc + Number(curr.monto_total), 0);
        const totalGastos = gastos.reduce((acc, curr) => acc + Math.abs(Number(curr.monto_total)), 0);

        const saldoInicial = saldoAcumulado;
        saldoAcumulado = saldoAcumulado + totalAsig - totalGastos;
        const saldoFinal = saldoAcumulado;

        if (
          items.length > 0 ||
          dayStr === startStr ||
          dayStr === endStr
        ) {
          resultados.push({
            fecha: dayStr,
            saldo_inicial: Number(saldoInicial.toFixed(2)),
            asignaciones: Number(totalAsig.toFixed(2)),
            ingresos: 0, // En Servientrega no hay "ingresos" per se en este contexto
            egresos: Number(totalGastos.toFixed(2)),
            saldo_final: Number(saldoFinal.toFixed(2)),
            num_movimientos: items.length,
            detalles_movimientos: gastos.map((g) => ({
              id: g.id,
              tipo: "GASTO_GUIA",
              monto: Math.abs(Number(g.monto_total)),
              descripcion: g.creado_por,
              usuario: "Sistema",
              hora: formatEcuadorTime(g.creado_en),
            })),
            detalles_asignaciones: asigs.map((a) => ({
              id: a.id,
              monto: Number(a.monto_total),
              tipo: "ASIGNACION",
              observaciones: `Asignado por: ${a.creado_por}`,
              usuario: a.creado_por,
              hora: formatEcuadorTime(a.creado_en),
            })),
          });
        }

        dayIter.setDate(dayIter.getDate() + 1);
        daysProcessed++;
      }

      res.json({
        success: true,
        punto_id,
        fecha_inicio: startStr,
        fecha_fin: endStr,
        dias: resultados,
      });
    } catch (error) {
      console.error("Error en investigacion-saldos servientrega:", error);
      res.status(500).json({
        success: false,
        message: "Error en la investigación de saldos",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

export { router as balancesRouter };
