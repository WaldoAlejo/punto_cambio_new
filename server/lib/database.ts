import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.production" }); // Asegura cargarlo si estás en producción manual

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

export { pool };
