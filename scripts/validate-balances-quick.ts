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

async function validarBalancesRapido() {
  try {
    console.log("🔍 Validación rápida de balances (primeros 5)...\n");

    // Obtener solo los primeros 5 balances para prueba
    const balances = await prisma.balance.findMany({
      take: 5,
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
    });

    console.log(`📊 Validando ${balances.length} balances...\n`);

    const resultados: ResultadoValidacion[] = [];

    for (const balance of balances) {
      console.log(
        `🏢 ${balance.puntoAtencion.nombre} - ${balance.moneda.codigo}`
      );

      const resultado: ResultadoValidacion = {
        punto_atencion: balance.puntoAtencion.nombre,
        moneda: balance.moneda.codigo,
        saldo_actual: Number(balance.cantidad),
        saldo_esperado: 0,
        diferencia: 0,
        problemas: [],
        movimientos_analizados: 0,
      };

      // 1. Obtener saldo inicial
      const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
        },
      });

      if (saldoInicial) {
        resultado.saldo_esperado = Number(saldoInicial.cantidad);
        console.log(
          `   💰 Saldo inicial: ${resultado.saldo_esperado.toLocaleString()}`
        );
      } else {
        console.log("   ⚠️  Sin saldo inicial registrado");
        resultado.problemas.push("Sin saldo inicial");
      }

      // 2. Analizar cambios de divisa (solo contar)
      const cambiosDivisa = await prisma.cambioDivisa.count({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          OR: [
            { moneda_origen_id: balance.moneda_id },
            { moneda_destino_id: balance.moneda_id },
          ],
        },
      });

      console.log(`   🔄 Cambios de divisa encontrados: ${cambiosDivisa}`);
      resultado.movimientos_analizados += cambiosDivisa;

      // 3. Analizar transferencias (solo contar)
      const transferenciasOut = await prisma.transferencia.count({
        where: {
          origen_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          estado: "APROBADO",
        },
      });

      const transferenciasIn = await prisma.transferencia.count({
        where: {
          destino_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          estado: "APROBADO",
        },
      });

      console.log(`   📤 Transferencias salientes: ${transferenciasOut}`);
      console.log(`   📥 Transferencias entrantes: ${transferenciasIn}`);

      resultado.movimientos_analizados += transferenciasOut + transferenciasIn;

      // 4. Calcular diferencia
      resultado.diferencia = resultado.saldo_actual - resultado.saldo_esperado;

      if (Math.abs(resultado.diferencia) > 0.01) {
        console.log(
          `   ❌ Diferencia: ${resultado.diferencia.toLocaleString()}`
        );
        resultado.problemas.push(
          `Diferencia de ${resultado.diferencia.toLocaleString()}`
        );
      } else {
        console.log("   ✅ Balance correcto");
      }

      console.log(
        `   📊 Movimientos analizados: ${resultado.movimientos_analizados}\n`
      );

      resultados.push(resultado);
    }

    // Resumen
    console.log("📋 RESUMEN:");
    console.log(`   Total balances validados: ${resultados.length}`);
    console.log(
      `   Balances con problemas: ${
        resultados.filter((r) => r.problemas.length > 0).length
      }`
    );
    console.log(
      `   Total movimientos analizados: ${resultados.reduce(
        (sum, r) => sum + r.movimientos_analizados,
        0
      )}`
    );

    console.log("\n✅ Validación rápida completada!");
  } catch (error) {
    console.error("❌ Error durante la validación:", error);
  } finally {
    await prisma.$disconnect();
  }
}

validarBalancesRapido();
