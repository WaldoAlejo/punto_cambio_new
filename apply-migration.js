// Script para aplicar migración de agencias Servientrega
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log(
      "🔧 Aplicando migración para campos de agencia Servientrega..."
    );

    // Ejecutar SQL raw para agregar las columnas
    await prisma.$executeRaw`
      ALTER TABLE "PuntoAtencion" 
      ADD COLUMN IF NOT EXISTS "servientrega_agencia_codigo" TEXT,
      ADD COLUMN IF NOT EXISTS "servientrega_agencia_nombre" TEXT;
    `;

    console.log("✅ Migración aplicada correctamente");

    // Verificar que las columnas se agregaron
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'PuntoAtencion' 
      AND column_name IN ('servientrega_agencia_codigo', 'servientrega_agencia_nombre');
    `;

    console.log("📋 Columnas verificadas:", result);
  } catch (error) {
    console.error("❌ Error aplicando migración:", error);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
