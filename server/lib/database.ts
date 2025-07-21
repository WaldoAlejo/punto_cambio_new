import { Pool } from 'pg';

const pool = new Pool({
  connectionString: "postgresql://postgres:Esh2ew8p@localhost:5432/punto_cambio",
  ssl: false
});

export { pool };