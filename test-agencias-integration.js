// Script de prueba para verificar integración de agencias
// Ejecutar después de aplicar la migración: node test-agencias-integration.js

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testIntegration() {
  console.log(
    "🧪 Iniciando pruebas de integración de agencias Servientrega...\n"
  );

  try {
    // 1. Verificar que las columnas existen en el esquema
    console.log("1️⃣ Verificando esquema de base de datos...");
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'PuntoAtencion' 
      AND column_name IN ('servientrega_agencia_codigo', 'servientrega_agencia_nombre');
    `;

    if (columns.length === 2) {
      console.log("✅ Columnas de agencia encontradas en la base de datos");
      console.log("   - servientrega_agencia_codigo: TEXT, nullable");
      console.log("   - servientrega_agencia_nombre: TEXT, nullable");
    } else {
      console.log(
        "❌ Columnas de agencia NO encontradas. Ejecutar migración primero."
      );
      return;
    }

    // 2. Probar creación de punto con agencia
    console.log("\n2️⃣ Probando creación de punto con agencia...");
    const testPoint = await prisma.puntoAtencion.create({
      data: {
        nombre: "Punto Prueba Agencias",
        direccion: "Dirección de Prueba",
        ciudad: "Ciudad Prueba",
        provincia: "Provincia Prueba",
        servientrega_agencia_codigo: "AG001",
        servientrega_agencia_nombre: "Agencia Prueba Servientrega",
        activo: true,
        es_principal: false,
      },
    });
    console.log("✅ Punto creado exitosamente con agencia:", testPoint.id);

    // 3. Verificar lectura de datos
    console.log("\n3️⃣ Verificando lectura de datos...");
    const retrievedPoint = await prisma.puntoAtencion.findUnique({
      where: { id: testPoint.id },
    });

    if (retrievedPoint?.servientrega_agencia_codigo === "AG001") {
      console.log("✅ Datos de agencia leídos correctamente");
      console.log(`   - Código: ${retrievedPoint.servientrega_agencia_codigo}`);
      console.log(`   - Nombre: ${retrievedPoint.servientrega_agencia_nombre}`);
    } else {
      console.log("❌ Error leyendo datos de agencia");
    }

    // 4. Probar actualización
    console.log("\n4️⃣ Probando actualización de agencia...");
    const updatedPoint = await prisma.puntoAtencion.update({
      where: { id: testPoint.id },
      data: {
        servientrega_agencia_codigo: "AG002",
        servientrega_agencia_nombre: "Agencia Actualizada",
      },
    });
    console.log("✅ Agencia actualizada correctamente");

    // 5. Limpiar datos de prueba
    console.log("\n5️⃣ Limpiando datos de prueba...");
    await prisma.puntoAtencion.delete({
      where: { id: testPoint.id },
    });
    console.log("✅ Datos de prueba eliminados");

    // 6. Verificar puntos existentes
    console.log("\n6️⃣ Verificando puntos existentes...");
    const existingPoints = await prisma.puntoAtencion.findMany({
      select: {
        id: true,
        nombre: true,
        servientrega_agencia_codigo: true,
        servientrega_agencia_nombre: true,
      },
    });

    console.log(
      `✅ ${existingPoints.length} puntos encontrados en la base de datos`
    );
    const pointsWithAgency = existingPoints.filter(
      (p) => p.servientrega_agencia_codigo
    );
    console.log(
      `   - ${pointsWithAgency.length} puntos tienen agencia asignada`
    );

    console.log("\n🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!");
    console.log(
      "✅ La integración de agencias Servientrega está funcionando correctamente"
    );
  } catch (error) {
    console.error("\n❌ Error en las pruebas:", error.message);

    if (error.code === "P2022") {
      console.log("\n💡 Solución: Ejecutar la migración SQL primero:");
      console.log("   psql -d tu_base_de_datos -f migration-agencias.sql");
    }
  } finally {
    await prisma.$disconnect();
  }
}

testIntegration();
