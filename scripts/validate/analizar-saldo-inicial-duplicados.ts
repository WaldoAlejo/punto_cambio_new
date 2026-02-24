import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const puntosProblem = [
  "PLAZA DEL VALLE",
  "AMAZONAS",
  "EL BOSQUE",
  "SCALA",
  "OFICINA ROYAL PACIFIC",
];

async function main() {
  console.log("\n=== ANÁLISIS: DUPLICADOS EN MOVIMIENTOS SALDO_INICIAL ===\n");

  for (const nombrePunto of puntosProblem) {
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: nombrePunto, activo: true },
      select: { id: true, nombre: true },
    });

    if (!punto) continue;

    console.log(`📍 ${punto.nombre}:`);

    // Contar movimientos SALDO_INICIAL por moneda
    const saldosInicialesMovs = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        tipo_movimiento: "SALDO_INICIAL",
      },
      include: { moneda: true },
      orderBy: { fecha: "asc" },
    });

    console.log(`   Movimientos SALDO_INICIAL: ${saldosInicialesMovs.length}`);

    // Agrupar por moneda
    const porMoneda = new Map<string, any[]>();
    for (const mov of saldosInicialesMovs) {
      const key = mov.moneda.codigo;
      if (!porMoneda.has(key)) porMoneda.set(key, []);
      porMoneda.get(key)!.push(mov);
    }

    for (const [monedaCodigo, movs] of porMoneda) {
      if (movs.length > 1) {
        console.log(`\n   ⚠️ ${monedaCodigo}: ${movs.length} registros SALDO_INICIAL`);
        let totalMontos = 0;
        for (const mov of movs) {
          console.log(
            `      ID: ${mov.id} | Fecha: ${mov.fecha.toISOString().split("T")[0]} | Monto: ${mov.monto}`
          );
          totalMontos += Number(mov.monto);
        }
        console.log(`      ➜ Total montos: ${totalMontos}`);
      }
    }

    console.log();
  }

  // Análisis más profundo de PLAZA DEL VALLE
  console.log("\n=== ANÁLISIS DETALLADO: PLAZA DEL VALLE ===\n");

  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: "PLAZA DEL VALLE", activo: true },
  });

  if (punto) {
    const moneda = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (moneda) {
      // Movimientos SALDO_INICIAL
      const saldoInitialMovs = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          tipo_movimiento: "SALDO_INICIAL",
        },
      });

      console.log(`SALDO_INICIAL en movimientoSaldo (${saldoInitialMovs.length}):`);
      for (const mov of saldoInitialMovs) {
        console.log(
          `  ID: ${mov.id}`
        );
        console.log(`  Fecha: ${mov.fecha}`);
        console.log(`  Monto: ${mov.monto}`);
        console.log(`  Saldo Anterior: ${mov.saldo_anterior}`);
        console.log(`  Saldo Nuevo: ${mov.saldo_nuevo}`);
        console.log(`  Referencia: ${mov.referencia_id}`);
        console.log();
      }

      // saldoInicial tabla
      const saldosInitiales = await prisma.saldoInicial.findMany({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
        },
      });

      console.log(`saldoInicial en tabla (${saldosInitiales.length}):`);
      for (const si of saldosInitiales) {
        console.log(`  ID: ${si.id}`);
        console.log(`  Cantidad: ${si.cantidad_inicial}`);
        console.log(`  Fecha: ${si.fecha_asignacion}`);
        console.log(`  Activo: ${si.activo}`);
        console.log();
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
