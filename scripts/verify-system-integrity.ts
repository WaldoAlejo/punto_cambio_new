#!/usr/bin/env tsx

/**
 * Script de verificación de integridad del sistema
 * Verifica que el frontend, backend y base de datos estén alineados
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

interface IntegrityCheck {
  name: string;
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
  details?: any;
}

class SystemIntegrityChecker {
  private checks: IntegrityCheck[] = [];

  private addCheck(check: IntegrityCheck) {
    this.checks.push(check);
    const icon =
      check.status === "PASS" ? "✅" : check.status === "FAIL" ? "❌" : "⚠️";
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (check.details) {
      console.log(`   Details:`, check.details);
    }
  }

  /**
   * Verifica conexión a la base de datos
   */
  async checkDatabaseConnection() {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      this.addCheck({
        name: "Database Connection",
        status: "PASS",
        message: "Conexión a la base de datos exitosa",
      });
    } catch (error) {
      this.addCheck({
        name: "Database Connection",
        status: "FAIL",
        message: "No se pudo conectar a la base de datos",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Verifica que las tablas principales existan
   */
  async checkRequiredTables() {
    const requiredTables = [
      "Usuario",
      "PuntoAtencion",
      "Moneda",
      "Saldo",
      "MovimientoSaldo",
      "CambioDivisa",
      "Transferencia",
      "Jornada",
      "SalidaEspontanea",
    ];

    try {
      for (const table of requiredTables) {
        const result = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) FROM "${table}" LIMIT 1`
        );

        this.addCheck({
          name: `Table ${table}`,
          status: "PASS",
          message: `Tabla ${table} existe y es accesible`,
        });
      }
    } catch (error) {
      this.addCheck({
        name: "Required Tables",
        status: "FAIL",
        message: "Error verificando tablas requeridas",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Verifica que existan usuarios administradores
   */
  async checkAdminUsers() {
    try {
      const adminCount = await prisma.usuario.count({
        where: {
          rol: { in: ["ADMIN", "SUPER_USUARIO"] },
          activo: true,
        },
      });

      if (adminCount === 0) {
        this.addCheck({
          name: "Admin Users",
          status: "FAIL",
          message: "No hay usuarios administradores activos",
        });
      } else {
        this.addCheck({
          name: "Admin Users",
          status: "PASS",
          message: `${adminCount} usuario(s) administrador(es) encontrado(s)`,
        });
      }
    } catch (error) {
      this.addCheck({
        name: "Admin Users",
        status: "FAIL",
        message: "Error verificando usuarios administradores",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Verifica que existan monedas configuradas
   */
  async checkCurrencies() {
    try {
      const currencyCount = await prisma.moneda.count({
        where: { activo: true },
      });

      if (currencyCount === 0) {
        this.addCheck({
          name: "Currencies",
          status: "WARNING",
          message: "No hay monedas configuradas",
        });
      } else {
        this.addCheck({
          name: "Currencies",
          status: "PASS",
          message: `${currencyCount} moneda(s) configurada(s)`,
        });
      }
    } catch (error) {
      this.addCheck({
        name: "Currencies",
        status: "FAIL",
        message: "Error verificando monedas",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Verifica que existan puntos de atención
   */
  async checkPoints() {
    try {
      const pointCount = await prisma.puntoAtencion.count({
        where: { activo: true },
      });

      if (pointCount === 0) {
        this.addCheck({
          name: "Points",
          status: "WARNING",
          message: "No hay puntos de atención configurados",
        });
      } else {
        this.addCheck({
          name: "Points",
          status: "PASS",
          message: `${pointCount} punto(s) de atención configurado(s)`,
        });
      }
    } catch (error) {
      this.addCheck({
        name: "Points",
        status: "FAIL",
        message: "Error verificando puntos de atención",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Verifica archivos críticos del frontend
   */
  checkFrontendFiles() {
    const criticalFiles = [
      "src/types/index.ts",
      "src/services/authService.ts",
      "src/services/apiService.ts",
      "src/hooks/useAuth.tsx",
      "src/constants/index.ts",
      "src/config/environment.ts",
    ];

    const projectRoot = path.resolve(__dirname, "..");

    for (const file of criticalFiles) {
      const filePath = path.join(projectRoot, file);
      if (fs.existsSync(filePath)) {
        this.addCheck({
          name: `Frontend File ${file}`,
          status: "PASS",
          message: `Archivo ${file} existe`,
        });
      } else {
        this.addCheck({
          name: `Frontend File ${file}`,
          status: "FAIL",
          message: `Archivo ${file} no encontrado`,
        });
      }
    }
  }

  /**
   * Verifica archivos críticos del backend
   */
  checkBackendFiles() {
    const criticalFiles = [
      "server/index.ts",
      "server/middleware/auth.ts",
      "server/middleware/validation.ts",
      "server/routes/auth.ts",
      "server/routes/users.ts",
      "server/routes/points.ts",
      "server/schemas/validation.ts",
    ];

    const projectRoot = path.resolve(__dirname, "..");

    for (const file of criticalFiles) {
      const filePath = path.join(projectRoot, file);
      if (fs.existsSync(filePath)) {
        this.addCheck({
          name: `Backend File ${file}`,
          status: "PASS",
          message: `Archivo ${file} existe`,
        });
      } else {
        this.addCheck({
          name: `Backend File ${file}`,
          status: "FAIL",
          message: `Archivo ${file} no encontrado`,
        });
      }
    }
  }

  /**
   * Verifica variables de entorno críticas
   */
  checkEnvironmentVariables() {
    const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET", "NODE_ENV"];

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        this.addCheck({
          name: `Environment Variable ${envVar}`,
          status: "PASS",
          message: `Variable ${envVar} está configurada`,
        });
      } else {
        this.addCheck({
          name: `Environment Variable ${envVar}`,
          status: "FAIL",
          message: `Variable ${envVar} no está configurada`,
        });
      }
    }
  }

  /**
   * Ejecuta todas las verificaciones
   */
  async runAllChecks() {
    console.log("🔍 Iniciando verificación de integridad del sistema...\n");

    // Verificaciones de base de datos
    console.log("📊 Verificando base de datos...");
    await this.checkDatabaseConnection();
    await this.checkRequiredTables();
    await this.checkAdminUsers();
    await this.checkCurrencies();
    await this.checkPoints();

    // Verificaciones de archivos
    console.log("\n📁 Verificando archivos del sistema...");
    this.checkFrontendFiles();
    this.checkBackendFiles();

    // Verificaciones de configuración
    console.log("\n⚙️ Verificando configuración...");
    this.checkEnvironmentVariables();

    // Resumen
    console.log("\n📋 RESUMEN DE VERIFICACIÓN:");
    const passCount = this.checks.filter((c) => c.status === "PASS").length;
    const failCount = this.checks.filter((c) => c.status === "FAIL").length;
    const warningCount = this.checks.filter(
      (c) => c.status === "WARNING"
    ).length;

    console.log(`✅ Exitosas: ${passCount}`);
    console.log(`❌ Fallidas: ${failCount}`);
    console.log(`⚠️ Advertencias: ${warningCount}`);

    if (failCount > 0) {
      console.log("\n🚨 ACCIÓN REQUERIDA:");
      this.checks
        .filter((c) => c.status === "FAIL")
        .forEach((check) => {
          console.log(`- ${check.name}: ${check.message}`);
        });
      process.exit(1);
    } else if (warningCount > 0) {
      console.log("\n⚠️ ADVERTENCIAS:");
      this.checks
        .filter((c) => c.status === "WARNING")
        .forEach((check) => {
          console.log(`- ${check.name}: ${check.message}`);
        });
    }

    console.log("\n🎉 Verificación de integridad completada!");
  }
}

// Ejecutar verificación si se llama directamente
if (require.main === module) {
  const checker = new SystemIntegrityChecker();
  checker
    .runAllChecks()
    .catch((error) => {
      console.error("❌ Error durante la verificación:", error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export { SystemIntegrityChecker };
