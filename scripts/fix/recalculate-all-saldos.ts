import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== RECALCULAR TODOS LOS SALDOS ===\n");

  const puntos = await prisma.puntoAtencion.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
  });

  const monedas = await prisma.moneda.findMany({
    where: { activo: true },
    select: { id: true, codigo: true },
  });

  let updated = 0;

  for (const punto of puntos) {
    for (const moneda of monedas) {
      // Obtener saldo inicial
      const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          activo: true,
        },
        orderBy: { fecha_asignacion: "desc" },
      });

      let saldoCalculado = saldoInicial
        ? Number(saldoInicial.cantidad_inicial)
        : 0;

      // Obtener movimientos (excepto SALDO_INICIAL para no duplicar)
      const movimientos = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          tipo_movimiento: { not: "SALDO_INICIAL" },
        },
        orderBy: { fecha: "asc" },
      });

      // Recalcular saldo
      let subtotalMovimientos = 0;
      const tiposEncontrados = new Set<string>();

      for (const mov of movimientos) {
        const monto = Number(mov.monto);
        tiposEncontrados.add(mov.tipo_movimiento);
        
        if (mov.tipo_movimiento === "EGRESO" || mov.tipo_movimiento === "TRANSFERENCIA_SALIENTE") {
          saldoCalculado -= Math.abs(monto);
          subtotalMovimientos -= Math.abs(monto);
        } else if (
          mov.tipo_movimiento === "INGRESO" ||
          mov.tipo_movimiento === "TRANSFERENCIA_ENTRANTE" ||
          mov.tipo_movimiento === "TRANSFERENCIA_DEVOLUCION"
        ) {
          saldoCalculado += Math.abs(monto);
          subtotalMovimientos += Math.abs(monto);
        } else {
          saldoCalculado += monto;
          subtotalMovimientos += monto;
        }
      }

      saldoCalculado = Number(saldoCalculado.toFixed(2));

      // Actualizar BD
      const saldoBD = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
          },
        },
      });

      if (saldoBD) {
        const cantidadAnterior = Number(saldoBD.cantidad);
        const billetesAnterior = Number(saldoBD.billetes);
        const monedasAnterior = Number(saldoBD.monedas_fisicas);
        
        let nuevosBilletes = billetesAnterior;
        let nuevasMonedas = monedasAnterior;

        const diferencia = Math.abs(cantidadAnterior - saldoCalculado);
        
        if (diferencia > 0.01) {
          // Si hay cambio, debemos ajustar el desglose físico para mantener consistencia
          // Ya que Saldo Actual (UI) = billetes + monedas_fisicas
          
          if (cantidadAnterior > 0) {
            // Ajuste proporcional
            const propBilletes = billetesAnterior / cantidadAnterior;
            nuevosBilletes = Number((saldoCalculado * propBilletes).toFixed(2));
            nuevasMonedas = Number((saldoCalculado - nuevosBilletes).toFixed(2));
          } else {
            // Si el anterior era 0, todo a billetes por defecto
            nuevosBilletes = saldoCalculado;
            nuevasMonedas = 0;
          }

          await prisma.saldo.update({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: punto.id,
                moneda_id: moneda.id,
              },
            },
            data: {
              cantidad: saldoCalculado,
              billetes: nuevosBilletes,
              monedas_fisicas: nuevasMonedas,
              updated_at: new Date(),
            },
          });

          updated++;
          console.log(
            `  ${punto.nombre} | ${moneda.codigo}:`
          );
          console.log(`    Base Inicial: ${Number(saldoInicial?.cantidad_inicial || 0).toFixed(2)}`);
          console.log(`    Movimientos:  ${subtotalMovimientos > 0 ? "+" : ""}${subtotalMovimientos.toFixed(2)} (${Array.from(tiposEncontrados).join(", ")})`);
          console.log(`    Resultado:    ${cantidadAnterior.toFixed(2)} → ${saldoCalculado.toFixed(2)}`);
          console.log(`    Físico:       (${billetesAnterior.toFixed(2)}B + ${monedasAnterior.toFixed(2)}M) → (${nuevosBilletes.toFixed(2)}B + ${nuevasMonedas.toFixed(2)}M)`);
        }
      }
    }
  }

  console.log(`\n✅ ${updated} saldos recalculados\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
