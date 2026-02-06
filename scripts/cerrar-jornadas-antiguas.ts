import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cerrarJornadasAntiguas() {
  try {
    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║     CERRANDO JORNADAS ANTIGUAS SIN CERRAR        ║");
    console.log("╚═══════════════════════════════════════════════════╝\n");

    // Fecha límite: hace 2 días
    const hace2Dias = new Date();
    hace2Dias.setDate(hace2Dias.getDate() - 2);
    hace2Dias.setHours(23, 59, 59, 999);

    console.log(`📅 Buscando jornadas anteriores a: ${hace2Dias.toLocaleString()}\n`);

    // Buscar jornadas antiguas sin cerrar
    const jornadasAntiguas = await prisma.jornada.findMany({
      where: {
        fecha_salida: null,
        estado: "ACTIVO",
        fecha_inicio: {
          lt: hace2Dias,
        },
      },
      include: {
        usuario: {
          select: {
            username: true,
            nombre: true,
          },
        },
        puntoAtencion: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        fecha_inicio: "asc",
      },
    });

    if (jornadasAntiguas.length === 0) {
      console.log("✅ No se encontraron jornadas antiguas sin cerrar");
      return;
    }

    console.log(`📋 Encontradas ${jornadasAntiguas.length} jornada(s) antigua(s) sin cerrar:\n`);

    for (let i = 0; i < jornadasAntiguas.length; i++) {
      const jornada = jornadasAntiguas[i];
      const diasAtras = Math.floor(
        (new Date().getTime() - jornada.fecha_inicio.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      console.log(`${i + 1}. Jornada ID: ${jornada.id}`);
      console.log(`   Usuario: ${jornada.usuario.username} (${jornada.usuario.nombre})`);
      console.log(`   Punto: ${jornada.puntoAtencion.nombre}`);
      console.log(`   Inicio: ${jornada.fecha_inicio.toLocaleString()}`);
      console.log(`   Días atrás: ${diasAtras}`);
      console.log("");
    }

    console.log("⚠️  Estas jornadas serán cerradas automáticamente...");
    console.log("    Continuando en 3 segundos...\n");

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Cerrar todas las jornadas antiguas
    for (const jornada of jornadasAntiguas) {
      // Establecer fecha_salida al final del día en que inició
      const fechaSalida = new Date(jornada.fecha_inicio);
      fechaSalida.setHours(18, 0, 0, 0); // 6 PM del mismo día

      await prisma.jornada.update({
        where: { id: jornada.id },
        data: {
          fecha_salida: fechaSalida,
          estado: "COMPLETADO",
          observaciones: `Jornada cerrada automáticamente por sistema (quedó abierta desde ${jornada.fecha_inicio.toLocaleDateString()})`,
        },
      });

      console.log(`✅ Jornada ${jornada.id} cerrada`);
    }

    console.log(`\n✅ ÉXITO: ${jornadasAntiguas.length} jornada(s) cerrada(s)`);
    console.log(`   Fecha de cierre aplicada: fin del día de inicio de cada jornada\n`);

    // Verificar que se cerraron
    const jornadasRestantes = await prisma.jornada.count({
      where: {
        fecha_salida: null,
        estado: "ACTIVO",
        fecha_inicio: {
          lt: hace2Dias,
        },
      },
    });

    if (jornadasRestantes === 0) {
      console.log("✅ Todas las jornadas antiguas fueron cerradas");
    } else {
      console.log(`⚠️  Aún quedan ${jornadasRestantes} jornada(s) antigua(s) abiertas`);
    }
  } catch (error) {
    console.error("❌ Error cerrando jornadas antiguas:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cerrarJornadasAntiguas();
