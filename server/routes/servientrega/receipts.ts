import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

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
    } = req.body;

    const usuario_id = (req as any).user?.id;

    if (
      !numero_recibo ||
      !referencia_id ||
      !punto_atencion_id ||
      !datos_operacion
    ) {
      return res.status(400).json({
        error:
          "Faltan campos requeridos: numero_recibo, referencia_id, punto_atencion_id, datos_operacion",
      });
    }

    console.log(
      `📄 Servientrega: Creando recibo ${numero_recibo} para guía ${referencia_id}`
    );

    // Verificar que el punto de atención existe
    const puntoAtencion = await prisma.puntoAtencion.findUnique({
      where: { id: punto_atencion_id },
    });

    if (!puntoAtencion) {
      return res.status(404).json({
        error: "Punto de atención no encontrado",
      });
    }

    // Crear el recibo
    const recibo = await prisma.recibo.create({
      data: {
        numero_recibo,
        tipo_operacion: "SERVIENTREGA",
        referencia_id,
        usuario_id,
        punto_atencion_id,
        datos_operacion,
        numero_copias,
        impreso: false,
      },
      include: {
        puntoAtencion: {
          select: {
            nombre: true,
          },
        },
        usuario: {
          select: {
            nombre: true,
            apellido: true,
          },
        },
      },
    });

    console.log(`✅ Servientrega: Recibo ${numero_recibo} creado exitosamente`);

    res.json({
      success: true,
      recibo: {
        id: recibo.id,
        numero_recibo: recibo.numero_recibo,
        fecha: recibo.fecha,
        punto_atencion: recibo.puntoAtencion.nombre,
        usuario: `${recibo.usuario.nombre} ${recibo.usuario.apellido}`,
        impreso: recibo.impreso,
        numero_copias: recibo.numero_copias,
      },
    });
  } catch (error) {
    console.error("❌ Servientrega: Error al crear recibo:", error);
    res.status(500).json({
      error: "Error interno del servidor al crear el recibo",
    });
  }
});

// ====================================
// 📄 OBTENER RECIBO POR ID
// ====================================
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const recibo = await prisma.recibo.findUnique({
      where: { id },
      include: {
        puntoAtencion: {
          select: {
            nombre: true,
          },
        },
        usuario: {
          select: {
            nombre: true,
            apellido: true,
          },
        },
      },
    });

    if (!recibo) {
      return res.status(404).json({
        error: "Recibo no encontrado",
      });
    }

    if (recibo.tipo_operacion !== "SERVIENTREGA") {
      return res.status(400).json({
        error: "El recibo no es de tipo Servientrega",
      });
    }

    res.json({
      success: true,
      recibo: {
        id: recibo.id,
        numero_recibo: recibo.numero_recibo,
        fecha: recibo.fecha,
        referencia_id: recibo.referencia_id,
        punto_atencion: recibo.puntoAtencion.nombre,
        usuario: `${recibo.usuario.nombre} ${recibo.usuario.apellido}`,
        datos_operacion: recibo.datos_operacion,
        impreso: recibo.impreso,
        numero_copias: recibo.numero_copias,
      },
    });
  } catch (error) {
    console.error("❌ Servientrega: Error al obtener recibo:", error);
    res.status(500).json({
      error: "Error interno del servidor al obtener el recibo",
    });
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
          tipo_operacion: "SERVIENTREGA",
          referencia_id: numeroGuia,
        },
        include: {
          puntoAtencion: {
            select: {
              nombre: true,
            },
          },
          usuario: {
            select: {
              nombre: true,
              apellido: true,
            },
          },
        },
        orderBy: {
          fecha: "desc",
        },
      });

      if (!recibo) {
        return res.status(404).json({
          error: "No se encontró recibo para esta guía",
        });
      }

      res.json({
        success: true,
        recibo: {
          id: recibo.id,
          numero_recibo: recibo.numero_recibo,
          fecha: recibo.fecha,
          referencia_id: recibo.referencia_id,
          punto_atencion: recibo.puntoAtencion.nombre,
          usuario: `${recibo.usuario.nombre} ${recibo.usuario.apellido}`,
          datos_operacion: recibo.datos_operacion,
          impreso: recibo.impreso,
          numero_copias: recibo.numero_copias,
        },
      });
    } catch (error) {
      console.error(
        "❌ Servientrega: Error al obtener recibo por guía:",
        error
      );
      res.status(500).json({
        error: "Error interno del servidor al obtener el recibo",
      });
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
      const { impreso = true, numero_copias } = req.body;

      const updateData: any = { impreso };
      if (numero_copias !== undefined) {
        updateData.numero_copias = numero_copias;
      }

      const recibo = await prisma.recibo.update({
        where: { id },
        data: updateData,
      });

      console.log(
        `📄 Servientrega: Recibo ${recibo.numero_recibo} marcado como ${
          impreso ? "impreso" : "no impreso"
        }`
      );

      res.json({
        success: true,
        message: `Recibo marcado como ${impreso ? "impreso" : "no impreso"}`,
      });
    } catch (error) {
      console.error(
        "❌ Servientrega: Error al actualizar estado de impresión:",
        error
      );
      res.status(500).json({
        error: "Error interno del servidor al actualizar el recibo",
      });
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
    } = req.query;

    const whereClause: any = {
      tipo_operacion: "SERVIENTREGA",
    };

    if (punto_atencion_id) {
      whereClause.punto_atencion_id = punto_atencion_id as string;
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

    if (impreso !== undefined) {
      whereClause.impreso = impreso === "true";
    }

    const recibos = await prisma.recibo.findMany({
      where: whereClause,
      include: {
        puntoAtencion: {
          select: {
            nombre: true,
          },
        },
        usuario: {
          select: {
            nombre: true,
            apellido: true,
          },
        },
      },
      orderBy: {
        fecha: "desc",
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.recibo.count({
      where: whereClause,
    });

    res.json({
      success: true,
      recibos: recibos.map((recibo) => ({
        id: recibo.id,
        numero_recibo: recibo.numero_recibo,
        fecha: recibo.fecha,
        referencia_id: recibo.referencia_id,
        punto_atencion: recibo.puntoAtencion.nombre,
        usuario: `${recibo.usuario.nombre} ${recibo.usuario.apellido}`,
        impreso: recibo.impreso,
        numero_copias: recibo.numero_copias,
      })),
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + parseInt(limit as string) < total,
      },
    });
  } catch (error) {
    console.error("❌ Servientrega: Error al listar recibos:", error);
    res.status(500).json({
      error: "Error interno del servidor al listar recibos",
    });
  }
});

export default router;
