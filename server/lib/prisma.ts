// server/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // Evitar múltiples instancias en desarrollo con hot-reload
   
  var prisma: PrismaClient | undefined;
}

const prisma =
  (global as typeof globalThis & { prisma?: PrismaClient }).prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Configurar timezone de Ecuador (UTC-5) para todas las conexiones
prisma
  .$executeRawUnsafe(`SET timezone = 'America/Guayaquil'`)
  .catch((err: Error) => {
    console.error("Error configurando timezone:", err);
  });

// En desarrollo, mantener la instancia global para evitar reconexiones en hot-reload
if (process.env.NODE_ENV === "development") {
  (global as typeof globalThis & { prisma?: PrismaClient }).prisma = prisma;
}

// Cerrar conexión al finalizar proceso (producción)
if (process.env.NODE_ENV === "production") {
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });
}

export default prisma;
