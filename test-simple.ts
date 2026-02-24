console.log("TEST: Script iniciado");

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("TEST: Dentro de main()");
  
  try {
    console.log("TEST: Conectando a BD...");
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    });
    console.log(`TEST: Se encontraron ${puntos.length} puntos activos`);
    
    for (const p of puntos) {
      console.log(`  - ${p.nombre}`);
    }
  } catch (error) {
    console.error("TEST: Error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("TEST: Desconectado de BD");
  }
}

main();
