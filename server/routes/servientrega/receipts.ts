import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma.js";
import { authenticateToken } from "../../middleware/auth.js";
import logger from "../../utils/logger.js";
import { Prisma, TipoRecibo } from "@prisma/client";

const router = Router();

// Usaremos MOVIMIENTO para los recibos de Servientrega
const RECIBO_TIPO_SERVIENTREGA: TipoRecibo = TipoRecibo.MOVIMIENTO;

// ====================================
// 📄 CREAR RECIBO DE SERVIENTREGA
// ====================================
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      numero_recibo,
      referencia_id, // ID de la guía de Servientrega
      punto_atencion_id,
      datos_operacion, // Datos completos de la operación (guía + tarifa)
      numero_copias = 2,
    } = req.body as {
      numero_recibo?: string;
      referencia_id?: string;
      punto_atencion_id?: string;
      datos_operacion?: unknown;
      numero_copias?: number;
    };

    const usuario_id = (req as any).user?.id as string | undefined;
    if (!usuario_id) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (
      !numero_recibo ||
      !referencia_id ||
      !punto_atencion_id ||
      datos_operacion === undefined
    ) {
      return res.status(400).json({
        error:
          "Faltan campos requeridos: numero_recibo, referencia_id, punto_atencion_id, datos_operacion",
      });
    }

    // Normaliza datos_operacion a InputJsonValue (evita TS2322)
    const datosOperacion: Prisma.InputJsonValue =
      (datos_operacion as Prisma.InputJsonValue) ??
      ({} as Prisma.InputJsonValue);

    // Verificar que el punto de atención existe
    const puntoExists = await prisma.puntoAtencion.findUnique({
      where: { id: punto_atencion_id },
      select: { id: true },
    });
    if (!puntoExists) {
      return res.status(404).json({ error: "Punto de atención no encontrado" });
    }

    // Crear el recibo (sin include para evitar errores de tipo)
    const recibo = await prisma.recibo.create({
      data: {
        numero_recibo,
        tipo_operacion: RECIBO_TIPO_SERVIENTREGA,
        referencia_id,
        usuario_id,
        punto_atencion_id,
        datos_operacion: datosOperacion,
        numero_copias,
        impreso: false,
      },
    });

    // Resolver nombres en paralelo (evita depender de relaciones tipadas)
    const [punto, usuarioDb] = await Promise.all([
      prisma.puntoAtencion.findUnique({
        where: { id: recibo.punto_atencion_id },
        select: { nombre: true },
      }),
      prisma.usuario.findUnique({
        where: { id: recibo.usuario_id },
        select: { nombre: true, username: true },
      }),
    ]);

    logger?.info?.(`Servientrega: Recibo ${numero_recibo} creado`);

    res.json({
      success: true,
      recibo: {
        id: recibo.id,
        numero_recibo: recibo.numero_recibo,
        fecha: recibo.fecha,
        punto_atencion: punto?.nombre ?? "",
        usuario: usuarioDb?.nombre ?? usuarioDb?.username ?? "",
        impreso: recibo.impreso,
        numero_copias: recibo.numero_copias,
      },
    });
  } catch (error) {
    logger?.error?.("Servientrega: Error al crear recibo", { error });
    res
      .status(500)
      .json({ error: "Error interno del servidor al crear el recibo" });
  }
});

// ====================================
// 📄 OBTENER RECIBO POR ID
// ====================================
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const recibo = await prisma.recibo.findUnique({ where: { id } });
    if (!recibo) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    if (recibo.tipo_operacion !== RECIBO_TIPO_SERVIENTREGA) {
      return res
        .status(400)
        .json({ error: "El recibo no es de tipo Servientrega" });
    }

    const [punto, usuarioDb] = await Promise.all([
      prisma.puntoAtencion.findUnique({
        where: { id: recibo.punto_atencion_id },
        select: { nombre: true },
      }),
      prisma.usuario.findUnique({
        where: { id: recibo.usuario_id },
        select: { nombre: true, username: true },
      }),
    ]);

    res.json({
      success: true,
      recibo: {
        id: recibo.id,
        numero_recibo: recibo.numero_recibo,
        fecha: recibo.fecha,
        referencia_id: recibo.referencia_id,
        punto_atencion: punto?.nombre ?? "",
        usuario: usuarioDb?.nombre ?? usuarioDb?.username ?? "",
        datos_operacion: recibo.datos_operacion,
        impreso: recibo.impreso,
        numero_copias: recibo.numero_copias,
      },
    });
  } catch (error) {
    logger?.error?.("Servientrega: Error al obtener recibo", { error });
    res
      .status(500)
      .json({ error: "Error interno del servidor al obtener el recibo" });
  }
});

