import { PrismaClient } from "@prisma/client";
import pkg from "pg";
const { Pool } = pkg;

const prisma = new PrismaClient();

// Crear pool de conexión directamente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

interface Moneda {
  id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  activo?: boolean;
  orden_display?: number;
}

async function diagnosticarCuadre(puntoAtencionId: string, fecha: Date) {
  try {
    console.log("🔍 Iniciando diagnóstico del cuadre...");
    console.log("📍 Punto de atención:", puntoAtencionId);
    console.log("📅 Fecha:", fecha.toISOString());
    console.log("");

    // 1. Verificar monedas activas
    const monedasResult = await pool.query<Moneda>(
      `SELECT id, codigo, nombre, simbolo, activo, orden_display
        FROM "Moneda"
        WHERE activo = true
        ORDER BY orden_display ASC`
    );
    const monedas = monedasResult.rows;
    console.log(`📊 Monedas activas encontradas: ${monedas.length}`);
    monedas.forEach((m) => console.log(`  - ${m.codigo} (${m.nombre})`));
    console.log("");

    // 2. Para cada moneda, verificar saldos iniciales y movimientos
    for (const moneda of monedas) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`💱 MONEDA: ${moneda.codigo} (${moneda.nombre})`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // 2.1. Verificar saldo inicial
      const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: moneda.id,
          activo: true,
        },
        orderBy: {
          fecha_asignacion: "desc",
        },
      });

      if (saldoInicial) {
        console.log(`✅ Saldo inicial encontrado:`);
        console.log(`   Cantidad: ${saldoInicial.cantidad_inicial}`);
        console.log(`   Fecha: ${saldoInicial.fecha_asignacion}`);
      } else {
        console.log(`⚠️  No hay saldo inicial registrado`);
      }

      // 2.2. Verificar movimientos
      const movimientos = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: moneda.id,
        },
        select: {
          id: true,
          monto: true,
          tipo_movimiento: true,
          descripcion: true,
          fecha: true,
        },
        orderBy: {
          fecha: "desc",
        },
        take: 10,
      });

      console.log(`\n📋 Últimos ${movimientos.length} movimientos:`);
      if (movimientos.length === 0) {
        console.log(`   (Sin movimientos)`);
      } else {
        movimientos.forEach((mov, idx) => {
          console.log(
            `   ${idx + 1}. [${mov.tipo_movimiento}] ${mov.monto} - ${mov.descripcion?.substring(0, 50) || "Sin descripción"}`
          );
        });
      }

      // 2.3. Verificar saldo actual
      const saldoActual = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: moneda.id,
          },
        },
      });

      console.log(`\n💰 Saldo actual en tabla Saldo:`);
      if (saldoActual) {
        console.log(`   Cantidad total: ${saldoActual.cantidad}`);
        console.log(`   Billetes: ${saldoActual.billetes}`);
        console.log(`   Monedas físicas: ${saldoActual.monedas_fisicas}`);
      } else {
        console.log(`   ⚠️ No existe registro en tabla Saldo`);
      }

      // 2.4. Calcular saldo teórico
      try {
        let saldoCalculado = saldoInicial
          ? Number(saldoInicial.cantidad_inicial)
          : 0;

        const todosMovimientos = await prisma.movimientoSaldo.findMany({
          where: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: moneda.id,
          },
          select: {
            monto: true,
            tipo_movimiento: true,
            descripcion: true,
          },
          orderBy: {
            fecha: "asc",
          },
        });

        const movimientosFiltrados = todosMovimientos.filter((mov) => {
          const desc = mov.descripcion?.toLowerCase() || "";
          return !desc.includes("bancos");
        });

        for (const mov of movimientosFiltrados) {
          const monto = Number(mov.monto);
          const tipoMovimiento = mov.tipo_movimiento;

          if (isNaN(monto) || !isFinite(monto)) {
            console.log(`   ⚠️ Movimiento con monto inválido: ${mov.monto}`);
            continue;
          }

          if (tipoMovimiento === "SALDO_INICIAL") {
            continue;
          }

          saldoCalculado += monto;
        }

        console.log(`\n🧮 Saldo calculado (teórico): ${saldoCalculado.toFixed(2)}`);
        console.log(`   Movimientos procesados: ${movimientosFiltrados.length}`);
        console.log(`   Movimientos excluidos (bancarios): ${todosMovimientos.length - movimientosFiltrados.length}`);

        if (saldoActual) {
          const diferencia = Number(saldoActual.cantidad) - saldoCalculado;
          console.log(`\n📊 Diferencia (Actual - Calculado): ${diferencia.toFixed(2)}`);
        }
      } catch (calcError) {
        console.error(`❌ Error calculando saldo teórico:`, calcError);
      }
    }

    console.log("\n\n✅ Diagnóstico completado");
  } catch (error) {
    console.error("❌ Error en diagnóstico:", error);
    if (error instanceof Error) {
      console.error("   Mensaje:", error.message);
      console.error("   Stack:", error.stack);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Ejecutar diagnóstico
const puntoAtencionId = process.argv[2] || "99070905-0cb5-4235-b9e0-bd3d00b35b62"; // AMAZONAS
const fecha = new Date(); // Hoy

console.log("╔══════════════════════════════════════════════════╗");
console.log("║   DIAGNÓSTICO DEL SISTEMA DE CUADRE DE CAJA     ║");
console.log("╚══════════════════════════════════════════════════╝\n");

diagnosticarCuadre(puntoAtencionId, fecha);
