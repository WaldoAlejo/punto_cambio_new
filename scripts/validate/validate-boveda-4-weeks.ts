import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { saldoReconciliationService } from "../../server/services/saldoReconciliationService.js";

const prisma = new PrismaClient();
const POINT_NAME = "BOVEDA";
const DAYS_BACK = 28;

type CurrencySummary = {
  codigo: string;
  saldoDb: number;
  saldoReal: number;
  diferencia: number;
  movimientos: number;
  ajustes: number;
  duplicados: number;
  inconsistenciasDelta: number;
  saldoInicialMovs: number;
  saldoInicialActivo: number;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object") {
    const anyValue = value as { toNumber?: () => number; toString?: () => string };
    if (typeof anyValue.toNumber === "function") return anyValue.toNumber();
    if (typeof anyValue.toString === "function") return Number(anyValue.toString());
  }
  return Number(value);
}

function isCajaMovement(description: string | null | undefined) {
  const desc = (description ?? "").toLowerCase();
  if (desc.includes("(caja)")) return true;
  return !/\bbancos?\b/i.test(desc);
}

async function main() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - DAYS_BACK);

  console.log("=".repeat(90));
  console.log("VALIDACION BOVEDA - ULTIMAS 4 SEMANAS");
  console.log("=".repeat(90));
  console.log(`Rango analizado: ${from.toISOString()} -> ${now.toISOString()}`);
  console.log("Criterios: sin ajustes, sin duplicados exactos, sin deltas inconsistentes, saldo reconciliado\n");

  const puntos = await prisma.puntoAtencion.findMany({
    where: {
      nombre: {
        contains: POINT_NAME,
        mode: "insensitive",
      },
      activo: true,
    },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  if (puntos.length === 0) {
    console.error(`❌ No se encontró un punto activo que contenga '${POINT_NAME}'`);
    process.exit(1);
  }

  if (puntos.length > 1) {
    console.error("❌ Se encontraron múltiples puntos que coinciden con BOVEDA:");
    for (const punto of puntos) {
      console.error(`   - ${punto.nombre} (${punto.id})`);
    }
    process.exit(1);
  }

  const punto = puntos[0];
  console.log(`Punto validado: ${punto.nombre}`);
  console.log(`Point ID: ${punto.id}\n`);

  const movimientosRango = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      fecha: {
        gte: from,
        lte: now,
      },
    },
    select: {
      id: true,
      moneda_id: true,
      tipo_movimiento: true,
      monto: true,
      saldo_anterior: true,
      saldo_nuevo: true,
      referencia_id: true,
      tipo_referencia: true,
      descripcion: true,
      fecha: true,
      moneda: {
        select: { codigo: true },
      },
    },
    orderBy: [{ moneda_id: "asc" }, { fecha: "asc" }],
  });

  const saldos = await prisma.saldo.findMany({
    where: { punto_atencion_id: punto.id },
    select: {
      moneda_id: true,
      cantidad: true,
      moneda: {
        select: { codigo: true },
      },
    },
    orderBy: { moneda: { codigo: "asc" } },
  });

  const saldoInicialActivo = await prisma.saldoInicial.findMany({
    where: {
      punto_atencion_id: punto.id,
      activo: true,
    },
    select: {
      moneda_id: true,
      cantidad_inicial: true,
      moneda: { select: { codigo: true } },
    },
  });

  const monedasIds = Array.from(
    new Set([
      ...movimientosRango.map((mov) => mov.moneda_id),
      ...saldos.map((saldo) => saldo.moneda_id),
      ...saldoInicialActivo.map((saldo) => saldo.moneda_id),
    ])
  );

  const summaries: CurrencySummary[] = [];

  for (const monedaId of monedasIds) {
    const movimientosMoneda = movimientosRango.filter((mov) => mov.moneda_id === monedaId);
    const saldoDbRow = saldos.find((saldo) => saldo.moneda_id === monedaId);
    const codigo =
      saldoDbRow?.moneda.codigo ??
      movimientosMoneda[0]?.moneda.codigo ??
      saldoInicialActivo.find((saldo) => saldo.moneda_id === monedaId)?.moneda.codigo ??
      monedaId;

    const movimientosCaja = movimientosMoneda.filter((mov) => isCajaMovement(mov.descripcion));
    const ajustes = movimientosCaja.filter((mov) => mov.tipo_movimiento === "AJUSTE");

    const duplicateGroups = new Map<string, string[]>();
    for (const mov of movimientosCaja) {
      const key = [
        mov.moneda_id,
        mov.tipo_movimiento,
        toNumber(mov.monto).toFixed(2),
        mov.fecha.toISOString(),
        mov.referencia_id ?? "",
        mov.tipo_referencia ?? "",
      ].join("|");
      const current = duplicateGroups.get(key) ?? [];
      current.push(mov.id);
      duplicateGroups.set(key, current);
    }
    const duplicados = Array.from(duplicateGroups.values()).filter((group) => group.length > 1);

    let inconsistenciasDelta = 0;
    for (const mov of movimientosCaja) {
      const monto = toNumber(mov.monto);
      const anterior = toNumber(mov.saldo_anterior);
      const nuevo = toNumber(mov.saldo_nuevo);
      const delta = Number((nuevo - anterior).toFixed(2));
      if (Math.abs(delta - monto) > 0.02) {
        inconsistenciasDelta++;
      }
    }

    const saldoReal = await saldoReconciliationService.calcularSaldoReal(punto.id, monedaId);
    const saldoDb = toNumber(saldoDbRow?.cantidad ?? 0);
    const diferencia = Number((saldoDb - saldoReal).toFixed(2));

    const saldoInicialMovs = await prisma.movimientoSaldo.count({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: monedaId,
        tipo_movimiento: "SALDO_INICIAL",
        fecha: {
          gte: from,
          lte: now,
        },
      },
    });

    const saldoInicialActivoCount = saldoInicialActivo.filter((saldo) => saldo.moneda_id === monedaId).length;

    summaries.push({
      codigo,
      saldoDb,
      saldoReal,
      diferencia,
      movimientos: movimientosCaja.length,
      ajustes: ajustes.length,
      duplicados: duplicados.length,
      inconsistenciasDelta,
      saldoInicialMovs,
      saldoInicialActivo: saldoInicialActivoCount,
    });

    console.log(`Moneda: ${codigo}`);
    console.log(`  Movimientos caja en rango: ${movimientosCaja.length}`);
    console.log(`  AJUSTE en rango: ${ajustes.length}`);
    console.log(`  Duplicados exactos en rango: ${duplicados.length}`);
    console.log(`  Inconsistencias delta en rango: ${inconsistenciasDelta}`);
    console.log(`  SALDO_INICIAL en rango: ${saldoInicialMovs}`);
    console.log(`  SaldoInicial activo: ${saldoInicialActivoCount}`);
    console.log(`  Saldo DB actual: ${saldoDb.toFixed(2)}`);
    console.log(`  Saldo reconciliado actual: ${saldoReal.toFixed(2)}`);
    console.log(`  Diferencia actual: ${diferencia.toFixed(2)}`);

    if (ajustes.length > 0) {
      console.log("  Detalle AJUSTE:");
      for (const mov of ajustes) {
        console.log(
          `    - ${mov.fecha.toISOString()} | ${toNumber(mov.monto).toFixed(2)} | ${mov.descripcion ?? "Sin descripción"} | ID ${mov.id}`
        );
      }
    }

    if (duplicados.length > 0) {
      console.log("  Detalle duplicados exactos:");
      for (const group of duplicados) {
        console.log(`    - IDs: ${group.join(", ")}`);
      }
    }

    console.log();
  }

  const totalIssues = summaries.reduce((acc, summary) => {
    return (
      acc +
      summary.ajustes +
      summary.duplicados +
      summary.inconsistenciasDelta +
      (Math.abs(summary.diferencia) > 0.02 ? 1 : 0)
    );
  }, 0);

  console.log("RESUMEN FINAL");
  console.log("-".repeat(90));
  for (const summary of summaries) {
    const ok =
      summary.ajustes === 0 &&
      summary.duplicados === 0 &&
      summary.inconsistenciasDelta === 0 &&
      Math.abs(summary.diferencia) <= 0.02;
    console.log(
      `${ok ? "✅" : "❌"} ${summary.codigo} | DB=${summary.saldoDb.toFixed(2)} | REAL=${summary.saldoReal.toFixed(2)} | DIFF=${summary.diferencia.toFixed(2)} | AJUSTE=${summary.ajustes} | DUP=${summary.duplicados} | DELTA=${summary.inconsistenciasDelta}`
    );
  }

  if (totalIssues > 0) {
    console.error("\n❌ VALIDACION FALLIDA: se encontraron inconsistencias en BOVEDA.");
    process.exit(1);
  }

  console.log("\n✅ VALIDACION EXITOSA: BOVEDA no presenta duplicados, ajustes ni descuadres en el periodo revisado.");
}

main()
  .catch((error) => {
    console.error("Fallo validate-boveda-4-weeks:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });