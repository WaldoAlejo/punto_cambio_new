import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testTransferencias() {
  try {
    console.log("🔍 Probando consulta de transferencias...");

    // Probar consulta básica de transferencias
    const transferencias = await prisma.transferencia.findMany({
      take: 5,
      include: {
        moneda: { select: { codigo: true } },
        origen: { select: { nombre: true } },
        destino: { select: { nombre: true } },
      },
    });

    console.log(
      `📊 Encontradas ${transferencias.length} transferencias (muestra)`
    );

    for (const t of transferencias) {
      console.log(
        `   - ${t.origen?.nombre || "Sin origen"} → ${t.destino.nombre}: ${
          t.monto
        } ${t.moneda.codigo} (Estado: ${t.estado})`
      );
    }

    // Probar consulta con filtro de estado
    const transferenciasAprobadas = await prisma.transferencia.findMany({
      where: { estado: "APROBADO" },
      take: 3,
    });

    console.log(
      `\n✅ Transferencias APROBADAS: ${transferenciasAprobadas.length} (muestra de 3)`
    );

    // Verificar estados disponibles
    const estadosUnicos = await prisma.transferencia.findMany({
      select: { estado: true },
      distinct: ["estado"],
    });

    console.log("\n📋 Estados de transferencia encontrados:");
    estadosUnicos.forEach((e) => console.log(`   - ${e.estado}`));
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testTransferencias();
