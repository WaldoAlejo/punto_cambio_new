const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function setupTestUsers() {
  try {
    console.log("🔧 Configurando usuarios de prueba...");

    // 1. Buscar o crear punto principal
    let puntoPrincipal = await prisma.puntoAtencion.findFirst({
      where: { nombre: "PUNTO PRINCIPAL" },
    });

    if (!puntoPrincipal) {
      puntoPrincipal = await prisma.puntoAtencion.create({
        data: {
          nombre: "PUNTO PRINCIPAL",
          direccion: "Oficina Central",
          telefono: "0999999999",
          activo: true,
          es_principal: true,
        },
      });
      console.log("✅ Punto principal creado:", puntoPrincipal.nombre);
    } else {
      console.log("✅ Punto principal encontrado:", puntoPrincipal.nombre);
    }

    // 2. Crear/actualizar usuario ADMIN
    const adminPassword = await bcrypt.hash("admin123", 10);

    const admin = await prisma.usuario.upsert({
      where: { username: "admin" },
      update: {
        password: adminPassword,
        punto_atencion_id: puntoPrincipal.id,
        activo: true,
      },
      create: {
        username: "admin",
        password: adminPassword,
        nombre: "Administrador Principal",
        rol: "ADMIN",
        punto_atencion_id: puntoPrincipal.id,
        activo: true,
      },
    });
    console.log("✅ Usuario ADMIN configurado:", admin.username);

    // 3. Crear/actualizar usuario OPERADOR
    const operadorPassword = await bcrypt.hash("operador123", 10);

    const operador = await prisma.usuario.upsert({
      where: { username: "operador" },
      update: {
        password: operadorPassword,
        activo: true,
      },
      create: {
        username: "operador",
        password: operadorPassword,
        nombre: "Operador de Prueba",
        rol: "OPERADOR",
        activo: true,
      },
    });
    console.log("✅ Usuario OPERADOR configurado:", operador.username);

    // 4. Crear/actualizar usuario CONCESION
    const concesionPassword = await bcrypt.hash("concesion123", 10);

    const concesion = await prisma.usuario.upsert({
      where: { username: "concesion" },
      update: {
        password: concesionPassword,
        punto_atencion_id: puntoPrincipal.id,
        activo: true,
      },
      create: {
        username: "concesion",
        password: concesionPassword,
        nombre: "Usuario Concesión",
        rol: "CONCESION",
        punto_atencion_id: puntoPrincipal.id,
        activo: true,
      },
    });
    console.log("✅ Usuario CONCESION configurado:", concesion.username);

    console.log("\n🎉 Usuarios de prueba configurados correctamente:");
    console.log("👤 ADMIN: admin / admin123 (Punto Principal asignado)");
    console.log("👤 OPERADOR: operador / operador123");
    console.log("👤 CONCESION: concesion / concesion123 (Solo Servientrega)");
  } catch (error) {
    console.error("❌ Error configurando usuarios:", error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestUsers();
