// Dry run for per-component exchange calculation without DB

type TipoOperacion = "COMPRA" | "VENTA";

type RateMode = "USD_PER_UNIT" | "UNITS_PER_USD";

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const round2 = (x: number) => Math.round((Number(x) + Number.EPSILON) * 100) / 100;

const rateModeByCode: Record<string, RateMode> = {
  EUR: "USD_PER_UNIT",
  GBP: "USD_PER_UNIT",
  CHF: "USD_PER_UNIT",
  JPY: "USD_PER_UNIT",
  COP: "UNITS_PER_USD",
  PYG: "UNITS_PER_USD",
  CLP: "UNITS_PER_USD",
  PEN: "UNITS_PER_USD",
  ARS: "UNITS_PER_USD",
  MXN: "UNITS_PER_USD",
  BRL: "UNITS_PER_USD",
  UYU: "UNITS_PER_USD",
  DOP: "UNITS_PER_USD",
};

function getRateModeForPair(codOrigen: string, codDestino: string): RateMode {
  if (codOrigen === "USD" && codDestino !== "USD") {
    return rateModeByCode[codDestino] ?? "UNITS_PER_USD";
  }
  if (codDestino === "USD" && codOrigen !== "USD") {
    return rateModeByCode[codOrigen] ?? "UNITS_PER_USD";
  }
  return rateModeByCode[codDestino] ?? "USD_PER_UNIT";
}

function convertir(
  _tipo: TipoOperacion,
  modo: RateMode,
  montoOrigen: number,
  tasa: number,
  codOrigen: string,
  codDestino: string
) {
  if (!Number.isFinite(tasa) || tasa <= 0) return { montoDestinoCalc: 0 };

  if (codOrigen === "USD" && codDestino !== "USD") {
    // VENTA: USD -> DIVISA
    if (modo === "UNITS_PER_USD") return { montoDestinoCalc: montoOrigen * tasa };
    return { montoDestinoCalc: montoOrigen / tasa };
  }
  if (codDestino === "USD" && codOrigen !== "USD") {
    // COMPRA: DIVISA -> USD
    if (modo === "UNITS_PER_USD") return { montoDestinoCalc: montoOrigen / tasa };
    return { montoDestinoCalc: montoOrigen * tasa };
  }
  return { montoDestinoCalc: 0 };
}

function calcDestinoUSD(params: {
  tipo_operacion: TipoOperacion;
  codigoOrigen: string;
  codigoDestino: string;
  divisas_entregadas_billetes: number;
  divisas_entregadas_monedas: number;
  tasa_cambio_billetes: number;
  tasa_cambio_monedas: number;
  monto_origen: number; // total origen si se usa fallback
}): number {
  const {
    tipo_operacion,
    codigoOrigen,
    codigoDestino,
    divisas_entregadas_billetes,
    divisas_entregadas_monedas,
    tasa_cambio_billetes,
    tasa_cambio_monedas,
    monto_origen,
  } = params;

  const modo = getRateModeForPair(codigoOrigen, codigoDestino);
  let totalCalc = 0;

  const entBilletes = num(divisas_entregadas_billetes);
  const entMonedas = num(divisas_entregadas_monedas);
  const tasaB = num(tasa_cambio_billetes);
  const tasaM = num(tasa_cambio_monedas);

  if (entBilletes > 0 && tasaB > 0) {
    const { montoDestinoCalc } = convertir(
      tipo_operacion,
      modo,
      entBilletes,
      tasaB,
      codigoOrigen,
      codigoDestino
    );
    if (montoDestinoCalc > 0) totalCalc += montoDestinoCalc;
  }

  if (entMonedas > 0 && tasaM > 0) {
    const { montoDestinoCalc } = convertir(
      tipo_operacion,
      modo,
      entMonedas,
      tasaM,
      codigoOrigen,
      codigoDestino
    );
    if (montoDestinoCalc > 0) totalCalc += montoDestinoCalc;
  }

  // Fallback: si no hubo desagregación útil, intentar con una tasa efectiva si la hubiera
  const tasaEfectiva = tasaB > 0 ? tasaB : tasaM > 0 ? tasaM : 0;
  if (totalCalc === 0 && tasaEfectiva > 0 && monto_origen > 0) {
    const { montoDestinoCalc } = convertir(
      tipo_operacion,
      modo,
      monto_origen,
      tasaEfectiva,
      codigoOrigen,
      codigoDestino
    );
    if (montoDestinoCalc > 0) totalCalc = montoDestinoCalc;
  }

  return round2(totalCalc);
}

function runExamples() {
  // Caso 1: 180 EUR en billetes a 1.10 => 198 USD
  const ex1 = calcDestinoUSD({
    tipo_operacion: "COMPRA",
    codigoOrigen: "EUR",
    codigoDestino: "USD",
    divisas_entregadas_billetes: 180,
    divisas_entregadas_monedas: 0,
    tasa_cambio_billetes: 1.10,
    tasa_cambio_monedas: 0,
    monto_origen: 180,
  });

  // Caso 2: 180 EUR billetes a 1.10 + 20 EUR monedas a 1.08 => 219.60 USD
  const ex2 = calcDestinoUSD({
    tipo_operacion: "COMPRA",
    codigoOrigen: "EUR",
    codigoDestino: "USD",
    divisas_entregadas_billetes: 180,
    divisas_entregadas_monedas: 20,
    tasa_cambio_billetes: 1.10,
    tasa_cambio_monedas: 1.08,
    monto_origen: 200,
  });

  console.log("Caso 1 (180 EUR billetes @1.10) =>", ex1, "USD (esperado 198.00)");
  console.log(
    "Caso 2 (180@1.10 + 20@1.08) =>",
    ex2,
    "USD (esperado 219.60)"
  );
}

runExamples();
