import prisma from "../lib/prisma.js";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function reconcileAmazonasPhysical() {
  try {
    // Buscar AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto AMAZONAS");
      return;
    }

    // Buscar USD
    const usd = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!usd) {
      console.log("❌ No se encontró USD");
      return;
    }

    // Obtener saldo actual
    const saldo = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id,
        },
      },
    });

    const saldoSistema = Number(saldo?.cantidad || 0);
    const saldoFisico = 79.17;
    const diferencia = saldoSistema - saldoFisico;

    console.log("\n" + "=".repeat(80));
    console.log("🔍 RECONCILIACIÓN DE EFECTIVO - AMAZONAS USD");
    console.log("=".repeat(80));
    console.log(`\n📊 Situación actual:`);
    console.log(`   Saldo en sistema: $${saldoSistema.toFixed(2)}`);
    console.log(`   Efectivo físico contado: $${saldoFisico.toFixed(2)}`);
    console.log(`   Diferencia (faltante): $${diferencia.toFixed(2)}`);

    console.log(`\n🔎 Análisis de discrepancias encontradas:`);
    console.log(`   1. Movimiento #6 (2025-10-06 20:27): +$500 no registrado`);
    console.log(`   2. Movimiento #25 (2025-10-07 14:25): -$500 no registrado`);
    console.log(
      `\n   Estas dos discrepancias se cancelan entre sí en el sistema.`
    );

    console.log(`\n💡 Posibles explicaciones:`);
    console.log(`   A) Hubo un retiro de $500 que no se registró`);
    console.log(`   B) Hubo múltiples transacciones no registradas`);
    console.log(`   C) Error en el conteo físico`);
    console.log(`   D) Dinero depositado en banco sin registrar en sistema`);

    console.log(`\n📋 Opciones de reconciliación:\n`);
    console.log(
      `   1. Registrar un AJUSTE de -$${diferencia.toFixed(2)} (faltante)`
    );
    console.log(`   2. Investigar más antes de ajustar`);
    console.log(`   3. Cancelar y no hacer cambios`);

    const respuesta = await question("\n¿Qué desea hacer? (1/2/3): ");

    if (respuesta === "1") {
      console.log(
        `\n⚠️  ADVERTENCIA: Esto registrará un faltante de $${diferencia.toFixed(
          2
        )}`
      );
      const confirmar = await question("¿Está seguro? (si/no): ");

      if (confirmar.toLowerCase() === "si") {
        // Buscar un usuario admin para el registro
        const admin = await prisma.usuario.findFirst({
          where: { rol: "ADMIN" },
        });

        if (!admin) {
          console.log("❌ No se encontró un usuario admin");
          return;
        }

        const motivo = await question("Ingrese el motivo del ajuste: ");

        // Crear el movimiento de ajuste
        const nuevoSaldo = saldoFisico;
        const movimiento = await prisma.movimientoSaldo.create({
          data: {
            punto_atencion_id: punto.id,
            moneda_id: usd.id,
            tipo_movimiento: "AJUSTE",
            monto: -diferencia,
            saldo_anterior: saldoSistema,
            saldo_nuevo: nuevoSaldo,
            usuario_id: admin.id,
            descripcion: `AJUSTE POR FALTANTE - ${motivo}`,
            fecha: new Date(),
          },
        });

        // Actualizar el saldo
        await prisma.saldo.update({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: punto.id,
              moneda_id: usd.id,
            },
          },
          data: {
            cantidad: nuevoSaldo,
          },
        });

        console.log(`\n✅ Ajuste registrado exitosamente`);
        console.log(`   Movimiento ID: ${movimiento.id}`);
        console.log(`   Nuevo saldo: $${nuevoSaldo.toFixed(2)}`);
      } else {
        console.log("\n❌ Operación cancelada");
      }
    } else if (respuesta === "2") {
      console.log(`\n📝 Recomendaciones para la investigación:`);
      console.log(
        `   1. Revisar registros de depósitos bancarios del 6-7 de octubre`
      );
      console.log(`   2. Verificar si hay retiros autorizados no registrados`);
      console.log(`   3. Revisar cámaras de seguridad si están disponibles`);
      console.log(`   4. Entrevistar al personal que trabajó esos días`);
      console.log(`   5. Verificar el conteo físico nuevamente`);
    } else {
      console.log("\n❌ Operación cancelada");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

reconcileAmazonasPhysical();
