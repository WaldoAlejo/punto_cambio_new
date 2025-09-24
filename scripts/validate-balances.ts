#!/usr/bin/env tsx

/**
 * Script de Validación de Balances
 *
 * Valida la consistencia de los balances actuales sin modificar nada,
 * identificando problemas específicos y proporcionando estadísticas detalladas.
 */

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

interface ValidationResult {
  punto_atencion: string;
  moneda: string;
  saldo_actual: number;
  saldo_esperado: number;
  diferencia: number;
  problemas: string[];
  movimientos_analizados: number;
}

async function validarBalances() {
  console.log("🔍 Validando consistencia de balances...\n");

  try {
    const resultados: ValidationResult[] = [];
    let totalProblemas = 0;

    // Obtener todos los balances actuales
    const balances = await prisma.saldo.findMany({
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true, nombre: true } },
      },
    });

    console.log(`📊 Validando ${balances.length} balances...\n`);

    for (const balance of balances) {
      const resultado: ValidationResult = {
        punto_atencion: balance.puntoAtencion.nombre,
        moneda: balance.moneda.codigo,
        saldo_actual: Number(balance.cantidad),
        saldo_esperado: 0,
        diferencia: 0,
        problemas: [],
        movimientos_analizados: 0,
      };

      console.log(
        `🏢 ${balance.puntoAtencion.nombre} - ${balance.moneda.codigo}`
      );

      // 1. Calcular saldo esperado basado en saldo inicial
      const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          activo: true,
        },
        orderBy: { fecha_asignacion: "desc" },
      });

      if (saldoInicial) {
        resultado.saldo_esperado = Number(saldoInicial.cantidad_inicial);
        console.log(
          `   💰 Saldo inicial: ${resultado.saldo_esperado.toLocaleString()}`
        );
      } else {
        resultado.problemas.push("No se encontró saldo inicial");
        console.log(`   ⚠️  Sin saldo inicial registrado`);
      }

      // 2. Analizar cambios de divisas (ingresos)
      const cambiosOrigen = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_origen_id: balance.moneda_id,
        },
      });

      let totalIngresos = 0;
      for (const cambio of cambiosOrigen) {
        const ingreso =
          Number(cambio.usd_entregado_efectivo || 0) +
          Number(cambio.usd_entregado_transfer || 0);
        totalIngresos += ingreso;
        resultado.movimientos_analizados++;
      }

      if (totalIngresos > 0) {
        resultado.saldo_esperado += totalIngresos;
        console.log(
          `   📈 Total ingresos por cambios: +${totalIngresos.toLocaleString()}`
        );
      }

      // 3. Analizar cambios de divisas (egresos) - CON LÓGICA CORREGIDA
      const cambiosDestino = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_destino_id: balance.moneda_id,
        },
        include: {
          monedaDestino: { select: { codigo: true } },
        },
      });

      let totalEgresos = 0;
      let egresosIncorrectos = 0;

      for (const cambio of cambiosDestino) {
        let egresoCalculado = 0;
        let egresoIncorrecto = 0;

        // Lógica CORRECTA
        if (cambio.monedaDestino.codigo === "USD") {
          egresoCalculado =
            Number(cambio.usd_entregado_efectivo || 0) +
            Number(cambio.usd_entregado_transfer || 0);
        } else {
          egresoCalculado = Number(cambio.divisas_recibidas_total_final || 0);
        }

        // Lógica INCORRECTA (la que causaba el bug)
        egresoIncorrecto =
          Number(cambio.usd_entregado_efectivo || 0) +
          Number(cambio.usd_entregado_transfer || 0);

        totalEgresos += egresoCalculado;
        resultado.movimientos_analizados++;

        // Detectar si este cambio fue afectado por el bug
        if (
          cambio.monedaDestino.codigo !== "USD" &&
          egresoIncorrecto !== egresoCalculado
        ) {
          egresosIncorrectos += egresoIncorrecto - egresoCalculado;
          resultado.problemas.push(
            `Cambio ${cambio.numero_recibo}: egreso incorrecto (${egresoIncorrecto} vs ${egresoCalculado})`
          );
        }
      }

      if (totalEgresos > 0) {
        resultado.saldo_esperado -= totalEgresos;
        console.log(
          `   📉 Total egresos por cambios: -${totalEgresos.toLocaleString()}`
        );
      }

      if (egresosIncorrectos !== 0) {
        console.log(
          `   🐛 Egresos afectados por bug: ${egresosIncorrectos.toLocaleString()}`
        );
        resultado.problemas.push(
          `Bug de egresos: diferencia de ${egresosIncorrectos.toLocaleString()}`
        );
      }

      // 4. Analizar transferencias salientes
      const transferenciasOut = await prisma.transferencia.findMany({
        where: {
          origen_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          estado: "APROBADO",
        },
      });

      let totalTransferenciasOut = 0;
      for (const transferencia of transferenciasOut) {
        totalTransferenciasOut += Number(transferencia.monto);
        resultado.movimientos_analizados++;
      }

      if (totalTransferenciasOut > 0) {
        resultado.saldo_esperado -= totalTransferenciasOut;
        console.log(
          `   📤 Total transferencias salientes: -${totalTransferenciasOut.toLocaleString()}`
        );
      }

      // 5. Analizar transferencias entrantes
      const transferenciasIn = await prisma.transferencia.findMany({
        where: {
          destino_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          estado: "APROBADO",
        },
      });

      let totalTransferenciasIn = 0;
      for (const transferencia of transferenciasIn) {
        totalTransferenciasIn += Number(transferencia.monto);
        resultado.movimientos_analizados++;
      }

      if (totalTransferenciasIn > 0) {
        resultado.saldo_esperado += totalTransferenciasIn;
        console.log(
          `   📥 Total transferencias entrantes: +${totalTransferenciasIn.toLocaleString()}`
        );
      }

      // 6. Analizar servicios externos
      const serviciosExternos = await prisma.servicioExternoOperacion.findMany({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
        },
      });

      let totalServicios = 0;
      for (const servicio of serviciosExternos) {
        totalServicios += Number(servicio.monto);
        resultado.movimientos_analizados++;
      }

      if (totalServicios > 0) {
        resultado.saldo_esperado += totalServicios;
        console.log(
          `   💼 Total servicios externos: +${totalServicios.toLocaleString()}`
        );
      }

      // 7. Calcular diferencia
      resultado.diferencia = resultado.saldo_actual - resultado.saldo_esperado;

      console.log(
        `   💰 Saldo actual: ${resultado.saldo_actual.toLocaleString()}`
      );
      console.log(
        `   🎯 Saldo esperado: ${resultado.saldo_esperado.toLocaleString()}`
      );

      if (Math.abs(resultado.diferencia) > 0.01) {
        console.log(
          `   ❌ Diferencia: ${resultado.diferencia.toLocaleString()}`
        );
        resultado.problemas.push(
          `Diferencia de ${resultado.diferencia.toLocaleString()}`
        );
        totalProblemas++;
      } else {
        console.log(`   ✅ Balance correcto`);
      }

      console.log(
        `   📊 Movimientos analizados: ${resultado.movimientos_analizados}`
      );

      if (resultado.problemas.length > 0) {
        console.log(`   🚨 Problemas encontrados:`);
        for (const problema of resultado.problemas) {
          console.log(`      • ${problema}`);
        }
      }

      console.log("");
      resultados.push(resultado);
    }

    // Generar resumen final
    console.log("=".repeat(80));
    console.log("📋 RESUMEN DE VALIDACIÓN");
    console.log("=".repeat(80));

    const totalBalances = resultados.length;
    const balancesCorrectos = resultados.filter(
      (r) => Math.abs(r.diferencia) <= 0.01
    ).length;
    const balancesIncorrectos = totalBalances - balancesCorrectos;
    const totalMovimientos = resultados.reduce(
      (sum, r) => sum + r.movimientos_analizados,
      0
    );

    console.log(`📊 Total balances validados: ${totalBalances}`);
    console.log(`✅ Balances correctos: ${balancesCorrectos}`);
    console.log(`❌ Balances incorrectos: ${balancesIncorrectos}`);
    console.log(
      `📈 Total movimientos analizados: ${totalMovimientos.toLocaleString()}`
    );

    if (balancesIncorrectos > 0) {
      console.log("\n🚨 BALANCES CON PROBLEMAS:");

      const problemasAgrupados = new Map<string, number>();

      for (const resultado of resultados) {
        if (Math.abs(resultado.diferencia) > 0.01) {
          console.log(
            `\n📍 ${resultado.punto_atencion} - ${resultado.moneda}:`
          );
          console.log(`   Actual: ${resultado.saldo_actual.toLocaleString()}`);
          console.log(
            `   Esperado: ${resultado.saldo_esperado.toLocaleString()}`
          );
          console.log(
            `   Diferencia: ${resultado.diferencia.toLocaleString()}`
          );

          for (const problema of resultado.problemas) {
            console.log(`   • ${problema}`);

            // Agrupar problemas para estadísticas
            const tipoProblema = problema.split(":")[0];
            problemasAgrupados.set(
              tipoProblema,
              (problemasAgrupados.get(tipoProblema) || 0) + 1
            );
          }
        }
      }

      console.log("\n📊 TIPOS DE PROBLEMAS ENCONTRADOS:");
      for (const [tipo, cantidad] of problemasAgrupados) {
        console.log(`   • ${tipo}: ${cantidad} casos`);
      }
    }

    // Estadísticas por moneda
    console.log("\n💱 ESTADÍSTICAS POR MONEDA:");
    const estadisticasPorMoneda = new Map<
      string,
      { total: number; correctos: number; diferencia_total: number }
    >();

    for (const resultado of resultados) {
      if (!estadisticasPorMoneda.has(resultado.moneda)) {
        estadisticasPorMoneda.set(resultado.moneda, {
          total: 0,
          correctos: 0,
          diferencia_total: 0,
        });
      }

      const stats = estadisticasPorMoneda.get(resultado.moneda)!;
      stats.total++;
      stats.diferencia_total += Math.abs(resultado.diferencia);

      if (Math.abs(resultado.diferencia) <= 0.01) {
        stats.correctos++;
      }
    }

    for (const [moneda, stats] of estadisticasPorMoneda) {
      const porcentajeCorrectos = (
        (stats.correctos / stats.total) *
        100
      ).toFixed(1);
      console.log(
        `   ${moneda}: ${stats.correctos}/${
          stats.total
        } correctos (${porcentajeCorrectos}%) - Diferencia total: ${stats.diferencia_total.toLocaleString()}`
      );
    }

    console.log(
      "\n" +
        (balancesIncorrectos > 0 ? "⚠️  " : "✅ ") +
        `Validación completada. ${
          balancesIncorrectos > 0
            ? "Se encontraron inconsistencias que requieren corrección."
            : "Todos los balances están correctos."
        }`
    );
  } catch (error) {
    console.error("❌ Error durante la validación:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
if (import.meta.url === `file://${process.argv[1]}`) {
  validarBalances().catch(console.error);
}

export { validarBalances };
