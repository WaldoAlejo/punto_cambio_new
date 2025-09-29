import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { subDays } from "date-fns";

export interface RemitenteData {
  identificacion?: string;
  cedula?: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email?: string;
  ciudad: string;
  provincia: string;
  codigo_postal?: string;
  pais?: string;
}

export interface DestinatarioData extends RemitenteData {
  // codpais se mapea a pais en la base de datos (se ignora en sanitización)
}

export interface GuiaData {
  numero_guia: string;
  proceso: string;
  base64_response: string;
  remitente_id: string;
  destinatario_id: string;
}

export interface SaldoData {
  punto_atencion_id: string;
  monto_total: number;
  monto_usado?: number;
  creado_por?: string;
}

export class ServientregaDBService {
  // ===== REMITENTES =====
  async buscarRemitentes(cedula: string) {
    return prisma.servientregaRemitente.findMany({
      where: {
        cedula: {
          contains: cedula,
          mode: "insensitive",
        },
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });
  }

  async guardarRemitente(data: RemitenteData) {
    const sanitizedData = this.sanitizeRemitenteData(data);
    return prisma.servientregaRemitente.create({
      data: sanitizedData as any, // Prisma types are too estrictos aquí
    });
  }

  async actualizarRemitente(cedula: string, data: Partial<RemitenteData>) {
    const filteredData = this.sanitizeRemitenteData(data);
    return prisma.servientregaRemitente.updateMany({
      where: { cedula },
      data: filteredData,
    });
  }

  /**
   * Remitente: NO guardamos ciudad/provincia/pais intencionalmente,
   * porque el remitente SIEMPRE es el punto de atención.
   */
  private sanitizeRemitenteData(
    data: Partial<RemitenteData>
  ): Record<string, any> {
    const allowedFields = [
      "cedula",
      "nombre",
      "direccion",
      "telefono",
      "codigo_postal",
      "email",
    ];
    return Object.keys(data)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj: Record<string, any>, key) => {
        obj[key] = data[key as keyof RemitenteData];
        return obj;
      }, {});
  }

  // ===== DESTINATARIOS =====
  async buscarDestinatarios(cedula: string) {
    return prisma.servientregaDestinatario.findMany({
      where: {
        cedula: {
          contains: cedula,
          mode: "insensitive",
        },
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });
  }

  async buscarDestinatariosPorNombre(nombre: string) {
    return prisma.servientregaDestinatario.findMany({
      where: {
        nombre: {
          contains: nombre,
          mode: "insensitive",
        },
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });
  }

  async guardarDestinatario(data: DestinatarioData) {
    const sanitizedData = this.sanitizeDestinatarioData(data);
    return prisma.servientregaDestinatario.create({
      data: sanitizedData as any,
    });
  }

  async actualizarDestinatario(
    cedula: string,
    data: Partial<DestinatarioData>
  ) {
    // Verificar si existe
    const existing = await prisma.servientregaDestinatario.findFirst({
      where: { cedula },
    });

    if (!existing) {
      throw new Error("Destinatario no encontrado");
    }

    const filteredData = this.sanitizeDestinatarioData(data);
    return prisma.servientregaDestinatario.updateMany({
      where: { cedula },
      data: filteredData,
    });
  }

  /**
   * Destinatario: ignoramos 'codpais' (numérico). Usar 'pais' (string).
   */
  private sanitizeDestinatarioData(
    data: Partial<DestinatarioData>
  ): Record<string, any> {
    const allowedFields = [
      "cedula",
      "nombre",
      "direccion",
      "ciudad",
      "provincia",
      "pais",
      "telefono",
      "email",
      "codigo_postal",
    ];

    const sanitized = Object.keys(data)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj: Record<string, any>, key) => {
        obj[key] = data[key as keyof DestinatarioData];
        return obj;
      }, {});

    return sanitized;
  }

  // ===== GUÍAS =====
  async guardarGuia(data: GuiaData) {
    return prisma.servientregaGuia.create({ data });
  }

  async anularGuia(numeroGuia: string) {
    return prisma.servientregaGuia.updateMany({
      where: { numero_guia: numeroGuia },
      data: { proceso: "Anulada" },
    });
  }

  async obtenerGuias(desde?: string, hasta?: string) {
    return prisma.servientregaGuia.findMany({
      where: {
        created_at: {
          gte: desde ? new Date(desde) : subDays(new Date(), 30),
          lte: hasta ? new Date(hasta) : new Date(),
        },
      },
      include: {
        remitente: true,
        destinatario: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  // ===== SALDOS =====
  async obtenerSaldo(puntoAtencionId: string) {
    return prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id: puntoAtencionId },
    });
  }

  /**
   * Asignación de saldo: transacción + historial + upsert con increment.
   */
  async gestionarSaldo(data: SaldoData) {
    const { punto_atencion_id, monto_total, creado_por } = data;

    return prisma.$transaction(async (tx) => {
      // Obtener información del punto de atención
      const puntoAtencion = await tx.puntoAtencion.findUnique({
        where: { id: punto_atencion_id },
        select: { nombre: true },
      });

      // Registrar en el historial cada asignación de saldo (crédito)
      await tx.servientregaHistorialSaldo.create({
        data: {
          punto_atencion_id,
          punto_atencion_nombre: puntoAtencion?.nombre || "Punto desconocido",
          monto_total: new Prisma.Decimal(monto_total),
          creado_por: creado_por || "SYSTEM",
        },
      });

      // Upsert del saldo con incremento
      const actualizado = await tx.servientregaSaldo.upsert({
        where: { punto_atencion_id },
        update: {
          monto_total: { increment: monto_total },
          updated_at: new Date(),
        },
        create: {
          punto_atencion_id,
          monto_total: new Prisma.Decimal(monto_total),
          monto_usado: new Prisma.Decimal(0),
          creado_por: creado_por || "SYSTEM",
        },
      });

      return actualizado;
    });
  }

  /**
   * Descuento de saldo: transacción, evita sobregiros y registra historial (débito).
   */
  async descontarSaldo(puntoAtencionId: string, monto: number) {
    return prisma.$transaction(async (tx) => {
      const saldo = await tx.servientregaSaldo.findUnique({
        where: { punto_atencion_id: puntoAtencionId },
      });
      if (!saldo) return null;

      const usado = saldo.monto_usado ?? new Prisma.Decimal(0);
      const total = saldo.monto_total ?? new Prisma.Decimal(0);
      const nuevoUsado = usado.add(new Prisma.Decimal(monto));
      const disponible = total.sub(nuevoUsado);

      if (disponible.lt(0)) {
        throw new Error("Saldo insuficiente");
      }

      const actualizado = await tx.servientregaSaldo.update({
        where: { punto_atencion_id: puntoAtencionId },
        data: { monto_usado: nuevoUsado, updated_at: new Date() },
      });

      // Registrar movimiento en historial (débito). Si tu esquema soporta 'tipo', úsalo; si no, dejamos el monto negativo.
      const puntoAtencion = await tx.puntoAtencion.findUnique({
        where: { id: puntoAtencionId },
        select: { nombre: true },
      });

      await tx.servientregaHistorialSaldo.create({
        data: {
          punto_atencion_id: puntoAtencionId,
          punto_atencion_nombre: puntoAtencion?.nombre || "Punto desconocido",
          monto_total: new Prisma.Decimal(-monto), // negativo = débito
          creado_por: "SYSTEM:DESCUENTO_GUIA",
        },
      });

      return actualizado;
    });
  }

  async obtenerHistorialSaldos() {
    const historial = await prisma.servientregaHistorialSaldo.findMany({
      select: {
        id: true,
        monto_total: true,
        creado_por: true,
        creado_en: true,
        punto_atencion_id: true,
        punto_atencion_nombre: true,
        punto_atencion: {
          select: {
            id: true,
            nombre: true,
            ciudad: true,
            provincia: true,
          },
        },
      },
      orderBy: { creado_en: "desc" },
    });

    return historial.map((item) => ({
      ...item,
      punto_nombre: item.punto_atencion?.nombre || item.punto_atencion_nombre,
      punto_ubicacion: `${item.punto_atencion?.ciudad ?? ""}${
        item.punto_atencion?.ciudad ? ", " : ""
      }${item.punto_atencion?.provincia ?? ""}`,
    }));
  }

  // ===== SOLICITUDES DE SALDO =====
  async crearSolicitudSaldo(data: {
    punto_atencion_id: string;
    monto_solicitado: number;
    observaciones: string;
    creado_por: string;
  }) {
    // Obtener el nombre del punto de atención
    const puntoAtencion = await prisma.puntoAtencion.findUnique({
      where: { id: data.punto_atencion_id },
      select: { nombre: true },
    });

    return prisma.servientregaSolicitudSaldo.create({
      data: {
        punto_atencion_id: data.punto_atencion_id,
        punto_atencion_nombre: puntoAtencion?.nombre || "Punto desconocido",
        monto_requerido: new Prisma.Decimal(data.monto_solicitado),
        observaciones: data.observaciones,
        estado: "PENDIENTE",
      },
      include: {
        punto_atencion: {
          select: {
            nombre: true,
            ciudad: true,
            provincia: true,
          },
        },
      },
    });
  }

  async listarSolicitudesSaldo(filtros?: {
    estado?: string;
    punto_atencion_id?: string;
  }) {
    const where: any = {};

    if (filtros?.estado) {
      where.estado = filtros.estado;
    }

    if (filtros?.punto_atencion_id) {
      where.punto_atencion_id = filtros.punto_atencion_id;
    }

    return prisma.servientregaSolicitudSaldo.findMany({
      where,
      include: {
        punto_atencion: {
          select: {
            nombre: true,
            ciudad: true,
            provincia: true,
          },
        },
      },
      orderBy: { creado_en: "desc" },
    });
  }

  async actualizarEstadoSolicitudSaldo(
    id: string,
    estado: string,
    aprobado_por?: string
  ) {
    return prisma.servientregaSolicitudSaldo.update({
      where: { id },
      data: {
        estado,
        aprobado_por,
        aprobado_en: new Date(),
      },
      include: {
        punto_atencion: {
          select: {
            nombre: true,
            ciudad: true,
            provincia: true,
          },
        },
      },
    });
  }

  // ===== PUNTOS DE ATENCIÓN =====
  async obtenerPuntosAtencion() {
    // Obtener puntos activos con agencia Servientrega no nula
    const puntos = await prisma.puntoAtencion.findMany({
      select: {
        id: true,
        nombre: true,
        direccion: true,
        ciudad: true,
        provincia: true,
        codigo_postal: true,
        telefono: true,
        activo: true,
        servientrega_agencia_codigo: true,
        servientrega_agencia_nombre: true,
      },
      where: {
        activo: true,
        servientrega_agencia_codigo: {
          not: null,
        },
      },
      orderBy: [{ provincia: "asc" }, { ciudad: "asc" }, { nombre: "asc" }],
    });

    // Filtrar manualmente agencias con sólo espacios
    const filtrados = puntos.filter(
      (p) =>
        p.servientrega_agencia_codigo &&
        p.servientrega_agencia_codigo.trim() !== ""
    );

    // Normalizar (trim) antes de devolver
    return filtrados.map((punto) => ({
      ...punto,
      servientrega_agencia_codigo:
        punto.servientrega_agencia_codigo?.trim() || null,
      servientrega_agencia_nombre:
        punto.servientrega_agencia_nombre?.trim() || null,
    }));
  }

  // ===== INFORMES Y ESTADÍSTICAS =====
  async obtenerGuiasConFiltros(filtros: {
    desde?: string;
    hasta?: string;
    estado?: string;
    punto_atencion_id?: string;
  }) {
    const where: any = {};

    // Filtro por fechas
    if (filtros.desde || filtros.hasta) {
      where.created_at = {};
      if (filtros.desde) {
        where.created_at.gte = new Date(filtros.desde);
      }
      if (filtros.hasta) {
        where.created_at.lte = new Date(filtros.hasta);
      }
    }

    // Filtro por estado
    if (filtros.estado && filtros.estado !== "TODOS") {
      switch (filtros.estado) {
        case "ACTIVA":
          where.proceso = { not: "Anulada" };
          break;
        case "ANULADA":
          where.proceso = "Anulada";
          break;
        case "PENDIENTE_ANULACION":
          where.proceso = "Pendiente_Anulacion";
          break;
      }
    }

    // Filtro por punto de atención
    if (filtros.punto_atencion_id && filtros.punto_atencion_id !== "TODOS") {
      where.punto_atencion_id = filtros.punto_atencion_id;
    }

    return prisma.servientregaGuia.findMany({
      where,
      include: {
        remitente: true,
        destinatario: true,
        punto_atencion: {
          select: {
            id: true,
            nombre: true,
            ciudad: true,
            provincia: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  async obtenerEstadisticasGuias(filtros: { desde?: string; hasta?: string }) {
    const where: any = {};

    // Filtro por fechas
    if (filtros.desde || filtros.hasta) {
      where.created_at = {};
      if (filtros.desde) {
        where.created_at.gte = new Date(filtros.desde);
      }
      if (filtros.hasta) {
        where.created_at.lte = new Date(filtros.hasta);
      }
    }

    // Estadísticas generales
    const [totalGuias, guiasActivas, guiasAnuladas, guiasPendientes] =
      await Promise.all([
        prisma.servientregaGuia.count({ where }),
        prisma.servientregaGuia.count({
          where: { ...where, proceso: { not: "Anulada" } },
        }),
        prisma.servientregaGuia.count({
          where: { ...where, proceso: "Anulada" },
        }),
        prisma.servientregaGuia.count({
          where: { ...where, proceso: "Pendiente_Anulacion" },
        }),
      ]);

    // Agrupar por punto de atención
    const guiasPorPunto = await prisma.servientregaGuia.groupBy({
      by: ["punto_atencion_id"],
      where,
      _count: {
        id: true,
      },
      _sum: {
        valor_declarado: true,
        costo_envio: true,
      },
    });

    // Enriquecer con información de puntos de atención
    const totalPorPunto = await Promise.all(
      guiasPorPunto.map(async (grupo) => {
        const punto = await prisma.puntoAtencion.findUnique({
          where: { id: grupo.punto_atencion_id || "" },
          select: { nombre: true },
        });

        const [activas, anuladas] = await Promise.all([
          prisma.servientregaGuia.count({
            where: {
              ...where,
              punto_atencion_id: grupo.punto_atencion_id,
              proceso: { not: "Anulada" },
            },
          }),
          prisma.servientregaGuia.count({
            where: {
              ...where,
              punto_atencion_id: grupo.punto_atencion_id,
              proceso: "Anulada",
            },
          }),
        ]);

        return {
          punto_atencion_nombre: punto?.nombre || "Punto desconocido",
          total: grupo._count.id,
          activas,
          anuladas,
          valor_total: parseFloat(
            grupo._sum.valor_declarado?.toString() || "0"
          ),
          costo_total: parseFloat(grupo._sum.costo_envio?.toString() || "0"),
        };
      })
    );

    return {
      total_guias: totalGuias,
      guias_activas: guiasActivas,
      guias_anuladas: guiasAnuladas,
      guias_pendientes_anulacion: guiasPendientes,
      total_por_punto: totalPorPunto,
    };
  }

  // ===== SOLICITUDES DE ANULACIÓN =====
  async obtenerSolicitudesAnulacion(filtros: {
    desde?: string;
    hasta?: string;
    estado?: string;
  }) {
    const where: any = {};

    if (filtros.desde || filtros.hasta) {
      where.fecha_solicitud = {};
      if (filtros.desde) {
        where.fecha_solicitud.gte = new Date(filtros.desde);
      }
      if (filtros.hasta) {
        where.fecha_solicitud.lte = new Date(filtros.hasta);
      }
    }

    if (filtros.estado && filtros.estado !== "TODOS") {
      where.estado = filtros.estado;
    }

    return prisma.servientregaSolicitudAnulacion.findMany({
      where,
      orderBy: { fecha_solicitud: "desc" },
    });
  }

  async crearSolicitudAnulacion(data: {
    guia_id: string;
    numero_guia: string;
    motivo_anulacion: string;
    solicitado_por: string;
    solicitado_por_nombre: string;
  }) {
    return prisma.servientregaSolicitudAnulacion.create({
      data: {
        guia_id: data.guia_id,
        numero_guia: data.numero_guia,
        motivo_anulacion: data.motivo_anulacion,
        estado: "PENDIENTE",
        solicitado_por: data.solicitado_por,
        solicitado_por_nombre: data.solicitado_por_nombre,
        fecha_solicitud: new Date(),
      },
    });
  }

  async actualizarSolicitudAnulacion(
    id: string,
    data: {
      estado?: string;
      respondido_por?: string;
      respondido_por_nombre?: string;
      observaciones_respuesta?: string;
      fecha_respuesta?: Date;
    }
  ) {
    return prisma.servientregaSolicitudAnulacion.update({
      where: { id },
      data,
    });
  }
}
