import { Pool } from "pg";

// ⚠️ NO cargar .env aquí - ya se cargó en server/index.ts
// Confiar en las variables que ya están en process.env

// Determinar si debemos usar SSL
// Usar SSL si:
// 1. NODE_ENV es production, o
// 2. La DATABASE_URL apunta a un servidor remoto (no localhost)
const databaseUrl = process.env.DATABASE_URL || "";
const isRemoteDatabase = !databaseUrl.includes("localhost") && 
                         !databaseUrl.includes("127.0.0.1") &&
                         !databaseUrl.includes("::1");

const shouldUseSSL = process.env.NODE_ENV === "production" || isRemoteDatabase;

// Configuración de la conexión a la base de datos
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseSSL ? { rejectUnauthorized: false } : false,
});

// Verificar la conexión a la base de datos
pool.on("connect", () => {
  console.log("Conexión a la base de datos establecida correctamente");
  console.log(`🔐 SSL: ${shouldUseSSL ? "Habilitado" : "Deshabilitado"}`);
});

pool.on("error", (err) => {
  console.error("Error en la conexión a la base de datos:", err);
});

export { pool };
