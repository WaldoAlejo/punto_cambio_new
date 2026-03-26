/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE VALIDACIÓN DEL FLUJO DE CIERRE E INICIO DE DÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este script valida:
 * 1. Zonas horarias (BD vs Servidor vs Local)
 * 2. Flujo de cierre de día (cuadre de caja)
 * 3. Flujo de inicio de día (apertura)
 * 4. Movimientos registrados correctamente
 * 
 * Uso: npx tsx scripts/validar-flujo-cierre-dia.ts [PUNTO_ATENCION_ID] [FECHA]
 * 
 * Ejemplo:
 *   npx tsx scripts/validar-flujo-cierre-dia.ts
 *   npx tsx scripts/validar-flujo-cierre-dia.ts 550e8400-e29b-41d4-a716-446655440000
 *   npx tsx scripts/validar-flujo-cierre-dia.ts 550e8400-e29b-41d4-a716-446655440000 2025-03-25
 */

import prisma from "../server/lib/prisma.js";
import { pool } from "../server/lib/database.js";
import { gyeDayRangeUtcFromDate, nowEcuador } from "../server/utils/timezone.js";

// Colores para output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(title: string, message?: string, type: "info" | "success" | "warning" | "error" = "info") {
  const color = type === "success" ? colors.green : type === "warning" ? colors.yellow : type === "error" ? colors.red : colors.cyan;
  console.log(`${color}${colors.bright}[${title}]${colors.reset} ${message || ""}`);
}

function logSection(title: string) {
  console.log("\n" + "═".repeat(70));
  console.log(`${colors.bright}${colors.blue}${title}${colors.reset}`);
  console.log("═".repeat(70));
}

