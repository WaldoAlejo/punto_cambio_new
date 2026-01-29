// @ts-nocheck
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function corregirAjusteUSD() {
  console.log("🔧 CORRECCIÓN DE AJUSTE USD - PLAZA DEL VALLE");
  console.log("=============================================\n");

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

    // 2. Buscar moneda USD
    const usd = await prisma.moneda.findFirst({
      where: { codigo: "USD" }
    });

    if (!usd) {
      console.error("❌ No se encontró la moneda USD");
      return;
    }

    // 3. Verificar saldo actual
    const saldoActual = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id
      }
    });

    if (!saldoActual) {
      console.error("❌ No se encontró el saldo USD");
      return;
    }

    const cantidadActual = Number(saldoActual.cantidad);
    console.log("📊 SITUACIÓN ACTUAL:");
    console.log("----------------------------");
    console.log(`  Punto: ${punto.nombre}`);
    console.log(`  Saldo actual en sistema:  $${cantidadActual.toFixed(2)}`);
    console.log(`  Saldo físico reportado:   $1575.51`);
    console.log(`  Diferencia:               $${(cantidadActual - 1575.51).toFixed(2)}\n`);

    console.log("❗ PROBLEMA IDENTIFICADO:");
    console.log("----------------------------");
    console.log("  El ajuste manual del 28/01/2026 se hizo por $69.86");
    console.log("  pero debió ser por $99.86");
    console.log("  Diferencia a corregir: $30.00\n");

    // Buscar el usuario administrador
    const admin = await prisma.usuario.findFirst({
      where: {
        OR: [
          { rol: "ADMIN" },
          { rol: "SUPER_USUARIO" },
          { username: "admin" }
        ]
      }
    });

    if (!admin) {
      console.error("❌ No se encontró un usuario administrador");
      return;
    }

    const nuevaCantidad = cantidadActual - 30;

    console.log("✅ CORRECCIÓN A APLICAR:");
    console.log("----------------------------");
    console.log(`  Restar del saldo:         $30.00`);
    console.log(`  Saldo después:            $${nuevaCantidad.toFixed(2)}`);
    console.log(`  Coincidirá con físico:    $1575.51 ✓\n`);

    // Aplicar la corrección en una transacción
    await prisma.$transaction(async (tx) => {
      // 1. Actualizar el saldo
      await tx.saldo.update({
        where: { id: saldoActual.id },
        data: {
          cantidad: nuevaCantidad
        }
      });

      // 2. Registrar el movimiento de ajuste
      await tx.movimientoSaldo.create({
        data: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id,
          tipo_movimiento: "AJUSTE",
          monto: 30,
          saldo_anterior: cantidadActual,
          saldo_nuevo: nuevaCantidad,
          usuario_id: admin.id,
          descripcion: "Corrección de ajuste manual previo - El ajuste del 28/01 debió ser $99.86 en lugar de $69.86. Diferencia: $30.00",
          fecha: new Date()
        }
      });

      console.log("✅ CORRECCIÓN APLICADA EXITOSAMENTE");
      console.log("----------------------------");
      console.log(`  ✓ Saldo actualizado de $${cantidadActual.toFixed(2)} a $${nuevaCantidad.toFixed(2)}`);
      console.log(`  ✓ Movimiento de ajuste registrado`);
      console.log(`  ✓ El saldo ahora coincide con el físico: $1575.51\n`);
    });

    // Verificar el resultado
    const saldoFinal = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id
      }
    });

    console.log("📊 VERIFICACIÓN FINAL:");
    console.log("----------------------------");
    console.log(`  Saldo en sistema:    $${Number(saldoFinal.cantidad).toFixed(2)}`);
    console.log(`  Saldo físico:        $1575.51`);
    console.log(`  Diferencia:          $${(Number(saldoFinal.cantidad) - 1575.51).toFixed(2)}`);
    
    if (Math.abs(Number(saldoFinal.cantidad) - 1575.51) < 0.01) {
      console.log("\n✅ ¡PERFECTO! Los saldos ahora coinciden.\n");
    } else {
      console.log("\n⚠️ Aún hay una diferencia.\n");
    }

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

corregirAjusteUSD();
