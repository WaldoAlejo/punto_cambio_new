// Script para probar la conexión a la base de datos
import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

// Cargar variables de entorno según el entorno
if (fs.existsSync(path.join(rootDir, ".env.local"))) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: path.join(rootDir, ".env.local") });
} else if (fs.existsSync(path.join(rootDir, ".env.production"))) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: path.join(rootDir, ".env.production") });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config({ path: path.join(rootDir, ".env") });
}

// Mostrar la URL de conexión (ocultando la contraseña)
const dbUrl = process.env.DATABASE_URL || "";
const sanitizedUrl = dbUrl.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
console.log(`Intentando conectar a: ${sanitizedUrl}`);

// Configuración de la conexión
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Probar la conexión
async function testConnection() {
  let client;
  try {
    console.log("Obteniendo cliente de conexión...");
    client = await pool.connect();
    console.log("Conexión establecida correctamente");

    console.log("Ejecutando consulta de prueba...");
    const result = await client.query(
      "SELECT NOW() as time, current_database() as database, version() as version"
    );
    console.log("Consulta ejecutada correctamente");
    console.log("Información del servidor:");
    console.log(`- Hora del servidor: ${result.rows[0].time}`);
    console.log(`- Base de datos: ${result.rows[0].database}`);
    console.log(`- Versión: ${result.rows[0].version}`);

    // Probar consulta a una tabla específica
    try {
      console.log("\nConsultando tabla de usuarios...");
      const usersResult = await client.query(
        'SELECT COUNT(*) as total FROM "Usuario"'
      );
      console.log(`Total de usuarios: ${usersResult.rows[0].total}`);
    } catch (err) {
      console.error("Error al consultar tabla de usuarios:", err.message);
    }

    try {
      console.log("\nConsultando tabla de puntos de atención...");
      const pointsResult = await client.query(
        'SELECT COUNT(*) as total FROM "PuntoAtencion"'
      );
      console.log(`Total de puntos de atención: ${pointsResult.rows[0].total}`);
    } catch (err) {
      console.error(
        "Error al consultar tabla de puntos de atención:",
        err.message
      );
    }
  } catch (err) {
    console.error("Error al conectar a la base de datos:");
    console.error(err);
  } finally {
    if (client) {
      console.log("Cerrando conexión...");
      client.release();
    }
    await pool.end();
    console.log("Pool de conexiones cerrado");
  }
}

testConnection();
