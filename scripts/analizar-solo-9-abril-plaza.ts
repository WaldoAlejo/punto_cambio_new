/**
 * ANÁLISIS DEL DÍA 9/4/2026 - PLAZA DEL VALLE
 * Solo analiza el día del problema para ver si cuadra
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Valores físicos reportados por el operador al INICIO del día 9/4
// (o al final del día 8/4, que es lo mismo)
const SALDO_INICIAL_REPORTADO = {
  USD: 0,  // Calcularemos esto
  EUR: 0,  // Calcularemos esto
};

// Valores físicos reportados al FINAL del día 9/4
const SALDO_FINAL_REPORTADO = {
  USD: 4021.46,
  EUR: 52.74,
};

async function main() {
  console.log("=".repeat(80));
  console.log("ANÁLISIS EXCLUSIVO DEL DÍA 9/4/2026 - PLAZA DEL VALLE");
  console.log("=".repeat(80));
  console.log("\n⚠️  Solo analizamos el día del problema (9/4/2026)");
  console.log("    Objetivo: Verificar si corrigiendo la anulación, todo cuadra\n");

  // Buscar PLAZA DEL VALLE
  const punto = await prisma.puntoAtencion.findFirst({
    where: {
      nombre: {
        contains: "PLAZA DEL VALLE",
        mode: "insensitive",
      },
    },
  });

  if (!punto) {
    console.error("❌ No se encontró PLAZA DEL VALLE");
    return;
  }

  console.log(`📍 Punto: ${punto.nombre}\n`);

  // Fechas del día 9/4/2026 (en UTC)
  const inicio9Abril = new Date("2026-04-09T00:00:00.000Z");
  const fin9Abril = new Date("2026-04-10T00:00:00.000Z");

  const monedas = await prisma.moneda.findMany({
    where: { codigo: { in: ["USD", "EUR"] } },
  });

  for (const moneda of monedas) {
    console.log("\n" + "=".repeat(80));
    console.log(`💱 ${moneda.codigo} (${moneda.nombre})`);
    console.log("=".repeat(80));

    // Obtener movimientos del día 9/4/2026
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha: {
          gte: inicio9Abril,
          lt: fin9Abril,
        },
      },
      orderBy: { fecha: "asc" },
    });

    console.log(`\n📊 Movimientos del 9/4/2026: ${movimientos.length}`);

    if (movimientos.length === 0) {
      console.log("   No hay movimientos este día");
      continue;
    }

    // Mostrar todos los movimientos del día
    console.log("\n📝 DETALLE DE MOVIMIENTOS:");
    console.log("-".repeat(80));
    console.log(`${"Hora".padEnd(12)} | ${"Tipo".padEnd(10)} | ${"Monto".padStart(12)} | ${"Saldo Acum".padStart(12)} | Descripción`);
    console.log("-".repeat(80));

    let saldoAcumulado = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalAjustes = 0;

    // Detectar la transacción problemática
    let transaccionProblematica: any = null;
    let reversoProblematico: any = null;

    for (const mov of movimientos) {
      const hora = new Date(mov.fecha).toLocaleTimeString('es-EC', { 
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
      });
      
      const monto = Number(mov.monto);
      const esReverso = (mov.descripcion || "").toLowerCase().includes("reverso") || 
                        (mov.descripcion || "").toLowerCase().includes("eliminación");
      
      // Calcular cambio en saldo
      let cambio = 0;
      if (mov.tipo_movimiento === "INGRESO") {
        cambio = monto;
        totalIngresos += monto;
      } else if (mov.tipo_movimiento === "EGRESO") {
        cambio = -monto;
        totalEgresos += monto;
      } else if (mov.tipo_movimiento === "AJUSTE") {
        cambio = monto; // Los ajustes ya vienen con signo
        totalAjustes += monto;
      }
      
      saldoAcumulado += cambio;

      // Detectar problemas
      if ((mov.descripcion || "").includes("1775764188730")) {
        if (esReverso) {
          reversoProblematico = { ...mov, cambio, saldoAcumulado };
        } else {
          transaccionProblematica = { ...mov, cambio, saldoAcumulado };
        }
      }

      const tipoStr = esReverso ? `🔴 ${mov.tipo_movimiento}` : mov.tipo_movimiento;
      const signo = cambio >= 0 ? "+" : "";
      const desc = (mov.descripcion || "").substring(0, 35);
      
      console.log(`${hora.padEnd(12)} | ${tipoStr.padEnd(10)} | ${signo}${cambio.toFixed(2).padStart(11)} | ${saldoAcumulado.toFixed(2).padStart(12)} | ${desc}`);
    }

    console.log("-".repeat(80));

    // Resumen del día
    console.log("\n📈 RESUMEN DEL DÍA 9/4/2026:");
    console.log(`   INGRESOS:  +${totalIngresos.toFixed(2)}`);
    console.log(`   EGRESOS:   -${totalEgresos.toFixed(2)}`);
    console.log(`   AJUSTES:   ${totalAjustes >= 0 ? "+" : ""}${totalAjustes.toFixed(2)}`);
    console.log(`   ─────────────────────────`);
    console.log(`   RESULTADO: ${saldoAcumulado >= 0 ? "+" : ""}${saldoAcumulado.toFixed(2)}`);

    // Analizar el problema específico
    console.log("\n🔍 ANÁLISIS DEL PROBLEMA:");
    console.log("-".repeat(80));

    if (transaccionProblematica && reversoProblematico) {
      console.log("✓ Se encontró la transacción problemática (CAM-1775764188730):");
      console.log(`  Transacción original:`);
      console.log(`    Tipo: ${transaccionProblematica.tipo_movimiento}`);
      console.log(`    Monto: ${Math.abs(transaccionProblematica.cambio).toFixed(2)}`);
      console.log(`  Reverso:`);
      console.log(`    Tipo: ${reversoProblematico.tipo_movimiento}`);
      console.log(`    Monto: ${Math.abs(reversoProblematico.cambio).toFixed(2)}`);
      
      const diferencia = Math.abs(transaccionProblematica.cambio) - Math.abs(reversoProblematico.cambio);
      console.log(`\n  ⚠️  DIFERENCIA: ${diferencia.toFixed(2)} ${moneda.codigo}`);
      console.log(`     (El reverso devolvió ${diferencia.toFixed(2)} menos de lo que se egresó)`);
    } else if (transaccionProblematica) {
      console.log("⚠️  Se encontró la transacción original pero NO su reverso");
    } else if (reversoProblematico) {
      console.log("⚠️  Se encontró el reverso pero NO la transacción original");
    } else {
      console.log("ℹ️  No se encontró la transacción CAM-1775764188730 este día");
    }

    // Verificación final
    console.log("\n✅ VERIFICACIÓN:");
    console.log("-".repeat(80));
    
    const saldoReportado = SALDO_FINAL_REPORTADO[moneda.codigo as keyof typeof SALDO_FINAL_REPORTADO];
    const diferenciaConReportado = saldoAcumulado - saldoReportado;

    console.log(`  Resultado calculado: ${saldoAcumulado.toFixed(2)}`);
    console.log(`  Saldo reportado:     ${saldoReportado.toFixed(2)}`);
    console.log(`  Diferencia:          ${diferenciaConReportado >= 0 ? "+" : ""}${diferenciaConReportado.toFixed(2)}`);

    if (transaccionProblematica && reversoProblematico) {
      const diferenciaReverso = Math.abs(transaccionProblematica.cambio) - Math.abs(reversoProblematico.cambio);
      const coincide = Math.abs(diferenciaConReportado + diferenciaReverso) < 0.01;
      
      console.log(`\n  💡 Si corregimos el reverso (agregando ${diferenciaReverso.toFixed(2)}):`);
      console.log(`     Nuevo resultado: ${(saldoAcumulado + diferenciaReverso).toFixed(2)}`);
      console.log(`     Coincide con reportado: ${coincide ? "✅ SÍ" : "❌ NO"}`);
      
      if (coincide) {
        console.log(`\n  🎯 CONCLUSIÓN: Corrigiendo la anulación mal hecha, TODO CUADRA`);
      } else {
        console.log(`\n  ⚠️  CONCLUSIÓN: Hay otras diferencias además de la anulación`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("ANÁLISIS COMPLETADO");
  console.log("=".repeat(80));
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
