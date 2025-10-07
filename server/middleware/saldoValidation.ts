import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
        return res.status(400).json({
          error: "SALDO_INSUFICIENTE",
          message: `Saldo insuficiente en ${
            validacion.puntoNombre
          }. Saldo actual: $${saldoActual.toFixed(2)} ${
            validacion.monedaCodigo
          }, requerido: $${validacion.montoRequerido.toFixed(2)}`,
          details: {
            punto: validacion.puntoNombre,
            moneda: validacion.monedaCodigo,
            saldoActual: saldoActual,
            montoRequerido: validacion.montoRequerido,
            deficit: validacion.montoRequerido - saldoActual,
          },
        });
      }
    }

    // Si todas las validaciones pasan, continuar
    next();
  } catch (error) {
    console.error("Error en validación de saldo:", error);
    res.status(500).json({
      error: "ERROR_VALIDACION_SALDO",
      message: "Error interno al validar saldo",
    });
  }
}

/**
 * Determina si una operación es un egreso que requiere validación
 */
function esOperacionEgreso(body: any): boolean {
  // Casos de egreso directo
  if (
    body.tipo_movimiento &&
    ["EGRESO", "RETIRO", "PAGO", "TRANSFERENCIA_SALIDA"].includes(
      body.tipo_movimiento
    )
  ) {
    return true;
  }

  if (body.tipo && ["EGRESO", "RETIRO", "PAGO"].includes(body.tipo)) {
    return true;
  }

  // Para transferencias (el punto origen hace egreso)
  if (body.punto_origen_id && body.monto && body.monto > 0) {
    return true;
  }

  // Para cambios de divisa (validar moneda origen)
  if (body.moneda_origen_id && body.monto_origen && body.monto_origen > 0) {
    return true;
  }

  // Casos específicos por endpoint
  const url = body._url || "";
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
async function obtenerValidacionesRequeridas(body: any): Promise<
  Array<{
    puntoAtencionId: string;
    monedaId: string;
    montoRequerido: number;
    puntoNombre: string;
    monedaCodigo: string;
  }>
> {
  const validaciones = [];

  // Egreso directo
  if (body.punto_atencion_id && body.moneda_id && body.monto) {
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: body.punto_atencion_id },
    });
    const moneda = await prisma.moneda.findUnique({
      where: { id: body.moneda_id },
    });

    validaciones.push({
      puntoAtencionId: body.punto_atencion_id,
      monedaId: body.moneda_id,
      montoRequerido: Math.abs(Number(body.monto)),
      puntoNombre: punto?.nombre || "Desconocido",
      monedaCodigo: moneda?.codigo || "Desconocido",
    });
  }

  // Transferencia (validar punto origen)
  if (body.punto_origen_id && body.moneda_id && body.monto) {
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: body.punto_origen_id },
    });
    const moneda = await prisma.moneda.findUnique({
      where: { id: body.moneda_id },
    });

    validaciones.push({
      puntoAtencionId: body.punto_origen_id,
      monedaId: body.moneda_id,
      montoRequerido: Number(body.monto),
      puntoNombre: punto?.nombre || "Desconocido",
      monedaCodigo: moneda?.codigo || "Desconocido",
    });
  }

  // Cambio de divisa (validar moneda origen)
  if (body.punto_atencion_id && body.moneda_origen_id && body.monto_origen) {
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: body.punto_atencion_id },
    });
    const moneda = await prisma.moneda.findUnique({
      where: { id: body.moneda_origen_id },
    });

    validaciones.push({
      puntoAtencionId: body.punto_atencion_id,
      monedaId: body.moneda_origen_id,
      montoRequerido: Number(body.monto_origen),
      puntoNombre: punto?.nombre || "Desconocido",
      monedaCodigo: moneda?.codigo || "Desconocido",
    });
  }

  return validaciones;
}

/**
 * Obtiene el saldo actual de un punto para una moneda específica
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

  return Number(saldo?.cantidad || 0);
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
    const { origen_id, moneda_id, monto, tipo_transferencia } = req.body;

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
    console.error("Error validando saldo para transferencia:", error);
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
 */
export async function validarSaldoCambioDivisa(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    let {
      punto_atencion_id,
      moneda_origen_id,
      moneda_destino_id,
      monto_origen,
      monto_destino,
      tipo_operacion,
    } = req.body;

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

    // 🔄 NORMALIZACIÓN: Asegurar que moneda_origen sea siempre lo que el PUNTO ENTREGA (egreso)
    // COMPRA -> El punto compra divisa (recibe divisa, entrega USD) -> Validar USD
    // VENTA -> El punto vende divisa (entrega divisa, recibe USD) -> Validar divisa
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

        // Si es COMPRA y USD está como DESTINO, invertir
        // (el cliente entrega divisa y recibe USD, el punto entrega USD)
        if (isCompra && moneda_destino_id === usdMoneda.id) {
          [moneda_origen_id, moneda_destino_id] = [
            moneda_destino_id,
            moneda_origen_id,
          ];
          [monto_origen, monto_destino] = [monto_destino, monto_origen];
        }
        // Si es VENTA y USD está como ORIGEN, invertir
        // (el cliente entrega USD y recibe divisa, el punto entrega divisa)
        else if (isVenta && moneda_origen_id === usdMoneda.id) {
          [moneda_origen_id, moneda_destino_id] = [
            moneda_destino_id,
            moneda_origen_id,
          ];
          [monto_origen, monto_destino] = [monto_destino, monto_origen];
        }
      }
    } catch (e) {
      console.warn(
        "No se pudo normalizar par USD en validación (continuando)",
        e
      );
    }

    // Ahora validar con las monedas normalizadas
    const saldoActual = await obtenerSaldoActual(
      punto_atencion_id,
      moneda_origen_id
    );
    const montoRequerido = Number(monto_origen);

    if (saldoActual < montoRequerido) {
      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: punto_atencion_id },
      });
      const moneda = await prisma.moneda.findUnique({
        where: { id: moneda_origen_id },
      });

      return res.status(400).json({
        error: "SALDO_INSUFICIENTE_CAMBIO",
        message: `Saldo insuficiente para cambio de divisa en ${punto?.nombre}`,
        details: {
          punto: punto?.nombre,
          monedaOrigen: moneda?.codigo,
          saldoActual: saldoActual,
          montoRequerido: montoRequerido,
          deficit: montoRequerido - saldoActual,
        },
      });
    }

    next();
  } catch (error) {
    console.error("Error validando saldo para cambio de divisa:", error);
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
