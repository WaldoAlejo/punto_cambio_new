import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

// Cargar variables de entorno desde el root del proyecto
const rootDir = path.join(process.cwd());
if (fs.existsSync(path.join(rootDir, ".env.production"))) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: path.join(rootDir, ".env.production") });
} else if (fs.existsSync(path.join(rootDir, ".env.local"))) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: path.join(rootDir, ".env.local") });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config({ path: path.join(rootDir, ".env") });
}

// Prisma
const prisma = new PrismaClient({ log: ["warn", "error"] });

// Utilidades de zona horaria
// Importamos desde el backend para mantener una sola definición de "día GYE"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {
  gyeDayRangeUtcFromDate,
  todayGyeDateOnly,
} from "../server/utils/timezone.ts";

function subOneDay(date: Date): Date {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const now = new Date();
  const { gte, lt } = gyeDayRangeUtcFromDate(now);
  const todayGye = todayGyeDateOnly(now); // YYYY-MM-DD
  const yesterdayGye = todayGyeDateOnly(subOneDay(now));

  console.log("\n=== Backdate hoy -> ayer (GYE) ===");
  console.log({
    rangeUtc: { gte: gte.toISOString(), lt: lt.toISOString() },
    todayGye,
    yesterdayGye,
    mode: apply ? "APPLY" : "DRY-RUN",
  });

  type TableTask = {
    table: string;
    // columnas timestamp sin zona
    tsCols?: string[];
    // columnas DateOnly (tipo DATE)
    dateCols?: string[];
    // filtro adicional opcional
    extraWhere?: string;
  };

  // Tablas/columnas a ajustar
  const tasks: TableTask[] = [
    { table: '"CambioDivisa"', tsCols: ["fecha"] },
    {
      table: '"Transferencia"',
      tsCols: ["fecha", "fecha_aprobacion", "fecha_rechazo"],
    },
    { table: '"MovimientoSaldo"', tsCols: ["fecha"] },
    { table: '"HistorialSaldo"', tsCols: ["fecha"] },
    { table: '"Movimiento"', tsCols: ["fecha"] },
    { table: '"Recibo"', tsCols: ["fecha"] },
    { table: '"ServicioExternoMovimiento"', tsCols: ["fecha"] },
    { table: '"CuadreCaja"', tsCols: ["fecha", "fecha_cierre"] },
    { table: '"CierreDiario"', tsCols: ["fecha_cierre"], dateCols: ["fecha"] },
    { table: '"SalidaEspontanea"', tsCols: ["fecha_salida", "fecha_regreso"] },
  ];

  let totalCandidates = 0;
  let totalUpdated = 0;

  for (const t of tasks) {
    // 1) DRY-RUN: contar filas candidatas por cada columna
    type CountResult = { col: string; count: number };
    const counts: CountResult[] = [];

    if (t.tsCols?.length) {
      for (const col of t.tsCols) {
        const where =
          `${col} >= $1 AND ${col} < $2` +
          (t.extraWhere ? ` AND (${t.extraWhere})` : "");
        const sql = `SELECT COUNT(*)::int AS c FROM ${t.table} WHERE ${where}`;
        const rows = await prisma.$queryRawUnsafe<{ c: number }[]>(
          sql,
          gte,
          lt
        );
        counts.push({ col, count: rows[0]?.c ?? 0 });
      }
    }

    if (t.dateCols?.length) {
      for (const col of t.dateCols) {
        const where =
          `${col} = $1::date` + (t.extraWhere ? ` AND (${t.extraWhere})` : "");
        const sql = `SELECT COUNT(*)::int AS c FROM ${t.table} WHERE ${where}`;
        const rows = await prisma.$queryRawUnsafe<{ c: number }[]>(
          sql,
          todayGye
        );
        counts.push({ col, count: rows[0]?.c ?? 0 });
      }
    }

    const tableCandidates = counts.reduce((acc, x) => acc + x.count, 0);
    totalCandidates += tableCandidates;

    // 2) Mostrar ejemplo(s) por tabla
    console.log(`\nTabla ${t.table}:`);
    counts.forEach((x) => console.log(` - ${x.col}: ${x.count} filas`));

    if (!apply) {
      // sample por columna ts
      if (t.tsCols?.length) {
        for (const col of t.tsCols) {
          const sql = `SELECT id, ${col} FROM ${t.table} WHERE ${col} >= $1 AND ${col} < $2 ORDER BY ${col} ASC LIMIT 3`;
          const rows = await prisma.$queryRawUnsafe<any[]>(sql, gte, lt);
          rows.forEach((r) => {
            const before =
              r[col] instanceof Date
                ? (r[col] as Date).toISOString()
                : String(r[col]);
            const after =
              r[col] instanceof Date
                ? new Date(
                    (r[col] as Date).getTime() - 24 * 60 * 60 * 1000
                  ).toISOString()
                : before;
            console.log(`   · id=${r.id} ${col}: ${before} -> ${after}`);
          });
        }
      }
      // sample por columna date
      if (t.dateCols?.length) {
        for (const col of t.dateCols) {
          const sql = `SELECT id, ${col} FROM ${t.table} WHERE ${col} = $1::date ORDER BY ${col} ASC LIMIT 3`;
          const rows = await prisma.$queryRawUnsafe<any[]>(sql, todayGye);
          rows.forEach((r) => {
            const before = String(r[col]);
            console.log(`   · id=${r.id} ${col}: ${before} -> ${yesterdayGye}`);
          });
        }
      }
      continue;
    }

    // 3) APPLY: ejecutar updates por columnas
    let updatedForTable = 0;

    if (t.tsCols?.length) {
      for (const col of t.tsCols) {
        // Ajusta solo si está dentro del rango hoy (GYE)
        const sql =
          `UPDATE ${t.table} SET ${col} = ${col} - interval '1 day' WHERE ${col} >= $1 AND ${col} < $2` +
          (t.extraWhere ? ` AND (${t.extraWhere})` : "");
        const res = await prisma.$executeRawUnsafe(sql, gte, lt);
        updatedForTable += Number(res || 0);
      }
    }

    if (t.dateCols?.length) {
      for (const col of t.dateCols) {
        // Fecha tipo DATE: castea el resultado a date
        const sql =
          `UPDATE ${t.table} SET ${col} = (${col} - interval '1 day')::date WHERE ${col} = $1::date` +
          (t.extraWhere ? ` AND (${t.extraWhere})` : "");
        const res = await prisma.$executeRawUnsafe(sql, todayGye);
        updatedForTable += Number(res || 0);
      }
    }

    totalUpdated += updatedForTable;
    console.log(`   -> Actualizadas ${updatedForTable} filas en ${t.table}`);
  }

  console.log("\nResumen:");
  console.log(` - Candidatas totales: ${totalCandidates}`);
  if (apply) console.log(` - Actualizadas totales: ${totalUpdated}`);
}

main()
  .catch((e) => {
    console.error("❌ Error: ", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
