import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "fs";

// ===== Cargar variables de entorno =====
if (fs.existsSync(".env.local")) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: ".env.local" });
} else if (fs.existsSync(".env.production")) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: ".env.production" });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config();
}

// ===== Configuración de conexión =====
const statementTimeoutMs = Number(process.env.DB_STATEMENT_TIMEOUT_MS || 8000);
const idleInTxTimeoutMs = Number(process.env.DB_IDLE_TX_TIMEOUT_MS || 5000);
const connectionTimeoutMs = Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000);
const poolMax = Number(process.env.PGPOOL_MAX || 10);
const poolIdle = Number(process.env.PGPOOL_IDLE || 30000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: poolMax,
  idleTimeoutMillis: poolIdle,
  connectionTimeoutMillis: connectionTimeoutMs,
});

// ===== Eventos de conexión =====
pool.on("connect", (client) => {
  console.log("✅ Conexión a la base de datos establecida");
  client
    .query(
      `SET statement_timeout = ${statementTimeoutMs};
       SET idle_in_transaction_session_timeout = ${idleInTxTimeoutMs};`
    )
    .catch((e) =>
      console.warn(
        "⚠️ No se pudieron establecer timeouts en sesión PG:",
        e.message
      )
    );
});

pool.on("error", (err) => {
  console.error("❌ Error en la conexión a la base de datos:", err);
});

// ===== Monkey-patch seguro de query para loguear queries lentas =====
// El problema de TS venía de los overloads. Forzamos un tipo variádico seguro.
const origQueryAny = pool.query as unknown as (...args: any[]) => Promise<any>;

(pool as any).query = async (...args: any[]) => {
  const start = Date.now();
  try {
    const res = await origQueryAny(...args);
    const dur = Date.now() - start;
    if (dur > 2000) {
      // Log si la query tarda >2s
      const preview =
        typeof args[0] === "string"
          ? args[0].slice(0, 120).replace(/\s+/g, " ")
          : "";
      console.warn(
        `⏱️ Query lenta: ${dur}ms\nSQL: ${preview}${
          preview.length === 120 ? "..." : ""
        }`
      );
    }
    return res;
  } catch (err) {
    console.error("❌ Error ejecutando query:", err);
    throw err;
  }
};

export { pool };
