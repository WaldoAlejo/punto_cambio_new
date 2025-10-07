import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function corregirDuplicadosSaldoInicial() {
  console.log("🔧 Corrigiendo duplicados de SALDO_INICIAL...\n");

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Encontrar todos los movimientos de SALDO_INICIAL agrupados por referencia
        const movimientos = await tx.movimientoSaldo.findMany({
          where: {
            tipo_movimiento: "SALDO_INICIAL",
          },
          orderBy: {
            fecha: "asc",
          },
        });

        console.log(
          `📊 Total de movimientos SALDO_INICIAL: ${movimientos.length}\n`
        );

        // Agrupar por referencia
        const porReferencia = new Map<string, typeof movimientos>();
        for (const mov of movimientos) {
          if (!mov.referencia_id) continue;

          const lista = porReferencia.get(mov.referencia_id) || [];
          lista.push(mov);
          porReferencia.set(mov.referencia_id, lista);
        }

        // 2. Identificar y eliminar duplicados
        let totalDuplicados = 0;
        let totalEliminados = 0;

        for (const [referencia, movs] of porReferencia.entries()) {
          if (movs.length > 1) {
            totalDuplicados++;
            console.log(
              `⚠️  Referencia ${referencia}: ${movs.length} movimientos`
            );

            // Ordenar por fecha y mantener solo el primero
            movs.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
            const [primero, ...duplicados] = movs;

            console.log(
              `   ✅ Manteniendo: ID ${primero.id} | Monto: ${primero.monto} | Fecha: ${primero.fecha}`
            );

            // Eliminar los duplicados
            for (const dup of duplicados) {
              console.log(
                `   ❌ Eliminando: ID ${dup.id} | Monto: ${dup.monto} | Fecha: ${dup.fecha}`
              );
              await tx.movimientoSaldo.delete({
                where: { id: dup.id },
              });
              totalEliminados++;
            }
            console.log("");
          }
        }

        console.log(`\n📈 Resumen de limpieza:`);
        console.log(`   - Referencias con duplicados: ${totalDuplicados}`);
        console.log(`   - Movimientos eliminados: ${totalEliminados}\n`);

        // 3. Recalcular todos los saldos
        console.log("🔄 Recalculando todos los saldos...\n");

        const saldos = await tx.saldo.findMany({
          include: {
            puntoAtencion: true,
            moneda: true,
          },
        });

        let saldosCorregidos = 0;

        for (const saldo of saldos) {
          // Obtener saldo inicial
          const saldoInicial = await tx.saldoInicial.findFirst({
            where: {
              punto_atencion_id: saldo.punto_atencion_id,
              moneda_id: saldo.moneda_id,
              activo: true,
            },
          });

          const inicial = Number(saldoInicial?.cantidad_inicial || 0);

          // Sumar todos los movimientos
          const resultado = await tx.movimientoSaldo.aggregate({
            where: {
              punto_atencion_id: saldo.punto_atencion_id,
              moneda_id: saldo.moneda_id,
            },
            _sum: {
              monto: true,
            },
          });

          const sumaMovimientos = Number(resultado._sum.monto || 0);
          const saldoCalculado = inicial + sumaMovimientos;

          if (Math.abs(Number(saldo.cantidad) - saldoCalculado) > 0.01) {
            console.log(
              `   📝 ${saldo.puntoAtencion.nombre} - ${saldo.moneda.codigo}:`
            );
            console.log(`      Anterior: ${saldo.cantidad}`);
            console.log(
              `      Calculado: ${saldoCalculado} (${inicial} + ${sumaMovimientos})`
            );
            console.log(
              `      Diferencia: ${Number(saldo.cantidad) - saldoCalculado}`
            );

            await tx.saldo.update({
              where: { id: saldo.id },
              data: { cantidad: saldoCalculado },
            });

            saldosCorregidos++;
          }
        }

        console.log(`\n✅ Saldos corregidos: ${saldosCorregidos}`);

        // 4. Verificación final
        console.log("\n🔍 Verificación final...\n");

        const verificacion = await tx.movimientoSaldo.groupBy({
          by: ["referencia_id", "tipo_movimiento"],
          where: {
            tipo_movimiento: "SALDO_INICIAL",
            referencia_id: { not: null },
          },
          _count: true,
          having: {
            referencia_id: {
              _count: {
                gt: 1,
              },
            },
          },
        });

        if (verificacion.length > 0) {
          console.log(
            `⚠️  Aún hay ${verificacion.length} referencias con duplicados`
          );
        } else {
          console.log("✅ No se encontraron duplicados de SALDO_INICIAL");
        }

        // Verificar integridad de todos los saldos
        const saldosVerificacion = await tx.saldo.findMany({
          include: {
            puntoAtencion: true,
            moneda: true,
          },
        });

        let discrepancias = 0;

        for (const saldo of saldosVerificacion) {
          const saldoInicial = await tx.saldoInicial.findFirst({
            where: {
              punto_atencion_id: saldo.punto_atencion_id,
              moneda_id: saldo.moneda_id,
              activo: true,
            },
          });

          const inicial = Number(saldoInicial?.cantidad_inicial || 0);

          const resultado = await tx.movimientoSaldo.aggregate({
            where: {
              punto_atencion_id: saldo.punto_atencion_id,
              moneda_id: saldo.moneda_id,
            },
            _sum: {
              monto: true,
            },
          });

          const sumaMovimientos = Number(resultado._sum.monto || 0);
          const saldoCalculado = inicial + sumaMovimientos;

          if (Math.abs(Number(saldo.cantidad) - saldoCalculado) > 0.01) {
            console.log(
              `❌ Discrepancia en ${saldo.puntoAtencion.nombre} - ${saldo.moneda.codigo}: ${saldo.cantidad} vs ${saldoCalculado}`
            );
            discrepancias++;
          }
        }

        if (discrepancias === 0) {
          console.log("✅ Todos los saldos están correctos\n");
        } else {
          console.log(`\n⚠️  Se encontraron ${discrepancias} discrepancias\n`);
        }
      },
      {
        maxWait: 60000, // 60 segundos
        timeout: 300000, // 5 minutos
      }
    );

    console.log("✅ Corrección completada exitosamente");
  } catch (error) {
    console.error("❌ Error durante la corrección:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

corregirDuplicadosSaldoInicial();
