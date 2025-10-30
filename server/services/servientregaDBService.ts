import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { subDays } from "date-fns";
import {
  registrarMovimientoSaldo,
  TipoMovimiento,
  TipoReferencia,
} from "./movimientoSaldoService.js";

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
  remitente_id?: string;
  destinatario_id?: string;
  punto_atencion_id?: string;
  usuario_id?: string;
  costo_envio?: number;
  valor_declarado?: number;
}

export interface SaldoData {
  punto_atencion_id: string;
  monto_total: number;
  monto_usado?: number;
  creado_por?: string;
}

/**
 * Función auxiliar para obtener el ID de la moneda USD
 * Servientrega siempre opera en dólares
 */
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

/**
 * Función auxiliar para obtener el ID del usuario SYSTEM
 * Se usa para registrar movimientos automáticos del sistema
 */
async function ensureSystemUserId(): Promise<string> {
  const existing = await prisma.usuario.findFirst({
    where: { correo: "system@puntocambio.com" },
    select: { id: true },
  });
  if (existing?.id) return existing.id;

  // Si no existe, crear usuario SYSTEM
  const created = await prisma.usuario.create({
    data: {
      username: "system",
      nombre: "Sistema",
      correo: "system@puntocambio.com",
      password: "SYSTEM_NO_LOGIN", // Password inválido para evitar login
      rol: "ADMIN",
      activo: true,
    },
    select: { id: true },
  });
  return created.id;
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
    console.log("🔍 [guardarGuia] Iniciando guardado de guía:", {
      numero_guia: data.numero_guia,
      costo_envio: data.costo_envio,
      punto_atencion_id: data.punto_atencion_id,
    });

    // Filtrar propiedades undefined/null para evitar conflictos con Prisma types
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        // Convertir números a Decimal para campos monetarios
        if (
          (key === "costo_envio" || key === "valor_declarado") &&
          typeof value === "number"
        ) {
          acc[key] = new Prisma.Decimal(value);
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as Record<string, any>);

    console.log("🔍 [guardarGuia] Datos limpios antes de crear:", cleanData);

    try {
      const resultado = await prisma.servientregaGuia.create({
        data: cleanData as any,
      });
      console.log("✅ [guardarGuia] Guía guardada exitosamente:", {
        id: resultado.id,
        numero_guia: resultado.numero_guia,
        costo_envio: resultado.costo_envio,
        punto_atencion_id: resultado.punto_atencion_id,
      });
      return resultado;
    } catch (error) {
      console.error("❌ [guardarGuia] Error al guardar guía:", error);
      throw error;
    }
  }

  async anularGuia(numeroGuia: string) {
    return prisma.servientregaGuia.updateMany({
      where: { numero_guia: numeroGuia },
      data: { proceso: "Anulada" },
    });
  }

  async obtenerGuias(
    desde?: string,
    hasta?: string,
    punto_atencion_id?: string,
    usuario_id?: string
  ) {
    return prisma.servientregaGuia.findMany({
      where: {
        // 🔐 Filtrar por punto de atención Y/O usuario_id (ambos si están disponibles, cualquiera si solo uno)
        // Si ambos están presentes, usar AND (la guía debe ser del usuario en ese punto)
        ...(punto_atencion_id && usuario_id
          ? { punto_atencion_id, usuario_id }
          : punto_atencion_id
          ? { punto_atencion_id }
          : usuario_id
          ? { usuario_id }
          : {}),
        created_at: {
          gte: desde ? new Date(desde) : subDays(new Date(), 30),
          lte: hasta ? new Date(hasta) : new Date(),
        },
      },
      include: {
        remitente: true,
        destinatario: true,
        usuario: {
          select: {
            id: true,
            nombre: true,
            username: true,
          },
        },
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
   * Ahora también registra en MovimientoSaldo para trazabilidad completa.
   */
  async gestionarSaldo(data: SaldoData) {
    const { punto_atencion_id, monto_total, creado_por } = data;

    return prisma.$transaction(async (tx) => {
      // Obtener IDs necesarios
      const usdId = await ensureUsdMonedaId();
      const systemUserId = await ensureSystemUserId();

      // Obtener saldo anterior (disponible = monto_total - monto_usado)
      const saldoExistente = await tx.servientregaSaldo.findUnique({
        where: { punto_atencion_id },
      });
      const montoTotalAnterior = saldoExistente?.monto_total
        ? Number(saldoExistente.monto_total)
        : 0;
      const montoUsadoAnterior = saldoExistente?.monto_usado
        ? Number(saldoExistente.monto_usado)
        : 0;
      const saldoDisponibleAnterior = montoTotalAnterior - montoUsadoAnterior;

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

      // Calcular nuevo saldo disponible
      const montoTotalNuevo = Number(actualizado.monto_total);
      const montoUsadoNuevo = Number(actualizado.monto_usado);
      const saldoDisponibleNuevo = montoTotalNuevo - montoUsadoNuevo;

      // Registrar en MovimientoSaldo para trazabilidad (dentro de la transacción)
      await registrarMovimientoSaldo(
        {
          puntoAtencionId: punto_atencion_id,
          monedaId: usdId,
          tipoMovimiento: TipoMovimiento.INGRESO,
          monto: monto_total, // Monto positivo, el servicio aplica el signo
          saldoAnterior: saldoDisponibleAnterior,
          saldoNuevo: saldoDisponibleNuevo,
          tipoReferencia: TipoReferencia.SERVIENTREGA,
          descripcion: `Asignación de saldo Servientrega por ${
            creado_por || "SYSTEM"
          }`,
          usuarioId: systemUserId,
        },
        tx
      ); // ⚠️ Pasar el cliente de transacción para atomicidad

      return actualizado;
    });
  }

  /**
   * Descuento de saldo: transacción, evita sobregiros y registra historial (débito).
   * Ahora también registra en MovimientoSaldo para trazabilidad completa.
   */
  async descontarSaldo(puntoAtencionId: string, monto: number) {
    console.log("🔍 [descontarSaldo] Iniciando descuento:", {
      puntoAtencionId,
      monto,
    });

    try {
      return await prisma.$transaction(async (tx) => {
        console.log("🔍 [descontarSaldo] Dentro de transacción");

        // Obtener IDs necesarios
        const usdId = await ensureUsdMonedaId();
        const systemUserId = await ensureSystemUserId();
        console.log("🔍 [descontarSaldo] IDs obtenidos:", {
          usdId,
          systemUserId,
        });

        const saldo = await tx.servientregaSaldo.findUnique({
          where: { punto_atencion_id: puntoAtencionId },
        });

        console.log("🔍 [descontarSaldo] Saldo encontrado:", saldo);
        if (!saldo) {
          console.warn(
            "⚠️ [descontarSaldo] No hay saldo para este punto de atención:",
            puntoAtencionId
          );
          return null;
        }

        const usado = saldo.monto_usado ?? new Prisma.Decimal(0);
        const total = saldo.monto_total ?? new Prisma.Decimal(0);
        const nuevoUsado = usado.add(new Prisma.Decimal(monto));
        const disponible = total.sub(nuevoUsado);

        console.log("🔍 [descontarSaldo] Cálculos de saldo:", {
          usado: Number(usado),
          total: Number(total),
          nuevoUsado: Number(nuevoUsado),
          disponible: Number(disponible),
        });

        if (disponible.lt(0)) {
          throw new Error("Saldo insuficiente");
        }

        // Calcular saldo disponible anterior y nuevo
        const saldoDisponibleAnterior = Number(total.sub(usado));
        const saldoDisponibleNuevo = Number(disponible);

        console.log("🔍 [descontarSaldo] Actualizando ServientregaSaldo...");
        const actualizado = await tx.servientregaSaldo.update({
          where: { punto_atencion_id: puntoAtencionId },
          data: { monto_usado: nuevoUsado, updated_at: new Date() },
        });

        console.log(
          "✅ [descontarSaldo] ServientregaSaldo actualizado:",
          actualizado
        );

        // Registrar movimiento en historial (débito)
        console.log(
          "🔍 [descontarSaldo] Buscando nombre del punto de atención..."
        );
        const puntoAtencion = await tx.puntoAtencion.findUnique({
          where: { id: puntoAtencionId },
          select: { nombre: true },
        });

        console.log(
          "🔍 [descontarSaldo] Creando registro en ServientregaHistorialSaldo..."
        );
        await tx.servientregaHistorialSaldo.create({
          data: {
            punto_atencion_id: puntoAtencionId,
            punto_atencion_nombre: puntoAtencion?.nombre || "Punto desconocido",
            monto_total: new Prisma.Decimal(-monto), // negativo = débito
            creado_por: "SYSTEM:DESCUENTO_GUIA",
          },
        });

        console.log("✅ [descontarSaldo] Historial creado");

        // Registrar en MovimientoSaldo para trazabilidad (dentro de la transacción)
        console.log("🔍 [descontarSaldo] Registrando MovimientoSaldo...");
        await registrarMovimientoSaldo(
          {
            puntoAtencionId: puntoAtencionId,
            monedaId: usdId,
            tipoMovimiento: TipoMovimiento.EGRESO,
            monto: monto, // Monto positivo, el servicio aplica el signo negativo
            saldoAnterior: saldoDisponibleAnterior,
            saldoNuevo: saldoDisponibleNuevo,
            tipoReferencia: TipoReferencia.SERVIENTREGA,
            descripcion: "Descuento por generación de guía Servientrega",
            usuarioId: systemUserId,
          },
          tx
        ); // ⚠️ Pasar el cliente de transacción para atomicidad

        console.log("✅ [descontarSaldo] MovimientoSaldo registrado");
        console.log("✅ [descontarSaldo] Transacción completada exitosamente");

        return actualizado;
      });
    } catch (error) {
      console.error("❌ [descontarSaldo] Error en transacción:", error);
      throw error;
    }
  }

  /**
   * Devolver saldo al anular una guía el mismo día
   * Ahora también registra en MovimientoSaldo para trazabilidad completa.
   */
  async devolverSaldo(puntoAtencionId: string, monto: number) {
    return prisma.$transaction(async (tx) => {
      // Obtener IDs necesarios
      const usdId = await ensureUsdMonedaId();
      const systemUserId = await ensureSystemUserId();

      const saldo = await tx.servientregaSaldo.findUnique({
        where: { punto_atencion_id: puntoAtencionId },
      });
      if (!saldo) return null;

      const usado = saldo.monto_usado ?? new Prisma.Decimal(0);
      const total = saldo.monto_total ?? new Prisma.Decimal(0);
      const nuevoUsado = usado.sub(new Prisma.Decimal(monto));

      // No permitir que el usado sea negativo
      if (nuevoUsado.lt(0)) {
        throw new Error("No se puede devolver más saldo del que se ha usado");
      }

      // Calcular saldo disponible anterior y nuevo
      const saldoDisponibleAnterior = Number(total.sub(usado));
      const saldoDisponibleNuevo = Number(total.sub(nuevoUsado));

      const actualizado = await tx.servientregaSaldo.update({
        where: { punto_atencion_id: puntoAtencionId },
        data: { monto_usado: nuevoUsado, updated_at: new Date() },
      });

      // Registrar movimiento en historial (crédito por devolución)
      const puntoAtencion = await tx.puntoAtencion.findUnique({
        where: { id: puntoAtencionId },
        select: { nombre: true },
      });

      await tx.servientregaHistorialSaldo.create({
        data: {
          punto_atencion_id: puntoAtencionId,
          punto_atencion_nombre: puntoAtencion?.nombre || "Punto desconocido",
          monto_total: new Prisma.Decimal(monto), // positivo = crédito por devolución
          creado_por: "SYSTEM:DEVOLUCION_ANULACION",
        },
      });

      // Registrar en MovimientoSaldo para trazabilidad (dentro de la transacción)
      await registrarMovimientoSaldo(
        {
          puntoAtencionId: puntoAtencionId,
          monedaId: usdId,
          tipoMovimiento: TipoMovimiento.INGRESO,
          monto: monto, // Monto positivo, el servicio aplica el signo
          saldoAnterior: saldoDisponibleAnterior,
          saldoNuevo: saldoDisponibleNuevo,
          tipoReferencia: TipoReferencia.SERVIENTREGA,
          descripcion: "Devolución por anulación de guía Servientrega",
          usuarioId: systemUserId,
        },
        tx
      ); // ⚠️ Pasar el cliente de transacción para atomicidad

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
