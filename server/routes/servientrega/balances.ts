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
import { ServicioExterno } from "@prisma/client";

const router = express.Router();

/** Asegura que exista USD y devuelve su id */
async function ensureUsdMonedaId(): Promise<string> {
  const existing = await prisma.moneda.findUnique({
    where: { codigo: "USD" },
    select: { id: true },
  });
  if (existing?.id) return existing.id;

  const created = await prisma.moneda.create({
    data: {
      nombre: "Dólar estadounidense",
      simbolo: "$",
      codigo: "USD",
      activo: true,
      orden_display: 0,
      comportamiento_compra: "MULTIPLICA",
      comportamiento_venta: "DIVIDE",
    },
    select: { id: true },
  });
  return created.id;
}

// =============================
// 💰 Gestión de Saldos - INTEGRADO CON SERVICIOS EXTERNOS
// =============================
// Ahora Servientrega usa ServicioExternoSaldo igual que Western

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

/**
 * Valida si hay saldo suficiente para generar una guía
 * Ahora usa ServicioExternoSaldo (igual que Western)
 */
router.get(
  "/saldo/validar/:puntoAtencionId",
  async (req: express.Request, res: express.Response) => {
    try {
      const { puntoAtencionId } = req.params;
      const { monto } = req.query;

      console.log(
        `🔍 Servientrega: Validando saldo (como servicio externo) para punto ${puntoAtencionId}, monto: ${monto}`
      );

      if (!puntoAtencionId) {
        return res.status(400).json({
          estado: "ERROR",
          mensaje: "El ID del punto de atención es requerido",
        });
      }

      const usdId = await ensureUsdMonedaId();
      
      // Buscar saldo en ServicioExternoSaldo (igual que Western)
      const saldo = await prisma.servicioExternoSaldo.findUnique({
        where: {
          punto_atencion_id_servicio_moneda_id: {
            punto_atencion_id: puntoAtencionId,
            servicio: ServicioExterno.SERVIENTREGA,
            moneda_id: usdId,
          },
        },
      });

      if (!saldo) {
        console.log(
          `❌ Servientrega: No se encontró saldo asignado para punto ${puntoAtencionId}`
        );
        return res.json({
          estado: "SIN_SALDO",
          mensaje: "No hay saldo asignado para Servientrega en este punto de atención. Contacte al administrador.",
          disponible: 0,
        });
      }

      const disponible = Number(saldo.cantidad || 0);
      const montoRequerido = monto ? parseFloat(monto as string) : 0;

      console.log(
        `💰 Servientrega: Saldo disponible: ${disponible}, Monto requerido: ${montoRequerido}`
      );

      if (disponible <= 0) {
        return res.json({
          estado: "SALDO_AGOTADO",
          mensaje: "El saldo de Servientrega se ha agotado",
          disponible: disponible,
          monto_requerido: montoRequerido,
        });
      }

      if (montoRequerido > 0 && disponible < montoRequerido) {
        return res.json({
          estado: "SALDO_INSUFICIENTE",
          mensaje: `Saldo insuficiente en Servientrega. Disponible: $${disponible.toFixed(
            2
          )}, Requerido: $${montoRequerido.toFixed(2)}`,
          disponible: disponible,
          monto_requerido: montoRequerido,
        });
      }

      return res.json({
        estado: "OK",
        mensaje: "Saldo suficiente para generar la guía",
        disponible: disponible,
        monto_requerido: montoRequerido,
        saldo_asignado: disponible,
        servicio: "SERVIENTREGA",
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

/**
 * Obtiene el saldo de Servientrega desde el sistema de Servicios Externos
 * Ahora Servientrega usa ServicioExternoSaldo igual que Western
 */
router.get(
  "/saldo/:puntoAtencionId",
  async (req: express.Request, res: express.Response) => {
    try {
      const { puntoAtencionId } = req.params;

      console.log(
        `💰 Servientrega: Consultando saldo (como servicio externo) para punto ${puntoAtencionId}`
      );

      if (!puntoAtencionId) {
        console.error(
          "❌ Servientrega: ID de punto de atención no proporcionado"
        );
        return res
          .status(400)
          .json({ error: "El ID del punto de atención es requerido" });
      }

      const usdId = await ensureUsdMonedaId();
      
      // Buscar saldo en ServicioExternoSaldo (igual que Western)
      const saldo = await prisma.servicioExternoSaldo.findUnique({
        where: {
          punto_atencion_id_servicio_moneda_id: {
            punto_atencion_id: puntoAtencionId,
            servicio: ServicioExterno.SERVIENTREGA,
            moneda_id: usdId,
          },
        },
      });

      if (!saldo) {
        console.log(
          `💰 Servientrega: No se encontró saldo asignado para punto ${puntoAtencionId}, devolviendo 0`
        );
        return res.json({ 
          disponible: 0,
          servicio: "SERVIENTREGA",
          nota: "No hay saldo asignado. Contacte al administrador."
        });
      }

      const disponible = Number(saldo.cantidad || 0);
      const resultado = {
        disponible: disponible,
        saldo_asignado: disponible,
        billetes: Number(saldo.billetes || 0),
        monedas_fisicas: Number(saldo.monedas_fisicas || 0),
        bancos: Number(saldo.bancos || 0),
        servicio: "SERVIENTREGA",
        // Campos legacy para compatibilidad
        monto_total: disponible,
        monto_usado: 0,
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

/**
 * Asigna saldo a Servientrega (usando el sistema de servicios externos)
 * Los administradores pueden usar /servicios-externos/asignar-saldo
 */
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

    const usdId = await ensureUsdMonedaId();
    
    // Crear/actualizar saldo en ServicioExternoSaldo (igual que Western)
    const existing = await prisma.servicioExternoSaldo.findUnique({
      where: {
        punto_atencion_id_servicio_moneda_id: {
          punto_atencion_id,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: usdId,
        },
      },
    });

    let resultado;
    if (existing) {
      resultado = await prisma.servicioExternoSaldo.update({
        where: { id: existing.id },
        data: {
          cantidad: { increment: parseFloat(monto_total) },
          updated_at: new Date(),
        },
      });
    } else {
      resultado = await prisma.servicioExternoSaldo.create({
        data: {
          punto_atencion_id,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: usdId,
          cantidad: parseFloat(monto_total),
          billetes: 0,
          monedas_fisicas: 0,
          bancos: 0,
        },
      });
    }

    // Registrar en historial de asignaciones
    await prisma.servicioExternoAsignacion.create({
      data: {
        punto_atencion_id,
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: usdId,
        monto: parseFloat(monto_total),
        tipo: "RECARGA",
        asignado_por: (req as any).user?.id || "system",
        observaciones: creado_por ? `Asignado por ${creado_por}` : undefined,
      },
    });

    res.json({
      success: true,
      saldo: {
        disponible: Number(resultado.cantidad),
        saldo_asignado: Number(resultado.cantidad),
        servicio: "SERVIENTREGA",
      },
      nota: "Servientrega ahora usa el sistema de saldos de servicios externos (como Western)",
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

// ========================================
// ✅ Verificar configuración de Servientrega en el punto
// ========================================

router.get(
  "/configuracion/:puntoAtencionId",
  async (req: express.Request, res: express.Response) => {
    try {
      const { puntoAtencionId } = req.params;

      console.log(
        `🔍 Servientrega: Verificando configuración para punto ${puntoAtencionId}`
      );

      if (!puntoAtencionId) {
        return res.status(400).json({
          habilitado: false,
          error: "El ID del punto de atención es requerido",
        });
      }

      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: puntoAtencionId },
        select: {
          id: true,
          nombre: true,
          servientrega_agencia_codigo: true,
          servientrega_agencia_nombre: true,
          servientrega_alianza: true,
          servientrega_oficina_alianza: true,
        },
      });

      if (!punto) {
        return res.status(404).json({
          habilitado: false,
          error: "Punto de atención no encontrado",
        });
      }

      // Verificar que tenga TODOS los campos requeridos
      const camposRequeridos = {
        agencia_codigo: punto.servientrega_agencia_codigo,
        agencia_nombre: punto.servientrega_agencia_nombre,
        alianza: punto.servientrega_alianza,
        oficina_alianza: punto.servientrega_oficina_alianza,
      };

      const camposFaltantes = Object.entries(camposRequeridos)
        .filter(([_, valor]) => !valor)
        .map(([campo]) => campo);

      const habilitado = camposFaltantes.length === 0;

      console.log(
        `🔍 Servientrega: Punto ${punto.nombre} - Habilitado: ${habilitado}, Faltan: [${camposFaltantes.join(", ")}]`
      );

      return res.json({
        habilitado,
        punto_id: punto.id,
        punto_nombre: punto.nombre,
        configuracion: habilitado
          ? {
              agencia_codigo: punto.servientrega_agencia_codigo,
              agencia_nombre: punto.servientrega_agencia_nombre,
              alianza: punto.servientrega_alianza,
              oficina_alianza: punto.servientrega_oficina_alianza,
            }
          : null,
        campos_faltantes: camposFaltantes.length > 0 ? camposFaltantes : undefined,
        mensaje: habilitado
          ? "Servientrega habilitado para este punto"
          : `Faltan campos requeridos: ${camposFaltantes.join(", ")}`,
      });
    } catch (error) {
      console.error(
        `❌ Servientrega: Error al verificar configuración para punto ${req.params.puntoAtencionId}:`,
        error
      );
      res.status(500).json({
        habilitado: false,
        error: "Error interno al verificar configuración",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

export { router as balancesRouter };
