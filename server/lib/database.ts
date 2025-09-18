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
});

// Verificar la conexión a la base de datos
pool.on("connect", () => {
  console.log("Conexión a la base de datos establecida correctamente");
});

pool.on("error", (err) => {
  console.error("Error en la conexión a la base de datos:", err);
});

export { pool };
