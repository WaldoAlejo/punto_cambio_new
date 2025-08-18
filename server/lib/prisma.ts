import { PrismaClient } from "@prisma/client";

// Crear una instancia global de PrismaClient para evitar múltiples conexiones
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

// Manejar el cierre de conexiones cuando la aplicación se detiene
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

export default prisma;
