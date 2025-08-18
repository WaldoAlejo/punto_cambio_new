// Script para verificar la configuración del servidor
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

// Función para cargar y mostrar variables de entorno
function loadAndShowEnv(envFile) {
  try {
    if (fs.existsSync(envFile)) {
      console.log(
        `\nCargando variables de entorno desde ${path.basename(envFile)}:`
      );
      const envContent = fs.readFileSync(envFile, "utf8");
      const envVars = dotenv.parse(envContent);

      // Mostrar variables ocultando información sensible
      Object.keys(envVars).forEach((key) => {
        let value = envVars[key];

        // Ocultar contraseñas y secretos
        if (
          key.toLowerCase().includes("password") ||
          key.toLowerCase().includes("secret") ||
          key.toLowerCase().includes("key")
        ) {
          value = "********";
        } else if (key === "DATABASE_URL") {
          value = value.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
        }

        console.log(`  ${key}=${value}`);
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error al cargar ${envFile}:`, error.message);
    return false;
  }
}

// Verificar archivos de entorno
console.log("=== VERIFICACIÓN DE ARCHIVOS DE ENTORNO ===");
const envFiles = [
  path.join(rootDir, ".env"),
  path.join(rootDir, ".env.local"),
  path.join(rootDir, ".env.production"),
];

let envFound = false;
for (const envFile of envFiles) {
  if (loadAndShowEnv(envFile)) {
    envFound = true;
  }
}

if (!envFound) {
  console.error("⚠️ No se encontró ningún archivo de variables de entorno");
}

// Verificar información del sistema
console.log("\n=== INFORMACIÓN DEL SISTEMA ===");
console.log(
  `Sistema operativo: ${os.type()} ${os.release()} (${os.platform()})`
);
console.log(`Arquitectura: ${os.arch()}`);
console.log(
  `Memoria total: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`
);
console.log(
  `Memoria libre: ${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB`
);
console.log(`CPUs: ${os.cpus().length}`);
console.log(`Hostname: ${os.hostname()}`);

// Verificar conectividad de red
console.log("\n=== VERIFICACIÓN DE CONECTIVIDAD ===");
try {
  console.log("Verificando conectividad a Google DNS (8.8.8.8)...");
  execSync("ping -c 2 8.8.8.8", { stdio: "inherit" });

  console.log("\nVerificando conectividad al servidor de base de datos...");
  const dbUrl = process.env.DATABASE_URL || "";
  const dbHost = dbUrl.match(/\/\/([^:]+):([^@]+)@([^:]+)/)?.[3];

  if (dbHost) {
    execSync(`ping -c 2 ${dbHost}`, { stdio: "inherit" });
  } else {
    console.error(
      "⚠️ No se pudo extraer el host de la base de datos de DATABASE_URL"
    );
  }
} catch (error) {
  console.error("⚠️ Error al verificar conectividad:", error.message);
}

// Verificar package.json
console.log("\n=== VERIFICACIÓN DE DEPENDENCIAS ===");
try {
  const packageJsonPath = path.join(rootDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    console.log(`Nombre del proyecto: ${packageJson.name}`);
    console.log(`Versión: ${packageJson.version}`);

    console.log("\nDependencias principales:");
    const mainDeps = ["express", "prisma", "@prisma/client", "pg", "dotenv"];
    mainDeps.forEach((dep) => {
      const version = packageJson.dependencies[dep];
      console.log(`  ${dep}: ${version || "No instalado"}`);
    });

    console.log("\nScripts disponibles:");
    Object.keys(packageJson.scripts)
      .slice(0, 10)
      .forEach((script) => {
        console.log(`  ${script}: ${packageJson.scripts[script]}`);
      });
  } else {
    console.error("⚠️ No se encontró el archivo package.json");
  }
} catch (error) {
  console.error("⚠️ Error al verificar package.json:", error.message);
}

// Verificar configuración de Prisma
console.log("\n=== VERIFICACIÓN DE PRISMA ===");
try {
  const prismaSchemaPath = path.join(rootDir, "prisma", "schema.prisma");
  if (fs.existsSync(prismaSchemaPath)) {
    const prismaSchema = fs.readFileSync(prismaSchemaPath, "utf8");

    // Extraer información del datasource
    const datasourceMatch = prismaSchema.match(/datasource\s+db\s+{([^}]+)}/s);
    if (datasourceMatch) {
      const datasource = datasourceMatch[1].trim();
      console.log("Configuración del datasource:");
      datasource.split("\n").forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith("//")) {
          console.log(`  ${trimmedLine}`);
        }
      });
    }

    // Contar modelos
    const modelCount = (prismaSchema.match(/model\s+\w+/g) || []).length;
    console.log(`\nTotal de modelos definidos: ${modelCount}`);

    // Listar algunos modelos
    const modelMatches = prismaSchema.match(/model\s+(\w+)/g) || [];
    if (modelMatches.length > 0) {
      console.log("Modelos encontrados (primeros 5):");
      modelMatches.slice(0, 5).forEach((model) => {
        console.log(`  ${model.replace("model ", "")}`);
      });
    }
  } else {
    console.error("⚠️ No se encontró el archivo schema.prisma");
  }
} catch (error) {
  console.error(
    "⚠️ Error al verificar configuración de Prisma:",
    error.message
  );
}

console.log("\n=== VERIFICACIÓN COMPLETADA ===");
console.log(
  "Ejecuta los scripts test-db-connection.js y test-prisma-connection.js para verificar la conexión a la base de datos."
);
