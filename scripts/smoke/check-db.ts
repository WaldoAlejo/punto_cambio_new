import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const now = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
    console.log("OK: DB reachable", { now: now?.[0]?.now });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("SMOKE_DB_FAILED", err);
  process.exit(1);
});
