import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "fs";

// Cargar variables de entorno según el entorno
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

// Configuración de la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  // Opcional: ajustar pool para evitar saturación
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PGPOOL_IDLE || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
});

// Verificar la conexión a la base de datos y fijar timeouts de sesión
pool.on("connect", (client) => {
  console.log("Conexión a la base de datos establecida correctamente");
  // Evita queries colgados indefinidamente
  const statementTimeoutMs = Number(
    process.env.DB_STATEMENT_TIMEOUT_MS || 8000
  );
  const idleInTxTimeoutMs = Number(process.env.DB_IDLE_TX_TIMEOUT_MS || 5000);
  client
    .query(
      `SET statement_timeout = ${statementTimeoutMs}; SET idle_in_transaction_session_timeout = ${idleInTxTimeoutMs};`
    )
    .catch((e) =>
      console.warn("No se pudo establecer timeouts de sesión en PG:", e.message)
    );
});

pool.on("error", (err) => {
  console.error("Error en la conexión a la base de datos:", err);
});

export { pool };
