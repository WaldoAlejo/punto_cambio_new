import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

interface SaldoValidationRequest extends Request {
  body: {
    punto_atencion_id?: string;
    moneda_id?: string;
    monto?: number;
    tipo_movimiento?: string;
    tipo?: string;
    // Para transferencias
    punto_origen_id?: string;
    punto_destino_id?: string;
    // Para cambios de divisa
    moneda_origen_id?: string;
    moneda_destino_id?: string;
    monto_origen?: number;
    monto_destino?: number;
  };
}

/**
 * Middleware para validar saldo suficiente antes de egresos
 * Solo bloquea EGRESOS, permite INGRESOS sin restricción
 */
export async function validarSaldoSuficiente(
  req: SaldoValidationRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { body } = req;

    // Determinar si es un egreso que requiere validación
    const esEgreso = esOperacionEgreso(body);

    if (!esEgreso) {
      // Si no es egreso, permitir sin validación
      return next();
    }

    // Validar saldo para egresos
    const validaciones = await obtenerValidacionesRequeridas(body);

    for (const validacion of validaciones) {
      const saldoActual = await obtenerSaldoActual(
        validacion.puntoAtencionId,
        validacion.monedaId
      );

      if (saldoActual < validacion.montoRequerido) {
        // Obtener desglose de billetes, monedas y bancos
        const saldo = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: validacion.puntoAtencionId,
              moneda_id: validacion.monedaId,
            },
          },
        });
        const saldoBilletes = Number(saldo?.billetes || 0);
        const saldoMonedas = Number(saldo?.monedas_fisicas || 0);
        const saldoBancos = Number(saldo?.bancos || 0);
        return res.status(400).json({
          error: "SALDO_INSUFICIENTE",
          message: `Saldo insuficiente en ${validacion.puntoNombre}. Saldo actual: $${saldoActual.toFixed(2)} (${saldoBilletes.toFixed(2)} billetes, ${saldoMonedas.toFixed(2)} monedas, ${saldoBancos.toFixed(2)} banco) ${validacion.monedaCodigo}, requerido: $${validacion.montoRequerido.toFixed(2)}`,
          details: {
            punto: validacion.puntoNombre,
            moneda: validacion.monedaCodigo,
            saldoActual: saldoActual,
            saldoBilletes,
            saldoMonedas,
            saldoBancos,
            montoRequerido: validacion.montoRequerido,
            deficit: validacion.montoRequerido - saldoActual,
          },
        });
      }
    }

    // Si todas las validaciones pasan, continuar
    next();
  } catch (error) {
    logger.error("Error en validación de saldo:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      error: "ERROR_VALIDACION_SALDO",
      message: "Error interno al validar saldo",
    });
  }
}

/**
 * Determina si una operación es un egreso que requiere validación
 */
type RequestBodyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RequestBodyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getIdFromBody(body: RequestBodyRecord, key: string): string | undefined {
  const value = body[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function getStringFromBody(
  body: RequestBodyRecord,
  key: string
): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

function esOperacionEgreso(body: unknown): boolean {
  if (!isRecord(body)) return false;
  // Casos de egreso directo
  if (
    typeof body.tipo_movimiento === "string" &&
    ["EGRESO", "RETIRO", "PAGO", "TRANSFERENCIA_SALIDA"].includes(
      body.tipo_movimiento
    )
  ) {
    return true;
  }

  if (typeof body.tipo === "string" && ["EGRESO", "RETIRO", "PAGO"].includes(body.tipo)) {
    return true;
  }

  // Para transferencias (el punto origen hace egreso)
  const monto = body.monto;
  if (getIdFromBody(body, "punto_origen_id") && monto && Number(monto) > 0) {
    return true;
  }

  // Para cambios de divisa (validar moneda origen)
  const montoOrigen = body.monto_origen;
  if (
    getIdFromBody(body, "moneda_origen_id") &&
    montoOrigen &&
    Number(montoOrigen) > 0
  ) {
    return true;
  }

  // Casos específicos por endpoint
  const url = getStringFromBody(body, "_url") || "";
  if (
    url.includes("/transfers") ||
    url.includes("/exchanges") ||
    url.includes("/spontaneous-exits")
  ) {
    return true;
  }

  return false;
}

/**
 * Obtiene las validaciones requeridas según el tipo de operación
 */
async function obtenerValidacionesRequeridas(body: unknown): Promise<
  Array<{
    puntoAtencionId: string;
    monedaId: string;
    montoRequerido: number;
    puntoNombre: string;
    monedaCodigo: string;
  }>
> {
  if (!isRecord(body)) return [];
  const validaciones: Array<{
    puntoAtencionId: string;
    monedaId: string;
    montoRequerido: number;
    puntoNombre: string;
    monedaCodigo: string;
  }> = [];

  // Egreso directo
  const puntoAtencionId = getIdFromBody(body, "punto_atencion_id");
  const monedaId = getIdFromBody(body, "moneda_id");
  const monto = body.monto;
  if (puntoAtencionId && monedaId && monto) {
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: puntoAtencionId },
    });
    const moneda = await prisma.moneda.findUnique({
      where: { id: monedaId },
    });

    validaciones.push({
      puntoAtencionId,
      monedaId,
      montoRequerido: Math.abs(Number(monto)),
      puntoNombre: punto?.nombre || "Desconocido",
      monedaCodigo: moneda?.codigo || "Desconocido",
    });
  }

  // Transferencia (validar punto origen)
  const puntoOrigenId = getIdFromBody(body, "punto_origen_id");
  if (puntoOrigenId && monedaId && monto) {
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: puntoOrigenId },
    });
    const moneda = await prisma.moneda.findUnique({
      where: { id: monedaId },
    });

    validaciones.push({
      puntoAtencionId: puntoOrigenId,
      monedaId,
      montoRequerido: Number(monto),
      puntoNombre: punto?.nombre || "Desconocido",
      monedaCodigo: moneda?.codigo || "Desconocido",
    });
  }

  // Cambio de divisa (validar moneda origen)
  const monedaOrigenId = getIdFromBody(body, "moneda_origen_id");
  const montoOrigen = body.monto_origen;
  if (puntoAtencionId && monedaOrigenId && montoOrigen) {
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: puntoAtencionId },
    });
    const moneda = await prisma.moneda.findUnique({
      where: { id: monedaOrigenId },
    });

    validaciones.push({
      puntoAtencionId,
      monedaId: monedaOrigenId,
      montoRequerido: Number(montoOrigen),
      puntoNombre: punto?.nombre || "Desconocido",
      monedaCodigo: moneda?.codigo || "Desconocido",
    });
  }

  return validaciones;
}

/**
 * Obtiene el saldo actual de un punto para una moneda específica
 * Incluye billetes, monedas físicas Y bancos (depósitos)
 */
async function obtenerSaldoActual(
  puntoAtencionId: string,
  monedaId: string
): Promise<number> {
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
      },
    },
  });

  // Retornar la suma de billetes, monedas físicas Y bancos
  const saldoBilletes = Number(saldo?.billetes || 0);
  const saldoMonedas = Number(saldo?.monedas_fisicas || 0);
  const saldoBancos = Number(saldo?.bancos || 0);
  return saldoBilletes + saldoMonedas + saldoBancos;
}

/**
 * Middleware específico para transferencias
 */
