/**
 * INVESTIGACIÓN PROFUNDA DEL SISTEMA DE SALDOS
 * Entender cómo se calculan los saldos, asignaciones, cierres y aperturas
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(100));
  console.log("INVESTIGACIÓN PROFUNDA DEL SISTEMA DE SALDOS");
  console.log("=".repeat(100));

  const punto = await prisma.puntoAtencion.findFirst({
    where: {
      nombre: {
        contains: "PLAZA DEL VALLE",
        mode: "insensitive",
      },
    },
  });

  if (!punto) {
    console.error("❌ No se encontró PLAZA DEL VALLE");
    return;
  }

  console.log(`\n📍 Punto: ${punto.nombre} (ID: ${punto.id})\n`);

  const monedas = await prisma.moneda.findMany({
    where: { codigo: { in: ["USD", "EUR"] } },
  });

  for (const moneda of monedas) {
    console.log("\n" + "=".repeat(100));
    console.log(`💱 ${moneda.codigo} (${moneda.nombre})`);
    console.log("=".repeat(100));

    // ============================================
    // 1. HISTORIAL DE SALDOS (TODOS LOS REGISTROS)
    // ============================================
    console.log("\n📚 1. HISTORIAL DE SALDOS");
    console.log("-".repeat(100));

    const historialSaldos = await prisma.historialSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
      orderBy: { fecha_solicitud: "desc" },
      take: 10,
    });

    console.log(`   Total registros en historial: ${historialSaldos.length}`);
    for (const h of historialSaldos) {
      console.log(`   ${h.fecha.toISOString()} | Saldo: ${Number(h.saldo).toFixed(2)} | Tipo: ${h.tipo_cambio || 'N/A'}`);
    }

    // ============================================
    // 2. SALDOS INICIALES (ASIGNACIONES)
    // ============================================
    console.log("\n📚 2. SALDOS INICIALES (ASIGNACIONES)");
    console.log("-".repeat(100));

    const saldosIniciales = await prisma.saldoInicial.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
      include: {
        usuarioAsignador: { select: { nombre: true } },
      },
      orderBy: { fecha_asignacion: "desc" },
      take: 10,
    });

    console.log(`   Total asignaciones: ${saldosIniciales.length}`);
    for (const si of saldosIniciales) {
      console.log(`   ${si.fecha_asignacion.toISOString()} | Cantidad: ${Number(si.cantidad_inicial).toFixed(2)} | Activo: ${si.activo} | Asignado por: ${si.usuarioAsignador?.nombre || 'N/A'}`);
    }

    // ============================================
    // 3. CIERRES DIARIOS
    // ============================================
    console.log("\n📚 3. CIERRES DIARIOS");
    console.log("-".repeat(100));

    const cierres = await prisma.cierreDiario.findMany({
      where: {
        punto_atencion_id: punto.id,
      },
      orderBy: { fecha: "desc" },
      take: 10,
    });

    console.log(`   Total cierres: ${cierres.length}`);
    for (const c of cierres) {
      console.log(`   ${c.fecha.toISOString()} | Estado: ${c.estado} | Cerrado por: ${c.cerrado_por || 'N/A'}`);
      if (c.diferencias_reportadas) {
        console.log(`   Diferencias: ${JSON.stringify(c.diferencias_reportadas)}`);
      }
    }

    // ============================================
    // 4. CUADRES DE CAJA
    // ============================================
    console.log("\n📚 4. CUADRES DE CAJA");
    console.log("-".repeat(100));

    const cuadres = await prisma.cuadreCaja.findMany({
      where: {
        punto_atencion_id: punto.id,
      },
      orderBy: { fecha: "desc" },
      take: 10,
    });

    console.log(`   Total cuadres: ${cuadres.length}`);
    for (const c of cuadres) {
      console.log(`   ${c.fecha.toISOString()} | Estado: ${c.estado} | Tipo: ${c.tipo_cuadre}`);
    }

    // ============================================
    // 5. MOVIMIENTOS ESPECIALES (SALDO_INICIAL)
    // ============================================
    console.log("\n📚 5. MOVIMIENTOS ESPECIALES (SALDO_INICIAL)");
    console.log("-".repeat(100));

    const movimientosSaldoInicial = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        tipo_movimiento: "SALDO_INICIAL",
      },
      orderBy: { fecha: "desc" },
      take: 10,
    });

    console.log(`   Total movimientos SALDO_INICIAL: ${movimientosSaldoInicial.length}`);
    for (const m of movimientosSaldoInicial) {
      console.log(`   ${m.fecha.toISOString()} | Saldo anterior: ${Number(m.saldo_anterior).toFixed(2)} | Monto: ${Number(m.monto).toFixed(2)} | Saldo nuevo: ${Number(m.saldo_nuevo).toFixed(2)}`);
      console.log(`   Descripción: ${m.descripcion}`);
    }

    // ============================================
    // 6. ANÁLISIS DE CÓMO SE CALCULA EL SALDO
    // ============================================
    console.log("\n📚 6. ANÁLISIS DEL CÁLCULO DE SALDO");
    console.log("-".repeat(100));

    // Obtener el saldo actual
    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
        },
      },
    });

    if (saldoActual) {
      console.log(`   Saldo actual en tabla Saldo:`);
      console.log(`   - Cantidad: ${Number(saldoActual.cantidad).toFixed(2)}`);
      console.log(`   - Billetes: ${Number(saldoActual.billetes).toFixed(2)}`);
      console.log(`   - Monedas: ${Number(saldoActual.monedas_fisicas).toFixed(2)}`);
      console.log(`   - Bancos: ${Number(saldoActual.bancos || 0).toFixed(2)}`);
      console.log(`   - Updated: ${saldoActual.updated_at.toISOString()}`);
    }

    // Calcular saldo desde el último SALDO_INICIAL
    const ultimoSaldoInicial = await prisma.movimientoSaldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        tipo_movimiento: "SALDO_INICIAL",
      },
      orderBy: { fecha: "desc" },
    });

    if (ultimoSaldoInicial) {
      console.log(`\n   Último SALDO_INICIAL encontrado:`);
      console.log(`   - Fecha: ${ultimoSaldoInicial.fecha.toISOString()}`);
      console.log(`   - Saldo inicial: ${Number(ultimoSaldoInicial.saldo_anterior).toFixed(2)}`);

      // Calcular todos los movimientos desde ese punto
      const movimientosDesdeInicial = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          fecha: {
            gt: ultimoSaldoInicial.fecha,
          },
        },
        orderBy: { fecha: "asc" },
      });

      let saldoCalculado = Number(ultimoSaldoInicial.saldo_anterior);
      let totalIngresos = 0;
      let totalEgresos = 0;
      let totalAjustes = 0;

      for (const m of movimientosDesdeInicial) {
        if (m.tipo_movimiento === "INGRESO") {
          saldoCalculado += Number(m.monto);
          totalIngresos += Number(m.monto);
        } else if (m.tipo_movimiento === "EGRESO") {
          saldoCalculado -= Number(m.monto);
          totalEgresos += Number(m.monto);
        } else if (m.tipo_movimiento === "AJUSTE") {
          saldoCalculado += Number(m.monto);
          totalAjustes += Number(m.monto);
        }
      }

      console.log(`\n   Movimientos desde el SALDO_INICIAL: ${movimientosDesdeInicial.length}`);
      console.log(`   - Ingresos: +${totalIngresos.toFixed(2)}`);
      console.log(`   - Egresos: -${totalEgresos.toFixed(2)}`);
      console.log(`   - Ajustes: ${totalAjustes >= 0 ? "+" : ""}${totalAjustes.toFixed(2)}`);
      console.log(`   - Saldo calculado: ${saldoCalculado.toFixed(2)}`);

      if (saldoActual) {
        const diferencia = saldoCalculado - Number(saldoActual.cantidad);
        console.log(`   - Saldo en DB: ${Number(saldoActual.cantidad).toFixed(2)}`);
        console.log(`   - Diferencia: ${diferencia >= 0 ? "+" : ""}${diferencia.toFixed(2)}`);
      }
    }

    // ============================================
    // 7. SOLICITUDES DE SALDO
    // ============================================
    console.log("\n📚 7. SOLICITUDES DE SALDO");
    console.log("-".repeat(100));

    const solicitudes = await prisma.solicitudSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
      orderBy: { fecha: "desc" },
      take: 10,
    });

    console.log(`   Total solicitudes: ${solicitudes.length}`);
    for (const s of solicitudes) {
      console.log(`   ${s.fecha.toISOString()} | Monto: ${Number(s.monto).toFixed(2)} | Estado: ${s.estado}`);
    }
  }

  // ============================================
  // 8. ANÁLISIS ESPECÍFICO DEL DÍA 9/4
  // ============================================
  console.log("\n\n" + "=".repeat(100));
  console.log("ANÁLISIS ESPECÍFICO DEL DÍA 9/4/2026");
  console.log("=".repeat(100));

  const inicio9Abril = new Date("2026-04-09T00:00:00.000Z");
  const fin9Abril = new Date("2026-04-10T00:00:00.000Z");

  for (const moneda of monedas) {
    console.log("\n" + "-".repeat(100));
    console.log(`💱 ${moneda.codigo} - 9/4/2026`);
    console.log("-".repeat(100));

    // Buscar SALDO_INICIAL del 9/4
    const saldoInicial9Abril = await prisma.movimientoSaldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        tipo_movimiento: "SALDO_INICIAL",
        fecha: {
          gte: inicio9Abril,
          lt: fin9Abril,
        },
      },
    });

    if (saldoInicial9Abril) {
      console.log(`\n   SALDO_INICIAL del 9/4:`);
      console.log(`   - Fecha: ${saldoInicial9Abril.fecha.toISOString()}`);
      console.log(`   - Saldo anterior: ${Number(saldoInicial9Abril.saldo_anterior).toFixed(2)}`);
      console.log(`   - Saldo nuevo: ${Number(saldoInicial9Abril.saldo_nuevo).toFixed(2)}`);
      console.log(`   - Descripción: ${saldoInicial9Abril.descripcion}`);
    } else {
      console.log(`\n   ⚠️  No hay SALDO_INICIAL el 9/4`);
    }

    // Buscar asignación de saldo inicial del 9/4
    const asignacion9Abril = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha_asignacion: {
          gte: inicio9Abril,
          lt: fin9Abril,
        },
      },
    });

    if (asignacion9Abril) {
      console.log(`\n   ASIGNACIÓN de saldo inicial del 9/4:`);
      console.log(`   - Fecha: ${asignacion9Abril.fecha_asignacion.toISOString()}`);
      console.log(`   - Cantidad: ${Number(asignacion9Abril.cantidad_inicial).toFixed(2)}`);
      console.log(`   - Activo: ${asignacion9Abril.activo}`);
    } else {
      console.log(`\n   ⚠️  No hay asignación de saldo inicial el 9/4`);
    }

    // Buscar cierre del 9/4
    const cierre9Abril = await prisma.cierreDiario.findFirst({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: inicio9Abril,
          lt: fin9Abril,
        },
      },
    });

    if (cierre9Abril) {
      console.log(`\n   CIERRE del 9/4:`);
      console.log(`   - Fecha: ${cierre9Abril.fecha.toISOString()}`);
      console.log(`   - Estado: ${cierre9Abril.estado}`);
      console.log(`   - Fecha cierre: ${cierre9Abril.fecha_cierre?.toISOString() || 'N/A'}`);
      if (cierre9Abril.diferencias_reportadas) {
        console.log(`   - Diferencias: ${JSON.stringify(cierre9Abril.diferencias_reportadas)}`);
      }
    } else {
      console.log(`\n   ⚠️  No hay cierre del 9/4`);
    }
  }

  console.log("\n" + "=".repeat(100));
  console.log("INVESTIGACIÓN COMPLETADA");
  console.log("=".repeat(100));
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
