// Script para probar la conexión a la base de datos usando Prisma
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

// Cargar variables de entorno según el entorno
if (fs.existsSync(path.join(rootDir, ".env.local"))) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: path.join(rootDir, ".env.local") });
} else if (fs.existsSync(path.join(rootDir, ".env.production"))) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: path.join(rootDir, ".env.production") });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config({ path: path.join(rootDir, ".env") });
}

// Mostrar la URL de conexión (ocultando la contraseña)
const dbUrl = process.env.DATABASE_URL || "";
const sanitizedUrl = dbUrl.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
console.log(`Intentando conectar a: ${sanitizedUrl}`);

// Crear instancia de Prisma con logs detallados
const prisma = new PrismaClient({
  log: [
    {
      emit: "event",
      level: "query",
    },
    {
      emit: "stdout",
      level: "error",
    },
    {
      emit: "stdout",
      level: "info",
    },
    {
      emit: "stdout",
      level: "warn",
    },
  ],
});

// Escuchar eventos de consulta para depuración
prisma.$on("query", (e) => {
  console.log("Consulta: " + e.query);
  console.log("Parámetros: " + e.params);
  console.log("Duración: " + e.duration + "ms");
});

// Probar la conexión
async function testPrismaConnection() {
  try {
    console.log("Probando conexión con Prisma...");

    // Consultar usuarios
    console.log("\nConsultando usuarios...");
    const userCount = await prisma.usuario.count();
    console.log(`Total de usuarios: ${userCount}`);

    if (userCount > 0) {
      const users = await prisma.usuario.findMany({
        take: 3,
        select: {
          id: true,
          username: true,
          nombre: true,
          rol: true,
          activo: true,
        },
      });
      console.log("Primeros usuarios:");
      users.forEach((user, index) => {
        console.log(
          `${index + 1}. ${user.nombre} (${user.username}) - Rol: ${
            user.rol
          }, Activo: ${user.activo}`
        );
      });
    }

    // Consultar puntos de atención
    console.log("\nConsultando puntos de atención...");
    const pointCount = await prisma.puntoAtencion.count();
    console.log(`Total de puntos de atención: ${pointCount}`);

    if (pointCount > 0) {
      const points = await prisma.puntoAtencion.findMany({
        take: 3,
        select: {
          id: true,
          nombre: true,
          ciudad: true,
          activo: true,
        },
      });
      console.log("Primeros puntos de atención:");
      points.forEach((point, index) => {
        console.log(
          `${index + 1}. ${point.nombre} (${point.ciudad}) - Activo: ${
            point.activo
          }`
        );
      });
    }

    // Consultar monedas
    console.log("\nConsultando monedas...");
    const currencyCount = await prisma.moneda.count();
    console.log(`Total de monedas: ${currencyCount}`);

    if (currencyCount > 0) {
      const currencies = await prisma.moneda.findMany({
        take: 5,
        select: {
          id: true,
          nombre: true,
          codigo: true,
          simbolo: true,
          activo: true,
        },
      });
      console.log("Monedas disponibles:");
      currencies.forEach((currency, index) => {
        console.log(
          `${index + 1}. ${currency.nombre} (${currency.codigo}) - Símbolo: ${
            currency.simbolo
          }, Activo: ${currency.activo}`
        );
      });
    }

    console.log("\nPrueba de conexión completada con éxito");
  } catch (error) {
    console.error("Error al conectar con Prisma:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
    console.log("Conexión de Prisma cerrada");
  }
}

testPrismaConnection();
