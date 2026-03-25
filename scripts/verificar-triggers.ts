import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Verificar triggers en la tabla PuntoAtencion
    const triggers = await prisma.$queryRaw`
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'PuntoAtencion'
    `;
    console.log("Triggers en PuntoAtencion:");
    console.log(JSON.stringify(triggers, null, 2));
    
    // Verificar si hay alguna política de RLS (Row Level Security)
    const rls = await prisma.$queryRaw`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'PuntoAtencion'
    `;
    console.log("\nRow Level Security:");
    console.log(JSON.stringify(rls, null, 2));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
