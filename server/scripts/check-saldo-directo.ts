import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkSaldoDirecto() {
  try {
    // Buscar AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró AMAZONAS");
      return;
    }

    // Buscar USD
    const moneda = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!moneda) {
      console.log("❌ No se encontró USD");
      return;
    }

    console.log("📍 Punto:", punto.nombre);
    console.log("💵 Moneda:", moneda.codigo);
    console.log("");

    // Consultar saldo directamente
    const saldo = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
    });

    if (!saldo) {
      console.log("❌ No se encontró registro de saldo");
      return;
    }

    console.log("💰 SALDO EN BASE DE DATOS:");
    console.log("   ID:", saldo.id);
    console.log("   Efectivo:", Number(saldo.efectivo));
    console.log("   Bancos:", Number(saldo.bancos));
    console.log("   Total:", Number(saldo.efectivo) + Number(saldo.bancos));
    console.log("");

    // Verificar si hay movimientos después de la última actualización
    const ultimoMovimiento = await prisma.movimientoSaldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
      orderBy: {
        fecha: "desc",
      },
    });

    if (ultimoMovimiento) {
      console.log("📅 Último movimiento:");
      console.log("   Fecha:", ultimoMovimiento.fecha.toISOString());
      console.log("   Tipo:", ultimoMovimiento.tipo_movimiento);
      console.log("   Monto:", Number(ultimoMovimiento.monto));
      console.log("   Descripción:", ultimoMovimiento.descripcion);
      console.log("   Saldo nuevo:", Number(ultimoMovimiento.saldo_nuevo));
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSaldoDirecto();
