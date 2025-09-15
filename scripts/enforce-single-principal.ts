import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== Enforce single principal PuntoAtencion ===");

  // 1) Corregir datos si existen múltiples principales
  const principals = await prisma.puntoAtencion.findMany({
    where: { es_principal: true },
    orderBy: { created_at: "asc" },
    select: { id: true, nombre: true, created_at: true },
  });

  if (principals.length === 0) {
    console.warn("No hay ningún punto de atención marcado como principal.");
  } else if (principals.length > 1) {
    console.warn(
      `Se encontraron ${principals.length} puntos principales. Corrigiendo...`
    );
    const keep = principals[0];
    const toUnset = principals.slice(1);

    for (const p of toUnset) {
      await prisma.puntoAtencion.update({
        where: { id: p.id },
        data: { es_principal: false },
      });
      console.log(`- Desmarcado como principal: ${p.nombre} (${p.id})`);
    }
    console.log(`Manteniendo como principal: ${keep.nombre} (${keep.id})`);
  } else {
    console.log(
      `OK: Solo un punto principal: ${principals[0].nombre} (${principals[0].id})`
    );
  }

  // 2) Crear índice único parcial para garantizar que solo exista un principal
  // Postgres: unique index filtrado por es_principal = true
  const createIndexSQL = `
    CREATE UNIQUE INDEX IF NOT EXISTS "unique_principal_point"
    ON "PuntoAtencion" (es_principal)
    WHERE es_principal = true;
  `;

  await prisma.$executeRawUnsafe(createIndexSQL);
  console.log("Índice único parcial aplicado: unique_principal_point");

  console.log("Hecho.");
}

main()
  .catch((e) => {
    console.error("Error aplicando restricción de punto principal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
