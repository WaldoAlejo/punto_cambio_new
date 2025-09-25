import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

interface DescuadreReport {
  puntoInfo: any;
  saldoActual: any;
  movimientosRecientes: any[];
  cambiosDivisas: any[];
  serviciosExternos: any[];
  transferencias: any[];
  historialSaldo: any[];
  verificacionIntegridad: any;
  movimientosSospechosos: any[];
  cambiosSospechosos: any[];
  resumenDia: any;
}

async function investigarDescuadreAmazonas(): Promise<DescuadreReport> {
  console.log("🔍 Iniciando investigación de descuadre en AMAZONAS...");

  try {
    // 1. Información básica del punto AMAZONAS
    console.log("📍 Buscando información del punto AMAZONAS...");
    const puntoInfo = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          contains: "AMAZONAS",
          mode: "insensitive",
        },
      },
    });

    if (!puntoInfo) {
      throw new Error("No se encontró el punto AMAZONAS");
    }

    console.log(
      `✅ Punto encontrado: ${puntoInfo.nombre} (ID: ${puntoInfo.id})`
    );

    // 2. Saldo actual en USD
    console.log("💰 Consultando saldo actual en USD...");
    const saldoActual = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: puntoInfo.id,
        moneda: {
          codigo: "USD",
        },
      },
      include: {
        moneda: true,
        punto_atencion: true,
      },
    });

    // 3. Todos los movimientos de saldo
    console.log("📊 Consultando todos los movimientos de saldo...");
    const movimientosRecientes = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoInfo.id,
        moneda: {
          codigo: "USD",
        },
      },
      include: {
        moneda: true,
        punto_atencion: true,
        usuario: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // 4. Todos los cambios de divisas completados
    console.log("🔄 Consultando todos los cambios de divisas...");
    const cambiosDivisas = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: puntoInfo.id,
        estado: "COMPLETADO",
        OR: [
          { monedaOrigen: { codigo: "USD" } },
          { monedaDestino: { codigo: "USD" } },
        ],
      },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
        puntoAtencion: true,
        usuario: true,
      },
      orderBy: {
        fecha: "desc",
      },
    });

    // 5. Todos los servicios externos
    console.log("🏪 Consultando todos los servicios externos...");
    const serviciosExternos = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: puntoInfo.id,
        moneda: {
          codigo: "USD",
        },
      },
      include: {
        servicio_externo: true,
        moneda: true,
        punto_atencion: true,
        usuario: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // 6. Todas las transferencias
    console.log("↔️ Consultando todas las transferencias...");
    const transferencias = await prisma.transferencia.findMany({
      where: {
        OR: [{ origen_id: puntoInfo.id }, { destino_id: puntoInfo.id }],
        moneda: {
          codigo: "USD",
        },
        estado: "APROBADA",
      },
      include: {
        origen: true,
        destino: true,
        moneda: true,
        usuarioSolicitante: true,
        usuarioAprobador: true,
      },
      orderBy: {
        fecha_aprobacion: "desc",
      },
    });

    // 7. Historial de saldo (últimos 20 registros)
    console.log("📜 Consultando historial de saldo...");
    const historialSaldo = await prisma.historialSaldo.findMany({
      where: {
        punto_atencion_id: puntoInfo.id,
        moneda: {
          codigo: "USD",
        },
      },
      include: {
        moneda: true,
        punto_atencion: true,
        usuario: true,
      },
      orderBy: {
        created_at: "desc",
      },
      take: 20,
    });

    // 8. Verificación de integridad
    console.log("🔍 Verificando integridad de saldos...");
    const sumMovimientos = await prisma.movimientoSaldo.aggregate({
      where: {
        punto_atencion_id: puntoInfo.id,
        moneda: {
          codigo: "USD",
        },
      },
      _sum: {
        monto: true,
      },
    });

    const verificacionIntegridad = {
      saldoInicial: saldoActual?.saldo_inicial || new Prisma.Decimal(0),
      sumaMovimientos: sumMovimientos._sum.monto || new Prisma.Decimal(0),
      saldoActual: saldoActual?.saldo_actual || new Prisma.Decimal(0),
      saldoCalculado: (
        saldoActual?.saldo_inicial || new Prisma.Decimal(0)
      ).plus(sumMovimientos._sum.monto || new Prisma.Decimal(0)),
      diferenciaEncontrada: (
        saldoActual?.saldo_actual || new Prisma.Decimal(0)
      ).minus(
        (saldoActual?.saldo_inicial || new Prisma.Decimal(0)).plus(
          sumMovimientos._sum.monto || new Prisma.Decimal(0)
        )
      ),
    };

    // 9. Movimientos sospechosos (cercanos a $13.12)
    console.log("🚨 Buscando movimientos sospechosos...");
    const movimientosSospechosos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoInfo.id,
        moneda: {
          codigo: "USD",
        },
        OR: [
          {
            monto: {
              gte: new Prisma.Decimal(13.0),
              lte: new Prisma.Decimal(13.25),
            },
          },
          {
            monto: {
              gte: new Prisma.Decimal(-13.25),
              lte: new Prisma.Decimal(-13.0),
            },
          },
        ],
      },
      include: {
        moneda: true,
        punto_atencion: true,
        usuario: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // 10. Cambios con montos sospechosos
    console.log("🔄 Buscando cambios con montos sospechosos...");
    const cambiosSospechosos = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: puntoInfo.id,
        estado: "COMPLETADO",
        OR: [
          {
            monedaOrigen: { codigo: "USD" },
            monto_origen: {
              gte: new Prisma.Decimal(13.0),
              lte: new Prisma.Decimal(13.25),
            },
          },
          {
            monedaDestino: { codigo: "USD" },
            monto_destino: {
              gte: new Prisma.Decimal(13.0),
              lte: new Prisma.Decimal(13.25),
            },
          },
        ],
      },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
        puntoAtencion: true,
        usuario: true,
      },
      orderBy: {
        fecha: "desc",
      },
    });

    // 11. Resumen general
    console.log("📋 Generando resumen general...");
    const resumenDia = {
      cambiosDivisas: cambiosDivisas.length,
      serviciosExternos: serviciosExternos.length,
      transferencias: transferencias.length,
      movimientosSaldo: movimientosRecientes.length,
    };

    return {
      puntoInfo,
      saldoActual,
      movimientosRecientes,
      cambiosDivisas,
      serviciosExternos,
      transferencias,
      historialSaldo,
      verificacionIntegridad,
      movimientosSospechosos,
      cambiosSospechosos,
      resumenDia,
    };
  } catch (error) {
    console.error("❌ Error durante la investigación:", error);
    throw error;
  }
}

