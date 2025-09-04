import { Moneda } from "../types";

/**
 * Calcula el monto de destino basado en el comportamiento de la divisa
 * @param monedaOrigen - Moneda que entrega el cliente
 * @param monedaDestino - Moneda que recibe el cliente
 * @param tipoOperacion - COMPRA o VENTA
 * @param montoOrigen - Monto en la moneda origen
 * @param tasaCambio - Tasa de cambio a aplicar
 * @returns Monto calculado en la moneda destino
 */
export function calcularMontoDestino(
  monedaOrigen: Moneda,
  monedaDestino: Moneda,
  tipoOperacion: "COMPRA" | "VENTA",
  montoOrigen: number,
  tasaCambio: number
): number {
  if (montoOrigen <= 0 || tasaCambio <= 0) {
    return 0;
  }

  // Determinar qué moneda usar para el comportamiento
  // En una COMPRA: el cliente entrega divisa extranjera y recibe moneda local
  // En una VENTA: el cliente entrega moneda local y recibe divisa extranjera

  let monedaParaComportamiento: Moneda;
  let comportamiento: "MULTIPLICA" | "DIVIDE";

  if (tipoOperacion === "COMPRA") {
    // En compra, usamos el comportamiento de compra de la moneda origen (divisa extranjera)
    monedaParaComportamiento = monedaOrigen;
    comportamiento = monedaOrigen.comportamiento_compra;
  } else {
    // En venta, usamos el comportamiento de venta de la moneda destino (divisa extranjera)
    monedaParaComportamiento = monedaDestino;
    comportamiento = monedaDestino.comportamiento_venta;
  }

  console.log(`🧮 Calculando ${tipoOperacion}:`, {
    monedaOrigen: monedaOrigen.codigo,
    monedaDestino: monedaDestino.codigo,
    monedaParaComportamiento: monedaParaComportamiento.codigo,
    comportamiento,
    montoOrigen,
    tasaCambio,
  });

  if (comportamiento === "MULTIPLICA") {
    return montoOrigen * tasaCambio;
  } else {
    return montoOrigen / tasaCambio;
  }
}

/**
 * Calcula el monto total considerando billetes y monedas por separado
 * @param monedaOrigen - Moneda que entrega el cliente
 * @param monedaDestino - Moneda que recibe el cliente
 * @param tipoOperacion - COMPRA o VENTA
 * @param montoBilletes - Monto en billetes
 * @param montoMonedas - Monto en monedas
 * @param tasaBilletes - Tasa de cambio para billetes
 * @param tasaMonedas - Tasa de cambio para monedas
 * @returns Objeto con los cálculos detallados
 */
export function calcularMontoDetalladoDestino(
  monedaOrigen: Moneda,
  monedaDestino: Moneda,
  tipoOperacion: "COMPRA" | "VENTA",
  montoBilletes: number,
  montoMonedas: number,
  tasaBilletes: number,
  tasaMonedas: number
) {
  const montoBilletesDestino = calcularMontoDestino(
    monedaOrigen,
    monedaDestino,
    tipoOperacion,
    montoBilletes,
    tasaBilletes
  );

  const montoMonedasDestino = calcularMontoDestino(
    monedaOrigen,
    monedaDestino,
    tipoOperacion,
    montoMonedas,
    tasaMonedas
  );

  const totalOrigen = montoBilletes + montoMonedas;
  const totalDestino = montoBilletesDestino + montoMonedasDestino;

  return {
    billetes: {
      origen: montoBilletes,
      destino: montoBilletesDestino,
      tasa: tasaBilletes,
    },
    monedas: {
      origen: montoMonedas,
      destino: montoMonedasDestino,
      tasa: tasaMonedas,
    },
    totales: {
      origen: totalOrigen,
      destino: totalDestino,
    },
  };
}

/**
 * Obtiene una descripción legible del comportamiento de una divisa
 * @param moneda - La moneda a describir
 * @returns Descripción del comportamiento
 */
export function obtenerDescripcionComportamiento(moneda: Moneda): string {
  const compra =
    moneda.comportamiento_compra === "MULTIPLICA" ? "multiplica" : "divide";
  const venta =
    moneda.comportamiento_venta === "MULTIPLICA" ? "multiplica" : "divide";

  return `${moneda.codigo}: Compra ${compra}, Venta ${venta}`;
}

/**
 * Valida si una tasa de cambio es válida según el comportamiento de la divisa
 * @param tasa - Tasa de cambio a validar
 * @param comportamiento - Comportamiento de la divisa
 * @returns true si la tasa es válida
 */
export function validarTasaCambio(
  tasa: number,
  comportamiento: "MULTIPLICA" | "DIVIDE"
): boolean {
  if (tasa <= 0) return false;

  // Para divisas que se dividen, tasas muy pequeñas pueden indicar error
  if (comportamiento === "DIVIDE" && tasa < 0.0001) {
    return false;
  }

  // Para divisas que se multiplican, tasas muy grandes pueden indicar error
  if (comportamiento === "MULTIPLICA" && tasa > 10000) {
    return false;
  }

  return true;
}
