import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Decimalish = Prisma.Decimal | number | string;

interface DescuadreReport {
  puntoInfo: {
    id: string;
    nombre: string;
    ciudad: string;
    estado?: unknown;
  };
  saldoActual: {
    cantidad: Prisma.Decimal;
    billetes: Prisma.Decimal;
    monedas_fisicas: Prisma.Decimal;
    bancos: Prisma.Decimal;
    updated_at: Date;
    moneda: { id: string; codigo: string; nombre: string };
    puntoAtencion: { id: string; nombre: string };
  } | null;
  saldoInicialActivo: {
    cantidad_inicial: Prisma.Decimal;
    fecha_asignacion: Date;
    id: string;
  } | null;
  movimientosRecientes: any[];
  cambiosDivisas: any[];
  serviciosExternos: any[];
  transferencias: any[];
  historialSaldo: any[];
  verificacionIntegridad: {
    saldoInicial: Prisma.Decimal;
    sumaMovimientos: Prisma.Decimal;
    saldoActual: Prisma.Decimal;
    saldoCalculado: Prisma.Decimal;
    diferenciaEncontrada: Prisma.Decimal;
  };
  movimientosSospechosos: any[];
  cambiosSospechosos: any[];
  resumenDia: {
    cambiosDivisas: number;
    serviciosExternos: number;
    transferencias: number;
    movimientosSaldo: number;
  };
}

function D(n: Decimalish) {
  return new Prisma.Decimal(n ?? 0);
}

