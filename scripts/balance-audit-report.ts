#!/usr/bin/env tsx

/**
 * Script de Auditoría de Balances
 *
 * Genera un reporte detallado de todos los movimientos que afectan los balances
 * de cada punto de atención y moneda, permitiendo identificar discrepancias
 * y entender el flujo de dinero en el sistema.
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://postgres:admin@localhost:5432/punto_cambio_new",
    },
  },
});

interface MovimientoAuditoria {
  fecha: Date;
  tipo: string;
  descripcion: string;
  monto: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  referencia_id?: string;
  referencia_tipo?: string;
  usuario?: string;
}

interface BalanceAuditoria {
  punto_atencion: string;
  punto_id: string;
  moneda: string;
  moneda_id: string;
  saldo_inicial: number;
  saldo_actual: number;
  saldo_calculado: number;
  diferencia: number;
  movimientos: MovimientoAuditoria[];
  resumen_por_tipo: Record<string, { cantidad: number; total: number }>;
}

async function generarReporteAuditoria() {
  console.log("📋 Generando reporte de auditoría de balances...\n");

  try {
    // Obtener todos los puntos y monedas
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    });

    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true },
    });

    const reporteCompleto: BalanceAuditoria[] = [];

    for (const punto of puntos) {
      console.log(`🏢 Procesando ${punto.nombre}...`);

      for (const moneda of monedas) {
        const auditoria: BalanceAuditoria = {
          punto_atencion: punto.nombre,
          punto_id: punto.id,
          moneda: moneda.codigo,
          moneda_id: moneda.id,
          saldo_inicial: 0,
          saldo_actual: 0,
          saldo_calculado: 0,
          diferencia: 0,
          movimientos: [],
          resumen_por_tipo: {},
        };

        // 1. Obtener saldo actual de la base de datos
        const saldoActual = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
            },
          },
        });

        auditoria.saldo_actual = saldoActual ? Number(saldoActual.cantidad) : 0;

        // 2. Obtener saldo inicial
        const saldoInicial = await prisma.saldoInicial.findFirst({
          where: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            activo: true,
          },
          orderBy: { fecha_asignacion: "desc" },
        });

        if (saldoInicial) {
          auditoria.saldo_inicial = Number(saldoInicial.cantidad_inicial);
          auditoria.saldo_calculado = auditoria.saldo_inicial;

          auditoria.movimientos.push({
            fecha: saldoInicial.fecha_asignacion,
            tipo: "SALDO_INICIAL",
            descripcion: `Saldo inicial asignado - ${
              saldoInicial.observaciones || ""
            }`,
            monto: auditoria.saldo_inicial,
            saldo_anterior: 0,
            saldo_nuevo: auditoria.saldo_inicial,
            referencia_id: saldoInicial.id,
            referencia_tipo: "SALDO_INICIAL",
          });
        }

        // 3. Obtener cambios de divisas donde este punto/moneda es origen (ingresos)
        const cambiosOrigen = await prisma.cambioDivisa.findMany({
          where: {
            punto_atencion_id: punto.id,
            moneda_origen_id: moneda.id,
          },
          include: {
            usuario: { select: { nombre: true } },
          },
          orderBy: { fecha: "asc" },
        });

        for (const cambio of cambiosOrigen) {
          const ingresoEfectivo = Number(cambio.usd_entregado_efectivo || 0);
          const ingresoTransfer = Number(cambio.usd_entregado_transfer || 0);
          const ingresoTotal = ingresoEfectivo + ingresoTransfer;

          if (ingresoTotal > 0) {
            const saldoAnterior = auditoria.saldo_calculado;
            auditoria.saldo_calculado += ingresoTotal;

            auditoria.movimientos.push({
              fecha: cambio.fecha,
              tipo: `CAMBIO_DIVISA_INGRESO_${cambio.tipo_operacion}`,
              descripcion: `${cambio.tipo_operacion} - Recibo: ${
                cambio.numero_recibo
              } (Efectivo: ${ingresoEfectivo.toLocaleString()}, Transfer: ${ingresoTransfer.toLocaleString()})`,
              monto: ingresoTotal,
              saldo_anterior: saldoAnterior,
              saldo_nuevo: auditoria.saldo_calculado,
              referencia_id: cambio.id,
              referencia_tipo: "CAMBIO_DIVISA",
              usuario: cambio.usuario.nombre,
            });
          }
        }

        // 4. Obtener cambios de divisas donde este punto/moneda es destino (egresos)
        const cambiosDestino = await prisma.cambioDivisa.findMany({
          where: {
            punto_atencion_id: punto.id,
            moneda_destino_id: moneda.id,
          },
          include: {
            usuario: { select: { nombre: true } },
            monedaDestino: { select: { codigo: true } },
          },
          orderBy: { fecha: "asc" },
        });

        for (const cambio of cambiosDestino) {
          let egresoTotal = 0;

          // Aplicar la lógica corregida para calcular egresos
          if (cambio.monedaDestino.codigo === "USD") {
            // Para USD, usar los campos específicos de USD
            const egresoEfectivo = Number(cambio.usd_entregado_efectivo || 0);
            const egresoTransfer = Number(cambio.usd_entregado_transfer || 0);
            egresoTotal = egresoEfectivo + egresoTransfer;
          } else {
            // Para otras monedas, usar divisas_recibidas_total_final
            egresoTotal = Number(cambio.divisas_recibidas_total_final || 0);
          }

          if (egresoTotal > 0) {
            const saldoAnterior = auditoria.saldo_calculado;
            auditoria.saldo_calculado -= egresoTotal;

            auditoria.movimientos.push({
              fecha: cambio.fecha,
              tipo: `CAMBIO_DIVISA_EGRESO_${cambio.tipo_operacion}`,
              descripcion: `${cambio.tipo_operacion} - Recibo: ${cambio.numero_recibo} (Entregado al cliente)`,
              monto: -egresoTotal,
              saldo_anterior: saldoAnterior,
              saldo_nuevo: auditoria.saldo_calculado,
              referencia_id: cambio.id,
              referencia_tipo: "CAMBIO_DIVISA",
              usuario: cambio.usuario.nombre,
            });
          }
        }

        // 5. Obtener transferencias salientes
        const transferenciasOut = await prisma.transferencia.findMany({
          where: {
            punto_origen_id: punto.id,
            moneda_id: moneda.id,
            estado: "COMPLETADA",
          },
          include: {
            puntoDestino: { select: { nombre: true } },
            usuarioSolicitante: { select: { nombre: true } },
          },
          orderBy: { fecha_solicitud: "asc" },
        });

        for (const transferencia of transferenciasOut) {
          const monto = Number(transferencia.monto);
          const saldoAnterior = auditoria.saldo_calculado;
          auditoria.saldo_calculado -= monto;

          auditoria.movimientos.push({
            fecha: transferencia.fecha_solicitud,
            tipo: "TRANSFERENCIA_SALIDA",
            descripcion: `Transferencia a ${
              transferencia.puntoDestino.nombre
            } - ${transferencia.observaciones || ""}`,
            monto: -monto,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: auditoria.saldo_calculado,
            referencia_id: transferencia.id,
            referencia_tipo: "TRANSFERENCIA",
            usuario: transferencia.usuarioSolicitante.nombre,
          });
        }

        // 6. Obtener transferencias entrantes
        const transferenciasIn = await prisma.transferencia.findMany({
          where: {
            punto_destino_id: punto.id,
            moneda_id: moneda.id,
            estado: "COMPLETADA",
          },
          include: {
            puntoOrigen: { select: { nombre: true } },
            usuarioSolicitante: { select: { nombre: true } },
          },
          orderBy: { fecha_solicitud: "asc" },
        });

        for (const transferencia of transferenciasIn) {
          const monto = Number(transferencia.monto);
          const saldoAnterior = auditoria.saldo_calculado;
          auditoria.saldo_calculado += monto;

          auditoria.movimientos.push({
            fecha: transferencia.fecha_solicitud,
            tipo: "TRANSFERENCIA_ENTRADA",
            descripcion: `Transferencia de ${
              transferencia.puntoOrigen.nombre
            } - ${transferencia.observaciones || ""}`,
            monto: monto,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: auditoria.saldo_calculado,
            referencia_id: transferencia.id,
            referencia_tipo: "TRANSFERENCIA",
            usuario: transferencia.usuarioSolicitante.nombre,
          });
        }

        // 7. Obtener operaciones de servicios externos
        const serviciosExternos =
          await prisma.servicioExternoOperacion.findMany({
            where: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
            },
            orderBy: { fecha: "asc" },
          });

        for (const servicio of serviciosExternos) {
          const monto = Number(servicio.monto);
          const saldoAnterior = auditoria.saldo_calculado;
          auditoria.saldo_calculado += monto;

          auditoria.movimientos.push({
            fecha: servicio.fecha,
            tipo: `SERVICIO_EXTERNO_${servicio.servicio}`,
            descripcion: `Comisión ${servicio.servicio} - ${
              servicio.descripcion || ""
            }`,
            monto: monto,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: auditoria.saldo_calculado,
            referencia_id: servicio.id,
            referencia_tipo: "SERVICIO_EXTERNO",
          });
        }

        // 8. Calcular diferencia y generar resumen por tipo
        auditoria.diferencia =
          auditoria.saldo_actual - auditoria.saldo_calculado;

        // Generar resumen por tipo de movimiento
        for (const movimiento of auditoria.movimientos) {
          if (!auditoria.resumen_por_tipo[movimiento.tipo]) {
            auditoria.resumen_por_tipo[movimiento.tipo] = {
              cantidad: 0,
              total: 0,
            };
          }
          auditoria.resumen_por_tipo[movimiento.tipo].cantidad++;
          auditoria.resumen_por_tipo[movimiento.tipo].total += movimiento.monto;
        }

        // Solo agregar al reporte si hay movimientos o saldo actual
        if (auditoria.movimientos.length > 0 || auditoria.saldo_actual !== 0) {
          reporteCompleto.push(auditoria);

          if (Math.abs(auditoria.diferencia) > 0.01) {
            console.log(
              `   ❌ ${
                moneda.codigo
              }: Diferencia de ${auditoria.diferencia.toLocaleString()}`
            );
          } else if (auditoria.saldo_actual > 0) {
            console.log(
              `   ✅ ${
                moneda.codigo
              }: ${auditoria.saldo_actual.toLocaleString()}`
            );
          }
        }
      }
    }

    // Generar archivo de reporte
    const fechaReporte = new Date().toISOString().split("T")[0];
    const nombreArchivo = `balance-audit-report-${fechaReporte}.json`;
    const rutaArchivo = join(process.cwd(), "reports", nombreArchivo);

    // Crear directorio de reportes si no existe
    try {
      const { mkdirSync } = await import("fs");
      mkdirSync(join(process.cwd(), "reports"), { recursive: true });
    } catch (error) {
      // El directorio ya existe
    }

    writeFileSync(rutaArchivo, JSON.stringify(reporteCompleto, null, 2));

    // Generar reporte CSV para Excel
    const csvLines = [
      "Punto,Moneda,Saldo_Inicial,Saldo_Actual,Saldo_Calculado,Diferencia,Total_Movimientos",
    ];

    for (const auditoria of reporteCompleto) {
      csvLines.push(
        [
          auditoria.punto_atencion,
          auditoria.moneda,
          auditoria.saldo_inicial.toFixed(2),
          auditoria.saldo_actual.toFixed(2),
          auditoria.saldo_calculado.toFixed(2),
          auditoria.diferencia.toFixed(2),
          auditoria.movimientos.length,
        ].join(",")
      );
    }

    const nombreArchivoCSV = `balance-audit-summary-${fechaReporte}.csv`;
    const rutaArchivoCSV = join(process.cwd(), "reports", nombreArchivoCSV);
    writeFileSync(rutaArchivoCSV, csvLines.join("\n"));

    // Mostrar resumen
    console.log("\n" + "=".repeat(80));
    console.log("📋 RESUMEN DEL REPORTE DE AUDITORÍA");
    console.log("=".repeat(80));

    const totalBalances = reporteCompleto.length;
    const balancesConDiferencias = reporteCompleto.filter(
      (b) => Math.abs(b.diferencia) > 0.01
    ).length;
    const totalMovimientos = reporteCompleto.reduce(
      (sum, b) => sum + b.movimientos.length,
      0
    );

    console.log(`📊 Total de balances analizados: ${totalBalances}`);
    console.log(`❌ Balances con diferencias: ${balancesConDiferencias}`);
    console.log(
      `📈 Total de movimientos procesados: ${totalMovimientos.toLocaleString()}`
    );
    console.log(`📁 Reporte detallado guardado en: ${rutaArchivo}`);
    console.log(`📊 Resumen CSV guardado en: ${rutaArchivoCSV}`);

    if (balancesConDiferencias > 0) {
      console.log("\n🚨 BALANCES CON DIFERENCIAS:");
      for (const auditoria of reporteCompleto) {
        if (Math.abs(auditoria.diferencia) > 0.01) {
          console.log(
            `   • ${auditoria.punto_atencion} - ${
              auditoria.moneda
            }: ${auditoria.diferencia.toLocaleString()}`
          );
          console.log(
            `     Actual: ${auditoria.saldo_actual.toLocaleString()}, Calculado: ${auditoria.saldo_calculado.toLocaleString()}`
          );
        }
      }
    }

    console.log("\n✅ Reporte de auditoría completado!");
  } catch (error) {
    console.error("❌ Error generando reporte de auditoría:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
if (import.meta.url === `file://${process.argv[1]}`) {
  generarReporteAuditoria().catch(console.error);
}

export { generarReporteAuditoria };
