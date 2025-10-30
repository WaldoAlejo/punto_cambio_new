-- Migration: Make ServientregaGuia remitente_id and destinatario_id optional
-- This allows guides to be created without requiring remitente/destinatario records upfront
-- Date: 2025-10-29

-- Drop the existing foreign key constraints
ALTER TABLE "ServientregaGuia" DROP CONSTRAINT IF EXISTS "ServientregaGuia_remitente_id_fkey";
ALTER TABLE "ServientregaGuia" DROP CONSTRAINT IF EXISTS "ServientregaGuia_destinatario_id_fkey";

-- Update the columns to allow NULL (they may already be nullable in the schema, but let's ensure it in the DB)
ALTER TABLE "ServientregaGuia" ALTER COLUMN "remitente_id" DROP NOT NULL;
ALTER TABLE "ServientregaGuia" ALTER COLUMN "destinatario_id" DROP NOT NULL;

-- Recreate the foreign key constraints with ON DELETE SET NULL for referential integrity
ALTER TABLE "ServientregaGuia" 
ADD CONSTRAINT "ServientregaGuia_remitente_id_fkey" 
FOREIGN KEY ("remitente_id") REFERENCES "ServientregaRemitente"("id") ON DELETE SET NULL;

ALTER TABLE "ServientregaGuia" 
ADD CONSTRAINT "ServientregaGuia_destinatario_id_fkey" 
FOREIGN KEY ("destinatario_id") REFERENCES "ServientregaDestinatario"("id") ON DELETE SET NULL;

-- Verify the changes
-- SELECT column_name, is_nullable, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'ServientregaGuia' 
-- AND column_name IN ('remitente_id', 'destinatario_id');