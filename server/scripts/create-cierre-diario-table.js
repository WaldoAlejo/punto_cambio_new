import { pool } from "../lib/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createCierreDiarioTable() {
  try {
    console.log("Creando tabla CierreDiario...");

    const migrationSQL = `
-- Crear tabla CierreDiario para manejar los cierres diarios de cada punto de atención
CREATE TABLE IF NOT EXISTS "CierreDiario" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  punto_atencion_id UUID NOT NULL REFERENCES "PuntoAtencion"(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  observaciones TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  cerrado_por UUID REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  diferencias_reportadas JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint para evitar múltiples cierres para la misma fecha y punto
  UNIQUE(fecha, punto_atencion_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_cierre_diario_fecha ON "CierreDiario"(fecha);
CREATE INDEX IF NOT EXISTS idx_cierre_diario_punto ON "CierreDiario"(punto_atencion_id);
CREATE INDEX IF NOT EXISTS idx_cierre_diario_estado ON "CierreDiario"(estado);
CREATE INDEX IF NOT EXISTS idx_cierre_diario_fecha_punto ON "CierreDiario"(fecha, punto_atencion_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_cierre_diario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cierre_diario_updated_at ON "CierreDiario";
CREATE TRIGGER trigger_update_cierre_diario_updated_at
  BEFORE UPDATE ON "CierreDiario"
  FOR EACH ROW
  EXECUTE FUNCTION update_cierre_diario_updated_at();
    `;

    await pool.query(migrationSQL);
    console.log("✅ Tabla CierreDiario creada exitosamente");

    // Verificar que la tabla se creó correctamente
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'CierreDiario' 
      ORDER BY ordinal_position
    `);

    console.log("📋 Columnas de la tabla CierreDiario:");
    result.rows.forEach((row) => {
      console.log(
        `  - ${row.column_name}: ${row.data_type} (${
          row.is_nullable === "YES" ? "nullable" : "not null"
        })`
      );
    });
  } catch (error) {
    console.error("❌ Error creando tabla CierreDiario:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar la migración
createCierreDiarioTable()
  .then(() => {
    console.log("🎉 Migración completada exitosamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Error en la migración:", error);
    process.exit(1);
  });
