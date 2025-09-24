#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://postgres:admin@localhost:5432/punto_cambio_new",
    },
  },
});

async function testConnection() {
  try {
    console.log("🔗 Probando conexión a la base de datos...");

    const balances = await prisma.saldo.findMany({
      take: 5,
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
    });

    console.log(
      `✅ Conexión exitosa! Encontrados ${balances.length} balances de muestra:`
    );

    for (const balance of balances) {
      console.log(
        `   - ${balance.puntoAtencion.nombre} - ${balance.moneda.codigo}: ${balance.cantidad}`
      );
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Error de conexión:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
