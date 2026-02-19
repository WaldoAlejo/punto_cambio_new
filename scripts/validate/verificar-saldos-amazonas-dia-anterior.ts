// ...existing code...
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const puntoNombre = "AMAZONAS";
    const monedaCodigo = "EUR";

    // Buscar desde la fecha de asignación del saldo inicial activo de la semana pasada
    const now = new Date();
    // Buscar saldo inicial activo más reciente antes de hoy
    const saldoInicialSemana = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: puntoNombre,
        moneda_id: monedaCodigo,
        activo: true,
        fecha_asignacion: { lte: now },
      },
      orderBy: { fecha_asignacion: "desc" },
    });
    let inicio: Date;
    if (saldoInicialSemana) {
      inicio = new Date(saldoInicialSemana.fecha_asignacion);
      inicio.setHours(0, 0, 0, 0);
    } else {
      // fallback: lunes de la semana pasada
      inicio = new Date(now);
      const day = inicio.getDay();
      const daysSinceMonday = day === 0 ? 6 : day - 1;
      inicio.setDate(inicio.getDate() - daysSinceMonday - 7);
      inicio.setHours(0, 0, 0, 0);
    }
    const fin = new Date(now); // hasta ahora

    // Buscar punto y moneda
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: puntoNombre, mode: "insensitive" } },
    });
    if (!punto) throw new Error("No se encontró el punto AMAZONAS");

    const moneda = await prisma.moneda.findFirst({
      where: { codigo: monedaCodigo },
    });
    if (!moneda) throw new Error("No se encontró la moneda EUR");

    if (!inicio) throw new Error("No se pudo calcular la fecha de inicio");

    // Saldo inicial activo antes de ayer
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        activo: true,
        fecha_asignacion: { lte: inicio },
      },
      orderBy: { fecha_asignacion: "desc" },
    });
    let saldoInicialCantidad = saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;
    let saldoInicialUsado = false;
    console.log(`Saldo inicial activo antes de ayer: ${saldoInicialCantidad}`);

    // Movimientos desde el inicio del día de ayer hasta ahora
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha: { gte: inicio },
      },
      orderBy: { fecha: "asc" },
    });

    let saldo = saldoInicialCantidad;
    console.log("\nMovimientos desde el inicio del día de ayer hasta ahora:");
    for (const mov of movimientos) {
      const tipo = mov.tipo_movimiento;
      const monto = Number(mov.monto);
      let delta = 0;
      const saldoAnterior = saldo;
      if (tipo === "EGRESO") delta = -Math.abs(monto);
      else if (tipo === "INGRESO") delta = Math.abs(monto);
      else delta = monto; // fallback
      saldo += delta;
      console.log(`  ${mov.fecha.toISOString()} | ${tipo.padEnd(12)} | ${monto.toFixed(2).padStart(8)} | Saldo: ${saldoAnterior.toFixed(2)} → ${(saldoAnterior + delta).toFixed(2)} | ID: ${mov.id} | Desc: ${mov.descripcion || ''}`);
    }

    // Servicios externos: ingresos y egresos
    let saldoServicios = 0;
    const serviciosExternos = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha: { gte: inicio },
      },
      orderBy: { fecha: "asc" },
    });
    console.log("\nMovimientos de servicios externos desde el viernes pasado:");
    for (const mov of serviciosExternos) {
      const tipo = mov.tipo_movimiento;
      const monto = Number(mov.monto);
      const saldoAnterior = saldo + saldoServicios;
      let delta = 0;
      if (tipo === "EGRESO") delta = -Math.abs(monto);
      else if (tipo === "INGRESO") delta = Math.abs(monto);
      else delta = monto; // fallback
      saldoServicios += delta;
      console.log(`  ${mov.fecha.toISOString()} | ${tipo.padEnd(12)} | ${monto.toFixed(2).padStart(8)} | Saldo: ${saldoAnterior.toFixed(2)} → ${(saldoAnterior + delta).toFixed(2)} | ID: ${mov.id} | Desc: ${mov.descripcion || ''}`);
    }
  // Saldo registrado en la tabla saldo
  const saldoActual = await prisma.saldo.findFirst({
    where: { punto_atencion_id: punto.id, moneda_id: moneda.id },
  });
  const saldoRegistrado = saldoActual ? Number(saldoActual.cantidad) : 0;
  console.log(`Saldo registrado en tabla saldo: ${saldoRegistrado}`);

  // Diferencia
  const diff = saldoRegistrado - saldo;
  console.log(`Diferencia: ${diff.toFixed(2)}`);

  // --- Exportar todos los movimientos detallados ---
  const movimientosDetallados = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: moneda.id,
      fecha: { gte: inicio },
    },
    orderBy: { fecha: "asc" },
  });

  console.log("\nLISTADO DETALLADO DE MOVIMIENTOS:");
  for (const mov of movimientosDetallados) {
    const desc = (mov.descripcion ?? "").toLowerCase();
    const esCaja = desc.includes("(caja)");
    const esBanco = /\bbancos?\b/i.test(desc);
    console.log(`  ${mov.fecha.toISOString()} | ${mov.tipo_movimiento.padEnd(20)} | ${Number(mov.monto).toFixed(2).padStart(8)} | Caja: ${esCaja ? "SI" : "NO"} | Banco: ${esBanco ? "SI" : "NO"} | ID: ${mov.id} | Desc: ${mov.descripcion || ''}`);
  }

  // --- Exportar todos los servicios externos detallados ---
  const serviciosExternosDetallados = await prisma.servicioExternoMovimiento.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: moneda.id,
      fecha: { gte: inicio },
    },
    orderBy: { fecha: "asc" },
  });

  console.log("\nLISTADO DETALLADO DE SERVICIOS EXTERNOS:");
  for (const mov of serviciosExternosDetallados) {
    console.log(`  ${mov.fecha.toISOString()} | ${mov.tipo_movimiento.padEnd(20)} | ${Number(mov.monto).toFixed(2).padStart(8)} | ID: ${mov.id} | Desc: ${mov.descripcion || ''}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
