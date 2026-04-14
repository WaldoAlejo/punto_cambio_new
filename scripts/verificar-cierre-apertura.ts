/**
 * Verificación de CIERRE 8/4 + APERTURA 9/4 + TODO el 9/4
 * Para identificar dónde está la diferencia de saldos
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Valores físicos reportados al final del 9/4
const SALDO_FINAL_REPORTADO = {
  USD: 4021.46,
  EUR: 52.74,
};

async function main() {
  console.log("=".repeat(90));
  console.log("VERIFICACIÓN: CIERRE 8/4 + APERTURA 9/4 + MOVIMIENTOS 9/4");
  console.log("=".repeat(90));

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

  console.log(`\n📍 Punto: ${punto.nombre} (ID: ${punto.id})\n`);

  const monedas = await prisma.moneda.findMany({
    where: { codigo: { in: ["USD", "EUR"] } },
  });

  for (const moneda of monedas) {
    console.log("\n" + "=".repeat(90));
    console.log(`💱 ${moneda.codigo} (${moneda.nombre})`);
    console.log("=".repeat(90));

    // ============================================
    // 1. BUSCAR CIERRE DEL 8 DE ABRIL
    // ============================================
    console.log("\n📅 1. CIERRE DEL 8 DE ABRIL");
    console.log("-".repeat(90));

    const inicio8Abril = new Date("2026-04-08T00:00:00.000Z");
    const fin8Abril = new Date("2026-04-09T00:00:00.000Z");

    // Buscar cierres diarios del 8/4
    const cierre8Abril = await prisma.cierreDiario.findFirst({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: inicio8Abril,
          lt: fin8Abril,
        },
      },
      orderBy: {
        fecha: "desc",
      },
    });

    let saldoCierre8Abril = 0;
    if (cierre8Abril) {
      console.log(`   Cierre encontrado: ID ${cierre8Abril.id}`);
      console.log(`   Fecha: ${cierre8Abril.fecha.toISOString()}`);
      console.log(`   Estado: ${cierre8Abril.estado}`);
      
      // Buscar el saldo al final del 8/4 en la tabla Saldo
      const saldo8Abril = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
          },
        },
      });
      
      if (saldo8Abril) {
        // Esto es el saldo actual, necesitamos retroceder los movimientos del 9/4
        console.log(`   Saldo actual en DB: ${Number(saldo8Abril.cantidad).toFixed(2)}`);
      }
    } else {
      console.log("   ⚠️  No se encontró cierre del 8/4");
    }

    // Calcular saldo "real" al final del 8/4 sumando movimientos
    const movimientos8Abril = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha: {
          gte: inicio8Abril,
          lt: fin8Abril,
        },
      },
    });

    let saldoCalculado8Abril = 0;
    for (const mov of movimientos8Abril) {
      if (mov.tipo_movimiento === "INGRESO") {
        saldoCalculado8Abril += Number(mov.monto);
      } else if (mov.tipo_movimiento === "EGRESO") {
        saldoCalculado8Abril -= Number(mov.monto);
      } else if (mov.tipo_movimiento === "AJUSTE") {
        saldoCalculado8Abril += Number(mov.monto);
      }
    }

    console.log(`   Movimientos del 8/4: ${movimientos8Abril.length}`);
    console.log(`   Saldo calculado por movimientos: ${saldoCalculado8Abril.toFixed(2)}`);
    saldoCierre8Abril = saldoCalculado8Abril;

    // ============================================
    // 2. BUSCAR APERTURA DEL 9 DE ABRIL
    // ============================================
    console.log("\n📅 2. APERTURA DEL 9 DE ABRIL");
    console.log("-".repeat(90));

    const inicio9Abril = new Date("2026-04-09T00:00:00.000Z");
    const fin9Abril = new Date("2026-04-10T00:00:00.000Z");

    // Buscar saldo inicial del 9/4
    const saldoInicial9Abril = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha_asignacion: {
          gte: inicio9Abril,
          lt: fin9Abril,
        },
        activo: true,
      },
      orderBy: {
        fecha_asignacion: "desc",
      },
    });

    let saldoApertura9Abril = 0;
    if (saldoInicial9Abril) {
      saldoApertura9Abril = Number(saldoInicial9Abril.cantidad_inicial);
      console.log(`   Apertura encontrada: ID ${saldoInicial9Abril.id}`);
      console.log(`   Fecha: ${saldoInicial9Abril.fecha_asignacion.toISOString()}`);
      console.log(`   Saldo inicial: ${saldoApertura9Abril.toFixed(2)}`);
    } else {
      console.log("   ⚠️  No se encontró saldo inicial del 9/4");
    }

    // También buscar en el primer movimiento del día (SALDO_INICIAL)
    const primerMovimiento9Abril = await prisma.movimientoSaldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha: {
          gte: inicio9Abril,
          lt: fin9Abril,
        },
        tipo_movimiento: "SALDO_INICIAL",
      },
      orderBy: {
        fecha: "asc",
      },
    });

    if (primerMovimiento9Abril) {
      const saldoInicialPorMovimiento = Number(primerMovimiento9Abril.saldo_anterior);
      console.log(`   Movimiento SALDO_INICIAL encontrado:`);
      console.log(`   Fecha: ${primerMovimiento9Abril.fecha.toISOString()}`);
      console.log(`   Saldo anterior (inicial): ${saldoInicialPorMovimiento.toFixed(2)}`);
      
      if (saldoApertura9Abril > 0 && Math.abs(saldoApertura9Abril - saldoInicialPorMovimiento) > 0.01) {
        console.log(`   ⚠️  DIFERENCIA: SaldoInicial=${saldoApertura9Abril.toFixed(2)} vs Movimiento=${saldoInicialPorMovimiento.toFixed(2)}`);
      }
      
      if (saldoApertura9Abril === 0) {
        saldoApertura9Abril = saldoInicialPorMovimiento;
      }
    } else {
      console.log("   ℹ️  No hay movimiento SALDO_INICIAL el 9/4");
    }

    // Comparar cierre 8/4 con apertura 9/4
    console.log("\n   📊 COMPARACIÓN CIERRE 8/4 vs APERTURA 9/4:");
    if (saldoCierre8Abril !== 0 || saldoApertura9Abril !== 0) {
      const difApertura = saldoApertura9Abril - saldoCierre8Abril;
      console.log(`   Cierre 8/4: ${saldoCierre8Abril.toFixed(2)}`);
      console.log(`   Apertura 9/4: ${saldoApertura9Abril.toFixed(2)}`);
      console.log(`   Diferencia: ${difApertura >= 0 ? "+" : ""}${difApertura.toFixed(2)}`);
      
      if (Math.abs(difApertura) > 0.01) {
        console.log(`   ⚠️  ¡EL CIERRE Y LA APERTURA NO COINCIDEN!`);
      } else {
        console.log(`   ✅ Cierre y apertura coinciden`);
      }
    }

    // ============================================
    // 3. MOVIMIENTOS DEL 9 DE ABRIL
    // ============================================
    console.log("\n📅 3. MOVIMIENTOS DEL 9 DE ABRIL");
    console.log("-".repeat(90));

    const movimientos9Abril = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha: {
          gte: inicio9Abril,
          lt: fin9Abril,
        },
      },
      orderBy: {
        fecha: "asc",
      },
    });

    console.log(`   Total movimientos: ${movimientos9Abril.length}`);

    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalAjustes = 0;

    for (const mov of movimientos9Abril) {
      const monto = Number(mov.monto);
      if (mov.tipo_movimiento === "INGRESO") {
        totalIngresos += monto;
      } else if (mov.tipo_movimiento === "EGRESO") {
        totalEgresos += monto;
      } else if (mov.tipo_movimiento === "AJUSTE") {
        totalAjustes += monto;
      }
    }

    console.log(`   INGRESOS: +${totalIngresos.toFixed(2)}`);
    console.log(`   EGRESOS:  -${totalEgresos.toFixed(2)}`);
    console.log(`   AJUSTES:  ${totalAjustes >= 0 ? "+" : ""}${totalAjustes.toFixed(2)}`);

    // ============================================
    // 4. CÁLCULO FINAL
    // ============================================
    console.log("\n📅 4. CÁLCULO FINAL ESPERADO");
    console.log("-".repeat(90));

    // Usar el saldo de apertura como base
    const saldoBase = saldoApertura9Abril > 0 ? saldoApertura9Abril : saldoCierre8Abril;
    const resultadoDelDia = totalIngresos - totalEgresos + totalAjustes;
    const saldoCalculadoFinal = saldoBase + resultadoDelDia;

    console.log(`   Saldo base (apertura/cierre): ${saldoBase.toFixed(2)}`);
    console.log(`   Resultado del día 9/4: ${resultadoDelDia >= 0 ? "+" : ""}${resultadoDelDia.toFixed(2)}`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   SALDO CALCULADO FINAL: ${saldoCalculadoFinal.toFixed(2)}`);
    console.log(`   SALDO REPORTADO:       ${SALDO_FINAL_REPORTADO[moneda.codigo as keyof typeof SALDO_FINAL_REPORTADO].toFixed(2)}`);
    
    const diferenciaFinal = saldoCalculadoFinal - SALDO_FINAL_REPORTADO[moneda.codigo as keyof typeof SALDO_FINAL_REPORTADO];
    console.log(`   DIFERENCIA:            ${diferenciaFinal >= 0 ? "+" : ""}${diferenciaFinal.toFixed(2)}`);

    // ============================================
    // 5. DIAGNÓSTICO
    // ============================================
    console.log("\n🔍 5. DIAGNÓSTICO");
    console.log("-".repeat(90));

    if (Math.abs(diferenciaFinal) < 0.01) {
      console.log("   ✅ TODO CUADRA PERFECTAMENTE");
    } else {
      console.log("   ❌ HAY DIFERENCIAS");
      
      if (saldoApertura9Abril === 0 && saldoCierre8Abril === 0) {
        console.log("   ⚠️  No se encontró ni cierre del 8/4 ni apertura del 9/4");
        console.log("      No podemos determinar el saldo inicial del día");
      } else if (saldoApertura9Abril === 0) {
        console.log("   ⚠️  No hay apertura del 9/4 registrada");
        console.log(`      Usando cierre del 8/4 como base: ${saldoCierre8Abril.toFixed(2)}`);
      }

      // Verificar si la diferencia viene del problema de anulación
      if (moneda.codigo === "EUR") {
        const difSinProblemaAnulacion = diferenciaFinal - 0.16;
        if (Math.abs(difSinProblemaAnulacion) < 0.01) {
          console.log("   💡 La diferencia de 0.16 EUR viene de la anulación mal hecha");
        } else {
          console.log(`   ⚠️  Hay diferencias además de la anulación: ${difSinProblemaAnulacion.toFixed(2)}`);
        }
      }
    }
  }

  console.log("\n" + "=".repeat(90));
  console.log("VERIFICACIÓN COMPLETADA");
  console.log("=".repeat(90));
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
