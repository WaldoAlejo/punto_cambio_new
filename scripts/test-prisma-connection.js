import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

// Cargar variables de entorno
if (fs.existsSync(path.join(rootDir, ".env.production"))) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: path.join(rootDir, ".env.production") });
} else if (fs.existsSync(path.join(rootDir, ".env.local"))) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: path.join(rootDir, ".env.local") });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config({ path: path.join(rootDir, ".env") });
}

// Verificar que DATABASE_URL está definido
if (!process.env.DATABASE_URL) {
  console.error(
    "Error: DATABASE_URL no está definido en las variables de entorno"
  );
  process.exit(1);
}

console.log("Probando conexión a la base de datos con Prisma...");
console.log(
  `URL de conexión: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ":****@")}`
);

// Crear instancia de Prisma
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

async function testPrismaConnection() {
  try {
    console.log("Intentando conectar con Prisma...");

    // Probar una consulta simple para verificar la conexión
    console.log("Ejecutando consulta de prueba...");

    // Intentar obtener un usuario
    const userCount = await prisma.usuario.count();
    console.log(`✅ Consulta exitosa. Número de usuarios: ${userCount}`);

    // Obtener información de puntos de atención
    console.log("Obteniendo información de puntos de atención...");
    const pointCount = await prisma.puntoAtencion.count();
    console.log(`✅ Número de puntos de atención: ${pointCount}`);

    if (pointCount > 0) {
      const points = await prisma.puntoAtencion.findMany({
        select: {
          id: true,
          nombre: true,
          ciudad: true,
          activo: true,
        },
        take: 5,
      });

      console.log("Primeros 5 puntos de atención (o menos):");
      points.forEach((point, index) => {
        console.log(
          `  ${index + 1}. ${point.nombre} (${point.ciudad}) - ${
            point.activo ? "Activo" : "Inactivo"
          }`
        );
      });
    }

    // Obtener información de monedas
    console.log("Obteniendo información de monedas...");
    const currencyCount = await prisma.moneda.count();
    console.log(`✅ Número de monedas: ${currencyCount}`);

    if (currencyCount > 0) {
      const currencies = await prisma.moneda.findMany({
        select: {
          id: true,
          nombre: true,
          codigo: true,
          simbolo: true,
          activo: true,
        },
        take: 5,
      });

      console.log("Primeras 5 monedas (o menos):");
      currencies.forEach((currency, index) => {
        console.log(
          `  ${index + 1}. ${currency.nombre} (${currency.codigo}) - ${
            currency.simbolo
          } - ${currency.activo ? "Activa" : "Inactiva"}`
        );
      });
    }

    // Verificar modelos de Prisma
    console.log("\nVerificando modelos de Prisma...");
    const models = Object.keys(prisma).filter(
      (key) =>
        !key.startsWith("_") &&
        key !== "$connect" &&
        key !== "$disconnect" &&
        key !== "$on" &&
        key !== "$transaction" &&
        key !== "$use"
    );

    console.log(`✅ Modelos encontrados: ${models.length}`);
    console.log("Modelos:");
    models.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model}`);
    });

    console.log("\n✅ Todas las pruebas de Prisma completadas con éxito");
  } catch (err) {
    console.error("❌ Error al conectar a la base de datos con Prisma:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log("Conexión de Prisma cerrada");
  }
}

testPrismaConnection();
