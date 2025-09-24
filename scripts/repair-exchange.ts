import { Prisma, PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Cargar variables de entorno desde el root del proyecto
const rootDir = path.join(process.cwd());
if (fs.existsSync(path.join(rootDir, ".env.production"))) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: path.join(rootDir, ".env.production") });
} else if (fs.existsSync(path.join(rootDir, ".env.local"))) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: path.join(rootDir, ".env.local") });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config({ path: path.join(rootDir, ".env") });
}

const prisma = new PrismaClient({ log: ["info", "warn", "error"] });

async function main() {
  const exchangeId = process.argv[2] || "f6acbca9-f5f1-4f3c-9823-32906fb47883";
  const desiredOriginCode = process.argv[3] || "EUR"; // Moneda que entrega el cliente
  const desiredDestCode = process.argv[4] || "USD"; // Moneda que recibe el cliente

  console.log("\n=== Reparación de Cambio de Divisas ===");
  console.log({ exchangeId, desiredOriginCode, desiredDestCode });

  // 1) Cargar cambio + IDs de monedas por código
  const [eur, usd] = await Promise.all([
    prisma.moneda.findUnique({ where: { codigo: desiredOriginCode } }),
    prisma.moneda.findUnique({ where: { codigo: desiredDestCode } }),
  ]);

  if (!eur)
    throw new Error(`No se encontró Moneda con código ${desiredOriginCode}`);
  if (!usd)
    throw new Error(`No se encontró Moneda con código ${desiredDestCode}`);

  const cambio = await prisma.cambioDivisa.findUnique({
    where: { id: exchangeId },
  });
  if (!cambio) throw new Error(`CambioDivisa no encontrado: ${exchangeId}`);

  console.log("Cambio actual:", {
    id: cambio.id,
    moneda_origen_id: cambio.moneda_origen_id,
    moneda_destino_id: cambio.moneda_destino_id,
    monto_origen: cambio.monto_origen.toString(),
    monto_destino: cambio.monto_destino.toString(),
    punto_atencion_id: cambio.punto_atencion_id,
    usuario_id: cambio.usuario_id,
  });

  // 2) Asegurar que monedas sean las correctas (EUR origen, USD destino por requerimiento)
  if (
    cambio.moneda_origen_id !== eur.id ||
    cambio.moneda_destino_id !== usd.id
  ) {
    console.log("Actualizando monedas del cambio (origen EUR, destino USD)...");
    await prisma.cambioDivisa.update({
      where: { id: exchangeId },
      data: {
        moneda_origen_id: eur.id,
        moneda_destino_id: usd.id,
      },
    });
  } else {
    console.log("Monedas ya están correctas en el cambio.");
  }

  // 3) Eliminar movimientos contables previos de este cambio
  console.log("Eliminando movimientos contables previos...");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "MovimientoSaldo" WHERE referencia_id = $1 AND tipo_referencia = 'CAMBIO_DIVISA'`,
    exchangeId
  );

  // 4) Recalcular e insertar movimientos contables correctos
  //    - EGRESO USD (monto_destino)
  //    - INGRESO EUR (monto_origen)
  const puntoId = cambio.punto_atencion_id;
  const usuarioId = cambio.usuario_id;
  const montoDestino = Number(cambio.monto_destino); // USD que se entrega
  const montoOrigen = Number(cambio.monto_origen); // EUR que se recibe

  // Helper para obtener saldo actual (cantidad) por punto y moneda
  async function getSaldoActual(
    punto_atencion_id: string,
    moneda_id: string
  ): Promise<number> {
    const saldo = await prisma.saldo.findUnique({
      where: { punto_atencion_id_moneda_id: { punto_atencion_id, moneda_id } },
    });
    return saldo ? Number(saldo.cantidad) : 0;
  }

  // EGRESO USD
  const saldoAnteriorUSD = await getSaldoActual(puntoId, usd.id);
  const saldoNuevoUSD = saldoAnteriorUSD - montoDestino;
  if (saldoNuevoUSD < 0) {
    console.warn(
      `ADVERTENCIA: Saldo USD negativo tras el EGRESO. Anterior: ${saldoAnteriorUSD}, Egreso: ${montoDestino}, Nuevo: ${saldoNuevoUSD}`
    );
  }

  await prisma.movimientoSaldo.create({
    data: {
      punto_atencion_id: puntoId,
      moneda_id: usd.id,
      tipo_movimiento: "EGRESO",
      monto: new Prisma.Decimal(montoDestino),
      saldo_anterior: new Prisma.Decimal(saldoAnteriorUSD),
      saldo_nuevo: new Prisma.Decimal(saldoNuevoUSD),
      usuario_id: usuarioId,
      referencia_id: exchangeId,
      tipo_referencia: "CAMBIO_DIVISA",
      descripcion: "Cambio de divisas - Entrega de USD al cliente",
    },
  });

  // Upsert Saldo USD
  const existingUSD = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoId,
        moneda_id: usd.id,
      },
    },
  });
  if (existingUSD) {
    await prisma.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoId,
          moneda_id: usd.id,
        },
      },
      data: { cantidad: new Prisma.Decimal(saldoNuevoUSD) },
    });
  } else {
    await prisma.saldo.create({
      data: {
        punto_atencion_id: puntoId,
        moneda_id: usd.id,
        cantidad: new Prisma.Decimal(saldoNuevoUSD),
        billetes: 0,
        monedas_fisicas: 0,
      },
    });
  }

  // INGRESO EUR
  const saldoAnteriorEUR = await getSaldoActual(puntoId, eur.id);
  const saldoNuevoEUR = saldoAnteriorEUR + montoOrigen;

  await prisma.movimientoSaldo.create({
    data: {
      punto_atencion_id: puntoId,
      moneda_id: eur.id,
      tipo_movimiento: "INGRESO",
      monto: new Prisma.Decimal(montoOrigen),
      saldo_anterior: new Prisma.Decimal(saldoAnteriorEUR),
      saldo_nuevo: new Prisma.Decimal(saldoNuevoEUR),
      usuario_id: usuarioId,
      referencia_id: exchangeId,
      tipo_referencia: "CAMBIO_DIVISA",
      descripcion: "Cambio de divisas - Recepción de EUR del cliente",
    },
  });

  // Upsert Saldo EUR
  const existingEUR = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoId,
        moneda_id: eur.id,
      },
    },
  });
  if (existingEUR) {
    await prisma.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoId,
          moneda_id: eur.id,
        },
      },
      data: { cantidad: new Prisma.Decimal(saldoNuevoEUR) },
    });
  } else {
    await prisma.saldo.create({
      data: {
        punto_atencion_id: puntoId,
        moneda_id: eur.id,
        cantidad: new Prisma.Decimal(saldoNuevoEUR),
        billetes: 0,
        monedas_fisicas: 0,
      },
    });
  }

  console.log("\n✅ Reparación completada:");
  console.log(
    `- EGRESO USD: ${montoDestino.toFixed(2)} | ${saldoAnteriorUSD.toFixed(
      2
    )} -> ${saldoNuevoUSD.toFixed(2)}`
  );
  console.log(
    `- INGRESO EUR: ${montoOrigen.toFixed(2)} | ${saldoAnteriorEUR.toFixed(
      2
    )} -> ${saldoNuevoEUR.toFixed(2)}`
  );
}

main()
  .catch((e) => {
    console.error("❌ Error en reparación:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
