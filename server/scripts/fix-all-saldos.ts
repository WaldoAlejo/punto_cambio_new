import prisma from "../lib/prisma.js";

/**
 * Script para RECALCULAR y CORREGIR todos los saldos de TODOS los puntos
 *
 * Problema detectado: Los saldos_nuevo están mal calculados en la BD
 * Solución: Recalcular cada movimiento basándose en:
 *   - saldo_nuevo = saldo_anterior + monto
 *
 * Uso:
 *   - Ver errores: npx tsx server/scripts/fix-all-saldos.ts
 *   - Aplicar correcciones: npx tsx server/scripts/fix-all-saldos.ts --apply
 *   - Un solo punto: npx tsx server/scripts/fix-all-saldos.ts --punto="AMAZONAS"
 */

interface Correccion {
  movimientoId: string;
  puntoNombre: string;
  monedaCodigo: string;
  fecha: Date;
  tipoMovimiento: string;
  monto: number;
  saldoNuevoActual: number;
  saldoNuevoCorrecto: number;
  diferencia: number;
}

async function fixAllSaldos() {
  try {
    const aplicarCorrecciones = process.argv.includes("--apply");
    const puntoFiltro = process.argv
      .find((arg) => arg.startsWith("--punto="))
      ?.split("=")[1];

    console.log("🔧 CORRECCIÓN MASIVA DE SALDOS\n");
    if (aplicarCorrecciones) {
      console.log("⚠️  MODO: APLICAR CORRECCIONES");
    } else {
      console.log("ℹ️  MODO: SOLO ANÁLISIS (no se modificará la BD)");
    }
    if (puntoFiltro) {
      console.log(`📍 Filtro: Solo punto "${puntoFiltro}"`);
    }
    console.log("\n" + "=".repeat(120) + "\n");

    // 1. Obtener todos los puntos de atención
    const puntos = await prisma.puntoAtencion.findMany({
      where: puntoFiltro
        ? { nombre: { contains: puntoFiltro, mode: "insensitive" } }
        : undefined,
      orderBy: { nombre: "asc" },
    });

    console.log(`📍 Puntos a revisar: ${puntos.length}\n`);

    // 2. Obtener todas las monedas
    const monedas = await prisma.moneda.findMany({
      orderBy: { codigo: "asc" },
    });

    let totalMovimientosRevisados = 0;
    let totalMovimientosCorrectos = 0;
    let totalMovimientosConError = 0;
    const todasLasCorrecciones: Correccion[] = [];

    // 3. Revisar cada punto y cada moneda
    for (const punto of puntos) {
      for (const moneda of monedas) {
        // Verificar si hay saldo para esta combinación
        const saldo = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
            },
          },
        });

        // Solo procesar si hay saldo o movimientos
        if (!saldo || Number(saldo.cantidad) === 0) {
          const hayMovimientos = await prisma.movimientoSaldo.count({
            where: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
            },
          });
          if (hayMovimientos === 0) continue;
        }

        // Obtener movimientos
        const movimientos = await prisma.movimientoSaldo.findMany({
          where: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
          },
          orderBy: { fecha: "asc" },
        });

        if (movimientos.length === 0) continue;

        console.log(
          `\n📦 ${punto.nombre} - ${moneda.codigo} (${movimientos.length} movimientos)`
        );

        // Obtener saldo inicial
        const saldoInicial = await prisma.saldoInicial.findFirst({
          where: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            activo: true,
          },
          orderBy: { fecha_asignacion: "desc" },
        });

        const inicial = Number(saldoInicial?.cantidad_inicial || 0);

        let movimientosCorrectos = 0;
        let movimientosConError = 0;

        // Revisar cada movimiento
        for (const m of movimientos) {
          const monto = Number(m.monto);
          const saldoAnterior = Number(m.saldo_anterior);
          const saldoNuevoBD = Number(m.saldo_nuevo);

          // Calcular el saldo nuevo CORRECTO
          const saldoNuevoCorrecto = saldoAnterior + monto;

          // Verificar si está correcto (tolerancia de 1 centavo por redondeo)
          const diferencia = saldoNuevoBD - saldoNuevoCorrecto;
          const esCorrecto = Math.abs(diferencia) < 0.01;

          if (!esCorrecto) {
            movimientosConError++;
            todasLasCorrecciones.push({
              movimientoId: m.id,
              puntoNombre: punto.nombre,
              monedaCodigo: moneda.codigo,
              fecha: m.fecha,
              tipoMovimiento: m.tipo_movimiento,
              monto: monto,
              saldoNuevoActual: saldoNuevoBD,
              saldoNuevoCorrecto: saldoNuevoCorrecto,
              diferencia: diferencia,
            });
          } else {
            movimientosCorrectos++;
          }

          totalMovimientosRevisados++;
        }

        if (movimientosConError > 0) {
          console.log(`   ❌ ${movimientosConError} errores encontrados`);
          totalMovimientosConError += movimientosConError;
        } else {
          console.log(`   ✅ Todos los movimientos correctos`);
        }
        totalMovimientosCorrectos += movimientosCorrectos;
      }
    }

    // 4. Mostrar resumen
    console.log("\n" + "=".repeat(120));
    console.log(`\n📊 RESUMEN GENERAL:\n`);
    console.log(
      `   📝 Total movimientos revisados: ${totalMovimientosRevisados}`
    );
    console.log(`   ✅ Movimientos correctos: ${totalMovimientosCorrectos}`);
    console.log(`   ❌ Movimientos con error: ${totalMovimientosConError}`);

    if (todasLasCorrecciones.length > 0) {
      console.log(
        `\n🔧 CORRECCIONES NECESARIAS: ${todasLasCorrecciones.length}\n`
      );

      // Agrupar por punto
      const porPunto = todasLasCorrecciones.reduce((acc, c) => {
        const key = `${c.puntoNombre} - ${c.monedaCodigo}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(c);
        return acc;
      }, {} as Record<string, Correccion[]>);

      Object.entries(porPunto).forEach(([key, correcciones]) => {
        console.log(`\n   📍 ${key}:`);
        correcciones.forEach((c, idx) => {
          const fecha = c.fecha.toISOString().split("T")[0];
          console.log(
            `      ${idx + 1}. ${fecha} ${c.tipoMovimiento.padEnd(15)} ${
              c.monto >= 0 ? "+" : ""
            }${c.monto
              .toFixed(2)
              .padStart(10)} | BD: $${c.saldoNuevoActual.toFixed(
              2
            )} → Correcto: $${c.saldoNuevoCorrecto.toFixed(
              2
            )} (Δ $${c.diferencia.toFixed(2)})`
          );
        });
      });

      // 5. Aplicar correcciones si se solicitó
      if (aplicarCorrecciones) {
        console.log(
          `\n\n🚀 APLICANDO ${todasLasCorrecciones.length} CORRECCIONES...\n`
        );

        let corregidos = 0;
        for (const correccion of todasLasCorrecciones) {
          await prisma.movimientoSaldo.update({
            where: { id: correccion.movimientoId },
            data: { saldo_nuevo: correccion.saldoNuevoCorrecto },
          });
          corregidos++;
          if (corregidos % 10 === 0) {
            console.log(
              `   ⏳ Progreso: ${corregidos}/${todasLasCorrecciones.length}`
            );
          }
        }

        console.log(`\n   ✅ ${corregidos} movimientos corregidos`);

        // Actualizar saldos finales en tabla Saldo
        console.log(`\n🔄 Actualizando saldos finales en tabla Saldo...\n`);

        for (const punto of puntos) {
          for (const moneda of monedas) {
            const ultimoMovimiento = await prisma.movimientoSaldo.findFirst({
              where: {
                punto_atencion_id: punto.id,
                moneda_id: moneda.id,
              },
              orderBy: { fecha: "desc" },
            });

            if (ultimoMovimiento) {
              await prisma.saldo.update({
                where: {
                  punto_atencion_id_moneda_id: {
                    punto_atencion_id: punto.id,
                    moneda_id: moneda.id,
                  },
                },
                data: { cantidad: ultimoMovimiento.saldo_nuevo },
              });
            }
          }
        }

        console.log(`   ✅ Saldos finales actualizados\n`);
        console.log(`\n✅ CORRECCIONES APLICADAS EXITOSAMENTE\n`);
      } else {
        console.log(`\n\nℹ️  Para aplicar estas correcciones, ejecuta:`);
        console.log(`   npx tsx server/scripts/fix-all-saldos.ts --apply\n`);
      }
    } else {
      console.log(
        `\n✅ No se encontraron errores. Todos los saldos están correctos.\n`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllSaldos();
