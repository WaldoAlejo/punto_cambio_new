import "dotenv/config";
import fs from "fs";
import path from "path";
import { Client } from "pg";

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.set(key, next);
        i++;
      } else {
        args.set(key, true);
      }
    } else {
      positional.push(a);
    }
  }

  return { args, positional };
}

async function main() {
  const { args, positional } = parseArgs(process.argv.slice(2));

  const file =
    (args.get("file") as string | undefined) ??
    positional[0] ??
    process.env.npm_config_file;

  const execute =
    Boolean(args.get("execute")) ||
    process.env.npm_config_execute === "true" ||
    process.env.EXECUTE === "true";

  if (!file) {
    throw new Error(
      "Missing --file <path>. Example: tsx scripts/db/apply-sql-file.ts --file server/migrations/2026-02-06-hardening-checks.sql"
    );
  }

  const abs = path.isAbsolute(file)
    ? file
    : path.join(process.cwd(), file.replaceAll("/", path.sep));

  const sql = fs.readFileSync(abs, "utf8");

  if (!execute) {
    console.log("DRY-RUN (no ejecutado). Para ejecutar usa --execute.");
    console.log("--- FILE:", abs);
    console.log(sql);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to execute SQL.");
  }

  const url = new URL(databaseUrl);
  const isLocalHost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";

  // Many managed Postgres instances require TLS; Prisma often negotiates this automatically,
  // but node-postgres needs explicit ssl configuration.
  const client = new Client({
    connectionString: databaseUrl,
    ...(isLocalHost
      ? {}
      : {
          ssl: {
            rejectUnauthorized: false,
          },
        }),
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK: SQL aplicado correctamente.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
