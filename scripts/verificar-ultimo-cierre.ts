import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verificarUltimoCierre() {
  try {
    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║      VERIFICACIÓN DEL ÚLTIMO CIERRE DIARIO       ║");
    console.log("╚═══════════════════════════════════════════════════╝\n");

    // Buscar el último cierre realizado hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ultimoCierre = await prisma.cierreDiario.findFirst({
      where: {
        fecha: {
          gte: hoy,
        },
      },
      include: {
        usuario: {
          select: {
            id: true,
            username: true,
            nombre: true,
            punto_atencion_id: true,
          },
        },
        puntoAtencion: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!ultimoCierre) {
      console.log("❌ No se encontraron cierres diarios hoy");
      return;
    }

    console.log("📋 ÚLTIMO CIERRE DIARIO:");
    console.log(`   ID: ${ultimoCierre.id}`);
    console.log(`   Punto: ${ultimoCierre.puntoAtencion.nombre}`);
    console.log(`   Usuario: ${ultimoCierre.usuario.username} (${ultimoCierre.usuario.nombre})`);
    console.log(`   Usuario ID: ${ultimoCierre.usuario.id}`);
    console.log(`   Punto ID: ${ultimoCierre.punto_atencion_id}`);
    console.log(`   Fecha cierre: ${ultimoCierre.created_at}`);
    console.log(`   Estado: ${ultimoCierre.estado || 'N/A'}`);
    console.log("");

    // Buscar jornadas del usuario en ese punto
    console.log("🔍 JORNADAS DEL USUARIO EN ESE PUNTO:");
    const jornadas = await prisma.jornada.findMany({
      where: {
        usuario_id: ultimoCierre.usuario.id,
        punto_atencion_id: ultimoCierre.punto_atencion_id,
      },
      orderBy: {
        fecha_inicio: "desc",
      },
      take: 5,
    });

    if (jornadas.length === 0) {
      console.log("   ⚠️  No se encontraron jornadas");
    } else {
      jornadas.forEach((jornada, idx) => {
        console.log(`\n   ${idx + 1}. Jornada ID: ${jornada.id}`);
        console.log(`      Inicio: ${jornada.fecha_inicio}`);
        console.log(`      Salida: ${jornada.fecha_salida || "AÚN ACTIVA"}`);
        console.log(`      Estado: ${jornada.estado}`);
      });
    }
    console.log("");

    // Verificar estado actual del usuario
    console.log("👤 ESTADO ACTUAL DEL USUARIO:");
    const usuarioActual = await prisma.usuario.findUnique({
      where: { id: ultimoCierre.usuario.id },
      select: {
        id: true,
        username: true,
        nombre: true,
        punto_atencion_id: true,
      },
    });

    if (usuarioActual) {
      console.log(`   Username: ${usuarioActual.username}`);
      console.log(`   Punto asignado: ${usuarioActual.punto_atencion_id || "NINGUNO (liberado)"}`);
    }

    console.log("\n✅ Verificación completada");
  } catch (error) {
    console.error("❌ Error en verificación:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarUltimoCierre();