function logSubSection(title: string) {
  console.log(`\n${colors.yellow}▶ ${title}${colors.reset}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. VALIDACIÓN DE ZONAS HORARIAS
// ═══════════════════════════════════════════════════════════════════════════
async function validarZonasHorarias() {
  logSection("1. VALIDACIÓN DE ZONAS HORARIAS");

  // Hora local del servidor
  const nowLocal = new Date();
  log("Hora Local Servidor", nowLocal.toISOString());
  log("Hora Local (toString)", nowLocal.toString());

  // Hora Ecuador (from timezone utils)
  const nowGye = nowEcuador();
  log("Hora Ecuador (nowEcuador)", nowGye.toISOString());
  log("Hora Ecuador (toString)", nowGye.toString());

  // Hora de la base de datos
  const dbTimeResult = await pool.query("SELECT NOW() as db_now");
  const dbNow = dbTimeResult.rows[0].db_now;
  log("Hora BD", dbNow.toISOString());

  // Verificar configuración de timezone en PostgreSQL
  const tzResult = await pool.query(`
    SELECT current_setting('timezone') as timezone_setting
  `);
  log("Timezone Setting", tzResult.rows[0].timezone_setting);

  // Calcular diferencias
  const diffMs = Math.abs(nowLocal.getTime() - new Date(dbNow).getTime());
  const diffMinutes = Math.round(diffMs / 60000);
  
  if (diffMinutes > 5) {
    log("⚠️ DIFERENCIA", `La hora del servidor y la BD difieren en ${diffMinutes} minutos`, "warning");
  } else {
    log("✅ SINCRONIZACIÓN", `Servidor y BD sincronizados (dif: ${diffMinutes} min)`, "success");
  }

  // Mostrar rango del día para Ecuador
  const today = new Date();
  const { gte, lt } = gyeDayRangeUtcFromDate(today);
  logSubSection("Rango de hoy (Ecuador) en UTC");
  log("Inicio (gte)", gte);
  log("Fin (lt)", lt);
  log("Fecha consultada", today.toISOString().split("T")[0]);

  return { nowLocal, nowGye, dbNow, dbTimezone: tzResult.rows[0].timezone_setting };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. VALIDACIÓN DE PUNTOS DE ATENCIÓN
// ═══════════════════════════════════════════════════════════════════════════
async function validarPuntosAtencion(puntoId?: string) {
  logSection("2. PUNTOS DE ATENCIÓN");

  const puntos = await prisma.puntoAtencion.findMany({
    where: puntoId ? { id: puntoId } : undefined,
    select: {
      id: true,
      nombre: true,
      activo: true,
      es_principal: true,
    },
    orderBy: { nombre: "asc" },
  });

  console.log(`\nTotal puntos: ${puntos.length}`);
  
  for (const punto of puntos) {
    const status = punto.activo ? colors.green + "✓ ACTIVO" : colors.red + "✗ INACTIVO";
    const principal = punto.es_principal ? colors.yellow + " [PRINCIPAL]" : "";
    console.log(`  ${status}${colors.reset} ${punto.nombre}${principal}${colors.reset}`);
    console.log(`     ID: ${punto.id}`);
  }

  return puntos;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. VALIDACIÓN DE MOVIMIENTOS POR FECHA Y PUNTO
// ═══════════════════════════════════════════════════════════════════════════
async function validarMovimientos(puntoAtencionId: string, fechaStr?: string) {
  logSection("3. VALIDACIÓN DE MOVIMIENTOS");

  // Determinar fecha a validar
  const fechaBase = fechaStr ? new Date(`${fechaStr}T00:00:00`) : nowEcuador();
  const fechaConsulta = fechaBase.toISOString().split("T")[0];
  
  log("Fecha consultada", fechaConsulta);
  log("Punto Atención ID", puntoAtencionId);

  const { gte, lt } = gyeDayRangeUtcFromDate(fechaBase);
  logSubSection("Rango UTC para consulta");
  log("Desde (gte)", gte);
  log("Hasta (lt)", lt);

  // Consultar movimientos de todas las fuentes
  logSubSection("Conteos por tipo de movimiento");

  // 1. Movimientos de Saldo
  const movimientosSaldo = await prisma.movimientoSaldo.count({
    where: {
      punto_atencion_id: puntoAtencionId,
      fecha: { gte: new Date(gte), lt: new Date(lt) },
    },
  });
  log("MovimientoSaldo", `${movimientosSaldo} registros`, movimientosSaldo > 0 ? "success" : "info");

  // 2. Cambios de Divisa
  const cambiosDivisa = await prisma.cambioDivisa.count({
    where: {
      punto_atencion_id: puntoAtencionId,
      fecha: { gte: new Date(gte), lt: new Date(lt) },
    },
  });
  log("CambioDivisa", `${cambiosDivisa} registros`, cambiosDivisa > 0 ? "success" : "info");

  // Detalle de cambios de divisa
  if (cambiosDivisa > 0) {
    const cambios = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: new Date(gte), lt: new Date(lt) },
      },
      include: {
        monedaOrigen: { select: { codigo: true } },
        monedaDestino: { select: { codigo: true } },
      },
      take: 5,
    });
    console.log("  Últimos cambios:");
    for (const c of cambios) {
      console.log(`    - ${c.numero_recibo}: ${c.monedaOrigen?.codigo} → ${c.monedaDestino?.codigo} ($${c.monto_origen})`);
    }
  }

  // 3. Transferencias
  const transferencias = await prisma.transferencia.count({
    where: {
      OR: [
        { origen_id: puntoAtencionId },
        { destino_id: puntoAtencionId },
      ],
      fecha: { gte: new Date(gte), lt: new Date(lt) },
      estado: { in: ["COMPLETADO", "APROBADO"] },
    },
  });
  log("Transferencias", `${transferencias} registros`, transferencias > 0 ? "success" : "info");

  // 4. Servicios Externos
  const serviciosExternos = await prisma.servicioExternoMovimiento.count({
    where: {
      punto_atencion_id: puntoAtencionId,
      fecha: { gte: new Date(gte), lt: new Date(lt) },
    },
  });
  log("ServicioExterno", `${serviciosExternos} registros`, serviciosExternos > 0 ? "success" : "info");

  // 5. Guías Servientrega
  const guiasServientrega = await prisma.servientregaGuia.count({
    where: {
      punto_atencion_id: puntoAtencionId,
      created_at: { gte: new Date(gte), lt: new Date(lt) },
      estado: { not: "CANCELADO" },
    },
  });
  log("ServientregaGuia", `${guiasServientrega} registros`, guiasServientrega > 0 ? "success" : "info");

  const totalMovimientos = movimientosSaldo + cambiosDivisa + transferencias + serviciosExternos + guiasServientrega;
  
  logSubSection("Resumen");
  log("TOTAL MOVIMIENTOS", `${totalMovimientos}`, totalMovimientos > 0 ? "success" : "warning");

  if (totalMovimientos === 0) {
    log("⚠️ ALERTA", "No se encontraron movimientos para esta fecha/punto", "warning");
    log("", "Esto explica por qué aparece 'Cierre sin Movimientos'", "warning");
  }

  return {
    fechaConsulta,
    rango: { gte, lt },
    conteos: {
      movimientosSaldo,
      cambiosDivisa,
      transferencias,
      serviciosExternos,
      guiasServientrega,
    },
    total: totalMovimientos,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. VALIDACIÓN DE CUADRE DE CAJA
// ═══════════════════════════════════════════════════════════════════════════
async function validarCuadreCaja(puntoAtencionId: string, fechaStr?: string) {
  logSection("4. VALIDACIÓN DE CUADRE DE CAJA");

  const fechaBase = fechaStr ? new Date(`${fechaStr}T00:00:00`) : nowEcuador();
  const { gte } = gyeDayRangeUtcFromDate(fechaBase);
  const fechaInicioDia = new Date(gte);

  // Buscar cuadre del día
  const cuadreResult = await pool.query(
    `SELECT * FROM "CuadreCaja"
     WHERE punto_atencion_id = $1
       AND fecha >= $2::timestamp
     ORDER BY fecha DESC
     LIMIT 1`,
    [puntoAtencionId, fechaInicioDia.toISOString()]
  );

  if (cuadreResult.rows.length === 0) {
    log("⚠️ SIN CUADRE", "No existe cuadre de caja para esta fecha", "warning");
    return null;
  }

  const cuadre = cuadreResult.rows[0];
  log("Cuadre encontrado", `ID: ${cuadre.id}`);
  log("Estado", cuadre.estado, cuadre.estado === "ABIERTO" ? "success" : "info");
  log("Fecha", cuadre.fecha);
  log("Fecha creación", cuadre.fecha_creacion || cuadre.created_at);
  
  if (cuadre.fecha_cierre) {
    log("Fecha cierre", cuadre.fecha_cierre);
  }

  // Buscar detalles del cuadre
  const detallesResult = await pool.query(
    `SELECT dc.*, m.codigo as moneda_codigo, m.nombre as moneda_nombre
     FROM "DetalleCuadreCaja" dc
     JOIN "Moneda" m ON dc.moneda_id = m.id::text
     WHERE dc.cuadre_id = $1::uuid`,
    [cuadre.id]
  );

  logSubSection("Detalles del cuadre");
  log("Total detalles", `${detallesResult.rows.length}`);

  if (detallesResult.rows.length === 0) {
    log("⚠️ SIN DETALLES", "El cuadre no tiene detalles de monedas", "warning");
    log("", "Esto causará que aparezca 'Cierre sin Movimientos'", "warning");
  } else {
    for (const detalle of detallesResult.rows) {
      console.log(`\n  ${colors.cyan}${detalle.moneda_codigo}${colors.reset}:`);
      console.log(`    Saldo Apertura: $${detalle.saldo_apertura}`);
      console.log(`    Saldo Cierre:   $${detalle.saldo_cierre}`);
      console.log(`    Conteo Físico:  $${detalle.conteo_fisico}`);
      console.log(`    Diferencia:     $${detalle.diferencia}`);
      console.log(`    Movimientos:    ${detalle.movimientos_periodo || 0}`);
    }
  }

  return { cuadre, detalles: detallesResult.rows };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. VALIDACIÓN DE SALDOS INICIALES
// ═══════════════════════════════════════════════════════════════════════════
async function validarSaldosIniciales(puntoAtencionId: string) {
  logSection("5. VALIDACIÓN DE SALDOS INICIALES");

  const saldos = await prisma.saldo.findMany({
    where: { punto_atencion_id: puntoAtencionId },
    include: { moneda: { select: { codigo: true, nombre: true } } },
  });

  if (saldos.length === 0) {
    log("⚠️ SIN SALDOS", "No hay registros de saldo para este punto", "warning");
    return [];
  }

  log("Total saldos", `${saldos.length}`);
  
  for (const saldo of saldos) {
    const cantidad = Number(saldo.cantidad);
    const tieneFondos = cantidad > 0;
    console.log(`\n  ${colors.cyan}${saldo.moneda?.codigo}${colors.reset}:`);
    console.log(`    Cantidad:  $${cantidad.toFixed(2)}`);
    console.log(`    Billetes:  $${Number(saldo.billetes || 0).toFixed(2)}`);
    console.log(`    Monedas:   $${Number(saldo.monedas_fisicas || 0).toFixed(2)}`);
    console.log(`    Bancos:    $${Number(saldo.bancos || 0).toFixed(2)}`);
    console.log(`    ${tieneFondos ? colors.green + "✓ Con fondos" : colors.yellow + "⚠ Sin fondos"}${colors.reset}`);
  }

  return saldos;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. VALIDACIÓN DE ÚLTIMO CIERRE
// ═══════════════════════════════════════════════════════════════════════════
async function validarUltimoCierre(puntoAtencionId: string) {
  logSection("6. ÚLTIMO CIERRE REALIZADO");

  const ultimoCierre = await pool.query(
    `SELECT * FROM "CuadreCaja"
     WHERE punto_atencion_id = $1
       AND estado = 'CERRADO'
     ORDER BY fecha_cierre DESC
     LIMIT 1`,
    [puntoAtencionId]
  );

  if (ultimoCierre.rows.length === 0) {
    log("⚠️ SIN CIERRES", "No hay cierres previos registrados", "warning");
    return null;
  }

  const cierre = ultimoCierre.rows[0];
  log("Último cierre", cierre.id);
  log("Fecha", cierre.fecha);
  log("Fecha cierre", cierre.fecha_cierre);
  log("Observaciones", cierre.observaciones || "(sin observaciones)");

  // Verificar detalles del cierre
  const detalles = await pool.query(
    `SELECT dc.*, m.codigo as moneda_codigo
     FROM "DetalleCuadreCaja" dc
     JOIN "Moneda" m ON dc.moneda_id = m.id::text
     WHERE dc.cuadre_id = $1::uuid`,
    [cierre.id]
  );

  log("Detalles en cierre", `${detalles.rows.length} monedas`);
  
  for (const d of detalles.rows) {
    console.log(`  ${d.moneda_codigo}: Conteo físico=$${d.conteo_fisico}, Diferencia=$${d.diferencia}`);
  }

  return cierre;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. SIMULACIÓN DE FLUJO DE CIERRE
// ═══════════════════════════════════════════════════════════════════════════
async function simularFlujoCierre(puntoAtencionId: string, fechaStr?: string) {
  logSection("7. SIMULACIÓN DE FLUJO DE CIERRE");

  const fechaBase = fechaStr ? new Date(`${fechaStr}T00:00:00`) : nowEcuador();
  const { gte, lt } = gyeDayRangeUtcFromDate(fechaBase);

  log("Paso 1: Verificar movimientos del día");
  
  // Contar movimientos como lo haría el endpoint
  const [
    movimientosSaldo,
    cambiosDivisa,
    transferencias,
    serviciosExternos,
    guiasServientrega,
  ] = await Promise.all([
    prisma.movimientoSaldo.count({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: new Date(gte), lt: new Date(lt) },
      },
    }),
    prisma.cambioDivisa.count({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: new Date(gte), lt: new Date(lt) },
      },
    }),
    prisma.transferencia.count({
      where: {
        OR: [
          { origen_id: puntoAtencionId },
          { destino_id: puntoAtencionId },
        ],
        fecha: { gte: new Date(gte), lt: new Date(lt) },
        estado: { in: ["COMPLETADO", "APROBADO"] },
      },
    }),
    prisma.servicioExternoMovimiento.count({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: new Date(gte), lt: new Date(lt) },
      },
    }),
    prisma.servientregaGuia.count({
      where: {
        punto_atencion_id: puntoAtencionId,
        created_at: { gte: new Date(gte), lt: new Date(lt) },
        estado: { not: "CANCELADO" },
      },
    }),
  ]);

  const totalMovimientos = movimientosSaldo + cambiosDivisa + transferencias + serviciosExternos + guiasServientrega;

  console.log(`  MovimientosSaldo: ${movimientosSaldo}`);
  console.log(`  CambioDivisa:     ${cambiosDivisa}`);
  console.log(`  Transferencias:   ${transferencias}`);
  console.log(`  ServiciosExt:     ${serviciosExternos}`);
  console.log(`  Guías Servi:      ${guiasServientrega}`);
  console.log(`  ─────────────────────────`);
  console.log(`  TOTAL:            ${totalMovimientos}`);

  if (totalMovimientos === 0) {
    log("\n❌ RESULTADO", "NO se mostrará formulario de conteo", "error");
    log("", "El endpoint retornará: detalles: []", "error");
    log("", "El frontend mostrará: 'Cierre sin Movimientos de Divisas'", "error");
    return false;
  }

  log("\n✅ RESULTADO", "SE mostrará formulario de conteo", "success");
  log("", "El endpoint procesará todas las monedas activas", "success");

  // Paso 2: Verificar si existe cuadre
  log("\nPaso 2: Verificar cuadre existente");
  const cuadreExistente = await pool.query(
    `SELECT * FROM "CuadreCaja"
     WHERE punto_atencion_id = $1
       AND fecha >= $2::timestamp
     ORDER BY fecha DESC
     LIMIT 1`,
    [puntoAtencionId, new Date(gte).toISOString()]
  );

  if (cuadreExistente.rows.length > 0) {
    const c = cuadreExistente.rows[0];
    log("Cuadre existente", `ID: ${c.id}, Estado: ${c.estado}`);
    
    if (c.estado === "CERRADO") {
      log("⚠️", "El día YA está cerrado", "warning");
    } else if (c.estado === "ABIERTO") {
      log("✅", "Hay un cuadre ABIERTO listo para cerrar", "success");
    }
  } else {
    log("ℹ️", "No existe cuadre, se creará uno nuevo", "info");
  }

  // Paso 3: Verificar monedas activas
  log("\nPaso 3: Monedas activas");
  const monedas = await prisma.moneda.findMany({
    where: { activo: true },
    orderBy: { orden_display: "asc" },
  });

  log("Total monedas activas", `${monedas.length}`);
  for (const m of monedas) {
    console.log(`  - ${m.codigo}: ${m.nombre}`);
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);
  const puntoIdArg = args[0];
  const fechaArg = args[1];

  console.log("\n" + "█".repeat(70));
  console.log("█" + " ".repeat(68) + "█");
  console.log("█" + "  VALIDACIÓN DE FLUJO DE CIERRE E INICIO DE DÍA".padStart(56) + " ".repeat(13) + "█");
  console.log("█" + " ".repeat(68) + "█");
  console.log("█".repeat(70));

  try {
    // 1. Validar zonas horarias
    await validarZonasHorarias();

    // 2. Validar puntos de atención
    const puntos = await validarPuntosAtencion(puntoIdArg);

    // Si no se especificó punto, terminar aquí
    if (!puntoIdArg) {
      log("\nℹ️ INFO", "Especifique un punto de atención para validar el flujo completo:", "info");
      console.log(`   npx tsx scripts/validar-flujo-cierre-dia.ts ${puntos[0]?.id || "[PUNTO_ID]"}`);
      process.exit(0);
    }

    // Validar que el punto existe
    const punto = puntos.find(p => p.id === puntoIdArg);
    if (!punto) {
      log("❌ ERROR", `Punto de atención no encontrado: ${puntoIdArg}`, "error");
      process.exit(1);
    }

    log("\n" + "─".repeat(70));
    log("VALIDANDO PUNTO", `${punto.nombre} (${punto.codigo})`);
    log("─".repeat(70));

    // 3. Validar movimientos
    const movimientos = await validarMovimientos(puntoIdArg, fechaArg);

    // 4. Validar cuadre de caja
    const cuadre = await validarCuadreCaja(puntoIdArg, fechaArg);

    // 5. Validar saldos iniciales
    await validarSaldosIniciales(puntoIdArg);

    // 6. Validar último cierre
    await validarUltimoCierre(puntoIdArg);

    // 7. Simular flujo de cierre
    await simularFlujoCierre(puntoIdArg, fechaArg);

    // RESUMEN FINAL
    logSection("RESUMEN FINAL");
    
    if (movimientos.total === 0) {
      log("⚠️ PROBLEMA DETECTADO", "No hay movimientos registrados", "warning");
      log("", "Posibles causas:", "warning");
      log("", "  1. La fecha consultada no tiene operaciones", "warning");
      log("", "  2. Problema de zona horaria (fecha guardada en UTC diferente)", "warning");
      log("", "  3. Los cambios de divisa no están registrando movimientos", "warning");
    } else if (!cuadre || cuadre.detalles.length === 0) {
      log("⚠️ PROBLEMA DETECTADO", "Hay movimientos pero el cuadre no tiene detalles", "warning");
      log("", "Esto puede indicar un problema en la creación del cuadre", "warning");
    } else {
      log("✅ FLUJO OK", "El flujo de cierre debería funcionar correctamente", "success");
    }

  } catch (error) {
    log("❌ ERROR FATAL", error instanceof Error ? error.message : String(error), "error");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
