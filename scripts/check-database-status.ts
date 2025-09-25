import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
  console.log("🔍 Verificando estado de la base de datos...\n");

  try {
    // Verificar cuadres de caja
    const cuadresCount = await prisma.cuadreCaja.count();
    console.log(`📊 Total de cuadres de caja: ${cuadresCount}`);

    if (cuadresCount > 0) {
      const latestCuadre = await prisma.cuadreCaja.findFirst({
        orderBy: { fecha: "desc" },
        include: {
          punto_servicio: true,
          moneda: true,
        },
      });
      console.log("📅 Último cuadre:", {
        fecha: latestCuadre?.fecha,
        punto: latestCuadre?.punto_servicio?.nombre,
        moneda: latestCuadre?.moneda?.codigo,
        estado: latestCuadre?.estado,
      });
    }

    // Verificar servicios externos
    const serviciosCount = await prisma.servicioExternoMovimiento.count();
    console.log(
      `🏦 Total de movimientos de servicios externos: ${serviciosCount}`
    );

    if (serviciosCount > 0) {
      const latestServicio = await prisma.servicioExternoMovimiento.findFirst({
        orderBy: { fecha: "desc" },
        include: {
          punto_servicio: true,
          moneda: true,
        },
      });
      console.log("📅 Último movimiento de servicio externo:", {
        fecha: latestServicio?.fecha,
        tipo: latestServicio?.tipo_movimiento,
        servicio: latestServicio?.tipo_servicio,
        monto: latestServicio?.monto,
        punto: latestServicio?.punto_servicio?.nombre,
      });
    }

    // Verificar puntos de servicio
    const puntosCount = await prisma.puntoServicio.count();
    console.log(`🏢 Total de puntos de servicio: ${puntosCount}`);

    // Verificar monedas
    const monedasCount = await prisma.moneda.count();
    console.log(`💰 Total de monedas: ${monedasCount}`);

    // Verificar usuarios
    const usuariosCount = await prisma.usuario.count();
    console.log(`👥 Total de usuarios: ${usuariosCount}`);

    console.log("\n✅ Verificación completada.");
  } catch (error) {
    console.error("❌ Error al verificar la base de datos:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStatus();
