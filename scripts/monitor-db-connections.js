import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

// Cargar variables de entorno
if (fs.existsSync(path.join(rootDir, ".env.production"))) {
  dotenv.config({ path: path.join(rootDir, ".env.production") });
} else {
  dotenv.config({ path: path.join(rootDir, ".env") });
}

// Configuración de la conexión
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

async function monitorConnections() {
  let client;
  try {
    client = await pool.connect();

    // Consultar conexiones activas
    const activeConnections = await client.query(`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);

    console.log(`Conexiones activas: ${activeConnections.rows[0].count}`);

    // Consultar conexiones por aplicación
    const connectionsByApp = await client.query(`
      SELECT application_name, count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database() 
      GROUP BY application_name 
      ORDER BY count DESC
    `);

    console.log("Conexiones por aplicación:");
    connectionsByApp.rows.forEach((row) => {
      console.log(`- ${row.application_name || "Sin nombre"}: ${row.count}`);
    });

    // Consultar conexiones inactivas por más de 1 hora
    const idleConnections = await client.query(`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database() 
      AND state = 'idle' 
      AND (now() - state_change) > interval '1 hour'
    `);

    console.log(
      `Conexiones inactivas por más de 1 hora: ${idleConnections.rows[0].count}`
    );

    // Si hay más de 50 conexiones, terminar las inactivas por más de 1 hora
    if (
      parseInt(activeConnections.rows[0].count) > 50 &&
      parseInt(idleConnections.rows[0].count) > 0
    ) {
      console.log("Terminando conexiones inactivas...");
      await client.query(`
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = current_database() 
        AND state = 'idle' 
        AND (now() - state_change) > interval '1 hour'
      `);
      console.log("Conexiones inactivas terminadas");
    }
  } catch (err) {
    console.error("Error al monitorear conexiones:", err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

monitorConnections();
