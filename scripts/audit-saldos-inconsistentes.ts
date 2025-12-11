import prisma from "../server/lib/prisma.js";
import logger from "../server/utils/logger.js";

interface SaldoInconsistencia {
  punto: string;
  moneda: string;
  cantidad: number;
  billetes: number | null;
  monedas_fisicas: number | null;
  suma_billetes_monedas: number | null;
  diferencia: number | null;
  es_inconsistente: boolean;
}

async function auditarSaldos() {
  console.log("🔍 AUDITORÍA DE SALDOS INCONSISTENTES");
  console.log("=" .repeat(80));

  try {
    const saldos = await prisma.saldo.findMany({
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
    });

    console.log(`\n📊 Total de saldos encontrados: ${saldos.length}\n`);

    const inconsistencias: SaldoInconsistencia[] = [];

    for (const saldo of saldos) {
      const cantidad = Number(saldo.cantidad || 0);
      const billetes = Number(saldo.billetes ?? null);
      const monedas = Number(saldo.monedas_fisicas ?? null);
      const sumaFisica =
        billetes !== null && monedas !== null ? billetes + monedas : null;
      const diferencia =
        sumaFisica !== null ? Math.abs(cantidad - sumaFisica) : null;

      const esInconsistente =
        diferencia !== null &&
        diferencia > 0.01 &&
        (billetes !== null || monedas !== null);

      if (esInconsistente || billetes === null || monedas === null) {
        inconsistencias.push({
          punto: saldo.puntoAtencion?.nombre || "DESCONOCIDO",
          moneda: saldo.moneda?.codigo || "DESCONOCIDO",
          cantidad,
          billetes,
          monedas_fisicas: monedas,
          suma_billetes_monedas: sumaFisica,
          diferencia,
          es_inconsistente: esInconsistente,
        });
      }
    }

    // Mostrar problemas críticos
    const criticos = inconsistencias.filter(
      (i) => i.es_inconsistente && i.suma_billetes_monedas !== null
    );
    console.log(`\n⚠️  CRÍTICO: ${criticos.length} saldos con inconsistencias\n`);

    if (criticos.length > 0) {
      console.log("Punto                    | Moneda | Cantidad | Billetes | Monedas | Suma | Diferencia");
      console.log("-".repeat(90));
      for (const inc of criticos) {
        const punto = inc.punto.padEnd(24);
        const moneda = String(inc.moneda).padEnd(7);
        const cant = String(inc.cantidad.toFixed(2)).padEnd(9);
        const bil = String(inc.billetes?.toFixed(2) ?? "NULL").padEnd(9);
        const mon = String(inc.monedas_fisicas?.toFixed(2) ?? "NULL").padEnd(8);
        const suma = String(inc.suma_billetes_monedas?.toFixed(2) ?? "NULL").padEnd(6);
        const diff = String(inc.diferencia?.toFixed(2) ?? "NULL");
        console.log(
          `${punto}| ${moneda}| ${cant}| ${bil}| ${mon}| ${suma}| ${diff}`
        );
      }
    }

    // Mostrar saldos con desglose NULL
    const conNull = inconsistencias.filter(
      (i) => (i.billetes === null || i.monedas_fisicas === null) && !i.es_inconsistente
    );
    console.log(
      `\n⚠️  ADVERTENCIA: ${conNull.length} saldos con desglose NULL/SIN DATOS\n`
    );

    if (conNull.length > 0) {
      console.log("Punto                    | Moneda | Cantidad | Billetes   | Monedas");
      console.log("-".repeat(80));
      for (const inc of conNull) {
        const punto = inc.punto.padEnd(24);
        const moneda = String(inc.moneda).padEnd(7);
        const cant = String(inc.cantidad.toFixed(2)).padEnd(9);
        const bil = String(inc.billetes?.toFixed(2) ?? "NULL").padEnd(11);
        const mon = String(inc.monedas_fisicas?.toFixed(2) ?? "NULL");
        console.log(`${punto}| ${moneda}| ${cant}| ${bil}| ${mon}`);
      }
    }

    // Estadísticas
    console.log("\n📈 ESTADÍSTICAS");
    console.log("-".repeat(50));
    console.log(`Total de saldos:              ${saldos.length}`);
    console.log(`Inconsistencias críticas:     ${criticos.length}`);
    console.log(`Saldos con NULL:              ${conNull.length}`);
    console.log(
      `Saldos correctos:             ${saldos.length - inconsistencias.length}`
    );

    const porcentajeCritico = ((criticos.length / saldos.length) * 100).toFixed(2);
    console.log(`\nPorcentaje de inconsistencias: ${porcentajeCritico}%`);

    // Recomendaciones
    console.log("\n💡 RECOMENDACIONES");
    console.log("-".repeat(50));

    if (criticos.length > 0) {
      console.log(
        "1. ❌ Hay inconsistencias críticas en los saldos"
      );
      console.log(
        "   Ejecutar: npm run fix:saldos-inconsistentes"
      );
    }

    if (conNull.length > 0) {
      console.log(
        "2. ⚠️  Hay saldos sin desglose de billetes/monedas"
      );
      console.log(
        "   Estos saldos pueden fallar en cambios de divisas"
      );
      console.log(
        "   Considerar asignar desglose manualmente o normalizarlos"
      );
    }

    if (criticos.length === 0 && conNull.length === 0) {
      console.log("✅ Todos los saldos están consistentes");
    }

    // Movimientos recientes por punto (para contexto)
    console.log("\n📋 ÚLTIMOS MOVIMIENTOS POR PUNTO (últimas 3 operaciones)");
    console.log("-".repeat(80));

    const puntos = await prisma.puntoAtencion.findMany();
    for (const punto of puntos.slice(0, 5)) {
      console.log(`\n${punto.nombre}:`);
      const movimientos = await prisma.movimientoSaldo.findMany({
        where: { punto_atencion_id: punto.id },
        include: { moneda: { select: { codigo: true } } },
        orderBy: { fecha: "desc" },
        take: 3,
      });

      for (const mov of movimientos) {
        const fecha = mov.fecha.toISOString().split("T")[0];
        console.log(
          `  ${fecha} | ${mov.tipo_movimiento} | ${mov.moneda?.codigo} | ${mov.monto.toFixed(2)} | ${mov.descripcion?.substring(0, 40)}`
        );
      }
    }

  } catch (error) {
    logger.error("Error en auditoría de saldos", {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

auditarSaldos();
