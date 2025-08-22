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
  codpais: number;
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
    return prisma.servientregaRemitente.create({
      data: this.sanitizeRemitenteData(data),
    });
  }

  async actualizarRemitente(cedula: string, data: Partial<RemitenteData>) {
    const filteredData = this.sanitizeRemitenteData(data);
    return prisma.servientregaRemitente.updateMany({
      where: { cedula },
      data: filteredData,
    });
  }

  private sanitizeRemitenteData(data: Partial<RemitenteData>) {
    const allowedFields = ['nombre', 'direccion', 'ciudad', 'provincia', 'pais', 'telefono', 'email', 'cedula'];
    return Object.keys(data)
      .filter(key => allowedFields.includes(key))
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
    return prisma.servientregaDestinatario.create({
      data: this.sanitizeDestinatarioData(data),
    });
  }

  async actualizarDestinatario(cedula: string, data: Partial<DestinatarioData>) {
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

  private sanitizeDestinatarioData(data: Partial<DestinatarioData>) {
    const allowedFields = ['nombre', 'direccion', 'ciudad', 'provincia', 'pais', 'telefono', 'email', 'cedula', 'codpais'];
    return Object.keys(data)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: Record<string, any>, key) => {
        obj[key] = data[key as keyof DestinatarioData];
        return obj;
      }, {});
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

    const existente = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id },
    });

    return existente
      ? await prisma.servientregaSaldo.update({
          where: { punto_atencion_id },
          data: {
            monto_total: new Prisma.Decimal(monto_total),
            updated_at: new Date(),
          },
        })
      : await prisma.servientregaSaldo.create({
          data: {
            punto_atencion_id,
            monto_total: new Prisma.Decimal(monto_total),
            monto_usado: new Prisma.Decimal(0),
            creado_por,
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
    const historial = await prisma.servientregaSaldo.findMany({
      select: {
        id: true,
        monto_total: true,
        monto_usado: true,
        created_at: true,
        updated_at: true,
        punto_atencion_id: true,
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

    return historial.map((item) => ({
      ...item,
      disponible: item.monto_total.sub(item.monto_usado),
      punto_nombre: item.punto_atencion?.nombre,
      punto_ubicacion: `${item.punto_atencion?.ciudad}, ${item.punto_atencion?.provincia}`,
    }));
  }
}