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
  // codpais se mapea a pais en la base de datos
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
      data: sanitizedData as any, // Prisma types are too strict here
    });
  }

  async actualizarRemitente(cedula: string, data: Partial<RemitenteData>) {
    const filteredData = this.sanitizeRemitenteData(data);
    return prisma.servientregaRemitente.updateMany({
      where: { cedula },
      data: filteredData,
    });
  }

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
      data: sanitizedData as any, // Prisma types are too strict here
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

    // Filtrar solo los campos permitidos y excluir campos no válidos como 'codpais'
    const sanitized = Object.keys(data)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj: Record<string, any>, key) => {
        obj[key] = data[key as keyof DestinatarioData];
        return obj;
      }, {});

    // Si viene 'codpais' en los datos originales, lo ignoramos ya que no existe en el modelo
    // El campo correcto es 'pais' que debe ser un string

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

  async gestionarSaldo(data: SaldoData) {
    const { punto_atencion_id, monto_total, creado_por } = data;

    // Obtener información del punto de atención
    const puntoAtencion = await prisma.puntoAtencion.findUnique({
      where: { id: punto_atencion_id },
      select: { nombre: true },
    });

    const existente = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id },
    });

    // Registrar en el historial cada asignación de saldo
    await prisma.servientregaHistorialSaldo.create({
      data: {
        punto_atencion_id,
        punto_atencion_nombre: puntoAtencion?.nombre || "Punto desconocido",
        monto_total: new Prisma.Decimal(monto_total),
        creado_por: creado_por || "SYSTEM",
      },
    });

    return existente
      ? await prisma.servientregaSaldo.update({
          where: { punto_atencion_id },
          data: {
            monto_total: existente.monto_total.add(
              new Prisma.Decimal(monto_total)
            ),
            updated_at: new Date(),
          },
        })
      : await prisma.servientregaSaldo.create({
          data: {
            punto_atencion_id,
            monto_total: new Prisma.Decimal(monto_total),
            monto_usado: new Prisma.Decimal(0),
            creado_por: creado_por || "SYSTEM",
          },
        });
  }

  async descontarSaldo(puntoAtencionId: string, monto: number) {
    const saldo = await this.obtenerSaldo(puntoAtencionId);
    if (!saldo) return null;

    return prisma.servientregaSaldo.update({
      where: { punto_atencion_id: puntoAtencionId },
      data: {
        monto_usado: saldo.monto_usado.add(new Prisma.Decimal(monto)),
      },
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
      punto_ubicacion: `${item.punto_atencion?.ciudad}, ${item.punto_atencion?.provincia}`,
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
    console.log(
      "🔍 ServientregaDBService: Iniciando consulta de puntos de atención..."
    );

    // Primero verificar cuántos puntos hay en total
    const totalPuntos = await prisma.puntoAtencion.count();
    const puntosActivos = await prisma.puntoAtencion.count({
      where: { activo: true },
    });

    console.log(
      `📊 ServientregaDBService: Estadísticas de puntos - Total: ${totalPuntos}, Activos: ${puntosActivos}`
    );

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
      },
      where: {
        activo: true,
      },
      orderBy: [{ provincia: "asc" }, { ciudad: "asc" }, { nombre: "asc" }],
    });

    console.log(
      `📍 ServientregaDBService: Consulta completada - ${puntos.length} puntos activos encontrados:`
    );
    puntos.forEach((punto, index) => {
      console.log(
        `  ${index + 1}. ${punto.nombre} - ${punto.ciudad}, ${
          punto.provincia
        } (ID: ${punto.id})`
      );
    });

    if (puntos.length === 0) {
      console.warn(
        "⚠️ ServientregaDBService: No se encontraron puntos de atención activos"
      );
    }

    return puntos;
  }
}
