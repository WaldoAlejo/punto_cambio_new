// @ts-nocheck
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analizarSaldoPlazaValle() {
  console.log("🔍 ANÁLISIS DE SALDOS - PLAZA DEL VALLE");
  console.log("=========================================\n");

  try {
    // 1. Buscar el punto Plaza del Valle
    const punto = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          contains: "Plaza del Valle",
          mode: "insensitive",
        },
      },
    });

    if (!punto) {
      console.error("❌ No se encontró el punto Plaza del Valle");
      return;
    }

    console.log(`✅ Punto encontrado: ${punto.nombre} (ID: ${punto.id})\n`);

    // 2. Obtener TODOS los saldos generales (todas las monedas)
    const todosLosSaldos = await prisma.saldo.findMany({
      where: {
        punto_atencion_id: punto.id
      },
      include: {
        moneda: true
      }
    });

    console.log("💰 TODOS LOS SALDOS GENERALES:");
    console.log("----------------------------");
    for (const saldo of todosLosSaldos) {
      const cantidad = Number(saldo.cantidad);
      if (cantidad !== 0) {
        console.log(`  ${saldo.moneda.codigo.padEnd(10)} ${saldo.moneda.nombre.padEnd(20)} $${cantidad.toFixed(2)}`);
      }
    }
    
    // 3. Obtener TODOS los saldos de servicios externos
    const todosLosServiciosSaldos = await prisma.servicioExternoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id
      },
      include: {
        moneda: true
      }
    });

    console.log("\n💼 TODOS LOS SALDOS DE SERVICIOS EXTERNOS:");
    console.log("----------------------------");
    for (const saldo of todosLosServiciosSaldos) {
      const cantidad = Number(saldo.cantidad);
      if (cantidad !== 0) {
        console.log(`  ${saldo.servicio.padEnd(20)} ${saldo.moneda.codigo.padEnd(10)} $${cantidad.toFixed(2)}`);
      }
    }
    
    console.log("\n");

    // 4. Buscar moneda COP específicamente
    const cop = await prisma.moneda.findFirst({
      where: { codigo: "COP" }
    });

    if (!cop) {
      console.error("❌ No se encontró la moneda COP");
      return;
    }

    // 5. Obtener saldo general en COP
    const saldoGeneral = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: cop.id
      }
    });

    const cantidadGeneral = saldoGeneral ? Number(saldoGeneral.cantidad) : 0;
    
    // 6. Obtener saldos de servicios externos en COP
    const saldosServicios = await prisma.servicioExternoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: cop.id
      }
    });

    let totalServicios = 0;
    for (const saldo of saldosServicios) {
      const cantidad = Number(saldo.cantidad);
      totalServicios += cantidad;
    }
    
    const totalSistema = cantidadGeneral + totalServicios;
    console.log("📊 RESUMEN COP:");
    console.log("----------------------------");
    console.log(`  Saldo GENERAL COP:            $${cantidadGeneral.toFixed(2)}`);
    console.log(`  Saldos SERVICIOS COP:         $${totalServicios.toFixed(2)}`);
    console.log(`  TOTAL COP EN SISTEMA:         $${totalSistema.toFixed(2)}\n`);

    // 5. Comparar con saldo físico reportado
    const saldoFisico = 1575.51;
    const diferencia = totalSistema - saldoFisico;

    console.log("📊 COMPARACIÓN:");
    console.log(`  Saldo físico reportado:  $${saldoFisico.toFixed(2)}`);
    console.log(`  Saldo en sistema:        $${totalSistema.toFixed(2)}`);
    console.log(`  Diferencia:              $${diferencia.toFixed(2)}\n`);

    if (Math.abs(diferencia - 30) < 0.01) {
      console.log("⚠️  La diferencia es exactamente $30.00");
      console.log("   Esto sugiere un movimiento específico.\n");
    }

    // 6. Buscar movimientos recientes
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);

    console.log("📋 MOVIMIENTOS RECIENTES (últimas 24 horas):");
    console.log("-------------------------------------------");

    // Movimientos de saldo general
    const movimientosSaldo = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: cop.id,
        fecha: {
          gte: ayer,
        },
      },
      orderBy: {
        fecha: "desc",
      },
      take: 20,
    });

    if (movimientosSaldo.length > 0) {
      console.log("\n  MOVIMIENTOS DE SALDO GENERAL:");
      for (const mov of movimientosSaldo) {
        const signo = mov.tipo_movimiento === "INGRESO" ? "+" : "-";
        console.log(
          `    ${mov.fecha.toISOString().substring(0, 19)} | ${mov.tipo_movimiento.padEnd(
            8
          )} | ${signo}$${Number(mov.monto).toFixed(2).padStart(10)} | ${
            mov.descripcion || "Sin descripción"
          }`
        );
      }
    }

    // Servicios externos
    const serviciosExternos = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: cop.id,
        fecha: {
          gte: ayer,
        },
      },
      orderBy: {
        fecha: "desc",
      },
      take: 20,
    });

    if (serviciosExternos.length > 0) {
      console.log("\n  SERVICIOS EXTERNOS:");
      for (const mov of serviciosExternos) {
        const signo = mov.tipo_movimiento === "INGRESO" ? "+" : "-";
        console.log(
          `    ${mov.fecha
            .toISOString()
            .substring(0, 19)} | ${mov.servicio.padEnd(
            15
          )} | ${mov.tipo_movimiento.padEnd(8)} | ${signo}$${Number(mov.monto)
            .toFixed(2)
            .padStart(10)} | ${mov.descripcion || "Sin descripción"}`
        );
      }
    }

    // 7. Buscar movimientos de exactamente $30
    console.log("\n\n🎯 MOVIMIENTOS DE EXACTAMENTE $30.00:");
    console.log("---------------------------------------");

    const movimientos30Saldo = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: cop.id,
        monto: 30,
      },
      orderBy: {
        fecha: "desc",
      },
      take: 10,
    });

    if (movimientos30Saldo.length > 0) {
      console.log("\n  EN SALDO GENERAL:");
      for (const mov of movimientos30Saldo) {
        console.log(
          `    ${mov.fecha.toISOString().substring(0, 19)} | ${mov.tipo_movimiento.padEnd(
            8
          )} | $${Number(mov.monto).toFixed(2)} | ${mov.descripcion || "Sin descripción"}`
        );
      }
    } else {
      console.log("\n  No hay movimientos de $30 en saldo general");
    }

    const movimientos30Servicios = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: cop.id,
        monto: 30,
      },
      orderBy: {
        fecha: "desc",
      },
      take: 10,
    });

    if (movimientos30Servicios.length > 0) {
      console.log("\n  EN SERVICIOS EXTERNOS:");
      for (const mov of movimientos30Servicios) {
        console.log(
          `    ${mov.fecha
            .toISOString()
            .substring(0, 19)} | ${mov.servicio.padEnd(
            15
          )} | ${mov.tipo_movimiento.padEnd(8)} | $${Number(mov.monto).toFixed(2)} | ${
            mov.descripcion || "Sin descripción"
          }`
        );
      }
    } else {
      console.log("\n  No hay movimientos de $30 en servicios externos");
    }

    // 8. Verificar cambios
    const cambios = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: ayer,
        },
      },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
      },
      orderBy: {
        fecha: "desc",
      },
      take: 10,
    });

    if (cambios.length > 0) {
      console.log("\n\n💱 CAMBIOS RECIENTES:");
      console.log("----------------------");
      for (const cambio of cambios) {
        console.log(
          `  ${cambio.fecha.toISOString().substring(0, 19)} | Estado: ${
            cambio.estado
          }`
        );
        console.log(
          `    Envió: ${Number(cambio.divisas_entregadas_total)} ${cambio.monedaOrigen.codigo}`
        );
        console.log(
          `    Recibió: ${Number(cambio.divisas_recibidas_total)} ${cambio.monedaDestino.codigo}`
        );
        if (cambio.estado === "ANULADO") {
          console.log(`    ⚠️  ANULADO`);
        }
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

analizarSaldoPlazaValle();
