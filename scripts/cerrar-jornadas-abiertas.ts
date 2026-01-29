import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cerrarJornadasAbiertas(puntoId: string) {
  try {
    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║      CERRANDO JORNADAS ABIERTAS DEL PUNTO        ║");
    console.log("╚═══════════════════════════════════════════════════╝\n");

    // Buscar jornadas sin cerrar
    const jornadasAbiertas = await prisma.jornada.findMany({
      where: {
        punto_atencion_id: puntoId,
        fecha_salida: null,
      },
      include: {
        usuario: {
          select: {
            username: true,
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

    if (jornadasAbiertas.length === 0) {
      console.log("✅ No hay jornadas abiertas para cerrar");
      return;
    }

    console.log(`📋 Encontradas ${jornadasAbiertas.length} jornadas abiertas:\n`);

    for (let i = 0; i < jornadasAbiertas.length; i++) {
      const jornada = jornadasAbiertas[i];
      console.log(`${i + 1}. ${jornada.usuario.username} - ${jornada.puntoAtencion.nombre}`);
      console.log(`   Inicio: ${jornada.fecha_inicio}`);
      console.log(`   Estado: ${jornada.estado}`);
    }

    console.log("\n⚠️  ¿Desea cerrar TODAS estas jornadas? (Continuará automáticamente)");
    console.log("    Cerrando en 3 segundos...\n");

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Cerrar todas las jornadas
    const ahora = new Date();
    const resultado = await prisma.jornada.updateMany({
      where: {
        punto_atencion_id: puntoId,
        fecha_salida: null,
      },
      data: {
        fecha_salida: ahora,
        estado: "COMPLETADO",
      },
    });

    console.log(`✅ ${resultado.count} jornada(s) cerrada(s) exitosamente`);
    console.log(`   Fecha de cierre: ${ahora.toISOString()}\n`);

    // Verificar que se cerraron
    const jornadasRestantes = await prisma.jornada.count({
      where: {
        punto_atencion_id: puntoId,
        fecha_salida: null,
      },
    });

    if (jornadasRestantes === 0) {
      console.log("✅ ÉXITO: Todas las jornadas fueron cerradas");
      console.log("✅ El punto está ahora LIBERADO y disponible");
    } else {
      console.log(`⚠️  Aún quedan ${jornadasRestantes} jornada(s) abiertas`);
    }
  } catch (error) {
    console.error("❌ Error cerrando jornadas:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
const puntoId = process.argv[2] || "fa75bb3a-e881-471a-b558-749b0f0de0ff"; // Royal Pacific

cerrarJornadasAbiertas(puntoId);
