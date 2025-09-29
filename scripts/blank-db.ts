// scripts/blank-db.ts
// DRY-RUN: npx tsx scripts/blank-db.ts
// REAL   : npx tsx scripts/blank-db.ts --yes
// Requiere: DATABASE_URL en .env

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- Config ---
const SCHEMA = process.env.DB_SCHEMA || "public"; // Postgres

// Tablas a conservar (nombres EXACTOS de Prisma + migrations)
const KEEP_ORIGINAL = [
  "Usuario",
  "PuntoAtencion",
  "ServientregaRemitente",
  "ServientregaDestinatario",
  "_prisma_migrations",
];

// Flag de confirmación
const YES_FLAG = process.argv.includes("--yes");

// --- Utils ---
function inferDialect(url?: string) {
  const u = (url || "").toLowerCase();
  if (u.startsWith("postgres://") || u.startsWith("postgresql://"))
    return "postgres";
  if (u.startsWith("mysql://") || u.startsWith("mysqls://")) return "mysql";
  if (u.startsWith("file:") || u.includes("sqlite")) return "sqlite";
  return "unknown";
}

// Normaliza solo para comparar (no para ejecutar)
function normName(name: string) {
  return name.replace(/["`[\]]/g, "").toLowerCase();
}

// Lista tablas devolviendo nombre original (respetar mayúsculas)
async function listTablesWithOriginal(dialect: string): Promise<string[]> {
  if (dialect === "postgres") {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = ${SCHEMA};
    `;
    return rows.map((r) => r.tablename);
  }

  if (dialect === "mysql") {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = DATABASE();
    `;
    return rows.map((r) => r.table_name);
  }

  if (dialect === "sqlite") {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';
    `;
    return rows.map((r) => r.name);
  }

  // Fallback (intenta Postgres y luego MySQL)
  try {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = ${SCHEMA};
    `;
    return rows.map((r) => r.tablename);
  } catch {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = DATABASE();
    `;
    return rows.map((r) => r.table_name);
  }
}

// Postgres: quote "schema"."Table"
function pgQualified(schema: string, table: string) {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return `${q(schema)}.${q(table)}`;
}

async function truncatePostgres(originalTables: string[]) {
  if (originalTables.length === 0) return;
  const qualified = originalTables
    .map((t) => pgQualified(SCHEMA, t))
    .join(", ");
  const sql = `TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE;`;
  await prisma.$executeRawUnsafe(sql);
}

async function truncateMySQL(originalTables: string[]) {
  if (originalTables.length === 0) return;
  await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=0;`);
  for (const t of originalTables) {
    await prisma.$executeRawUnsafe("TRUNCATE TABLE " + `\`${t}\`;`);
  }
  await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=1;`);
}

async function truncateSQLite(originalTables: string[]) {
  if (originalTables.length === 0) return;
  for (const t of originalTables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${t}";`);
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM sqlite_sequence WHERE name='${t.replace(/'/g, "''")}';`
      );
    } catch {
      /* noop */
    }
  }
}

async function main() {
  const dialect = inferDialect(process.env.DATABASE_URL);
  console.log(`🔎 Motor: ${dialect}`);
  if (dialect === "postgres") {
    console.log(`🔎 Esquema: ${SCHEMA}`);
  }

  const allOriginal = await listTablesWithOriginal(dialect);
  // Mapa original → normalizado
  const all = allOriginal.map((orig) => ({
    orig,
    norm: normName(orig),
  }));

  const keepSet = new Set(KEEP_ORIGINAL.map(normName));

  // Filtrar tablas del sistema típicas + las que queremos conservar
  const SYSTEM_PREFIXES = ["sqlite_", "pg_", "sql_"]; // por si acaso
  const toWipe = all
    .filter(
      (t) =>
        !SYSTEM_PREFIXES.some((p) => t.norm.startsWith(p)) &&
        !keepSet.has(t.norm)
    )
    .map((t) => t.orig);

  console.log("🧾 Tablas encontradas:", allOriginal.sort().join(", "));
  console.log("🛡️  Preservadas:", KEEP_ORIGINAL.join(", "));
  console.log(
    "🗑️  A limpiar:",
    toWipe.length ? toWipe.sort().join(", ") : "(ninguna)"
  );

  if (!YES_FLAG) {
    console.log("\n⚠️  DRY-RUN. No se ha borrado nada.");
    console.log("👉 Ejecuta con --yes para proceder realmente.");
    return;
  }

  console.log("\n⏳ Limpiando…");
  if (dialect === "postgres") await truncatePostgres(toWipe);
  else if (dialect === "mysql") await truncateMySQL(toWipe);
  else if (dialect === "sqlite") await truncateSQLite(toWipe);
  else {
    // fallback: prueba Postgres y luego MySQL
    try {
      await truncatePostgres(toWipe);
    } catch {
      await truncateMySQL(toWipe);
    }
  }
  console.log("✅ Listo. BD blanqueada (tablas preservadas intactas).");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
