// server/services/fxService.ts
import { PrismaClient, ComportamientoCalculo } from "@prisma/client";

const prisma = new PrismaClient();

export type Tasas = {
  /** Tasa de COMPRA (numérica) para la moneda (convención libre – ver nota abajo) */
  compra: number;
  /** Tasa de VENTA  (numérica) para la moneda (convención libre – ver nota abajo) */
  venta: number;
};

export interface CalcularCambioInput {
  codigoOrigen: string;
  codigoDestino: string;
  montoOrigen: number;
  tasasPorMoneda: Record<string, Tasas>;
  base?: string; // por defecto "USD"
}

/**
 * Aplica una tasa según el comportamiento especificado.
 * MULTIPLICA → monto * tasa
 * DIVIDE     → monto / tasa
 */
function apply(
  monto: number,
  tasa: number,
  comportamiento: ComportamientoCalculo
) {
  if (!(tasa > 0)) throw new Error("La tasa debe ser > 0.");
  return comportamiento === ComportamientoCalculo.MULTIPLICA
    ? monto * tasa
    : monto / tasa;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type PasoCambio = {
  descripcion: string;
  monto: number;
  moneda: string;
  tasa: number;
  comportamiento: ComportamientoCalculo;
};

/**
 * Calcula el cambio respetando el comportamiento por moneda en cada pierna:
 *  - Pierna 1 (Origen→Base): usar comportamiento_compra de la moneda ORIGEN con tasa de COMPRA[origen]
 *  - Pierna 2 (Base→Destino): usar comportamiento_venta  de la moneda DESTINO con tasa de VENTA [destino]
 *
 * NOTA IMPORTANTE:
 *   Este enfoque **no fuerza** una convención única de tasas (USD/moneda o moneda/USD).
 *   Sea cual sea tu convención interna para cada moneda, la "dirección" correcta
 *   la determina el comportamiento (MULTIPLICA o DIVIDE) que configuraste en BD
 *   para COMPRA y para VENTA.
 */
export async function calcularCambioConDB({
  codigoOrigen,
  codigoDestino,
  montoOrigen,
  tasasPorMoneda,
  base = "USD",
}: CalcularCambioInput) {
  if (!(montoOrigen > 0))
    throw new Error("El monto de origen debe ser mayor a 0.");

  const O = codigoOrigen.toUpperCase();
  const D = codigoDestino.toUpperCase();
  const B = base.toUpperCase();

  if (O === D) {
    return {
      montoDestino: round2(montoOrigen),
      pasos: [
        {
          descripcion: "Misma moneda, sin conversión",
          monto: round2(montoOrigen),
          moneda: D,
        },
      ],
    };
  }

  // Cargamos comportamientos desde BD
  const comportamientos = await prisma.moneda.findMany({
    where: { codigo: { in: [O, D] } },
    select: {
      codigo: true,
      comportamiento_compra: true,
      comportamiento_venta: true,
    },
  });

  const byCode = new Map(
    comportamientos.map((m) => [m.codigo.toUpperCase(), m])
  );

  const origenCfg = byCode.get(O);
  const destinoCfg = byCode.get(D);

  if (!origenCfg)
    throw new Error(
      `No se encontró configuración de comportamiento para ${O}.`
    );
  if (!destinoCfg)
    throw new Error(
      `No se encontró configuración de comportamiento para ${D}.`
    );

  const tasasO = tasasPorMoneda[O];
  const tasasD = tasasPorMoneda[D];
  if (!tasasO || !(tasasO.compra > 0) || !(tasasO.venta > 0)) {
    throw new Error(`Faltan tasas válidas para ${O}.`);
  }
  if (!tasasD || !(tasasD.compra > 0) || !(tasasD.venta > 0)) {
    throw new Error(`Faltan tasas válidas para ${D}.`);
  }

  const pasos: Array<{
    descripcion: string;
    monto: number;
    moneda: string;
    tasa: number;
    comportamiento: ComportamientoCalculo;
  }> = [];

  // Caso 1: Origen == Base → Base→Destino (se usa VENTA del destino)
  if (O === B) {
    const out = apply(
      montoOrigen,
      tasasD.venta,
      destinoCfg.comportamiento_venta
    );
    pasos.push({
      descripcion: `${B} → ${D} (venta ${D})`,
      monto: round2(out),
      moneda: D,
      tasa: tasasD.venta,
      comportamiento: destinoCfg.comportamiento_venta,
    });
    return { montoDestino: round2(out), pasos };
  }

  // Caso 2: Destino == Base → Origen→Base (se usa COMPRA del origen)
  if (D === B) {
    const toBase = apply(
      montoOrigen,
      tasasO.compra,
      origenCfg.comportamiento_compra
    );
    pasos.push({
      descripcion: `${O} → ${B} (compra ${O})`,
      monto: round2(toBase),
      moneda: B,
      tasa: tasasO.compra,
      comportamiento: origenCfg.comportamiento_compra,
    });
    return { montoDestino: round2(toBase), pasos };
  }

  // Caso 3: Cruce O→B→D
  const toBase = apply(
    montoOrigen,
    tasasO.compra,
    origenCfg.comportamiento_compra
  );
  pasos.push({
    descripcion: `${O} → ${B} (compra ${O})`,
    monto: round2(toBase),
    moneda: B,
    tasa: tasasO.compra,
    comportamiento: origenCfg.comportamiento_compra,
  });

  const toDest = apply(toBase, tasasD.venta, destinoCfg.comportamiento_venta);
  pasos.push({
    descripcion: `${B} → ${D} (venta ${D})`,
    monto: round2(toDest),
    moneda: D,
    tasa: tasasD.venta,
    comportamiento: destinoCfg.comportamiento_venta,
  });

  return { montoDestino: round2(toDest), pasos };
}

/** Versión pura si ya traes comportamientos por tu cuenta (sin BD) */
export function calcularCambioPuro({
  codigoOrigen,
  codigoDestino,
  montoOrigen,
  tasasPorMoneda,
  comportamientosPorMoneda,
  base = "USD",
}: CalcularCambioInput & {
  comportamientosPorMoneda: Record<
    string,
    { compra: ComportamientoCalculo; venta: ComportamientoCalculo }
  >;
}) {
  if (!(montoOrigen > 0))
    throw new Error("El monto de origen debe ser mayor a 0.");

  const O = codigoOrigen.toUpperCase();
  const D = codigoDestino.toUpperCase();
  const B = base.toUpperCase();

  if (O === D) {
    return {
      montoDestino: round2(montoOrigen),
      pasos: [
        {
          descripcion: "Misma moneda, sin conversión",
          monto: round2(montoOrigen),
          moneda: D,
        },
      ],
    };
  }

  const origenCfg = comportamientosPorMoneda[O];
  const destinoCfg = comportamientosPorMoneda[D];
  if (!origenCfg) throw new Error(`No hay comportamiento para ${O}.`);
  if (!destinoCfg) throw new Error(`No hay comportamiento para ${D}.`);

  const tasasO = tasasPorMoneda[O];
  const tasasD = tasasPorMoneda[D];
  if (!tasasO || !(tasasO.compra > 0) || !(tasasO.venta > 0))
    throw new Error(`Faltan tasas para ${O}.`);
  if (!tasasD || !(tasasD.compra > 0) || !(tasasD.venta > 0))
    throw new Error(`Faltan tasas para ${D}.`);

  const pasos: PasoCambio[] = [];

  if (O === B) {
    const out = apply(montoOrigen, tasasD.venta, destinoCfg.venta);
    pasos.push({
      descripcion: `${B} → ${D} (venta ${D})`,
      monto: round2(out),
      moneda: D,
      tasa: tasasD.venta,
      comportamiento: destinoCfg.venta,
    });
    return { montoDestino: round2(out), pasos };
  }
  if (D === B) {
    const toBase = apply(montoOrigen, tasasO.compra, origenCfg.compra);
    pasos.push({
      descripcion: `${O} → ${B} (compra ${O})`,
      monto: round2(toBase),
      moneda: B,
      tasa: tasasO.compra,
      comportamiento: origenCfg.compra,
    });
    return { montoDestino: round2(toBase), pasos };
  }

  const toBase = apply(montoOrigen, tasasO.compra, origenCfg.compra);
  pasos.push({
    descripcion: `${O} → ${B} (compra ${O})`,
    monto: round2(toBase),
    moneda: B,
    tasa: tasasO.compra,
    comportamiento: origenCfg.compra,
  });

  const toDest = apply(toBase, tasasD.venta, destinoCfg.venta);
  pasos.push({
    descripcion: `${B} → ${D} (venta ${D})`,
    monto: round2(toDest),
    moneda: D,
    tasa: tasasD.venta,
    comportamiento: destinoCfg.venta,
  });

  return { montoDestino: round2(toDest), pasos };
}
