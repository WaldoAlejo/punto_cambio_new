import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Log helper que escribe a archivo y consola
const logOutput: string[] = [];
function log(msg: string) {
  console.log(msg);
  logOutput.push(msg);
}

interface ValidationReport {
  punto: string;
  moneda: string;
  saldoInicial: number;
  saldoEnBD: number;
  saldoFisico: number;
  saldoCalculado: number;
  billetes: number;
  monedas: number;
  diferencias: {
    bd_vs_fisico: number;
    bd_vs_calculado: number;
    fisico_vs_calculado: number;
  };
  estado: "✅ OK" | "⚠️ ADVERTENCIA" | "❌ ERROR";
  detalles: string[];
}

async function main() {
  log("\n=== VALIDACIÓN COMPREHENSIVE DE SALDOS ===\n");

  const reports: ValidationReport[] = [];

  const puntos = await prisma.puntoAtencion.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
  });

  const monedas = await prisma.moneda.findMany({
    where: { activo: true },
    select: { id: true, codigo: true, nombre: true },
  });

  for (const punto of puntos) {
    for (const moneda of monedas) {
      const detalles: string[] = [];
      let estado: "✅ OK" | "⚠️ ADVERTENCIA" | "❌ ERROR" = "✅ OK";

      // 1. Obtener saldo registrado en BD
      const saldoBD = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
          },
        },
      });

      const saldoEnBD = saldoBD ? Number(saldoBD.cantidad) : 0;
      const billetes = saldoBD ? Number(saldoBD.billetes) : 0;
      const monedas_val = saldoBD ? Number(saldoBD.monedas_fisicas) : 0;
      const saldoFisico = billetes + monedas_val;

      // 2. Obtener saldo inicial activo
      const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          activo: true,
        },
        orderBy: { fecha_asignacion: "desc" },
      });

      const saldoInicialCantidad = saldoInicial
        ? Number(saldoInicial.cantidad_inicial)
        : 0;

      // 3. Calcular saldo desde movimientos (EXCLUYENDO SALDO_INICIAL)
      const movimientos = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          tipo_movimiento: { not: "SALDO_INICIAL" },
        },
        orderBy: { fecha: "asc" },
      });

      let saldoCalculado = saldoInicialCantidad;
      for (const mov of movimientos) {
        const monto = Number(mov.monto);
        if (mov.tipo_movimiento === "EGRESO" || mov.tipo_movimiento === "TRANSFERENCIA_SALIENTE") {
          saldoCalculado -= Math.abs(monto);
        } else if (mov.tipo_movimiento === "INGRESO" || mov.tipo_movimiento === "TRANSFERENCIA_ENTRANTE" || mov.tipo_movimiento === "TRANSFERENCIA_DEVOLUCION") {
          saldoCalculado += Math.abs(monto);
        } else {
          saldoCalculado += monto;
        }
      }
      saldoCalculado = Number(saldoCalculado.toFixed(2));

      // 4. Validaciones
      const eps = 0.02;

      // Validación 1: BD cantidad vs Físico
      if (Math.abs(saldoEnBD - saldoFisico) > eps) {
        estado = "❌ ERROR";
        detalles.push(
          `❌ Mismatch: BD cantidad (${saldoEnBD.toFixed(2)}) ≠ Físico billetes+monedas (${saldoFisico.toFixed(2)}) | Diff: ${(saldoEnBD - saldoFisico).toFixed(2)}`
        );
      } else {
        detalles.push(
          `✅ BD cantidad = Físico: ${saldoEnBD.toFixed(2)}`
        );
      }

      // Validación 2: BD cantidad vs Calculado
      if (Math.abs(saldoEnBD - saldoCalculado) > eps) {
        if (estado !== "❌ ERROR") estado = "⚠️ ADVERTENCIA";
        detalles.push(
          `⚠️ Mismatch: BD cantidad (${saldoEnBD.toFixed(2)}) ≠ Calculado (${saldoCalculado.toFixed(2)}) | Diff: ${(saldoEnBD - saldoCalculado).toFixed(2)}`
        );
      } else {
        detalles.push(
          `✅ BD cantidad = Calculado: ${saldoEnBD.toFixed(2)}`
        );
      }

      // Validación 3: Físico vs Calculado
      if (Math.abs(saldoFisico - saldoCalculado) > eps) {
        if (estado !== "❌ ERROR") estado = "⚠️ ADVERTENCIA";
        detalles.push(
          `⚠️ Mismatch: Físico (${saldoFisico.toFixed(2)}) ≠ Calculado (${saldoCalculado.toFixed(2)}) | Diff: ${(saldoFisico - saldoCalculado).toFixed(2)}`
        );
      } else {
        detalles.push(
          `✅ Físico = Calculado: ${saldoFisico.toFixed(2)}`
        );
      }

      reports.push({
        punto: punto.nombre,
        moneda: moneda.codigo,
        saldoInicial: saldoInicialCantidad,
        saldoEnBD,
        saldoFisico,
        saldoCalculado,
        billetes,
        monedas: monedas_val,
        diferencias: {
          bd_vs_fisico: Number((saldoEnBD - saldoFisico).toFixed(2)),
          bd_vs_calculado: Number((saldoEnBD - saldoCalculado).toFixed(2)),
          fisico_vs_calculado: Number((saldoFisico - saldoCalculado).toFixed(2)),
        },
        estado,
        detalles,
      });
    }
  }

  // Mostrar reporte
  const fs = await import("fs");
  const reportLines: string[] = [];
  
  function addLine(msg: string) {
    console.log(msg);
    reportLines.push(msg);
  }

  addLine(
    "┌─────────────────────────────────────────────────────────────────────────────┐"
  );
  addLine(
    "│ REPORTE DE VALIDACIÓN DE SALDOS                                             │"
  );
  addLine(
    "└─────────────────────────────────────────────────────────────────────────────┘\n"
  );

  let erroresCount = 0;
  let advertenciasCount = 0;
  let okCount = 0;

  for (const report of reports) {
    if (report.estado === "❌ ERROR") erroresCount++;
    else if (report.estado === "⚠️ ADVERTENCIA") advertenciasCount++;
    else okCount++;

    addLine(`${report.estado} ${report.punto} | ${report.moneda}`);
    addLine(
      `   Inicial: $${report.saldoInicial.toFixed(2)} | BD: $${report.saldoEnBD.toFixed(2)} | Físico: $${report.saldoFisico.toFixed(2)} | Calculado: $${report.saldoCalculado.toFixed(2)}`
    );
    addLine(`   Desglose físico: ${report.billetes.toFixed(2)} billetes + ${report.monedas.toFixed(2)} monedas = ${report.saldoFisico.toFixed(2)}`);
    addLine(`   Diferencias:`);
    addLine(
      `     • BD vs Físico: ${report.diferencias.bd_vs_fisico > 0 ? "+" : ""}${report.diferencias.bd_vs_fisico.toFixed(2)}`
    );
    addLine(
      `     • BD vs Calculado: ${report.diferencias.bd_vs_calculado > 0 ? "+" : ""}${report.diferencias.bd_vs_calculado.toFixed(2)}`
    );
    addLine(
      `     • Físico vs Calculado: ${report.diferencias.fisico_vs_calculado > 0 ? "+" : ""}${report.diferencias.fisico_vs_calculado.toFixed(2)}`
    );
    for (const detalle of report.detalles) {
      addLine(`   ${detalle}`);
    }
    addLine("");
  }

  // Resumen
  addLine("\n=== RESUMEN ===");
  addLine(`✅ OK: ${okCount}`);
  addLine(`⚠️ ADVERTENCIAS: ${advertenciasCount}`);
  addLine(`❌ ERRORES: ${erroresCount}`);
  addLine(`TOTAL: ${reports.length}`);

  if (advertenciasCount > 0) {
    addLine("\n⚠️ ADVERTENCIAS ENCONTRADAS:");
    const advertencias = reports.filter((r) => r.estado === "⚠️ ADVERTENCIA");
    for (const a of advertencias) {
      addLine(`\n${a.punto} | ${a.moneda}:`);
      for (const detalle of a.detalles) {
        if (detalle.startsWith("⚠️")) addLine(`  ${detalle}`);
      }
    }
  }

  if (erroresCount > 0) {
    addLine("\n❌ ERRORES ENCONTRADOS:");
    const errores = reports.filter((r) => r.estado === "❌ ERROR");
    for (const e of errores) {
      addLine(`\n${e.punto} | ${e.moneda}:`);
      for (const detalle of e.detalles) {
        if (detalle.startsWith("❌")) addLine(`  ${detalle}`);
      }
    }
  }

  // Guardar reporte en archivo
  const reportFile = "validation-report-comprehensive.txt";
  fs.writeFileSync(reportFile, reportLines.join("\n"), "utf-8");
  addLine(`\n📄 Reporte completo guardado en: ${reportFile}`);

  await prisma.$disconnect();

  if (erroresCount > 0 || advertenciasCount > 0) {
    addLine("\n⚠️ NOTA: Revisa el archivo de reporte arriba para más detalles.");
    process.exitCode = advertenciasCount > 0 ? 0 : 1;
  }
}

main().catch((e) => {
  console.error("Error en validación:", e);
  process.exitCode = 1;
});