// ====================================
// 📄 OBTENER RECIBO POR NÚMERO DE GUÍA
// ====================================
router.get(
  "/guia/:numeroGuia",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { numeroGuia } = req.params;

      const recibo = await prisma.recibo.findFirst({
        where: {
          tipo_operacion: RECIBO_TIPO_SERVIENTREGA,
          referencia_id: numeroGuia,
        },
        orderBy: { fecha: "desc" },
      });

      if (!recibo) {
        return res
          .status(404)
          .json({ error: "No se encontró recibo para esta guía" });
      }

      const [punto, usuarioDb] = await Promise.all([
        prisma.puntoAtencion.findUnique({
          where: { id: recibo.punto_atencion_id },
          select: { nombre: true },
        }),
        prisma.usuario.findUnique({
          where: { id: recibo.usuario_id },
          select: { nombre: true, username: true },
        }),
      ]);

      res.json({
        success: true,
        recibo: {
          id: recibo.id,
          numero_recibo: recibo.numero_recibo,
          fecha: recibo.fecha,
          referencia_id: recibo.referencia_id,
          punto_atencion: punto?.nombre ?? "",
          usuario: usuarioDb?.nombre ?? usuarioDb?.username ?? "",
          datos_operacion: recibo.datos_operacion,
          impreso: recibo.impreso,
          numero_copias: recibo.numero_copias,
        },
      });
    } catch (error) {
      logger?.error?.("Servientrega: Error al obtener recibo por guía", {
        error,
      });
      res
        .status(500)
        .json({ error: "Error interno del servidor al obtener el recibo" });
    }
  }
);

// ====================================
// 📄 MARCAR RECIBO COMO IMPRESO
// ====================================
router.patch(
  "/:id/impreso",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { impreso = true, numero_copias } = req.body as {
        impreso?: boolean;
        numero_copias?: number;
      };

      const updateData: any = { impreso: Boolean(impreso) };
      if (numero_copias !== undefined) {
        updateData.numero_copias =
          Number.parseInt(String(numero_copias), 10) || 0;
      }

      const recibo = await prisma.recibo.update({
        where: { id },
        data: updateData,
      });

      logger?.info?.(
        `Servientrega: Recibo ${recibo.numero_recibo} marcado como ${
          updateData.impreso ? "impreso" : "no impreso"
        }`
      );

      res.json({
        success: true,
        message: `Recibo marcado como ${
          updateData.impreso ? "impreso" : "no impreso"
        }`,
      });
    } catch (error) {
      logger?.error?.("Servientrega: Error al actualizar estado de impresión", {
        error,
      });
      res
        .status(500)
        .json({ error: "Error interno del servidor al actualizar el recibo" });
    }
  }
);

// ====================================
// 📄 LISTAR RECIBOS DE SERVIENTREGA
// ====================================
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      punto_atencion_id,
      fecha_desde,
      fecha_hasta,
      impreso,
      limit = "50",
      offset = "0",
    } = req.query as Record<string, string | undefined>;

    const whereClause: any = { tipo_operacion: RECIBO_TIPO_SERVIENTREGA };

    if (punto_atencion_id)
      whereClause.punto_atencion_id = String(punto_atencion_id);

    if (fecha_desde || fecha_hasta) {
      whereClause.fecha = {};
      if (fecha_desde) whereClause.fecha.gte = new Date(String(fecha_desde));
      if (fecha_hasta) whereClause.fecha.lte = new Date(String(fecha_hasta));
    }

    if (impreso !== undefined) whereClause.impreso = String(impreso) === "true";

    const take = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
    const skip = Math.max(parseInt(String(offset), 10) || 0, 0);

    const [recibos, total] = await Promise.all([
      prisma.recibo.findMany({
        where: whereClause,
        orderBy: { fecha: "desc" },
        take,
        skip,
      }),
      prisma.recibo.count({ where: whereClause }),
    ]);

    // Batch para nombres
    const puntoIds = Array.from(
      new Set(recibos.map((r) => r.punto_atencion_id).filter(Boolean))
    );
    const usuarioIds = Array.from(
      new Set(recibos.map((r) => r.usuario_id).filter(Boolean))
    );

    const [puntos, usuarios] = await Promise.all([
      puntoIds.length
        ? prisma.puntoAtencion.findMany({
            where: { id: { in: puntoIds } },
            select: { id: true, nombre: true },
          })
        : Promise.resolve([]),
      usuarioIds.length
        ? prisma.usuario.findMany({
            where: { id: { in: usuarioIds } },
            select: { id: true, nombre: true, username: true },
          })
        : Promise.resolve([]),
    ]);

    const mapPuntos = new Map(puntos.map((p) => [p.id, p.nombre]));
    const mapUsuarios = new Map(
      usuarios.map((u) => [u.id, u.nombre || u.username || ""])
    );

    res.json({
      success: true,
      recibos: recibos.map((r) => ({
        id: r.id,
        numero_recibo: r.numero_recibo,
        fecha: r.fecha,
        referencia_id: r.referencia_id,
        punto_atencion: mapPuntos.get(r.punto_atencion_id) ?? "",
        usuario: mapUsuarios.get(r.usuario_id) ?? "",
        impreso: r.impreso,
        numero_copias: r.numero_copias,
      })),
      pagination: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    logger?.error?.("Servientrega: Error al listar recibos", { error });
    res
      .status(500)
      .json({ error: "Error interno del servidor al listar recibos" });
  }
});

export default router;
