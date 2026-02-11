import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { saldoReconciliationService } from "../../server/services/saldoReconciliationService.js";

async function main() {
  const prisma = new PrismaClient();
  try {
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "Plaza del Valle", mode: "insensitive" } },
      select: { id: true, nombre: true },
    });

    if (!punto) {
      console.error("NO_POINT");
      process.exitCode = 2;
      return;
    }

    const usd = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
      select: { id: true, codigo: true },
    });

    if (!usd) {
      console.error("NO_USD");
      process.exitCode = 2;
      return;
    }

    const saldo = await prisma.saldo.findFirst({
      where: { punto_atencion_id: punto.id, moneda_id: usd.id },
      select: {
        id: true,
        cantidad: true,
        bancos: true,
        billetes: true,
        monedas_fisicas: true,
        updated_at: true,
      },
    });

    const saldoCantidad = Number(saldo?.cantidad ?? 0);
    const saldoBancos = Number(saldo?.bancos ?? 0);

    const saldoRealCaja = await saldoReconciliationService.calcularSaldoReal(
      punto.id,
      usd.id
    );

    const lastMov = await prisma.movimientoSaldo.findFirst({
      where: { punto_atencion_id: punto.id, moneda_id: usd.id },
      orderBy: { fecha: "desc" },
      select: {
        id: true,
        fecha: true,
        monto: true,
        tipo_movimiento: true,
        saldo_nuevo: true,
        descripcion: true,
      },
    });

    const produbancoMov = await prisma.movimientoSaldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        descripcion: { contains: "produbanco", mode: "insensitive" },
      },
      orderBy: { fecha: "desc" },
      select: { fecha: true, monto: true, tipo_movimiento: true, descripcion: true },
    });

    console.log("PLAZA_VALLE_CONTROL_CHECK");
    console.log({ punto, moneda: usd });
    console.log({
      saldoCantidad,
      saldoBancos,
      saldoRealCaja,
      diffCantidadVsReal: Number((saldoCantidad - saldoRealCaja).toFixed(2)),
      saldoUpdatedAt: saldo?.updated_at ?? null,
      lastMov: lastMov
        ? {
            fecha: lastMov.fecha,
            tipo: lastMov.tipo_movimiento,
            monto: Number(lastMov.monto),
            saldo_nuevo: Number(lastMov.saldo_nuevo),
            descripcion: lastMov.descripcion,
          }
        : null,
      produbancoMov: produbancoMov
        ? {
            fecha: produbancoMov.fecha,
            tipo: produbancoMov.tipo_movimiento,
            monto: Number(produbancoMov.monto),
            descripcion: produbancoMov.descripcion,
          }
        : null,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("DIAG_FAILED", e);
  process.exit(1);
});
