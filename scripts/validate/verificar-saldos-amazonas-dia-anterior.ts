import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const puntoNombre = "AMAZONAS";
  const monedaCodigo = "EUR";

  console.log(`\n=== VALIDACIÓN DE SALDOS: ${puntoNombre} | ${monedaCodigo} ===\n`);

  // Buscar punto y moneda
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: puntoNombre, mode: "insensitive" } },
  });
  if (!punto) throw new Error(`No se encontró el punto: ${puntoNombre}`);

  const moneda = await prisma.moneda.findFirst({
    where: { codigo: { equals: monedaCodigo, mode: "insensitive" } },
  });
  if (!moneda) throw new Error(`No se encontró la moneda: ${monedaCodigo}`);

  console.log(`Punto: ${punto.nombre} (${punto.id})`);
  console.log(`Moneda: ${moneda.codigo} (${moneda.id})\n`);

  // Obtener fecha de inicio desde saldo inicial activo
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: moneda.id,
      activo: true,
    },
    orderBy: { fecha_asignacion: "desc" },
  });

  let inicio: Date;
  if (saldoInicial) {
    inicio = new Date(saldoInicial.fecha_asignacion);
    inicio.setHours(0, 0, 0, 0);
    console.log(`Saldo Inicial Activo:`);
    console.log(`  Fecha: ${inicio.toISOString()}`);
    console.log(`  Cantidad: $${Number(saldoInicial.cantidad_inicial).toFixed(2)}\n`);
  } else {
    // fallback: hace 7 días
    inicio = new Date();
    inicio.setDate(inicio.getDate() - 7);
    inicio.setHours(0, 0, 0, 0);
    console.log(`⚠️ Sin saldo inicial activo. Usando fallback: hace 7 días\n`);
  }

  const saldoInicialCantidad = saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;

  // Obtener movimientos de saldo
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: moneda.id,
      fecha: { gte: inicio },
    },
    orderBy: { fecha: "asc" },
  });

  // Calcular saldo con movimientos
  let saldoCalculado = saldoInicialCantidad;
  console.log(`Movimientos de Saldo desde ${inicio.toISOString()}:`);
  if (movimientos.length === 0) {
    console.log(`  (sin movimientos)\n`);
  } else {
    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      let delta = 0;

      if (mov.tipo_movimiento === "EGRESO" || mov.tipo_movimiento === "TRANSFERENCIA_SALIENTE") {
        delta = -Math.abs(monto);
      } else if (mov.tipo_movimiento === "INGRESO" || mov.tipo_movimiento === "TRANSFERENCIA_ENTRANTE" || mov.tipo_movimiento === "TRANSFERENCIA_DEVOLUCION") {
        delta = Math.abs(monto);
      } else {
        delta = monto;
      }

      const saldoAnterior = saldoCalculado;
      saldoCalculado += delta;

      console.log(
        `  ${mov.fecha.toISOString()} | ${mov.tipo_movimiento.padEnd(25)} | ${monto.toFixed(2).padStart(10)} | Saldo: $${saldoAnterior.toFixed(2)} → $${saldoCalculado.toFixed(2)}`
      );
      if (mov.descripcion) {
        console.log(`    └─ Desc: ${mov.descripcion}`);
      }
    }
  }

  console.log();

  // Obtener saldo actual registrado en BD
  const saldoActual = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
    },
  });

  const saldoEnBD = saldoActual ? Number(saldoActual.cantidad) : 0;
  const billetes = saldoActual ? Number(saldoActual.billetes) : 0;
  const monedas_val = saldoActual ? Number(saldoActual.monedas_fisicas) : 0;
  const saldoFisico = billetes + monedas_val;

  // Mostrar resumen
  console.log(`RESUMEN DE SALDOS:`);
  console.log(`  Saldo Inicial:      $${saldoInicialCantidad.toFixed(2)}`);
  console.log(`  Saldo Calculado:    $${saldoCalculado.toFixed(2)} (desde movimientos)`);
  console.log(`  Saldo en BD:        $${saldoEnBD.toFixed(2)} (campo cantidad)`);
  console.log(`  Saldo Físico:       $${saldoFisico.toFixed(2)} (billetes + monedas)`);
  console.log(`    └─ Billetes:     $${billetes.toFixed(2)}`);
  console.log(`    └─ Monedas:      $${monedas_val.toFixed(2)}\n`);

  // Validaciones
  console.log(`VALIDACIONES:`);
  const eps = 0.02;

  const diff1 = saldoEnBD - saldoFisico;
  if (Math.abs(diff1) <= eps) {
    console.log(`  ✅ BD cantidad = Físico (diferencia: $${diff1.toFixed(2)})`);
  } else {
    console.log(`  ❌ BD cantidad ≠ Físico (diferencia: $${diff1.toFixed(2)})`);
  }

  const diff2 = saldoEnBD - saldoCalculado;
  if (Math.abs(diff2) <= eps) {
    console.log(`  ✅ BD cantidad = Calculado (diferencia: $${diff2.toFixed(2)})`);
  } else {
    console.log(`  ⚠️ BD cantidad ≠ Calculado (diferencia: $${diff2.toFixed(2)})`);
  }

  const diff3 = saldoFisico - saldoCalculado;
  if (Math.abs(diff3) <= eps) {
    console.log(`  ✅ Físico = Calculado (diferencia: $${diff3.toFixed(2)})`);
  } else {
    console.log(`  ⚠️ Físico ≠ Calculado (diferencia: $${diff3.toFixed(2)})`);
  }

  console.log();

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
