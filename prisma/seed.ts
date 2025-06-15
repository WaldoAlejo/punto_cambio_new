import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

// ✅ Función de borrado segura sin relanzar errores
async function safeDelete(nombre: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`✅ ${nombre} eliminados`);
  } catch (error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      console.warn(`⚠️ Tabla ${nombre} no existe. Saltando...`);
    } else {
      console.error(`❌ Error eliminando ${nombre}:`, error);
      // No relanzamos el error para permitir que el seed continúe
    }
  }
}

async function main() {
  console.log("🌱 Iniciando limpieza completa de la base de datos...");

  console.log("🧹 Eliminando todos los datos existentes...");
  await safeDelete("DetalleCuadreCaja", () =>
    prisma.detalleCuadreCaja.deleteMany()
  );
  await safeDelete("Recibo", () => prisma.recibo.deleteMany());
  await safeDelete("Transferencia", () => prisma.transferencia.deleteMany());
  await safeDelete("CambioDivisa", () => prisma.cambioDivisa.deleteMany());
  await safeDelete("Movimiento", () => prisma.movimiento.deleteMany());
  await safeDelete("Jornada", () => prisma.jornada.deleteMany());
  await safeDelete("CuadreCaja", () => prisma.cuadreCaja.deleteMany());
  await safeDelete("SolicitudSaldo", () => prisma.solicitudSaldo.deleteMany());
  await safeDelete("HistorialSaldo", () => prisma.historialSaldo.deleteMany());
  await safeDelete("Saldo", () => prisma.saldo.deleteMany());
  await safeDelete("Usuario", () => prisma.usuario.deleteMany());
  await safeDelete("PuntoAtencion", () => prisma.puntoAtencion.deleteMany());
  await safeDelete("Moneda", () => prisma.moneda.deleteMany());

  console.log("🎯 Base de datos completamente limpia");

  // Crear monedas básicas
  console.log("💰 Creando monedas básicas...");
  const monedas = await Promise.all([
    prisma.moneda.create({
      data: {
        nombre: "Dólar Estadounidense",
        simbolo: "$",
        codigo: "USD",
        activo: true,
        orden_display: 1,
      },
    }),
    prisma.moneda.create({
      data: {
        nombre: "Euro",
        simbolo: "€",
        codigo: "EUR",
        activo: true,
        orden_display: 2,
      },
    }),
    prisma.moneda.create({
      data: {
        nombre: "Bolívar Venezolano",
        simbolo: "Bs",
        codigo: "VES",
        activo: true,
        orden_display: 3,
      },
    }),
  ]);

  console.log(`✅ ${monedas.length} monedas creadas`);

  // Crear usuario admin
  console.log("👤 Creando usuario administrador...");
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const admin = await prisma.usuario.create({
    data: {
      username: "admin",
      password: hashedPassword,
      rol: "ADMIN",
      nombre: "Administrador Principal",
      correo: "admin@puntocambio.com",
      telefono: "+58 212-555-0000",
      activo: true,
    },
  });

  console.log(`✅ Usuario administrador creado: ${admin.username}`);

  console.log("\n🎉 ¡Base de datos completamente limpia y lista!");
  console.log("\n📋 Estado actual del sistema:");
  console.log(`- ${monedas.length} monedas básicas (USD, EUR, VES)`);
  console.log("- 1 usuario administrador único");
  console.log("- 0 puntos de atención (crear desde el panel admin)");
  console.log("- 0 transferencias");
  console.log("- 0 jornadas o movimientos");
  console.log("\n🔑 Credenciales de acceso:");
  console.log("Usuario: admin");
  console.log("Contraseña: admin123");
  console.log("\n🚀 Ahora puedes comenzar a configurar el sistema desde cero.");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  