function imprimirReporte(reporte: DescuadreReport) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 REPORTE DE INVESTIGACIÓN - DESCUADRE AMAZONAS");
  console.log("=".repeat(80));

  // Información del punto
  console.log("\n🏢 INFORMACIÓN DEL PUNTO:");
  console.log(`   Nombre: ${reporte.puntoInfo.nombre}`);
  console.log(`   Ciudad: ${reporte.puntoInfo.ciudad}`);
  console.log(`   ID: ${reporte.puntoInfo.id}`);
  console.log(`   Estado: ${reporte.puntoInfo.estado}`);

  // Saldo actual
  console.log("\n💰 SALDO ACTUAL USD:");
  if (reporte.saldoActual) {
    console.log(`   Saldo Inicial: $${reporte.saldoActual.saldo_inicial}`);
    console.log(`   Saldo Actual: $${reporte.saldoActual.saldo_actual}`);
    console.log(`   Diferencia: $${reporte.saldoActual.diferencia}`);
    console.log(`   Última actualización: ${reporte.saldoActual.updated_at}`);
  } else {
    console.log("   ⚠️ No se encontró registro de saldo USD");
  }

  // Verificación de integridad
  console.log("\n🔍 VERIFICACIÓN DE INTEGRIDAD:");
  console.log(
    `   Saldo Inicial: $${reporte.verificacionIntegridad.saldoInicial}`
  );
  console.log(
    `   Suma de Movimientos: $${reporte.verificacionIntegridad.sumaMovimientos}`
  );
  console.log(
    `   Saldo Calculado: $${reporte.verificacionIntegridad.saldoCalculado}`
  );
  console.log(
    `   Saldo Actual: $${reporte.verificacionIntegridad.saldoActual}`
  );
  console.log(
    `   🚨 DIFERENCIA ENCONTRADA: $${reporte.verificacionIntegridad.diferenciaEncontrada}`
  );

  // Resumen general
  console.log("\n📋 RESUMEN GENERAL:");
  console.log(
    `   Total Cambios de Divisas: ${reporte.resumenDia.cambiosDivisas}`
  );
  console.log(
    `   Total Servicios Externos: ${reporte.resumenDia.serviciosExternos}`
  );
  console.log(`   Total Transferencias: ${reporte.resumenDia.transferencias}`);
  console.log(
    `   Total Movimientos de Saldo: ${reporte.resumenDia.movimientosSaldo}`
  );

  // Movimientos sospechosos
  console.log("\n🚨 MOVIMIENTOS SOSPECHOSOS (cercanos a $13.12):");
  if (reporte.movimientosSospechosos.length > 0) {
    reporte.movimientosSospechosos.forEach((mov, index) => {
      console.log(
        `   ${index + 1}. ID: ${mov.id} | Monto: $${mov.monto} | Tipo: ${
          mov.tipo_movimiento
        }`
      );
      console.log(
        `      Fecha: ${mov.created_at} | Usuario: ${
          mov.usuario?.nombre || "N/A"
        }`
      );
      console.log(`      Descripción: ${mov.descripcion || "N/A"}`);
      console.log(
        `      Referencia: ${mov.tipo_referencia || "N/A"} - ${
          mov.referencia_id || "N/A"
        }`
      );
      console.log("");
    });
  } else {
    console.log("   ✅ No se encontraron movimientos sospechosos");
  }

  // Cambios sospechosos
  console.log("\n🔄 CAMBIOS DE DIVISAS SOSPECHOSOS:");
  if (reporte.cambiosSospechosos.length > 0) {
    reporte.cambiosSospechosos.forEach((cambio, index) => {
      console.log(`   ${index + 1}. Operación: ${cambio.numero_operacion}`);
      console.log(
        `      ${cambio.moneda_origen.codigo} $${cambio.monto_origen} → ${cambio.moneda_destino.codigo} $${cambio.monto_destino}`
      );
      console.log(
        `      Tasa: ${cambio.tasa_cambio} | Fecha: ${cambio.completed_at}`
      );
      console.log(`      Usuario: ${cambio.usuario?.nombre || "N/A"}`);
      console.log("");
    });
  } else {
    console.log("   ✅ No se encontraron cambios sospechosos");
  }

  // Todos los movimientos
  console.log("\n📊 TODOS LOS MOVIMIENTOS DE SALDO:");
  if (reporte.movimientosRecientes.length > 0) {
    console.log(`   Total: ${reporte.movimientosRecientes.length} movimientos`);
    reporte.movimientosRecientes.slice(0, 20).forEach((mov, index) => {
      console.log(
        `   ${index + 1}. $${mov.monto} | ${mov.tipo_movimiento} | ${
          mov.created_at
        }`
      );
      console.log(`      Saldo: $${mov.saldo_anterior} → $${mov.saldo_nuevo}`);
      console.log(`      ${mov.descripcion || "Sin descripción"}`);
      console.log("");
    });
    if (reporte.movimientosRecientes.length > 20) {
      console.log(
        `   ... y ${reporte.movimientosRecientes.length - 20} movimientos más`
      );
    }
  } else {
    console.log("   ℹ️ No hay movimientos de saldo");
  }

  console.log("\n" + "=".repeat(80));
  console.log("🎯 CONCLUSIONES Y RECOMENDACIONES:");
  console.log("=".repeat(80));

  const diferencia = reporte.verificacionIntegridad.diferenciaEncontrada;
  if (Math.abs(Number(diferencia)) < 0.01) {
    console.log("✅ Los saldos están cuadrados. No se detectó descuadre.");
  } else {
    console.log(`🚨 DESCUADRE CONFIRMADO: $${diferencia}`);
    console.log("");
    console.log("📝 PASOS RECOMENDADOS:");
    console.log("1. Revisar los movimientos sospechosos listados arriba");
    console.log(
      "2. Verificar las operaciones del día con el personal del punto"
    );
    console.log(
      "3. Comprobar si hay transacciones no registradas o duplicadas"
    );
    console.log(
      "4. Revisar los cambios de divisas con montos cercanos al descuadre"
    );
    console.log(
      "5. Contactar al supervisor para ajuste manual si es necesario"
    );
  }
}

async function main() {
  try {
    const reporte = await investigarDescuadreAmazonas();
    imprimirReporte(reporte);
  } catch (error) {
    console.error("❌ Error en la investigación:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar solo si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { investigarDescuadreAmazonas, imprimirReporte };
