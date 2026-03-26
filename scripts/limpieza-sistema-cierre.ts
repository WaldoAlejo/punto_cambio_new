/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIMPIEZA DEL SISTEMA DE CIERRE DE CAJA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este script:
 * 1. Cierra cuadres abiertos de días anteriores
 * 2. Cierra jornadas activas sin apertura de caja
 * 3. Prepara el sistema para el nuevo flujo de apertura validada
 */

import prisma from "../server/lib/prisma.js";
import { pool } from "../server/lib/database.js";
import { nowEcuador, gyeDayRangeUtcFromDate } from "../server/utils/timezone.js";
import { EstadoJornada, EstadoApertura } from "@prisma/client";

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

// ═══════════════════════════════════════════════════════════════════════════
// 1. CERRAR CUADRES ABIERTOS ANTIGUOS
// ═══════════════════════════════════════════════════════════════════════════
async function cerrarCuadresAntiguos() {
  logSection("1. CERRANDO CUADRES ABIERTOS ANTIGUOS");

  const hoy = nowEcuador();
  const { gte } = gyeDayRangeUtcFromDate(hoy);

  // Buscar cuadres abiertos de días anteriores
  const cuadresAntiguos = await prisma.cuadreCaja.findMany({
    where: {
      estado: { in: ["ABIERTO", "PARCIAL"] },
      fecha: { lt: new Date(gte) },
    },
    include: {
      puntoAtencion: { select: { nombre: true } },
      detalles: true,
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`Cuadres antiguos encontrados: ${cuadresAntiguos.length}\n`);

  if (cuadresAntiguos.length === 0) {
    log("✅", "No hay cuadres antiguos para cerrar", "success");
    return 0;
  }

  let cerrados = 0;
  let errores = 0;

  for (const cuadre of cuadresAntiguos) {
    try {
      console.log(`Procesando: ${cuadre.puntoAtencion?.nombre} - ${cuadre.fecha.toISOString().split("T")[0]}`);

      // Si no tiene detalles, crearlos con saldo 0
      if (cuadre.detalles.length === 0) {
        console.log("  ⚠️ Sin detalles, creando detalles básicos...");
        
        const monedas = await prisma.moneda.findMany({ where: { activo: true } });
        for (const moneda of monedas) {
          await prisma.detalleCuadreCaja.create({
            data: {
              cuadre_id: cuadre.id,
              moneda_id: moneda.id,
              saldo_apertura: 0,
              saldo_cierre: 0,
              conteo_fisico: 0,
              diferencia: 0,
              billetes: 0,
              monedas_fisicas: 0,
              movimientos_periodo: 0,
            },
          });
        }
      }

      // Cerrar el cuadre
      await prisma.cuadreCaja.update({
        where: { id: cuadre.id },
        data: {
          estado: "CERRADO",
          fecha_cierre: new Date(),
          observaciones: (cuadre.observaciones || "") + " | Cerrado automáticamente por limpieza de sistema",
        },
      });

      console.log("  ✅ Cerrado\n");
      cerrados++;
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
      errores++;
    }
  }

  log("Resumen", `${cerrados} cerrados, ${errores} errores`, errores > 0 ? "warning" : "success");
  return cerrados;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. CERRAR JORNADAS ACTIVAS SIN APERTURA
// ═══════════════════════════════════════════════════════════════════════════
async function cerrarJornadasSinApertura() {
  logSection("2. CERRANDO JORNADAS ACTIVAS SIN APERTURA");

  // Buscar jornadas activas sin apertura
  const jornadasSinApertura = await prisma.jornada.findMany({
    where: {
      estado: { in: [EstadoJornada.ACTIVO, EstadoJornada.ALMUERZO] },
    },
    include: {
      usuario: { select: { nombre: true } },
      puntoAtencion: { select: { nombre: true } },
      apertura: true,
    },
  });

  const jornadasFiltradas = jornadasSinApertura.filter(j => !j.apertura);

  console.log(`Jornadas sin apertura: ${jornadasFiltradas.length}\n`);

  if (jornadasFiltradas.length === 0) {
    log("✅", "No hay jornadas sin apertura", "success");
    return 0;
  }

  // Mostrar algunas para confirmación
  console.log("Primeras 10 jornadas a cerrar:\n");
  jornadasFiltradas.slice(0, 10).forEach((j, i) => {
    console.log(`  ${i + 1}. ${j.usuario?.nombre} en ${j.puntoAtencion?.nombre}`);
    console.log(`     Inicio: ${j.fecha_inicio.toLocaleString("es-EC")}`);
  });

  if (jornadasFiltradas.length > 10) {
    console.log(`  ... y ${jornadasFiltradas.length - 10} más\n`);
  }

  let cerradas = 0;
  let errores = 0;

  for (const jornada of jornadasFiltradas) {
    try {
      await prisma.jornada.update({
        where: { id: jornada.id },
        data: {
          estado: EstadoJornada.COMPLETADO,
          fecha_salida: new Date(),
          observaciones: "Jornada cerrada automáticamente por limpieza de sistema (sin apertura de caja)",
        },
      });

      // Liberar punto del usuario
      await prisma.usuario.update({
        where: { id: jornada.usuario_id },
        data: { punto_atencion_id: null },
      });

      cerradas++;
    } catch (error) {
      console.log(`  ❌ Error cerrando jornada ${jornada.id}: ${error instanceof Error ? error.message : String(error)}`);
      errores++;
    }
  }

  log("Resumen", `${cerradas} cerradas, ${errores} errores`, errores > 0 ? "warning" : "success");
  return cerradas;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. CREAR APERTURAS PARA JORNADAS CON CUADRE PERO SIN APERTURA
// ═══════════════════════════════════════════════════════════════════════════
async function sincronizarAperturasConCuadres() {
  logSection("3. SINCRONIZANDO APERTURAS CON CUADRES EXISTENTES");

  // Buscar cuadres que no tengan apertura asociada
  const cuadresSinApertura = await prisma.cuadreCaja.findMany({
    where: {
      estado: "ABIERTO",
    },
    include: {
      puntoAtencion: true,
      usuario: { select: { nombre: true } },
    },
  });

  // Filtrar los que no tienen jornada con apertura
  const cuadresParaSincronizar = [];
  
  for (const cuadre of cuadresSinApertura) {
    const jornadaConApertura = await prisma.jornada.findFirst({
      where: {
        usuario_id: cuadre.usuario_id,
        punto_atencion_id: cuadre.punto_atencion_id,
        fecha_inicio: {
          gte: new Date(cuadre.fecha.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(cuadre.fecha.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        apertura: true,
      },
    });

    if (!jornadaConApertura?.apertura) {
      cuadresParaSincronizar.push(cuadre);
    }
  }

  console.log(`Cuadres sin apertura asociada: ${cuadresParaSincronizar.length}\n`);

  if (cuadresParaSincronizar.length === 0) {
    log("✅", "Todos los cuadres tienen apertura asociada", "success");
    return 0;
  }

  let creadas = 0;
  let errores = 0;

  for (const cuadre of cuadresParaSincronizar) {
    try {
      console.log(`Procesando cuadre: ${cuadre.puntoAtencion?.nombre} - ${cuadre.fecha.toISOString().split("T")[0]}`);

      // Buscar o crear jornada
      let jornada = await prisma.jornada.findFirst({
        where: {
          usuario_id: cuadre.usuario_id,
          punto_atencion_id: cuadre.punto_atencion_id,
          fecha_inicio: {
            gte: new Date(cuadre.fecha.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(cuadre.fecha.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      if (!jornada) {
        console.log("  Creando jornada...");
        jornada = await prisma.jornada.create({
          data: {
            usuario_id: cuadre.usuario_id,
            punto_atencion_id: cuadre.punto_atencion_id,
            fecha_inicio: cuadre.fecha,
            estado: EstadoJornada.ACTIVO,
          },
        });
      }

      // Crear apertura
      const detalles = await prisma.detalleCuadreCaja.findMany({
        where: { cuadre_id: cuadre.id },
      });

      const saldoEsperado = detalles.map(d => ({
        moneda_id: d.moneda_id,
        cantidad: d.saldo_apertura,
      }));

      const conteoFisico = detalles.map(d => ({
        moneda_id: d.moneda_id,
        total: d.conteo_fisico,
        billetes: [],
        monedas: [],
      }));

      await prisma.aperturaCaja.create({
        data: {
          jornada_id: jornada.id,
          usuario_id: cuadre.usuario_id,
          punto_atencion_id: cuadre.punto_atencion_id,
          fecha: cuadre.fecha,
          hora_inicio_conteo: cuadre.fecha,
          hora_fin_conteo: cuadre.fecha,
          hora_apertura: cuadre.fecha,
          estado: EstadoApertura.ABIERTA,
          saldo_esperado: saldoEsperado as any,
          conteo_fisico: conteoFisico as any,
          diferencias: [],
          requiere_aprobacion: false,
          observaciones: "Apertura creada automáticamente por sincronización con cuadre existente",
        },
      });

      console.log("  ✅ Apertura creada\n");
      creadas++;
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
      errores++;
    }
  }

  log("Resumen", `${creadas} creadas, ${errores} errores`, errores > 0 ? "warning" : "success");
  return creadas;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("\n" + "█".repeat(70));
  console.log("█" + " ".repeat(68) + "█");
  console.log("█" + "  LIMPIEZA DEL SISTEMA DE CIERRE DE CAJA".padStart(55) + " ".repeat(14) + "█");
  console.log("█" + " ".repeat(68) + "█");
  console.log("█".repeat(70));

  console.log("\n⚠️  Esta acción cerrará:");
  console.log("   - Cuadres abiertos de días anteriores");
  console.log("   - Jornadas activas sin apertura de caja");
  console.log("\n   Los operadores deberán iniciar jornada nuevamente con el nuevo flujo.\n");

  try {
    const cuadresCerrados = await cerrarCuadresAntiguos();
    const jornadasCerradas = await cerrarJornadasSinApertura();
    const aperturasCreadas = await sincronizarAperturasConCuadres();

    logSection("RESUMEN DE LIMPIEZA");
    console.log(`Cuadres antiguos cerrados: ${cuadresCerrados}`);
    console.log(`Jornadas sin apertura cerradas: ${jornadasCerradas}`);
    console.log(`Aperturas sincronizadas: ${aperturasCreadas}`);

    console.log("\n" + "─".repeat(70));
    console.log("✅ Limpieza completada.");
    console.log("\nEl sistema está listo para el nuevo flujo de apertura validada.");
    console.log("Los operadores deberán:");
    console.log("  1. Iniciar jornada nuevamente");
    console.log("  2. Completar apertura de caja con USD y EUR obligatorios");
    console.log("  3. Esperar aprobación si hay diferencias");
    console.log("─".repeat(70) + "\n");

  } catch (error) {
    log("❌ ERROR", error instanceof Error ? error.message : String(error), "error");
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
