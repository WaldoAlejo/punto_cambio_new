import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixUserPuntoAtencion() {
  try {
    console.log("🔍 Verificando usuarios ADMIN sin punto de atención...");

    // Buscar usuarios ADMIN sin punto de atención
    const adminUsers = await prisma.usuario.findMany({
      where: {
        rol: "ADMIN",
        punto_atencion_id: null,
        activo: true,
      },
    });

    if (adminUsers.length === 0) {
      console.log(
        "✅ Todos los usuarios ADMIN tienen punto de atención asignado"
      );

      // Mostrar usuarios ADMIN existentes
      const allAdmins = await prisma.usuario.findMany({
        where: { rol: "ADMIN" },
        select: {
          username: true,
          nombre: true,
          activo: true,
          punto_atencion_id: true,
        },
      });

      console.log("\n📋 Usuarios ADMIN existentes:");
      allAdmins.forEach((admin) => {
        console.log(
          `👤 ${admin.username} (${admin.nombre}) - Punto: ${
            admin.punto_atencion_id ? "✅" : "❌"
          } - Activo: ${admin.activo ? "✅" : "❌"}`
        );
      });

      return;
    }

    console.log(
      `⚠️ Encontrados ${adminUsers.length} usuarios ADMIN sin punto de atención`
    );

    // Buscar o crear punto de atención principal
    let puntoPrincipal = await prisma.puntoAtencion.findFirst({
      where: { es_principal: true },
    });

    if (!puntoPrincipal) {
      console.log("🏢 Creando punto de atención principal...");
      puntoPrincipal = await prisma.puntoAtencion.create({
        data: {
          nombre: "OFICINA PRINCIPAL",
          direccion: "edificio Royal Pacific, Piso 6 La Pinta y Rábida",
          telefono: "984997178",
          ciudad: "Quito",
          provincia: "Pichincha",
          es_principal: true,
          activo: true,
        },
      });
      console.log("✅ Punto principal creado:", puntoPrincipal.nombre);
    }

    // Asignar punto de atención a usuarios ADMIN
    for (const user of adminUsers) {
      await prisma.usuario.update({
        where: { id: user.id },
        data: { punto_atencion_id: puntoPrincipal.id },
      });

      console.log(
        `✅ Usuario ${user.username} (${user.nombre}) asignado al punto principal`
      );
    }

    console.log(
      "\n🎉 ¡Todos los usuarios ADMIN ahora tienen punto de atención asignado!"
    );
    console.log("🔑 Ahora puedes hacer login normalmente con tus credenciales");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserPuntoAtencion();
