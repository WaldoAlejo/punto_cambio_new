#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ResultadoValidacion {
  punto_atencion: string;
  moneda: string;
  saldo_actual: number;
  saldo_esperado: number;
  diferencia: number;
  problemas: string[];
  movimientos_analizados: number;
}

async function validarBalances() {
  try {
    console.log("🔍 Validando consistencia de balances...\n");

    const balances = await prisma.saldo.findMany({
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
      orderBy: [
        { puntoAtencion: { nombre: "asc" } },
        { moneda: { codigo: "asc" } },
      ],
    });

    console.log(`📊 Validando ${balances.length} balances...\n`);

    const resultados: ResultadoValidacion[] = [];
    let balancesConProblemas = 0;
    let totalMovimientos = 0;

    for (const balance of balances) {
      const resultado: ResultadoValidacion = {
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
        const montoOrigen = Number(cambio.monto_origen);
        totalIngresos += montoOrigen;
        resultado.movimientos_analizados++;
      }

      if (totalIngresos > 0) {
        resultado.saldo_esperado += totalIngresos;
        console.log(
          `   📈 Total ingresos por cambios: +${totalIngresos.toLocaleString()}`
        );
      }

      // 3. Analizar cambios de divisas (egresos)
      const cambiosDestino = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_destino_id: balance.moneda_id,
        },
      });

      let totalEgresos = 0;
      let egresosIncorrectos = 0;

      for (const cambio of cambiosDestino) {
        resultado.movimientos_analizados++;

        // Calcular egreso correcto
        let egresoEfectivo = 0;
        let egresoTransfer = 0;
        let egresoTotal = 0;

        const montoDestino = Number(cambio.monto_destino);

        switch (cambio.metodo_entrega) {
          case "EFECTIVO":
            egresoEfectivo = montoDestino;
            egresoTotal = egresoEfectivo;
            break;
          case "TRANSFERENCIA":
            egresoTransfer = montoDestino;
            egresoTotal = egresoTransfer;
            break;
          case "MIXTO":
            egresoEfectivo = Number(cambio.efectivo_entregado || 0);
            egresoTransfer = Number(cambio.transferencia_realizada || 0);
            egresoTotal = egresoEfectivo + egresoTransfer;
            break;
          default:
            // Método no reconocido, usar monto destino como fallback
            egresoTotal = montoDestino;
            break;
        }

        totalEgresos += egresoTotal;

        // Detectar bug: diferencia entre egreso calculado y monto destino
        const diferenciaBug = egresoTotal - montoDestino;
        if (Math.abs(diferenciaBug) > 0.01) {
          egresosIncorrectos += diferenciaBug;
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

      // 6. Analizar servicios externos (movimientos)
      const serviciosExternos = await prisma.servicioExternoMovimiento.findMany(
        {
          where: {
            punto_atencion_id: balance.punto_atencion_id,
            moneda_id: balance.moneda_id,
          },
        }
      );

      let totalServiciosExternos = 0;
      for (const servicio of serviciosExternos) {
        const monto = Number(servicio.monto);
        if (servicio.tipo_movimiento === "INGRESO") {
          totalServiciosExternos += monto;
        } else if (servicio.tipo_movimiento === "EGRESO") {
          totalServiciosExternos -= monto;
        }
        resultado.movimientos_analizados++;
      }

      if (totalServiciosExternos !== 0) {
        resultado.saldo_esperado += totalServiciosExternos;
        const signo = totalServiciosExternos > 0 ? "+" : "";
        console.log(
          `   🏦 Total servicios externos: ${signo}${totalServiciosExternos.toLocaleString()}`
        );
      }

      // 7. Calcular diferencia
      resultado.diferencia = resultado.saldo_actual - resultado.saldo_esperado;

      if (Math.abs(resultado.diferencia) > 0.01) {
        console.log(
          `   ❌ Diferencia: ${resultado.diferencia.toLocaleString()}`
        );
        resultado.problemas.push(
          `Diferencia de ${resultado.diferencia.toLocaleString()}`
        );
        balancesConProblemas++;
      } else {
        console.log("   ✅ Balance correcto");
      }

      console.log(
        `   📊 Movimientos analizados: ${resultado.movimientos_analizados}\n`
      );

      totalMovimientos += resultado.movimientos_analizados;
      resultados.push(resultado);
    }

    // Generar resumen
    console.log("=".repeat(60));
    console.log("📋 RESUMEN DE VALIDACIÓN");
    console.log("=".repeat(60));
    console.log(`   Total balances validados: ${resultados.length}`);
    console.log(`   Balances con problemas: ${balancesConProblemas}`);
    console.log(
      `   Balances correctos: ${resultados.length - balancesConProblemas}`
    );
    console.log(`   Total movimientos analizados: ${totalMovimientos}`);

    // Mostrar balances con mayores diferencias
    const balancesConDiferencias = resultados
      .filter((r) => Math.abs(r.diferencia) > 0.01)
      .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
      .slice(0, 10);

    if (balancesConDiferencias.length > 0) {
      console.log("\n🔍 TOP 10 DIFERENCIAS MÁS GRANDES:");
      balancesConDiferencias.forEach((balance, index) => {
        console.log(
          `   ${index + 1}. ${balance.punto_atencion} - ${
            balance.moneda
          }: ${balance.diferencia.toLocaleString()}`
        );
      });
    }

    // Mostrar problemas más comunes
    const problemasComunes = new Map<string, number>();
    resultados.forEach((r) => {
      r.problemas.forEach((problema) => {
        problemasComunes.set(
          problema,
          (problemasComunes.get(problema) || 0) + 1
        );
      });
    });

    if (problemasComunes.size > 0) {
      console.log("\n🚨 PROBLEMAS MÁS COMUNES:");
      Array.from(problemasComunes.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([problema, count]) => {
          console.log(`   - ${problema}: ${count} casos`);
        });
    }

    console.log("\n✅ Validación completada!");
  } catch (error) {
    console.error("❌ Error durante la validación:", error);
  } finally {
    await prisma.$disconnect();
  }
}

validarBalances();
