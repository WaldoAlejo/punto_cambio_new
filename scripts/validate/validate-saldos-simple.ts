import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();
const reportPath = "saldos-validation-report.txt";
const lines: string[] = [];

function write(msg: string) {
  console.log(msg);
  lines.push(msg);
}

async function main() {
  try {
    write("\n╔════════════════════════════════════════════════════════════╗");
    write("║         VALIDACIÓN DE SALDOS - REPORTE COMPLETO          ║");
    write("╚════════════════════════════════════════════════════════════╝\n");

    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    });

    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true },
    });

    write(`Puntos encontrados: ${puntos.length}`);
    write(`Monedas encontradas: ${monedas.length}\n`);

    let errorCount = 0;
    let okCount = 0;

    for (const punto of puntos) {
      for (const moneda of monedas) {
        // Obtener saldo
        const saldo = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
            },
          },
        });

        const saldoEnBD = saldo ? Number(saldo.cantidad) : 0;
        const billetes = saldo ? Number(saldo.billetes) : 0;
        const monedas_fisicas = saldo ? Number(saldo.monedas_fisicas) : 0;
        const saldoFisico = billetes + monedas_fisicas;

        // Validación
        const diff = Math.abs(saldoEnBD - saldoFisico);
        const eps = 0.02;

        if (diff <= eps && saldoEnBD === 0) {
          // Skip ceros
          continue;
        }

        if (diff > eps) {
          errorCount++;
          write(
            `❌ ${punto.nombre.padEnd(20)} | ${moneda.codigo} | BD: $${saldoEnBD.toFixed(2)} | Físico: $${saldoFisico.toFixed(2)} | DIFF: $${diff.toFixed(2)}`
          );
        } else {
          okCount++;
          write(
            `✅ ${punto.nombre.padEnd(20)} | ${moneda.codigo} | $${saldoEnBD.toFixed(2)} OK`
          );
        }
      }
    }

    write(`\n════════════════════════════════════════════════════════════`);
    write(`RESUMEN: ${okCount} OK | ${errorCount} ERRORES`);
    write(`════════════════════════════════════════════════════════════\n`);

    if (errorCount === 0) {
      write(`✅ TODOS LOS SALDOS SON CONSISTENTES\n`);
    } else {
      write(`⚠️ SE ENCONTRARON ${errorCount} INCONSISTENCIAS\n`);
      process.exitCode = 1;
    }

    // Escribir reporte a archivo
    fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
    write(`\n📄 Reporte guardado en: ${reportPath}`);
  } catch (error) {
    write(`\n❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
