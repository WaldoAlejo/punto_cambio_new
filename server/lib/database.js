import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: "postgresql://postgres:Esh2ew8p@localhost:5432/punto_cambio",
  ssl: false
});

export { pool };