export async function validarSaldoTransferencia(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { origen_id, moneda_id, monto } = req.body;

    // Para transferencias sin origen (DEPOSITO_GERENCIA, DEPOSITO_MATRIZ), no validar saldo
    if (!origen_id) {
      return next();
    }

    if (!moneda_id || !monto) {
      return res.status(400).json({
        error: "DATOS_INCOMPLETOS",
        message: "Faltan datos requeridos para la transferencia",
      });
    }

    const saldoActual = await obtenerSaldoActual(origen_id, moneda_id);
    const montoRequerido = Number(monto);

    if (saldoActual < montoRequerido) {
      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: origen_id },
      });
      const moneda = await prisma.moneda.findUnique({
        where: { id: moneda_id },
      });

      return res.status(400).json({
        error: "SALDO_INSUFICIENTE_TRANSFERENCIA",
        message: `Saldo insuficiente para transferencia desde ${punto?.nombre}`,
        details: {
          puntoOrigen: punto?.nombre,
          moneda: moneda?.codigo,
          saldoActual: saldoActual,
          montoRequerido: montoRequerido,
          deficit: montoRequerido - saldoActual,
        },
      });
    }

    next();
  } catch (error) {
    logger.error("Error validando saldo para transferencia:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      error: "ERROR_VALIDACION_TRANSFERENCIA",
      message: "Error interno al validar saldo para transferencia",
    });
  }
}

/**
 * Middleware específico para cambios de divisa
 * Aplica la misma lógica de normalización que el endpoint de exchanges
 * para validar la moneda correcta según el tipo de operación
 * ✅ VALIDA BILLETES Y MONEDAS POR SEPARADO
 */
