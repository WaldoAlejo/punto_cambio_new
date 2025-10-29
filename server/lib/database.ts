import { Pool } from "pg";

// ⚠️ NO cargar .env aquí - ya se cargó en server/index.ts
// Confiar en las variables que ya están en process.env

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
