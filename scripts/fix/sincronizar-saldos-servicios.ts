import { PrismaClient, ServicioExterno } from "@prisma/client";

const prisma = new PrismaClient();

async function sincronizarSaldosServicios(puntoNombre: string, servicio: ServicioExterno) {
  console.log(`Sincronizando saldo de ${servicio} en ${puntoNombre}...`);
  
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: puntoNombre, mode: 'insensitive' } }
  });

  if (!punto) {
    console.error("Punto no encontrado");
    return;
  }

  // 1. Obtener todas las asignaciones
  const asignaciones = await prisma.servicioExternoAsignacion.findMany({
    where: { punto_atencion_id: punto.id, servicio }
  });
  const totalAsig = asignaciones.reduce((acc, curr) => acc + Number(curr.monto), 0);

  // 2. Obtener todos los movimientos
  const movimientos = await prisma.servicioExternoMovimiento.findMany({
    where: { punto_atencion_id: punto.id, servicio }
  });

  const ingresos = movimientos
    .filter(m => m.tipo_movimiento === "INGRESO")
    .reduce((acc, curr) => acc + Number(curr.monto), 0);
  
  const egresos = movimientos
    .filter(m => m.tipo_movimiento === "EGRESO")
    .reduce((acc, curr) => acc + Number(curr.monto), 0);

  const saldoReal = totalAsig + egresos - ingresos;
  console.log(`Total Asignaciones: $${totalAsig}`);
  console.log(`Total Egresos: +$${egresos}`);
  console.log(`Total Ingresos: -$${ingresos}`);
  console.log(`Saldo Real Calculado: $${saldoReal.toFixed(2)}`);

  // 3. Actualizar la tabla de saldos
  const usdId = (await prisma.moneda.findUnique({ where: { codigo: "USD" } }))?.id;
  if (!usdId) throw new Error("No se encontró moneda USD");

  await prisma.servicioExternoSaldo.upsert({
    where: {
      punto_atencion_id_servicio_moneda_id: {
        punto_atencion_id: punto.id,
        servicio,
        moneda_id: usdId
      }
    },
    update: { cantidad: saldoReal },
    create: {
      punto_atencion_id: punto.id,
      servicio,
      moneda_id: usdId,
      cantidad: saldoReal,
      billetes: 0,
      monedas_fisicas: 0
    }
  });

  console.log(`✅ Saldo de ${servicio} actualizado correctamente en la tabla principal.`);
}

async function main() {
  try {
    const usdId = (await prisma.moneda.findUnique({ where: { codigo: "USD" } }))?.id;
    if (!usdId) throw new Error("No se encontró moneda USD");

    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true }
    });

    const servicios = Object.values(ServicioExterno);

    console.log(`Iniciando sincronización masiva para ${puntos.length} puntos y ${servicios.length} servicios...`);

    for (const punto of puntos) {
      console.log(`\n📍 Punto: ${punto.nombre}`);
      for (const servicio of servicios) {
        // 1. Calcular historial
        const asignaciones = await prisma.servicioExternoAsignacion.findMany({
          where: { punto_atencion_id: punto.id, servicio }
        });
        const movimientos = await prisma.servicioExternoMovimiento.findMany({
          where: { punto_atencion_id: punto.id, servicio }
        });

        if (asignaciones.length === 0 && movimientos.length === 0) continue;

        const totalAsig = asignaciones.reduce((acc, curr) => acc + Number(curr.monto), 0);
        const ingresos = movimientos
          .filter(m => m.tipo_movimiento === "INGRESO")
          .reduce((acc, curr) => acc + Number(curr.monto), 0);
        const egresos = movimientos
          .filter(m => m.tipo_movimiento === "EGRESO")
          .reduce((acc, curr) => acc + Number(curr.monto), 0);

        const saldoReal = Number((totalAsig + egresos - ingresos).toFixed(2));

        // 2. Obtener saldo actual grabado
        const saldoActual = await prisma.servicioExternoSaldo.findUnique({
          where: {
            punto_atencion_id_servicio_moneda_id: {
              punto_atencion_id: punto.id,
              servicio,
              moneda_id: usdId
            }
          }
        });

        const cantidadActual = Number(saldoActual?.cantidad || 0);

        if (Math.abs(cantidadActual - saldoReal) > 0.001) {
          console.log(`  ⚠️ Descuadre en ${servicio}: Grabado: $${cantidadActual.toFixed(2)} | Real: $${saldoReal.toFixed(2)} (Diff: $${(cantidadActual - saldoReal).toFixed(2)})`);
          
          await prisma.servicioExternoSaldo.upsert({
            where: {
              punto_atencion_id_servicio_moneda_id: {
                punto_atencion_id: punto.id,
                servicio,
                moneda_id: usdId
              }
            },
            update: { cantidad: saldoReal },
            create: {
              punto_atencion_id: punto.id,
              servicio,
              moneda_id: usdId,
              cantidad: saldoReal,
              billetes: 0,
              monedas_fisicas: 0
            }
          });
          console.log(`  ✅ ${servicio} SINCRONIZADO.`);
        }
      }
    }
    console.log("\n🚀 Sincronización masiva completada.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
