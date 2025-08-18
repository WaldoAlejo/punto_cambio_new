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
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: path.join(rootDir, ".env.production") });
} else if (fs.existsSync(path.join(rootDir, ".env.local"))) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: path.join(rootDir, ".env.local") });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config({ path: path.join(rootDir, ".env") });
}

// Verificar que DATABASE_URL está definido
if (!process.env.DATABASE_URL) {
  console.error(
    "Error: DATABASE_URL no está definido en las variables de entorno"
  );
  process.exit(1);
}

console.log("Probando conexión a la base de datos...");
console.log(
  `URL de conexión: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ":****@")}`
);

// Configuración de la conexión
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

async function testConnection() {
  let client;
  try {
    console.log("Intentando conectar...");
    client = await pool.connect();
    console.log("✅ Conexión exitosa a la base de datos");

    // Probar una consulta simple
    console.log("Ejecutando consulta de prueba...");
    const result = await client.query(
      "SELECT current_database() as db_name, current_user as user_name"
    );
    console.log(
      `✅ Consulta exitosa. Base de datos: ${result.rows[0].db_name}, Usuario: ${result.rows[0].user_name}`
    );

    // Obtener información del servidor
    console.log("Obteniendo información del servidor...");
    const serverInfo = await client.query("SELECT version()");
    console.log(`✅ Versión del servidor: ${serverInfo.rows[0].version}`);

    // Obtener estadísticas de conexiones
    console.log("Obteniendo estadísticas de conexiones...");
    const connectionStats = await client.query(`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    console.log(`✅ Conexiones activas: ${connectionStats.rows[0].count}`);

    // Verificar tablas existentes
    console.log("Verificando tablas existentes...");
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    if (tables.rows.length === 0) {
      console.log("⚠️ No se encontraron tablas en la base de datos");
    } else {
      console.log(`✅ Tablas encontradas: ${tables.rows.length}`);
      console.log("Tablas:");
      tables.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.table_name}`);
      });
    }

    console.log("\n✅ Todas las pruebas completadas con éxito");
  } catch (err) {
    console.error("❌ Error al conectar a la base de datos:", err);
    process.exit(1);
  } finally {
    if (client) {
      console.log("Cerrando conexión...");
      client.release();
    }
    await pool.end();
    console.log("Conexión cerrada");
  }
}

testConnection();
