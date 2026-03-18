import { PrismaClient, ServicioExterno } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== RECALCULANDO TODOS LOS SALDOS (DIVISAS Y SERVICIOS) ===\n");

  const puntos = await prisma.puntoAtencion.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
  });

  const monedas = await prisma.moneda.findMany({
    where: { activo: true },
    select: { id: true, codigo: true },
  });

  let updatedDivisas = 0;
  let updatedServicios = 0;

  // 1. RECALCULAR DIVISAS (Efectivo en Caja)
  console.log("--- Procesando Divisas ---");
  for (const punto of puntos) {
    for (const moneda of monedas) {
      // Sumar TODOS los movimientos de la historia (incluyendo SALDO_INICIAL)
      const movs = await prisma.movimientoSaldo.findMany({
        where: { punto_atencion_id: punto.id, moneda_id: moneda.id },
        select: { monto: true, tipo_movimiento: true, descripcion: true },
      });

      let saldoCalculado = 0;
      for (const m of movs) {
        const abs = Math.abs(Number(m.monto));
        const tipo = m.tipo_movimiento;
        const desc = (m.descripcion || "").toLowerCase();

        // Lógica de signos (Caja)
        if (tipo === "EGRESO" || tipo === "TRANSFERENCIA_SALIENTE" || tipo === "TRANSFERENCIA_SALIDA") {
          saldoCalculado -= abs;
        } else if (tipo === "INGRESO" || tipo === "TRANSFERENCIA_ENTRANTE" || tipo === "TRANSFERENCIA_RECIBIDA" || tipo === "SALDO_INICIAL" || tipo === "TRANSFERENCIA_DEVOLUCION") {
          saldoCalculado += abs;
        } else if (tipo === "AJUSTE") {
          saldoCalculado += Number(m.monto);
        } else if (tipo === "CAMBIO_DIVISA") {
          if (desc.startsWith("egreso por cambio")) saldoCalculado -= abs;
          else if (desc.startsWith("ingreso por cambio")) saldoCalculado += abs;
          else saldoCalculado += Number(m.monto);
        }
      }

      saldoCalculado = Number(saldoCalculado.toFixed(2));

      // Actualizar tabla Saldo
      const existing = await prisma.saldo.findUnique({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: moneda.id } }
      });

      if (existing) {
        const diff = Math.abs(Number(existing.cantidad) - saldoCalculado);
        if (diff > 0.01) {
          await prisma.saldo.update({
            where: { id: existing.id },
            data: { 
              cantidad: saldoCalculado, 
              billetes: saldoCalculado, 
              monedas_fisicas: 0, 
              updated_at: new Date() 
            }
          });
          console.log(`  [DIVISA] ${punto.nombre} | ${moneda.codigo}: ${existing.cantidad} -> ${saldoCalculado}`);
          updatedDivisas++;
        }
      } else if (saldoCalculado !== 0) {
        await prisma.saldo.create({
          data: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            cantidad: saldoCalculado,
            billetes: saldoCalculado,
            monedas_fisicas: 0,
            bancos: 0
          }
        });
        console.log(`  [DIVISA] ${punto.nombre} | ${moneda.codigo}: NUEVO -> ${saldoCalculado}`);
        updatedDivisas++;
      }

      // Sincronizar SaldoInicial consolidado
      const sumHistorial = await prisma.historialSaldo.aggregate({
        where: { punto_atencion_id: punto.id, moneda_id: moneda.id, tipo_movimiento: "INGRESO" },
        _sum: { cantidad_incrementada: true }
      });
      const totalAsignado = Number(sumHistorial._sum.cantidad_incrementada || 0);
      
      const si = await prisma.saldoInicial.findFirst({
        where: { punto_atencion_id: punto.id, moneda_id: moneda.id, activo: true }
      });
      if (si && Number(si.cantidad_inicial) !== totalAsignado) {
        await prisma.saldoInicial.update({ where: { id: si.id }, data: { cantidad_inicial: totalAsignado } });
      }
    }
  }

  // 2. RECALCULAR SERVICIOS EXTERNOS (Crédito Digital)
  console.log("\n--- Procesando Servicios Externos ---");
  const usdId = (await prisma.moneda.findFirst({ where: { codigo: 'USD' } }))?.id;
  if (usdId) {
    for (const punto of puntos) {
      const servicios = Object.values(ServicioExterno);
      for (const svc of servicios) {
        const asigs = await prisma.servicioExternoAsignacion.aggregate({
          where: { punto_atencion_id: punto.id, servicio: svc, moneda_id: usdId },
          _sum: { monto: true }
        });
        const movs = await prisma.servicioExternoMovimiento.findMany({
          where: { punto_atencion_id: punto.id, servicio: svc, moneda_id: usdId }
        });

        const totalAsig = Number(asigs._sum.monto || 0);
        let egresos = 0; // Reposición (+)
        let ingresos = 0; // Consumo (-)
        for (const m of movs) {
          if (m.tipo_movimiento === "EGRESO") egresos += Number(m.monto);
          else if (m.tipo_movimiento === "INGRESO") ingresos += Number(m.monto);
        }

        const saldoFinal = Number((totalAsig + egresos - ingresos).toFixed(2));

        const existingSvc = await prisma.servicioExternoSaldo.findUnique({
          where: { punto_atencion_id_servicio_moneda_id: { punto_atencion_id: punto.id, servicio: svc, moneda_id: usdId } }
        });

        if (existingSvc) {
          const diff = Math.abs(Number(existingSvc.cantidad) - saldoFinal);
          if (diff > 0.01) {
            await prisma.servicioExternoSaldo.update({
              where: { id: existingSvc.id },
              data: { cantidad: saldoFinal, updated_at: new Date() }
            });
            console.log(`  [SVC] ${punto.nombre} | ${svc}: ${existingSvc.cantidad} -> ${saldoFinal}`);
            updatedServicios++;
          }
        } else if (saldoFinal !== 0) {
          await prisma.servicioExternoSaldo.create({
            data: {
              punto_atencion_id: punto.id,
              servicio: svc,
              moneda_id: usdId,
              cantidad: saldoFinal,
              billetes: 0,
              monedas_fisicas: 0,
              bancos: 0
            }
          });
          console.log(`  [SVC] ${punto.nombre} | ${svc}: NUEVO -> ${saldoFinal}`);
          updatedServicios++;
        }
      }
    }
  }

  console.log(`\n✅ ${updatedDivisas} saldos de divisas corregidos.`);
  console.log(`✅ ${updatedServicios} saldos de servicios corregidos.\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
