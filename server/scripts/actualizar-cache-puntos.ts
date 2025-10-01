import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function actualizarCachePuntos() {
  console.log("🔄 ACTUALIZANDO CACHE DE PUNTOS CON SERVIENTREGA");
  console.log("============================================================");

  try {
    // Obtener todos los puntos con configuración Servientrega actualizada
    const puntosServientrega = await prisma.puntoAtencion.findMany({
      where: {
        servientrega_agencia_codigo: {
          not: null,
        },
      },
      include: {
        saldosServientrega: true,
        usuarios: {
          where: {
            activo: true,
          },
          select: {
            id: true,
            nombre: true,
            rol: true,
          },
        },
      },
    });

    console.log(
      `📍 Encontrados ${puntosServientrega.length} puntos con configuración Servientrega`
    );
    console.log("");

    for (const punto of puntosServientrega) {
      console.log(`📍 ${punto.nombre}:`);
      console.log(
        `   🏪 Código de Agencia: "${punto.servientrega_agencia_codigo}"`
      );
      console.log(
        `   🏪 Nombre de Agencia: "${punto.servientrega_agencia_nombre}"`
      );
      console.log(
        `   💰 Saldo: $${Number(punto.saldosServientrega?.monto_total || 0)}`
      );
      console.log(
        `   👥 Operadores activos: ${
          punto.usuarios.filter((u) => u.rol === "OPERADOR").length
        }`
      );
      console.log("");
    }

    console.log("📋 INSTRUCCIONES PARA OPERADORES:");
    console.log(
      "================================================================================"
    );
    console.log('Para que aparezca la opción "Guías Servientrega" en el menú:');
    console.log("");
    console.log("1. 🔄 Cerrar sesión completamente");
    console.log(
      "2. 🧹 Limpiar caché del navegador (Ctrl+Shift+R o Cmd+Shift+R)"
    );
    console.log("3. 🔑 Iniciar sesión nuevamente");
    console.log("4. 📍 Seleccionar el punto de atención");
    console.log("");
    console.log("Alternativamente, pueden:");
    console.log("- Abrir el navegador en modo incógnito");
    console.log("- O presionar F12 → Application → Storage → Clear storage");
    console.log("");
    console.log("✅ Los datos en la base de datos ya están corregidos");
    console.log(
      "🎯 El problema era espacios en blanco en los códigos de agencia"
    );
  } catch (error) {
    console.error("❌ Error al verificar puntos:", error);
  } finally {
    await prisma.$disconnect();
  }
}

actualizarCachePuntos();
