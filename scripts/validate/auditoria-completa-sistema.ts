#!/usr/bin/env ts-node
/**
 * Auditoría Completa del Sistema
 * 
 * Este script verifica:
 * 1. Duplicados en cambios de divisa
 * 2. Duplicados en movimientos de saldo
 * 3. Integridad de saldos (saldo = billetes + monedas + bancos)
 * 4. Asignaciones de saldo correctas
 * 5. Transferencias huérfanas
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface AuditResult {
  modulo: string;
  estado: "OK" | "WARNING" | "ERROR";
  mensaje: string;
  detalles?: any[];
  count?: number;
}

const resultados: AuditResult[] = [];

// ============================================================================
// 1. DETECTAR DUPLICADOS EN CAMBIOS DE DIVISA
// ============================================================================
async function auditarCambiosDivisa() {
  console.log("\n🔍 Auditando Cambios de Divisa...");
  
  const cambios = await prisma.cambioDivisa.findMany({
    orderBy: { fecha: "asc" },
    select: {
      id: true,
      usuario_id: true,
      punto_atencion_id: true,
      moneda_origen_id: true,
      moneda_destino_id: true,
      monto_origen: true,
      monto_destino: true,
      fecha: true,
      numero_recibo: true,
    },
  });

  const grupos = new Map<string, typeof cambios>();
  
  for (const cambio of cambios) {
    const key = `${cambio.usuario_id}|${cambio.punto_atencion_id}|${cambio.moneda_origen_id}|${cambio.moneda_destino_id}|${cambio.monto_origen}|${cambio.monto_destino}|${cambio.fecha.toISOString().slice(0, 19)}`;
    
    if (!grupos.has(key)) {
      grupos.set(key, []);
    }
    grupos.get(key)!.push(cambio);
  }

  const duplicados: typeof cambios[] = [];
  for (const [key, items] of grupos) {
    if (items.length > 1) {
      duplicados.push(items);
    }
  }

  if (duplicados.length === 0) {
    resultados.push({
      modulo: "Cambios de Divisa",
      estado: "OK",
      mensaje: "No se encontraron cambios duplicados",
      count: 0,
    });
  } else {
    resultados.push({
      modulo: "Cambios de Divisa",
      estado: "ERROR",
      mensaje: `Se encontraron ${duplicados.length} grupos de cambios duplicados`,
      count: duplicados.length,
      detalles: duplicados.map(d => ({
        ids: d.map(c => c.id),
        recibos: d.map(c => c.numero_recibo),
        fecha: d[0].fecha,
      })),
    });
  }
}

// ============================================================================
// 2. DETECTAR DUPLICADOS EN MOVIMIENTOS DE SALDO
// ============================================================================
async function auditarMovimientosSaldo() {
  console.log("\n🔍 Auditando Movimientos de Saldo...");
  
  const movimientos = await prisma.movimientoSaldo.findMany({
    orderBy: { fecha: "asc" },
    select: {
      id: true,
      punto_atencion_id: true,
      moneda_id: true,
      tipo_movimiento: true,
      tipo_referencia: true,
      referencia_id: true,
      monto: true,
      fecha: true,
    },
  });

  const grupos = new Map<string, typeof movimientos>();
  
  for (const mov of movimientos) {
    // Agrupar por: punto + moneda + tipo + referencia + fecha (precisión de segundos)
    const key = `${mov.punto_atencion_id}|${mov.moneda_id}|${mov.tipo_movimiento}|${mov.tipo_referencia}|${mov.referencia_id || "null"}|${mov.monto}|${mov.fecha.toISOString().slice(0, 19)}`;
    
    if (!grupos.has(key)) {
      grupos.set(key, []);
    }
    grupos.get(key)!.push(mov);
  }

  const duplicados: typeof movimientos[] = [];
  for (const [key, items] of grupos) {
    if (items.length > 1) {
      duplicados.push(items);
    }
  }

  if (duplicados.length === 0) {
    resultados.push({
      modulo: "Movimientos de Saldo",
      estado: "OK",
      mensaje: "No se encontraron movimientos duplicados",
      count: 0,
    });
  } else {
    resultados.push({
      modulo: "Movimientos de Saldo",
      estado: "ERROR",
      mensaje: `Se encontraron ${duplicados.length} grupos de movimientos duplicados`,
      count: duplicados.length,
      detalles: duplicados.map(d => ({
        ids: d.map(m => m.id),
        tipo: d[0].tipo_movimiento,
        referencia: d[0].tipo_referencia,
        fecha: d[0].fecha,
      })),
    });
  }
}

// ============================================================================
// 3. VERIFICAR INTEGRIDAD DE SALDOS
// ============================================================================
async function auditarIntegridadSaldos() {
  console.log("\n🔍 Auditando Integridad de Saldos...");
  
  const saldos = await prisma.saldo.findMany({
    include: {
      moneda: { select: { codigo: true } },
      puntoAtencion: { select: { nombre: true } },
    },
  });

  const inconsistencias = [];

  for (const saldo of saldos) {
    const esperado = Number(saldo.billetes || 0) + Number(saldo.monedas_fisicas || 0) + Number(saldo.bancos || 0);
    const actual = Number(saldo.cantidad);
    
    if (Math.abs(esperado - actual) > 0.01) {
      inconsistencias.push({
        punto: saldo.puntoAtencion?.nombre,
        moneda: saldo.moneda?.codigo,
        saldo_id: saldo.id,
        cantidad_registrada: actual,
        billetes: Number(saldo.billetes || 0),
        monedas: Number(saldo.monedas_fisicas || 0),
        bancos: Number(saldo.bancos || 0),
        suma_real: esperado,
        diferencia: Math.abs(esperado - actual),
      });
    }
  }

  if (inconsistencias.length === 0) {
    resultados.push({
      modulo: "Integridad de Saldos",
      estado: "OK",
      mensaje: "Todos los saldos son consistentes",
      count: 0,
    });
  } else {
    resultados.push({
      modulo: "Integridad de Saldos",
      estado: "ERROR",
      mensaje: `Se encontraron ${inconsistencias.length} saldos inconsistentes`,
      count: inconsistencias.length,
      detalles: inconsistencias.slice(0, 10), // Mostrar solo los primeros 10
    });
  }
}

// ============================================================================
// 4. VERIFICAR ASIGNACIONES DE SALDO
// ============================================================================
async function auditarAsignacionesSaldo() {
  console.log("\n🔍 Auditando Asignaciones de Saldo...");
  
  // Obtener todas las asignaciones de saldo inicial
  const asignaciones = await prisma.saldoInicial.findMany({
    where: { activo: true },
    include: {
      moneda: { select: { codigo: true } },
      puntoAtencion: { select: { nombre: true } },
    },
    orderBy: { created_at: "asc" },
  });

  const problemas = [];

  for (const asignacion of asignaciones) {
    // Verificar que existe el saldo correspondiente
    const saldo = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: asignacion.punto_atencion_id,
          moneda_id: asignacion.moneda_id,
        },
      },
    });

    if (!saldo) {
      problemas.push({
        tipo: "SALDO_NO_ENCONTRADO",
        asignacion_id: asignacion.id,
        punto: asignacion.puntoAtencion?.nombre,
        moneda: asignacion.moneda?.codigo,
        mensaje: "Existe asignación pero no existe registro en tabla Saldo",
      });
    }
  }

  // Verificar saldos sin asignación inicial
  const saldosSinAsignacion = await prisma.saldo.findMany({
    where: {
      cantidad: { gt: 0 },
    },
    include: {
      moneda: { select: { codigo: true } },
      puntoAtencion: { select: { nombre: true } },
    },
  });

  for (const saldo of saldosSinAsignacion) {
    const asignacion = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: saldo.punto_atencion_id,
        moneda_id: saldo.moneda_id,
        activo: true,
      },
    });

    if (!asignacion) {
      problemas.push({
        tipo: "SALDO_SIN_ASIGNACION",
        saldo_id: saldo.id,
        punto: saldo.puntoAtencion?.nombre,
        moneda: saldo.moneda?.codigo,
        cantidad: saldo.cantidad,
        mensaje: "Existe saldo positivo pero no hay asignación inicial activa",
      });
    }
  }

  if (problemas.length === 0) {
    resultados.push({
      modulo: "Asignaciones de Saldo",
      estado: "OK",
      mensaje: "Todas las asignaciones son consistentes",
      count: 0,
    });
  } else {
    resultados.push({
      modulo: "Asignaciones de Saldo",
      estado: "WARNING",
      mensaje: `Se encontraron ${problemas.length} inconsistencias en asignaciones`,
      count: problemas.length,
      detalles: problemas.slice(0, 10),
    });
  }
}

// ============================================================================
// 5. VERIFICAR TRANSFERENCIAS HUÉRFANAS
// ============================================================================
async function auditarTransferencias() {
  console.log("\n🔍 Auditando Transferencias...");
  
  // Transferencias pendientes antiguas (más de 7 días)
  const hace7Dias = new Date();
  hace7Dias.setDate(hace7Dias.getDate() - 7);

  const transferenciasAntiguas = await prisma.transferencia.findMany({
    where: {
      estado: "PENDIENTE",
      fecha: { lt: hace7Dias },
    },
    select: {
      id: true,
      fecha: true,
      estado: true,
      monto: true,
      origen: { select: { nombre: true } },
      destino: { select: { nombre: true } },
    },
  });

  if (transferenciasAntiguas.length === 0) {
    resultados.push({
      modulo: "Transferencias",
      estado: "OK",
      mensaje: "No hay transferencias pendientes antiguas",
      count: 0,
    });
  } else {
    resultados.push({
      modulo: "Transferencias",
      estado: "WARNING",
      mensaje: `Hay ${transferenciasAntiguas.length} transferencias pendientes de más de 7 días`,
      count: transferenciasAntiguas.length,
      detalles: transferenciasAntiguas.map(t => ({
        id: t.id,
        fecha: t.fecha,
        origen: t.origen?.nombre,
        destino: t.destino?.nombre,
        monto: t.monto,
      })),
    });
  }
}

// ============================================================================
// 6. VERIFICAR RECIBOS HUÉRFANOS
// ============================================================================
async function auditarRecibos() {
  console.log("\n🔍 Auditando Recibos...");
  
  // Recibos que referencian cambios de divisa inexistentes
  const recibosConProblemas = await prisma.$queryRaw`
    SELECT r.id, r.numero_recibo, r.tipo_operacion, r.referencia_id, r.fecha
    FROM "Recibo" r
    LEFT JOIN "CambioDivisa" c ON r.referencia_id = c.id::text
    WHERE r.tipo_operacion = 'CAMBIO_DIVISA'
    AND c.id IS NULL
    LIMIT 100
  `;

  const problemas = recibosConProblemas as any[];

  if (problemas.length === 0) {
    resultados.push({
      modulo: "Recibos",
      estado: "OK",
      mensaje: "Todos los recibos referencian transacciones existentes",
      count: 0,
    });
  } else {
    resultados.push({
      modulo: "Recibos",
      estado: "WARNING",
      mensaje: `Se encontraron ${problemas.length} recibos huérfanos`,
      count: problemas.length,
      detalles: problemas.slice(0, 10),
    });
  }
}

// ============================================================================
// REPORTE FINAL
// ============================================================================
function imprimirReporte() {
  console.log("\n" + "=".repeat(80));
  console.log("📊 REPORTE DE AUDITORÍA DEL SISTEMA");
  console.log("=".repeat(80));

  const errores = resultados.filter(r => r.estado === "ERROR");
  const warnings = resultados.filter(r => r.estado === "WARNING");
  const ok = resultados.filter(r => r.estado === "OK");

  console.log(`\n✅ OK: ${ok.length}`);
  console.log(`⚠️  WARNING: ${warnings.length}`);
  console.log(`❌ ERROR: ${errores.length}`);

  console.log("\n" + "-".repeat(80));
  console.log("DETALLE POR MÓDULO:");
  console.log("-".repeat(80));

  for (const resultado of resultados) {
    const icono = resultado.estado === "OK" ? "✅" : resultado.estado === "WARNING" ? "⚠️" : "❌";
    console.log(`\n${icono} ${resultado.modulo}`);
    console.log(`   Estado: ${resultado.estado}`);
    console.log(`   Mensaje: ${resultado.mensaje}`);
    
    if (resultado.detalles && resultado.detalles.length > 0) {
      console.log(`   Detalles (${Math.min(resultado.detalles.length, 10)} de ${resultado.count}):`);
      console.log(JSON.stringify(resultado.detalles, null, 2).split("\n").map(l => "     " + l).join("\n"));
    }
  }

  console.log("\n" + "=".repeat(80));
  
  if (errores.length > 0) {
    console.log("🔴 ACCIÓN REQUERIDA: Se encontraron errores críticos que deben corregirse.");
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log("🟡 REVISIÓN SUGERIDA: Se encontraron advertencias que deberían revisarse.");
    process.exit(0);
  } else {
    console.log("✅ SISTEMA OK: No se encontraron problemas.");
    process.exit(0);
  }
}

// ============================================================================
// EJECUCIÓN PRINCIPAL
// ============================================================================
async function main() {
  console.log("🚀 Iniciando Auditoría Completa del Sistema...");
  console.log("Fecha:", new Date().toISOString());

  try {
    await auditarCambiosDivisa();
    await auditarMovimientosSaldo();
    await auditarIntegridadSaldos();
    await auditarAsignacionesSaldo();
    await auditarTransferencias();
    await auditarRecibos();

    imprimirReporte();
  } catch (error) {
    console.error("\n💥 Error durante la auditoría:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
