// server/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
const prisma = global.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
    });
// En desarrollo, mantener la instancia global para evitar reconexiones en hot-reload
if (process.env.NODE_ENV === "development") {
    global.prisma = prisma;
}
// Cerrar conexión al finalizar proceso (producción)
if (process.env.NODE_ENV === "production") {
    process.on("beforeExit", async () => {
        await prisma.$disconnect();
    });
}
export default prisma;