export async function validarSaldoCambioDivisa(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {
    punto_atencion_id,
    moneda_origen_id,
    moneda_destino_id,
    monto_origen,
    monto_destino,
    tipo_operacion,
    metodo_entrega,
    usd_entregado_efectivo,
    usd_entregado_transfer,
  } = req.body;

  try {
    if (
      !punto_atencion_id ||
      !moneda_origen_id ||
      !moneda_destino_id ||
      !monto_origen ||
      !tipo_operacion
    ) {
      return res.status(400).json({
        error: "DATOS_INCOMPLETOS",
        message: "Faltan datos requeridos para el cambio de divisa",
      });
    }

    // ✅ VALIDAR QUE EL PUNTO DE ATENCIÓN EXISTA
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: punto_atencion_id },
    });

    if (!punto) {
      logger.error("Punto de atención no encontrado en validación", {
        punto_atencion_id,
      });
      return res.status(400).json({
        error: "PUNTO_NO_ENCONTRADO",
        message: `El punto de atención especificado no fue encontrado`,
        details: {
          puntoId: punto_atencion_id,
        },
      });
    }

    // ✅ VALIDAR QUE AMBAS MONEDAS EXISTAN
    const [monedaOrigenVal, monedaDestinoVal] = await Promise.all([
      prisma.moneda.findUnique({ where: { id: moneda_origen_id } }),
      prisma.moneda.findUnique({ where: { id: moneda_destino_id } }),
    ]);

    if (!monedaOrigenVal) {
      logger.error("Moneda origen no encontrada en validación", {
        moneda_origen_id,
      });
      return res.status(400).json({
        error: "MONEDA_ORIGEN_NO_ENCONTRADA",
        message: `La moneda origen especificada no fue encontrada`,
        details: {
          monedaId: moneda_origen_id,
        },
      });
    }

    if (!monedaDestinoVal) {
      logger.error("Moneda destino no encontrada en validación", {
        moneda_destino_id,
      });
      return res.status(400).json({
        error: "MONEDA_DESTINO_NO_ENCONTRADA",
        message: `La moneda destino especificada no fue encontrada`,
        details: {
          monedaId: moneda_destino_id,
        },
      });
    }

    // 🔄 NORMALIZACIÓN: Validar la moneda que el PUNTO ENTREGA (egreso)
    // COMPRA -> El cliente trae divisas y el punto PAGA EN USD -> Validar DESTINO (USD que sale)
    // VENTA -> El cliente trae USD y el punto ENTREGA DIVISAS -> Validar DESTINO (divisas que salen)
    
    // Por defecto: Validamos DESTINO (lo que el punto entrega al cliente)
    const monedaValidar = moneda_destino_id;
    const montoValidar = Number(monto_destino);

    logger.info("[VALIDACION_CAMBIO_DIVISA] Determinando moneda a validar", {
      tipo_operacion,
      moneda_origen_id,
      moneda_destino_id,
      monto_origen,
      monto_destino,
    });

    try {
      const usdMoneda = await prisma.moneda.findFirst({
        where: { codigo: "USD" },
      });

      if (
        usdMoneda &&
        (moneda_origen_id === usdMoneda.id ||
          moneda_destino_id === usdMoneda.id)
      ) {
        const isCompra = tipo_operacion === "COMPRA";
        const isVenta = tipo_operacion === "VENTA";

        // COMPRA: Cliente trae divisas, punto PAGA USD -> Validar USD (destino)
        // VENTA: Cliente trae USD, punto ENTREGA divisas -> Validar divisas (destino)
        // En ambos casos, validamos DESTINO, así que no necesitamos hacer nada especial
        
        logger.info("[VALIDACION_CAMBIO_DIVISA] Moneda USD detectada", {
          isCompra,
          isVenta,
          monedaValidar,
          montoValidar,
        });
      }
    } catch (e) {
      logger.warn("No se pudo normalizar par USD en validación (continuando)", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // ✅ VALIDAR MONEDA EXISTE ANTES DE CONTINUAR
    const moneda = await prisma.moneda.findUnique({
      where: { id: monedaValidar },
    });

    if (!moneda) {
      logger.error("Moneda no encontrada en validación", {
        monedaValidar,
        moneda_origen_id,
        moneda_destino_id,
      });
      return res.status(400).json({
        error: "MONEDA_NO_ENCONTRADA",
        message: `La moneda especificada no fue encontrada`,
        details: {
          monedaId: monedaValidar,
        },
      });
    }

    // ✅ VALIDAR SALDO TOTAL Y BILLETES/MONEDAS POR SEPARADO
    const saldo = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto_atencion_id,
          moneda_id: monedaValidar,
        },
      },
    });

    // En este sistema, `Saldo.cantidad` es el saldo EFECTIVO total (billetes + monedas).
    // `Saldo.bancos` se usa solo para trazabilidad y/o entregas por transferencia.
    // No podemos inferir efectivo desde breakdowns, porque pueden estar en 0 aunque `cantidad` esté correcto.
    const saldoEfectivo = Number(saldo?.cantidad || 0);
    let saldoBilletes = Number(saldo?.billetes || 0);
    const saldoMonedas = Number(saldo?.monedas_fisicas || 0);
    const saldoBancos = Number(saldo?.bancos || 0);

    // Fallback: si no hay breakdown físico pero sí hay efectivo total, asignar todo a billetes.
    if (saldoBilletes === 0 && saldoMonedas === 0 && saldoEfectivo > 0) {
      saldoBilletes = saldoEfectivo;
    }

    // Para logs/diagnóstico: total disponible (efectivo + bancos)
    const saldoTotal = saldoEfectivo + saldoBancos;


    // Calcular cuánto EFECTIVO se necesita (si el pago/entrega es por transferencia, no exigir efectivo).
    let efectivoRequerido = montoValidar;

    // Si la entrega es por transferencia, no se requiere efectivo físico (el route de exchanges tampoco lo valida).
    if (metodo_entrega === "transferencia") {
      efectivoRequerido = 0;
    }

    // Si es USD y entrega es mixta, el efectivo requerido es solo la parte en efectivo.
    if (moneda.codigo === "USD" && metodo_entrega === "mixto") {
      efectivoRequerido = Number(usd_entregado_efectivo || 0);
    }

    // LOG DETALLADO PARA DEPURACIÓN DE SALDO FÍSICO
    logger.info("[VALIDACION_CAMBIO_DIVISA] Estado previo a validación de saldo físico", {
      punto_atencion_id,
      monedaValidar,
      saldoTotal,
      saldoEfectivo,
      saldoBilletes,
      saldoMonedas,
      saldoBancos,
      efectivoRequerido,
      metodo_entrega,
      usd_entregado_efectivo,
      usd_entregado_transfer,
      montoValidar,
      tipo_operacion,
      moneda_origen_id,
      moneda_destino_id,
      monto_origen,
      monto_destino,
    });

    // Validar saldo EFECTIVO (solo cuando se requiere efectivo)
    if (saldoEfectivo < efectivoRequerido) {
      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: punto_atencion_id },
      });

      logger.warn("[VALIDACION_CAMBIO_DIVISA] Saldo total insuficiente", {
        punto: punto?.nombre,
        moneda: moneda?.codigo,
        saldoActual: saldoEfectivo,
        montoRequerido: efectivoRequerido,
        deficit: efectivoRequerido - saldoEfectivo,
      });

      return res.status(400).json({
        error: "SALDO_INSUFICIENTE_CAMBIO",
        message: `Saldo total insuficiente para cambio de divisa en ${punto?.nombre}`,
        details: {
          punto: punto?.nombre,
          moneda: moneda?.codigo,
          saldoActual: saldoEfectivo,
          montoRequerido: efectivoRequerido,
          deficit: efectivoRequerido - saldoEfectivo,
        },
      });
    }

    // ✅ VALIDAR DISPONIBILIDAD DE EFECTIVO FÍSICO
    // IMPORTANTE: No validamos proporciones específicas de billetes/monedas
    // porque el cliente especifica cómo quiere RECIBIR, pero el punto entrega lo que TIENE
    // Simplemente validamos que hay SUFICIENTE dinero físico en total
    
    if (efectivoRequerido > 0) {
      const saldoFisicoTotal = saldoBilletes + saldoMonedas;

      logger.info("[VALIDACION_CAMBIO_DIVISA] Validando saldo físico total", {
        saldoFisicoTotal,
        saldoBilletes,
        saldoMonedas,
        efectivoRequerido,
      });
      
      // Validación principal: ¿hay suficiente dinero físico?
      if (saldoFisicoTotal < efectivoRequerido) {
        const punto = await prisma.puntoAtencion.findUnique({
          where: { id: punto_atencion_id },
        });

        logger.warn("[VALIDACION_CAMBIO_DIVISA] Saldo físico insuficiente", {
          punto: punto?.nombre,
          moneda: moneda?.codigo,
          saldoFisicoTotal,
          saldoBilletes,
          saldoMonedas,
          efectivoRequerido,
          deficit: efectivoRequerido - saldoFisicoTotal,
        });

        return res.status(400).json({
          error: "SALDO_INSUFICIENTE_CAMBIO",
          message: `Saldo físico insuficiente en ${moneda?.codigo} para realizar el cambio en ${punto?.nombre}. Disponible: ${saldoFisicoTotal.toFixed(2)} (${saldoBilletes.toFixed(2)} billetes + ${saldoMonedas.toFixed(2)} monedas), Requerido: ${efectivoRequerido.toFixed(2)}`,
          details: {
            punto: punto?.nombre,
            moneda: moneda?.codigo,
            saldoFisicoTotal: saldoFisicoTotal,
            saldoBilletes: saldoBilletes,
            saldoMonedas: saldoMonedas,
            efectivoRequerido: efectivoRequerido,
            deficit: efectivoRequerido - saldoFisicoTotal,
            nota: "El sistema intentará usar billetes y monedas según lo disponible",
          },
        });
      }
    }

    next();
  } catch (error) {
    // Confirmar entrada al catch
    console.log("Entrando a catch de validación de cambio de divisa");
    // Log detallado del error para stacktrace
    console.error("[VALIDACION_CAMBIO_DIVISA][ERROR]", error);
    logger.error("Error validando saldo para cambio de divisa:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      detalles: {
        punto_atencion_id: punto_atencion_id || "undefined",
        moneda_origen_id: moneda_origen_id || "undefined",
        moneda_destino_id: moneda_destino_id || "undefined",
        monto_origen: monto_origen || "undefined",
      },
    });
    res.status(500).json({
      error: "ERROR_VALIDACION_CAMBIO",
      message: "Error interno al validar saldo para cambio de divisa",
    });
  }
}

export default {
  validarSaldoSuficiente,
  validarSaldoTransferencia,
  validarSaldoCambioDivisa,
};