async function investigarDescuadreAmazonas(): Promise<DescuadreReport> {
  console.log("🔍 Iniciando investigación de descuadre en AMAZONAS...");

  // 1) Punto AMAZONAS
  console.log("📍 Buscando información del punto AMAZONAS...");
  const puntoInfo = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    select: { id: true, nombre: true, ciudad: true, activo: true },
  });
  if (!puntoInfo) throw new Error("No se encontró el punto AMAZONAS");
  console.log(`✅ Punto encontrado: ${puntoInfo.nombre} (ID: ${puntoInfo.id})`);

  // 2) Saldo actual USD
  console.log("💰 Consultando saldo actual en USD...");
  const saldoActual = await prisma.saldo.findFirst({
    where: {
      punto_atencion_id: puntoInfo.id,
      moneda: { codigo: "USD" },
    },
    include: {
      moneda: true,
      puntoAtencion: true,
    },
  });

  if (!saldoActual) {
    throw new Error("No se encontró saldo en USD para AMAZONAS");
  }

  console.log(
    `💰 Saldo actual en ${saldoActual.puntoAtencion.nombre}: $${saldoActual.cantidad} ${saldoActual.moneda.codigo}`
  );

  // 2.1) SaldoInicial activo USD (el “vigente”)
  console.log("📜 Buscando saldo inicial activo (USD)...");
  const saldoInicialActivo = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoInfo.id,
      activo: true,
      moneda: { codigo: "USD" },
    },
    orderBy: { fecha_asignacion: "desc" },
    select: {
      id: true,
      cantidad_inicial: true,
      fecha_asignacion: true,
    },
  });

  // 3) Movimientos de saldo USD
  console.log("📊 Consultando todos los movimientos de saldo...");
  const movimientosRecientes = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoInfo.id,
      moneda: { codigo: "USD" },
    },
    include: {
      moneda: true,
      puntoAtencion: true,
      usuario: true,
    },
    orderBy: { fecha: "desc" },
  });

  // 4) Cambios de divisas (COMPLETADO) donde intervenga USD
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
    orderBy: { fecha: "desc" },
  });

  // 5) Servicios externos USD
  console.log("🏪 Consultando todos los servicios externos...");
  const serviciosExternos = await prisma.servicioExternoMovimiento.findMany({
    where: {
      punto_atencion_id: puntoInfo.id,
      moneda: { codigo: "USD" },
    },
    include: {
      moneda: true,
      puntoAtencion: true,
      usuario: true,
    },
    orderBy: { fecha: "desc" },
  });

  // 6) Transferencias USD (APROBADO)
  console.log("↔️ Consultando todas las transferencias aprobadas...");
  const transferencias = await prisma.transferencia.findMany({
    where: {
      OR: [{ origen_id: puntoInfo.id }, { destino_id: puntoInfo.id }],
      moneda: { codigo: "USD" },
      estado: "APROBADO",
    },
    include: {
      origen: true,
      destino: true,
      moneda: true,
      usuarioSolicitante: true,
      usuarioAprobador: true,
    },
    orderBy: { fecha_aprobacion: "desc" },
  });

  // 7) Historial de saldo (últimos 20)
  console.log("📜 Consultando historial de saldo...");
  const historialSaldo = await prisma.historialSaldo.findMany({
    where: {
      punto_atencion_id: puntoInfo.id,
      moneda: { codigo: "USD" },
    },
    include: {
      moneda: true,
      puntoAtencion: true,
      usuario: true,
    },
    orderBy: { fecha: "desc" },
    take: 20,
  });

  // 8) Verificación de integridad
  console.log("🔍 Verificando integridad de saldos...");
  const sumMovimientos = await prisma.movimientoSaldo.aggregate({
    where: {
      punto_atencion_id: puntoInfo.id,
      moneda: { codigo: "USD" },
    },
    _sum: { monto: true },
  });

  const saldoInicial = D(saldoInicialActivo?.cantidad_inicial ?? 0);
  const sumaMovs = D(sumMovimientos._sum.monto ?? 0);
  const saldoActualCantidad = D(saldoActual.cantidad);

  const saldoCalculado = saldoInicial.plus(sumaMovs);
  const diferenciaEncontrada = saldoActualCantidad.minus(saldoCalculado);

  const verificacionIntegridad = {
    saldoInicial,
    sumaMovimientos: sumaMovs,
    saldoActual: saldoActualCantidad,
    saldoCalculado,
    diferenciaEncontrada,
  };

  // 9) Movimientos sospechosos (~13.12)
  console.log("🚨 Buscando movimientos sospechosos...");
  const movimientosSospechosos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoInfo.id,
      moneda: { codigo: "USD" },
      OR: [
        { monto: { gte: D(13.0), lte: D(13.25) } },
        { monto: { gte: D(-13.25), lte: D(-13.0) } },
      ],
    },
    include: { moneda: true, puntoAtencion: true, usuario: true },
    orderBy: { fecha: "desc" },
  });

  // 10) Cambios sospechosos con montos ~13.12 en origen o destino USD
  console.log("🔄 Buscando cambios con montos sospechosos...");
  const cambiosSospechosos = await prisma.cambioDivisa.findMany({
    where: {
      punto_atencion_id: puntoInfo.id,
      estado: "COMPLETADO",
      OR: [
        {
          monedaOrigen: { codigo: "USD" },
          monto_origen: { gte: D(13.0), lte: D(13.25) },
        },
        {
          monedaDestino: { codigo: "USD" },
          monto_destino: { gte: D(13.0), lte: D(13.25) },
        },
      ],
    },
    include: {
      monedaOrigen: true,
      monedaDestino: true,
      puntoAtencion: true,
      usuario: true,
    },
    orderBy: { fecha: "desc" },
  });

  // 11) Resumen
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
    saldoInicialActivo,
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

  // Saldo actual
  console.log("\n💰 SALDO ACTUAL USD:");
  if (reporte.saldoActual) {
    console.log(`   Cantidad total: $${reporte.saldoActual.cantidad}`);
    console.log(
      `   Detalle → Billetes: $${reporte.saldoActual.billetes} | Monedas: $${reporte.saldoActual.monedas_fisicas} | Bancos: $${reporte.saldoActual.bancos}`
    );
    console.log(`   Última actualización: ${reporte.saldoActual.updated_at}`);
  } else {
    console.log("   ⚠️ No se encontró registro de saldo USD");
  }

  // Saldo inicial activo
  console.log("\n🧭 SALDO INICIAL ACTIVO (USD):");
  if (reporte.saldoInicialActivo) {
    console.log(
      `   Asignado: $${reporte.saldoInicialActivo.cantidad_inicial} el ${reporte.saldoInicialActivo.fecha_asignacion}`
    );
  } else {
    console.log("   ⚠️ No hay SaldoInicial activo para USD");
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
        `      Fecha: ${mov.fecha} | Usuario: ${mov.usuario?.nombre || "N/A"}`
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
      const tasa =
        Number(D(cambio.monto_origen)) !== 0
          ? D(cambio.monto_destino).div(D(cambio.monto_origen))
          : D(0);
      console.log(`   ${index + 1}. Recibo: ${cambio.numero_recibo || "—"}`);
      console.log(
        `      ${cambio.monedaOrigen.codigo} $${cambio.monto_origen} → ${cambio.monedaDestino.codigo} $${cambio.monto_destino}`
      );
      console.log(`      Tasa (dest/orig): ${tasa} | Fecha: ${cambio.fecha}`);
      console.log(`      Usuario: ${cambio.usuario?.nombre || "N/A"}`);
      console.log("");
    });
  } else {
    console.log("   ✅ No se encontraron cambios sospechosos");
  }

  // Todos los movimientos (muestra 20)
  console.log("\n📊 TODOS LOS MOVIMIENTOS DE SALDO (últimos 20):");
  if (reporte.movimientosRecientes.length > 0) {
    console.log(`   Total: ${reporte.movimientosRecientes.length} movimientos`);
    reporte.movimientosRecientes.slice(0, 20).forEach((mov, index) => {
      console.log(
        `   ${index + 1}. $${mov.monto} | ${mov.tipo_movimiento} | ${mov.fecha}`
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { investigarDescuadreAmazonas, imprimirReporte };
