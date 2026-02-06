import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function validarEstadoPunto(puntoId: string) {
  try {
    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║   VALIDACIÓN DE ESTADO DEL PUNTO DE ATENCIÓN    ║");
    console.log("╚═══════════════════════════════════════════════════╝\n");

    // 1. Obtener información del punto
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: puntoId },
      select: {
        id: true,
        nombre: true,
        activo: true,
        ciudad: true,
        provincia: true,
      },
    });

    if (!punto) {
      console.error("❌ Punto de atención no encontrado");
      return;
    }

    console.log("📍 PUNTO DE ATENCIÓN:");
    console.log(`   Nombre: ${punto.nombre}`);
    console.log(`   ID: ${punto.id}`);
    console.log(`   Ciudad: ${punto.ciudad}, ${punto.provincia}`);
    console.log(`   Estado: ${punto.activo ? "✅ Activo" : "❌ Inactivo"}`);
    console.log("");

    // 2. Verificar jornadas activas
    const jornadasActivas = await prisma.jornada.findMany({
      where: {
        punto_atencion_id: puntoId,
        fecha_salida: null, // Jornadas sin cerrar
      },
      include: {
        usuario: {
          select: {
            username: true,
            correo: true,
            rol: true,
          },
        },
      },
      orderBy: {
        fecha_inicio: "desc",
      },
    });

    console.log("🕒 JORNADAS ACTIVAS (sin cerrar):");
    if (jornadasActivas.length === 0) {
      console.log("   ✅ No hay jornadas activas");
      console.log("   ℹ️  El punto está LIBERADO y disponible");
    } else {
      console.log(`   ⚠️  ${jornadasActivas.length} jornada(s) activa(s):`);
      jornadasActivas.forEach((jornada, idx) => {
        console.log(`\n   ${idx + 1}. Usuario: ${jornada.usuario.username}`);
        console.log(`      Correo: ${jornada.usuario.correo || 'N/A'}`);
        console.log(`      Rol: ${jornada.usuario.rol}`);
        console.log(`      Inicio: ${jornada.fecha_inicio}`);
        console.log(`      Estado: ${jornada.estado}`);
        console.log(`      ID Jornada: ${jornada.id}`);
      });
      console.log("\n   ⚠️  ACCIÓN REQUERIDA: Cerrar estas jornadas");
    }
    console.log("");

    // 3. Verificar usuarios asignados permanentemente al punto
    const usuariosAsignados = await prisma.usuario.findMany({
      where: {
        punto_atencion_id: puntoId,
        activo: true,
      },
      select: {
        id: true,
        username: true,
        correo: true,
        rol: true,
        punto_atencion_id: true,
      },
    });

    console.log("👥 USUARIOS ASIGNADOS PERMANENTEMENTE:");
    if (usuariosAsignados.length === 0) {
      console.log("   ℹ️  No hay usuarios asignados permanentemente");
      console.log("   ✅ Cualquier operador puede usar este punto");
    } else {
      console.log(`   ${usuariosAsignados.length} usuario(s) asignado(s):`);
      usuariosAsignados.forEach((user, idx) => {
        console.log(`\n   ${idx + 1}. ${user.username} (${user.correo})`);
        console.log(`      Rol: ${user.rol}`);
        console.log(`      ID: ${user.id}`);
      });
    }
    console.log("");

    // 4. Verificar cuadres abiertos
    const cuadresAbiertos = await prisma.cuadreCaja.findMany({
      where: {
        punto_atencion_id: puntoId,
        estado: "ABIERTO",
      },
      include: {
        usuario: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        fecha: "desc",
      },
    });

    console.log("💰 CUADRES DE CAJA ABIERTOS:");
    if (cuadresAbiertos.length === 0) {
      console.log("   ✅ No hay cuadres abiertos");
    } else {
      console.log(`   ⚠️  ${cuadresAbiertos.length} cuadre(s) abierto(s):`);
      cuadresAbiertos.forEach((cuadre, idx) => {
        console.log(`\n   ${idx + 1}. Fecha: ${cuadre.fecha}`);
        console.log(`      Usuario: ${cuadre.usuario.username}`);
        console.log(`      Estado: ${cuadre.estado}`);
        console.log(`      ID: ${cuadre.id}`);
      });
      console.log("\n   ℹ️  Los cuadres abiertos no impiden el acceso");
    }
    console.log("");

    // 5. Última jornada cerrada
    const ultimaJornada = await prisma.jornada.findFirst({
      where: {
        punto_atencion_id: puntoId,
        fecha_salida: { not: null },
      },
      include: {
        usuario: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        fecha_salida: "desc",
      },
    });

    console.log("📅 ÚLTIMA JORNADA CERRADA:");
    if (ultimaJornada) {
      console.log(`   Usuario: ${ultimaJornada.usuario.username}`);
      console.log(`   Inicio: ${ultimaJornada.fecha_inicio}`);
      console.log(`   Salida: ${ultimaJornada.fecha_salida}`);
      const fechaSalida = ultimaJornada.fecha_salida;
      if (fechaSalida) {
        const duracion =
          new Date(fechaSalida).getTime() -
          new Date(ultimaJornada.fecha_inicio).getTime();
        const horas = Math.floor(duracion / (1000 * 60 * 60));
        const minutos = Math.floor(
          (duracion % (1000 * 60 * 60)) / (1000 * 60)
        );
        console.log(`   Duración: ${horas}h ${minutos}m`);
      }
    } else {
      console.log("   ℹ️  No hay jornadas cerradas registradas");
    }
    console.log("");

    // 6. Resumen y recomendaciones
    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║              RESUMEN Y ESTADO ACTUAL             ║");
    console.log("╚═══════════════════════════════════════════════════╝\n");

    const disponible = jornadasActivas.length === 0;

    if (disponible) {
      console.log("✅ PUNTO DISPONIBLE");
      console.log("   El punto está LIBERADO y puede ser usado por:");
      console.log("   - Usuarios asignados permanentemente al punto");
      console.log("   - Operadores sin punto asignado (pueden seleccionarlo)");
    } else {
      console.log("⚠️  PUNTO OCUPADO");
      console.log("   El punto tiene jornadas activas sin cerrar");
      console.log("\n   ACCIÓN SUGERIDA:");
      console.log("   1. Solicitar al usuario que cierre su jornada");
      console.log("   2. O cerrar manualmente las jornadas con:");
      console.log(
        `      UPDATE "Jornada" SET fecha_salida = NOW(), estado = 'CERRADO' WHERE id = '${jornadasActivas[0].id}';`
      );
    }

    console.log("\n✅ Validación completada");
  } catch (error) {
    console.error("❌ Error en validación:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar validación
const puntoId = process.argv[2] || "fa75bb3a-e881-471a-b558-749b0f0de0ff"; // Royal Pacific

validarEstadoPunto(puntoId);
