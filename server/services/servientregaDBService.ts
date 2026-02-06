import { Prisma, ServicioExterno, TipoViaTransferencia } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { subDays } from "date-fns";
import {
  registrarMovimientoSaldo,
  TipoMovimiento,
  TipoReferencia,
} from "./movimientoSaldoService.js";

const log = (...args: unknown[]) => {
  console.warn(...args);
};

export interface RemitenteData {
  identificacion?: string;
  cedula?: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email?: string;
  ciudad?: string;
  provincia?: string;
  codigo_postal?: string;
  pais?: string;
}

// Nota: codpais se mapea a pais en la base de datos (se ignora en sanitización)
export type DestinatarioData = RemitenteData;

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
  private normalizeDesglosePago(montoTotal: number, billetes?: number, monedas?: number, bancos?: number) {
    const safe = (n: unknown) => {
      const num = typeof n === "number" ? n : Number(n);
      return Number.isFinite(num) ? num : 0;
    };

    const total = Math.max(0, safe(montoTotal));
    let bil = Math.max(0, safe(billetes));
    let mon = Math.max(0, safe(monedas));
    let ban = Math.max(0, safe(bancos));

    // Si no enviaron desglose, asumir efectivo (billetes)
    if (bil === 0 && mon === 0 && ban === 0 && total > 0) {
      bil = total;
    }

    // Normalizar: el total del desglose no debe exceder montoTotal.
    // Prioridad: respetar bancos, luego monedas, luego ajustar billetes.
    if (ban > total) ban = total;
    const restanteTrasBanco = Math.max(0, total - ban);

    if (mon > restanteTrasBanco) mon = restanteTrasBanco;
    const restanteTrasMonedas = Math.max(0, restanteTrasBanco - mon);

    if (bil > restanteTrasMonedas) bil = restanteTrasMonedas;

    const efectivo = bil + mon;
    const suma = efectivo + ban;
    // Si quedó por debajo (por datos incompletos), completar en billetes.
    if (suma + 1e-9 < total) {
      bil += total - suma;
    }

    return {
      billetes: bil,
      monedas: mon,
      bancos: ban,
      efectivo,
      total,
    };
  }

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
    const cedula = sanitizedData.cedula;
    const nombre = sanitizedData.nombre;
    const direccion = sanitizedData.direccion;

    if (!cedula || !nombre || !direccion) {
      throw new Error("Cedula, nombre y direccion son requeridos para guardar remitente");
    }

    const resultado = await prisma.servientregaRemitente.upsert({
      where: { 
        cedula_nombre_direccion: { cedula, nombre, direccion }
      },
      update: sanitizedData as Prisma.ServientregaRemitenteUncheckedUpdateInput,
      create: sanitizedData as Prisma.ServientregaRemitenteUncheckedCreateInput,
      select: {
        id: true,
        cedula: true,
        nombre: true,
      },
    });
    log("✅ [guardarRemitente] Resultado con ID:", resultado);
    return resultado;
  }

  async actualizarRemitente(cedula: string, data: Partial<RemitenteData>) {
    const filteredData = this.sanitizeRemitenteData(data);
    return prisma.servientregaRemitente.updateMany({
      where: { cedula: cedula },
      data: filteredData,
    });
  }

  /**
   * Remitente: NO guardamos ciudad/provincia/pais intencionalmente,
   * porque el remitente SIEMPRE es el punto de atención.
   */
  private sanitizeRemitenteData(
    data: Partial<RemitenteData>
  ): Partial<Prisma.ServientregaRemitenteUncheckedCreateInput> {
    const sanitized: Partial<Prisma.ServientregaRemitenteUncheckedCreateInput> = {};

    if (data.cedula !== undefined) sanitized.cedula = data.cedula;
    if (data.nombre !== undefined) sanitized.nombre = data.nombre;
    if (data.direccion !== undefined) sanitized.direccion = data.direccion;
    if (data.telefono !== undefined) sanitized.telefono = data.telefono;
    if (data.codigo_postal !== undefined) sanitized.codigo_postal = data.codigo_postal;
    if (data.email !== undefined) sanitized.email = data.email;

    return sanitized;
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
    const cedula = sanitizedData.cedula;
    const nombre = sanitizedData.nombre;
    const direccion = sanitizedData.direccion;

    if (!cedula || !nombre || !direccion) {
      throw new Error("Cedula, nombre y direccion son requeridos para guardar destinatario");
    }

    const resultado = await prisma.servientregaDestinatario.upsert({
      where: { 
        cedula_nombre_direccion: { cedula, nombre, direccion }
      },
      update: sanitizedData as Prisma.ServientregaDestinatarioUncheckedUpdateInput,
      create: sanitizedData as Prisma.ServientregaDestinatarioUncheckedCreateInput,
      select: {
        id: true,
        cedula: true,
        nombre: true,
      },
    });
    log("✅ [guardarDestinatario] Resultado con ID:", resultado);
    return resultado;
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
      where: { cedula: cedula },
      data: filteredData,
    });
  }

  /**
   * Destinatario: ignoramos 'codpais' (numérico). Usar 'pais' (string).
   */
  private sanitizeDestinatarioData(
    data: Partial<DestinatarioData>
  ): Partial<Prisma.ServientregaDestinatarioUncheckedCreateInput> {
    const sanitized: Partial<Prisma.ServientregaDestinatarioUncheckedCreateInput> = {};

    if (data.cedula !== undefined) sanitized.cedula = data.cedula;
    if (data.nombre !== undefined) sanitized.nombre = data.nombre;
    if (data.direccion !== undefined) sanitized.direccion = data.direccion;
    if (data.ciudad !== undefined) sanitized.ciudad = data.ciudad;
    if (data.provincia !== undefined) sanitized.provincia = data.provincia;
    if (data.pais !== undefined) sanitized.pais = data.pais;
    if (data.telefono !== undefined) sanitized.telefono = data.telefono;
    if (data.email !== undefined) sanitized.email = data.email;
    if (data.codigo_postal !== undefined) sanitized.codigo_postal = data.codigo_postal;

    return sanitized;
  }

  // ===== GUÍAS =====
  async guardarGuia(data: GuiaData) {
    log("🔍 [guardarGuia] Iniciando guardado de guía:", {
      numero_guia: data.numero_guia,
      costo_envio: data.costo_envio,
      punto_atencion_id: data.punto_atencion_id,
    });

    const cleanData: Prisma.ServientregaGuiaUncheckedCreateInput = {
      numero_guia: data.numero_guia,
      proceso: data.proceso,
    };

    if (data.base64_response !== undefined && data.base64_response !== null && data.base64_response !== "") {
      cleanData.base64_response = data.base64_response;
    }
    if (data.remitente_id) cleanData.remitente_id = data.remitente_id;
    if (data.destinatario_id) cleanData.destinatario_id = data.destinatario_id;
    if (data.punto_atencion_id) cleanData.punto_atencion_id = data.punto_atencion_id;
    if (data.usuario_id) cleanData.usuario_id = data.usuario_id;
    if (typeof data.costo_envio === "number") cleanData.costo_envio = new Prisma.Decimal(data.costo_envio);
    if (typeof data.valor_declarado === "number") cleanData.valor_declarado = new Prisma.Decimal(data.valor_declarado);

    log("🔍 [guardarGuia] Datos limpios antes de crear:", cleanData);

    try {
      const resultado = await prisma.servientregaGuia.create({
        data: cleanData,
      });
      log("✅ [guardarGuia] Guía guardada exitosamente:", {
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
      data: {
        proceso: "Anulada",
        estado: "ANULADA",
      },
    });
  }

  async obtenerGuias(
    desde?: string,
    hasta?: string,
    punto_atencion_id?: string,
    usuario_id?: string,
    agencia_codigo?: string
  ) {
    // 🔧 Convertir fechas CORRECTAMENTE considerando que las guías se almacenan en UTC
    // El usuario proporciona fechas en formato local Ecuador (UTC-5)
    // Para buscar en la BD (UTC), necesitamos SUMAR 5 horas, no restar
    // Ejemplo: "2025-10-30" en Ecuador → "2025-10-30 00:00:00 Ecuador" = "2025-10-30 05:00:00 UTC"

    let desdeDate: Date;
    let hastaDate: Date;
    const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000; // 5 horas en milisegundos

    if (desde) {
      desdeDate = new Date(desde);
      // SUMAR 5 horas para convertir "2025-10-25 00:00:00 Ecuador" a UTC
      desdeDate.setTime(desdeDate.getTime() + ECUADOR_OFFSET_MS);
      desdeDate.setHours(0, 0, 0, 0); // Inicio del día en Ecuador = UTC+5
    } else {
      desdeDate = subDays(new Date(), 30);
      desdeDate.setTime(desdeDate.getTime() + ECUADOR_OFFSET_MS);
      desdeDate.setHours(0, 0, 0, 0);
    }

    if (hasta) {
      hastaDate = new Date(hasta);
      // SUMAR 5 horas para convertir "2025-10-30 23:59:59 Ecuador" a UTC
      hastaDate.setTime(hastaDate.getTime() + ECUADOR_OFFSET_MS);
      hastaDate.setHours(23, 59, 59, 999); // Final del día en Ecuador = UTC+5
    } else {
      hastaDate = new Date();
      hastaDate.setTime(hastaDate.getTime() + ECUADOR_OFFSET_MS);
      hastaDate.setHours(23, 59, 59, 999);
    }

    log("📅 [obtenerGuias] CORRECCIÓN DE ZONA HORARIA APLICADA", {
      desde_original: desde,
      desde_convertido: desdeDate.toISOString(),
      hasta_original: hasta,
      hasta_convertido: hastaDate.toISOString(),
      punto_atencion_id,
      usuario_id,
      agencia_codigo,
      offset_aplicado_horas: 5,
      nota: "Se SUMA 5 horas para convertir Ecuador time (UTC-5) a UTC para búsqueda en BD",
    });

    // 🏢 IMPORTANTE: Filtrar por agencia si está disponible
    // Esto asegura que solo se vean guías de la agencia del punto de atención
    const WHERE_CLAUSE: Prisma.ServientregaGuiaWhereInput = {};
    
    if (agencia_codigo) {
      WHERE_CLAUSE.agencia_codigo = agencia_codigo;
      log("🏢 Filtrando por agencia:", agencia_codigo);
    } else if (punto_atencion_id && usuario_id) {
      WHERE_CLAUSE.punto_atencion_id = punto_atencion_id;
      WHERE_CLAUSE.usuario_id = usuario_id;
    } else if (punto_atencion_id) {
      WHERE_CLAUSE.punto_atencion_id = punto_atencion_id;
    } else if (usuario_id) {
      WHERE_CLAUSE.usuario_id = usuario_id;
    }

    log("🔍 [obtenerGuias] WHERE clause para búsqueda:", {
      ...WHERE_CLAUSE,
      created_at: {
        gte: desdeDate.toISOString(),
        lte: hastaDate.toISOString(),
      },
    });

    const guias = await prisma.servientregaGuia.findMany({
      where: {
        ...WHERE_CLAUSE,
        created_at: {
          gte: desdeDate,
          lte: hastaDate,
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

    log("✅ [obtenerGuias] Resultado final:", {
      guias_encontradas: guias.length,
      desde: desde,
      hasta: hasta,
      punto_atencion_id,
      usuario_id,
      guias: guias.map((g) => ({
        numero_guia: g.numero_guia,
        created_at: g.created_at,
        usuario_id: g.usuario_id,
        punto_atencion_id: g.punto_atencion_id,
      })),
    });

    return guias;
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
          saldoBucket: "NINGUNO",
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
    log("🔍 [descontarSaldo] Iniciando descuento:", {
      puntoAtencionId,
      monto,
    });

    try {
      return await prisma.$transaction(async (tx) => {
        log("🔍 [descontarSaldo] Dentro de transacción");

        // Obtener IDs necesarios
        const usdId = await ensureUsdMonedaId();
        const systemUserId = await ensureSystemUserId();
        log("🔍 [descontarSaldo] IDs obtenidos:", {
          usdId,
          systemUserId,
        });

        const saldo = await tx.servientregaSaldo.findUnique({
          where: { punto_atencion_id: puntoAtencionId },
        });

        log("🔍 [descontarSaldo] Saldo encontrado:", saldo);
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

        log("🔍 [descontarSaldo] Cálculos de saldo:", {
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

        log("🔍 [descontarSaldo] Actualizando ServientregaSaldo...");
        // Sumar/restar billetes y monedas si se proveen (opcional: puedes pasar como argumento)
        const saldoActual = await tx.servientregaSaldo.findUnique({ where: { punto_atencion_id: puntoAtencionId } });
        const actualizado = await tx.servientregaSaldo.update({
          where: { punto_atencion_id: puntoAtencionId },
          data: {
            monto_usado: nuevoUsado,
            billetes: saldoActual?.billetes ?? 0, // mantener valor anterior si no hay desglose
            monedas_fisicas: saldoActual?.monedas_fisicas ?? 0,
            updated_at: new Date(),
          },
        });

        log("✅ [descontarSaldo] ServientregaSaldo actualizado:", actualizado);

        // Registrar movimiento en historial (débito)
        log("🔍 [descontarSaldo] Buscando nombre del punto de atención...");
        const puntoAtencion = await tx.puntoAtencion.findUnique({
          where: { id: puntoAtencionId },
          select: { nombre: true },
        });

        log("🔍 [descontarSaldo] Creando registro en ServientregaHistorialSaldo...");
        await tx.servientregaHistorialSaldo.create({
          data: {
            punto_atencion_id: puntoAtencionId,
            punto_atencion_nombre: puntoAtencion?.nombre || "Punto desconocido",
            monto_total: new Prisma.Decimal(-monto), // negativo = débito
            creado_por: "SYSTEM:DESCUENTO_GUIA",
          },
        });

        log("✅ [descontarSaldo] Historial creado");

        // Registrar en MovimientoSaldo para trazabilidad (dentro de la transacción)
        log("🔍 [descontarSaldo] Registrando MovimientoSaldo...");
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
            saldoBucket: "NINGUNO",
            usuarioId: systemUserId,
          },
          tx
        ); // ⚠️ Pasar el cliente de transacción para atomicidad

        log("✅ [descontarSaldo] MovimientoSaldo registrado");
        log("✅ [descontarSaldo] Transacción completada exitosamente");

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

      const saldoActual = await tx.servientregaSaldo.findUnique({ where: { punto_atencion_id: puntoAtencionId } });
      const actualizado = await tx.servientregaSaldo.update({
        where: { punto_atencion_id: puntoAtencionId },
        data: {
          monto_usado: nuevoUsado,
          billetes: saldoActual?.billetes ?? 0,
          monedas_fisicas: saldoActual?.monedas_fisicas ?? 0,
          updated_at: new Date(),
        },
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
          saldoBucket: "NINGUNO",
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
    const where: Prisma.ServientregaSolicitudSaldoWhereInput = {};

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
    usuario_id?: string;
  }) {
    const where: Prisma.ServientregaGuiaWhereInput = {};
    const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000; // 5 horas en milisegundos

    log("🔍 [obtenerGuiasConFiltros] Filtros recibidos:", filtros);

    // Filtro por fechas (CORRECCIÓN: considerar offset Ecuador UTC-5)
    // Se SUMA 5 horas para convertir Ecuador time (UTC-5) a UTC para búsqueda en BD
    if (filtros.desde || filtros.hasta) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (filtros.desde) {
        const desdeDate = new Date(filtros.desde);
        desdeDate.setTime(desdeDate.getTime() + ECUADOR_OFFSET_MS); // SUMAR 5 horas
        desdeDate.setHours(0, 0, 0, 0); // Inicio del día
        createdAt.gte = desdeDate;
        log("📅 Desde (inicio del día, con offset Ecuador):", desdeDate.toISOString());
      }
      if (filtros.hasta) {
        const hastaDate = new Date(filtros.hasta);
        hastaDate.setTime(hastaDate.getTime() + ECUADOR_OFFSET_MS); // SUMAR 5 horas
        hastaDate.setHours(23, 59, 59, 999); // Final del día
        createdAt.lte = hastaDate;
        log("📅 Hasta (final del día, con offset Ecuador):", hastaDate.toISOString());
      }

      if (createdAt.gte || createdAt.lte) {
        where.created_at = createdAt;
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

    // Filtro por usuario (si se proporciona)
    if (filtros.usuario_id) {
      where.usuario_id = filtros.usuario_id;
    }

    // Filtro por punto de atención
    if (filtros.punto_atencion_id && filtros.punto_atencion_id !== "TODOS") {
      where.punto_atencion_id = filtros.punto_atencion_id;
    }

    log("🔍 [obtenerGuiasConFiltros] WHERE clause:", JSON.stringify(where, null, 2));

    const guias = await prisma.servientregaGuia.findMany({
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
            servientrega_agencia_codigo: true,
            servientrega_agencia_nombre: true,
            servientrega_alianza: true,
            servientrega_oficina_alianza: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    log(`✅ [obtenerGuiasConFiltros] Encontradas ${guias.length} guías`);
    return guias;
  }

  async obtenerEstadisticasGuias(filtros: { desde?: string; hasta?: string }) {
    const where: Prisma.ServientregaGuiaWhereInput = {};
    const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000; // 5 horas en milisegundos

    // Filtro por fechas (CORRECCIÓN: considerar offset Ecuador UTC-5)
    // Se SUMA 5 horas para convertir Ecuador time (UTC-5) a UTC para búsqueda en BD
    if (filtros.desde || filtros.hasta) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (filtros.desde) {
        const desdeDate = new Date(filtros.desde);
        desdeDate.setTime(desdeDate.getTime() + ECUADOR_OFFSET_MS); // SUMAR 5 horas
        desdeDate.setHours(0, 0, 0, 0); // Inicio del día
        createdAt.gte = desdeDate;
      }
      if (filtros.hasta) {
        const hastaDate = new Date(filtros.hasta);
        hastaDate.setTime(hastaDate.getTime() + ECUADOR_OFFSET_MS); // SUMAR 5 horas
        hastaDate.setHours(23, 59, 59, 999); // Final del día
        createdAt.lte = hastaDate;
      }

      if (createdAt.gte || createdAt.lte) {
        where.created_at = createdAt;
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
    const where: Prisma.ServientregaSolicitudAnulacionWhereInput = {};
    const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000; // 5 horas en milisegundos

    if (filtros.desde || filtros.hasta) {
      const fechaSolicitud: Prisma.DateTimeFilter = {};
      if (filtros.desde) {
        const desdeDate = new Date(filtros.desde);
        desdeDate.setTime(desdeDate.getTime() + ECUADOR_OFFSET_MS); // SUMAR 5 horas
        desdeDate.setHours(0, 0, 0, 0); // Inicio del día
        fechaSolicitud.gte = desdeDate;
      }
      if (filtros.hasta) {
        const hastaDate = new Date(filtros.hasta);
        hastaDate.setTime(hastaDate.getTime() + ECUADOR_OFFSET_MS); // SUMAR 5 horas
        hastaDate.setHours(23, 59, 59, 999); // Final del día
        fechaSolicitud.lte = hastaDate;
      }

      if (fechaSolicitud.gte || fechaSolicitud.lte) {
        where.fecha_solicitud = fechaSolicitud;
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
    return prisma.$transaction(async (tx) => {
      // Crear la solicitud de anulación
      const solicitud = await tx.servientregaSolicitudAnulacion.create({
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

      // Actualizar el estado de la guía a PENDIENTE_ANULACION
      await tx.servientregaGuia.updateMany({
        where: { numero_guia: data.numero_guia },
        data: {
          estado: "PENDIENTE_ANULACION",
          updated_at: new Date(),
        },
      });

      return solicitud;
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

  /**
   * Obtener una solicitud de anulación por ID
   */
  async obtenerSolicitudAnulacion(id: string) {
    return prisma.servientregaSolicitudAnulacion.findUnique({
      where: { id },
    });
  }

  /**
   * 📥 INGRESO de servicio externo: Cuando se genera una guía
   * - Crea MovimientoServicioExterno (INGRESO) para registro
   * - NO actualiza ServicioExternoSaldo (Servientrega usa ServientregaSaldo separado)
   * - Actualiza Saldo general USD (suma - entra efectivo al punto)
   * - Registra en MovimientoSaldo para auditoría
   * Todo en transacción
   * 
   * NOTA: El descuento del ServientregaSaldo se hace por separado en descontarSaldo()
   */
  async registrarIngresoServicioExterno(
    puntoAtencionId: string,
    monto: number,
    numeroGuia: string,
    billetes?: number,
    monedas?: number,
    bancos?: number
  ) {
    return prisma.$transaction(async (tx) => {
      log("📥 [registrarIngresoServicioExterno] Iniciando:", {
        puntoAtencionId,
        monto,
        numeroGuia,
        billetes,
        monedas,
        bancos,
      });

      // Obtener IDs necesarios
      const usdId = await ensureUsdMonedaId();
      const systemUserId = await ensureSystemUserId();

      const desglose = this.normalizeDesglosePago(monto, billetes, monedas, bancos);

      // Determinar método de ingreso para el movimiento
      let metodoIngreso: TipoViaTransferencia = TipoViaTransferencia.EFECTIVO;
      if (desglose.bancos > 0) {
        if (desglose.efectivo > 0) {
          metodoIngreso = TipoViaTransferencia.MIXTO;
        } else {
          metodoIngreso = TipoViaTransferencia.BANCO;
        }
      }

      // 1️⃣ Crear MovimientoServicioExterno (solo para registro/auditoría)
      log("📥 [registrarIngresoServicioExterno] Creando movimiento...");
      const movimiento = await tx.servicioExternoMovimiento.create({
        data: {
          punto_atencion_id: puntoAtencionId,
          servicio: ServicioExterno.SERVIENTREGA,
          tipo_movimiento: "INGRESO",
          moneda_id: usdId,
          monto: new Prisma.Decimal(desglose.total),
          numero_referencia: numeroGuia,
          descripcion: `Ingreso por generación de guía Servientrega #${numeroGuia}`,
          usuario_id: systemUserId,
          billetes: new Prisma.Decimal(desglose.billetes),
          monedas_fisicas: new Prisma.Decimal(desglose.monedas),
          bancos: new Prisma.Decimal(desglose.bancos),
          metodo_ingreso: metodoIngreso,
        },
      });

      log("✅ [registrarIngresoServicioExterno] Movimiento creado:", movimiento.id);

      // 2️⃣ NO actualizamos ServicioExternoSaldo para SERVIENTREGA
      // porque usa ServientregaSaldo (descontado previamente en descontarSaldo)
      log("ℹ️ [registrarIngresoServicioExterno] Saltando actualización de ServicioExternoSaldo (Servientrega usa tabla separada)");

      const saldoServicioAnterior = new Prisma.Decimal(0);
      const saldoServicioNuevo = new Prisma.Decimal(0);

      // 3️⃣ Actualizar Saldo general USD por bucket (CAJA vs BANCOS) usando el ledger
      const saldoActual = await tx.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: usdId,
          },
        },
        select: {
          id: true,
          cantidad: true,
          bancos: true,
          billetes: true,
          monedas_fisicas: true,
        },
      });

      const saldoCajaAnterior = saldoActual?.cantidad ?? new Prisma.Decimal(0);
      const saldoBancosAnterior = saldoActual?.bancos ?? new Prisma.Decimal(0);

      let saldoCajaNuevo = saldoCajaAnterior;
      let saldoBancosNuevo = saldoBancosAnterior;

      if (desglose.efectivo > 0) {
        saldoCajaNuevo = saldoCajaAnterior.add(new Prisma.Decimal(desglose.efectivo));
        await registrarMovimientoSaldo(
          {
            puntoAtencionId,
            monedaId: usdId,
            tipoMovimiento: TipoMovimiento.INGRESO,
            monto: desglose.efectivo,
            saldoAnterior: saldoCajaAnterior,
            saldoNuevo: saldoCajaNuevo,
            tipoReferencia: TipoReferencia.SERVIENTREGA,
            referenciaId: numeroGuia,
            descripcion: `Ingreso (CAJA) por guía Servientrega #${numeroGuia}`,
            saldoBucket: "CAJA",
            usuarioId: systemUserId,
          },
          tx
        );

        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: puntoAtencionId,
              moneda_id: usdId,
            },
          },
          update: {
            billetes: new Prisma.Decimal((saldoActual?.billetes ?? new Prisma.Decimal(0)).toNumber()).add(
              new Prisma.Decimal(desglose.billetes)
            ),
            monedas_fisicas: new Prisma.Decimal((saldoActual?.monedas_fisicas ?? new Prisma.Decimal(0)).toNumber()).add(
              new Prisma.Decimal(desglose.monedas)
            ),
            updated_at: new Date(),
          },
          create: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: usdId,
            cantidad: saldoCajaNuevo,
            bancos: saldoBancosAnterior,
            billetes: new Prisma.Decimal(desglose.billetes),
            monedas_fisicas: new Prisma.Decimal(desglose.monedas),
          },
        });
      }

      if (desglose.bancos > 0) {
        saldoBancosNuevo = saldoBancosAnterior.add(new Prisma.Decimal(desglose.bancos));
        await registrarMovimientoSaldo(
          {
            puntoAtencionId,
            monedaId: usdId,
            tipoMovimiento: TipoMovimiento.INGRESO,
            monto: desglose.bancos,
            saldoAnterior: saldoBancosAnterior,
            saldoNuevo: saldoBancosNuevo,
            tipoReferencia: TipoReferencia.SERVIENTREGA,
            referenciaId: numeroGuia,
            descripcion: `Ingreso (BANCOS) por guía Servientrega #${numeroGuia}`,
            saldoBucket: "BANCOS",
            usuarioId: systemUserId,
          },
          tx
        );
      }
      log("✅ [registrarIngresoServicioExterno] Transacción completada");

      return {
        movimiento,
        saldoServicio: {
          anterior: Number(saldoServicioAnterior),
          nuevo: Number(saldoServicioNuevo),
        },
        saldoGeneral: {
          anterior: Number(saldoCajaAnterior),
          nuevo: Number(saldoCajaNuevo),
        },
      };
    });
  }

  /**
   * 📤 REVERSIÓN de ingreso: Cuando se cancela una guía
   * - Crea MovimientoServicioExterno (EGRESO - reversión)
   * - Actualiza ServicioExternoSaldo (resta)
   * - Actualiza Saldo general USD (resta)
   * - Registra en MovimientoSaldo para auditoría
   * Todo en transacción
   */
  async revertirIngresoServicioExterno(
    puntoAtencionId: string,
    monto: number,
    numeroGuia: string,
    billetes?: number,
    monedas?: number,
    bancos?: number
  ) {
    return prisma.$transaction(async (tx) => {
      log("📤 [revertirIngresoServicioExterno] Iniciando:", {
        puntoAtencionId,
        monto,
        numeroGuia,
        billetes,
        monedas,
        bancos,
      });

      // Obtener IDs necesarios
      const usdId = await ensureUsdMonedaId();
      const systemUserId = await ensureSystemUserId();

      const desglose = this.normalizeDesglosePago(monto, billetes, monedas, bancos);

      // Determinar método de ingreso para el movimiento de reversión
      let metodoIngreso: TipoViaTransferencia = TipoViaTransferencia.EFECTIVO;
      if (desglose.bancos > 0) {
        if (desglose.efectivo > 0) {
          metodoIngreso = TipoViaTransferencia.MIXTO;
        } else {
          metodoIngreso = TipoViaTransferencia.BANCO;
        }
      }

      // 1️⃣ Crear MovimientoServicioExterno (EGRESO - reversión)
      log("📤 [revertirIngresoServicioExterno] Creando movimiento de reversión...");
      const movimiento = await tx.servicioExternoMovimiento.create({
        data: {
          punto_atencion_id: puntoAtencionId,
          servicio: ServicioExterno.SERVIENTREGA,
          tipo_movimiento: "EGRESO",
          moneda_id: usdId,
          monto: new Prisma.Decimal(-desglose.total),
          numero_referencia: numeroGuia,
          descripcion: `Reversión por cancelación de guía Servientrega #${numeroGuia}`,
          usuario_id: systemUserId,
          billetes: new Prisma.Decimal(-desglose.billetes),
          monedas_fisicas: new Prisma.Decimal(-desglose.monedas),
          bancos: new Prisma.Decimal(-desglose.bancos),
          metodo_ingreso: metodoIngreso,
        },
      });

      log(
        "✅ [revertirIngresoServicioExterno] Movimiento de reversión creado:",
        movimiento.id
      );

      // 2️⃣ SERVIENTREGA: no tocamos ServicioExternoSaldo (usa ServientregaSaldo separado)
      const saldoServicioAnterior = new Prisma.Decimal(0);
      const saldoServicioNuevo = new Prisma.Decimal(0);

      // 3️⃣ Actualizar Saldo general USD por bucket usando el ledger
      const saldoActual = await tx.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: usdId,
          },
        },
        select: {
          id: true,
          cantidad: true,
          bancos: true,
          billetes: true,
          monedas_fisicas: true,
        },
      });

      const saldoCajaAnterior = saldoActual?.cantidad ?? new Prisma.Decimal(0);
      const saldoBancosAnterior = saldoActual?.bancos ?? new Prisma.Decimal(0);

      let saldoCajaNuevo = saldoCajaAnterior;
      let saldoBancosNuevo = saldoBancosAnterior;

      if (desglose.efectivo > 0) {
        saldoCajaNuevo = saldoCajaAnterior.sub(new Prisma.Decimal(desglose.efectivo));
        await registrarMovimientoSaldo(
          {
            puntoAtencionId,
            monedaId: usdId,
            tipoMovimiento: TipoMovimiento.EGRESO,
            monto: desglose.efectivo,
            saldoAnterior: saldoCajaAnterior,
            saldoNuevo: saldoCajaNuevo,
            tipoReferencia: TipoReferencia.SERVIENTREGA,
            referenciaId: numeroGuia,
            descripcion: `Reversión (CAJA) guía Servientrega #${numeroGuia}`,
            saldoBucket: "CAJA",
            usuarioId: systemUserId,
          },
          tx
        );

        const billetesAnteriorNum = saldoActual?.billetes
          ? saldoActual.billetes.toNumber()
          : 0;
        const monedasAnteriorNum = saldoActual?.monedas_fisicas
          ? saldoActual.monedas_fisicas.toNumber()
          : 0;

        const billetesNuevo = Math.max(0, billetesAnteriorNum - desglose.billetes);
        const monedasNuevo = Math.max(0, monedasAnteriorNum - desglose.monedas);
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: puntoAtencionId,
              moneda_id: usdId,
            },
          },
          update: {
            billetes: new Prisma.Decimal(billetesNuevo),
            monedas_fisicas: new Prisma.Decimal(monedasNuevo),
            updated_at: new Date(),
          },
          create: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: usdId,
            cantidad: saldoCajaNuevo,
            bancos: saldoBancosAnterior,
            billetes: new Prisma.Decimal(billetesNuevo),
            monedas_fisicas: new Prisma.Decimal(monedasNuevo),
          },
        });
      }

      if (desglose.bancos > 0) {
        saldoBancosNuevo = saldoBancosAnterior.sub(new Prisma.Decimal(desglose.bancos));
        await registrarMovimientoSaldo(
          {
            puntoAtencionId,
            monedaId: usdId,
            tipoMovimiento: TipoMovimiento.EGRESO,
            monto: desglose.bancos,
            saldoAnterior: saldoBancosAnterior,
            saldoNuevo: saldoBancosNuevo,
            tipoReferencia: TipoReferencia.SERVIENTREGA,
            referenciaId: numeroGuia,
            descripcion: `Reversión (BANCOS) guía Servientrega #${numeroGuia}`,
            saldoBucket: "BANCOS",
            usuarioId: systemUserId,
          },
          tx
        );
      }
      log("✅ [revertirIngresoServicioExterno] Transacción completada");

      return {
        movimiento,
        saldoServicio: {
          anterior: Number(saldoServicioAnterior),
          nuevo: Number(saldoServicioNuevo),
        },
        saldoGeneral: {
          anterior: Number(saldoCajaAnterior),
          nuevo: Number(saldoCajaNuevo),
        },
      };
    });
  }
}
