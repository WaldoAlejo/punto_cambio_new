/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE REBASIFICACIÓN CONTROLADA DE SALDOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este script permite establecer un nuevo "punto cero" para los saldos de
 * caja en todos los puntos de atención, SIN borrar el historial de movimientos.
 *
 * Flujo:
 *   1. Generar plantilla JSON con los saldos actuales del sistema
 *   2. El usuario edita el JSON con los conteos físicos reales
 *   3. Aplicar la re-basificación (modo dry-run por defecto)
 *
 * MODO DRY-RUN (por defecto):
 *   Solo muestra lo que haría, no toca la base de datos.
 *
 * MODO EJECUCIÓN:
 *   Agregar la flag --execute
 *
 * USO:
 *   # Generar plantilla
 *   npx tsx scripts/rebasificacion-saldos.ts --generar-plantilla --output conteos.json
 *
 *   # Aplicar re-basificación (preview)
 *   npx tsx scripts/rebasificacion-saldos.ts --aplicar conteos.json --usuario-id <ADMIN_ID>
 *
 *   # Aplicar re-basificación (real)
 *   npx tsx scripts/rebasificacion-saldos.ts --aplicar conteos.json --usuario-id <ADMIN_ID> --execute
 *
 * SEGURIDAD:
 *   - Requiere ID de usuario ADMIN o SUPER_USUARIO
 *   - Transacción por punto de atención (si falla uno, los demás se aplican)
 *   - Preserva: MovimientoSaldo, AsignacionSaldo, Servientrega*, CambioDivisa, Transferencia
 *   - Solo modifica: SaldoInicial, Saldo, HistorialSaldo
 */

import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient({
  log: process.argv.includes("--verbose") ? ["query", "info", "warn", "error"] : [],
});

// ───────────────────────────────────────────────────────────────────────────
// Tipos
// ───────────────────────────────────────────────────────────────────────────

interface ConteoMoneda {
  moneda_id: string;
  codigo: string;
  conteo_fisico: number;
  billetes?: number;
  monedas_fisicas?: number;
  observaciones?: string;
}

interface ConteoPunto {
  punto_atencion_id: string;
  punto_nombre: string;
  monedas: ConteoMoneda[];
  observaciones?: string;
}

interface PlantillaRebasificacion {
  generado_el: string;
  notas: string;
  conteos: ConteoPunto[];
}

interface ResultadoRebasificacion {
  punto_atencion_id: string;
  punto_nombre: string;
  exito: boolean;
  monedas_procesadas: number;
  errores: string[];
  detalle: {
    moneda_id: string;
    codigo: string;
    saldo_inicial_anterior: number;
    saldo_inicial_nuevo: number;
    saldo_actualizado: number;
  }[];
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = process.argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ───────────────────────────────────────────────────────────────────────────
// Modo: Generar plantilla
// ───────────────────────────────────────────────────────────────────────────

async function generarPlantilla(outputPath: string): Promise<void> {
  console.log("📋 GENERANDO PLANTILLA DE REBASIFICACIÓN\n");

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

  const conteos: ConteoPunto[] = [];

  for (const punto of puntos) {
    const monedasPunto: ConteoMoneda[] = [];

    for (const moneda of monedas) {
      // Obtener saldo actual del sistema
      const saldo = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
          },
        },
        select: { cantidad: true, billetes: true, monedas_fisicas: true },
      });

      const cantidad = Number(saldo?.cantidad ?? 0);

      monedasPunto.push({
        moneda_id: moneda.id,
        codigo: moneda.codigo,
        conteo_fisico: round2(cantidad),
        billetes: round2(Number(saldo?.billetes ?? cantidad)),
        monedas_fisicas: round2(Number(saldo?.monedas_fisicas ?? 0)),
        observaciones: cantidad === 0 ? "Sin saldo en sistema" : undefined,
      });
    }

    conteos.push({
      punto_atencion_id: punto.id,
      punto_nombre: punto.nombre,
      monedas: monedasPunto,
    });
  }

  const plantilla: PlantillaRebasificacion = {
    generado_el: new Date().toISOString(),
    notas:
      "INSTRUCCIONES: Edita 'conteo_fisico' con el conteo físico real de cada moneda. " +
      "Deja en 0 las monedas que no tengas físicamente. " +
      "No borres entradas. No modifiques los IDs. " +
      "Cuando termines, guarda y ejecuta con --aplicar.",
    conteos,
  };

  const fullPath = path.resolve(outputPath);
  fs.writeFileSync(fullPath, JSON.stringify(plantilla, null, 2), "utf-8");

  console.log(`✅ Plantilla generada: ${fullPath}`);
  console.log(`   📍 Puntos: ${puntos.length}`);
  console.log(`   💱 Monedas por punto: ${monedas.length}`);
  console.log(`   📝 Total entradas: ${puntos.length * monedas.length}`);
  console.log(`\n🖊️  Edita los conteos físicos y luego ejecuta:`);
  console.log(`   npx tsx scripts/rebasificacion-saldos.ts --aplicar ${outputPath} --usuario-id <ID_ADMIN>`);
}

// ───────────────────────────────────────────────────────────────────────────
// Validar usuario admin
// ───────────────────────────────────────────────────────────────────────────

async function validarAdmin(usuarioId: string): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nombre: true, rol: true, activo: true },
  });

  if (!usuario) {
    throw new Error(`Usuario con ID "${usuarioId}" no encontrado.`);
  }
  if (!usuario.activo) {
    throw new Error(`Usuario "${usuario.nombre}" está inactivo.`);
  }
  if (!["ADMIN", "SUPER_USUARIO"].includes(usuario.rol)) {
    throw new Error(
      `Usuario "${usuario.nombre}" tiene rol "${usuario.rol}". ` +
        `Se requiere ADMIN o SUPER_USUARIO.`
    );
  }

  console.log(`🔐 Administrador validado: ${usuario.nombre} (${usuario.rol})\n`);
}

// ───────────────────────────────────────────────────────────────────────────
// Aplicar re-basificación para un punto/moneda
// ───────────────────────────────────────────────────────────────────────────

async function rebasificarMoneda(
  tx: Prisma.TransactionClient,
  puntoId: string,
  puntoNombre: string,
  conteo: ConteoMoneda,
  usuarioId: string,
  execute: boolean
): Promise<{ exito: boolean; detalle?: ResultadoRebasificacion["detalle"][0]; error?: string }> {
  const conteoFisico = round2(conteo.conteo_fisico);
  const billetes = round2(conteo.billetes ?? conteoFisico);
  const monedasFisicas = round2(conteo.monedas_fisicas ?? 0);

  // 1. Obtener SaldoInicial activo anterior
  const saldoInicialAnterior = await tx.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoId,
      moneda_id: conteo.moneda_id,
      activo: true,
    },
    select: { id: true, cantidad_inicial: true },
  });

  const cantidadInicialAnterior = Number(saldoInicialAnterior?.cantidad_inicial ?? 0);

  if (!execute) {
    return {
      exito: true,
      detalle: {
        moneda_id: conteo.moneda_id,
        codigo: conteo.codigo,
        saldo_inicial_anterior: cantidadInicialAnterior,
        saldo_inicial_nuevo: conteoFisico,
        saldo_actualizado: conteoFisico,
      },
    };
  }

  // 2. Desactivar SaldoInicial anterior
  if (saldoInicialAnterior) {
    await tx.saldoInicial.update({
      where: { id: saldoInicialAnterior.id },
      data: { activo: false, updated_at: new Date() },
    });
  }

  // 3. Crear nuevo SaldoInicial activo
  const nuevoSaldoInicial = await tx.saldoInicial.create({
    data: {
      punto_atencion_id: puntoId,
      moneda_id: conteo.moneda_id,
      cantidad_inicial: new Prisma.Decimal(conteoFisico),
      asignado_por: usuarioId,
      activo: true,
      observaciones:
        `REBASIFICACIÓN ${new Date().toISOString().slice(0, 10)}. ` +
        `Saldo inicial anterior: ${cantidadInicialAnterior}. ` +
        `Nuevo conteo físico: ${conteoFisico}. ` +
        (conteo.observaciones || ""),
    },
  });

  // 4. Obtener saldo actual para el movimiento
  const saldoActual = await tx.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoId,
        moneda_id: conteo.moneda_id,
      },
    },
    select: { id: true, cantidad: true },
  });

  const cantidadSaldoAnterior = Number(saldoActual?.cantidad ?? 0);

  // 5. Registrar MovimientoSaldo de tipo SALDO_INICIAL
  await tx.movimientoSaldo.create({
    data: {
      punto_atencion_id: puntoId,
      moneda_id: conteo.moneda_id,
      tipo_movimiento: "SALDO_INICIAL",
      monto: new Prisma.Decimal(conteoFisico),
      saldo_anterior: new Prisma.Decimal(0), // El nuevo saldo inicial parte de 0 conceptualmente
      saldo_nuevo: new Prisma.Decimal(conteoFisico),
      usuario_id: usuarioId,
      tipo_referencia: "SALDO_INICIAL",
      referencia_id: nuevoSaldoInicial.id,
      descripcion: `REBASIFICACIÓN - Nuevo saldo inicial establecido por conteo físico: ${conteoFisico}`,
      fecha: new Date(),
    },
  });

  // 6. Actualizar Saldo
  if (saldoActual?.id) {
    await tx.saldo.update({
      where: { id: saldoActual.id },
      data: {
        cantidad: new Prisma.Decimal(conteoFisico),
        billetes: new Prisma.Decimal(billetes),
        monedas_fisicas: new Prisma.Decimal(monedasFisicas),
        updated_at: new Date(),
      },
    });
  } else {
    await tx.saldo.create({
      data: {
        punto_atencion_id: puntoId,
        moneda_id: conteo.moneda_id,
        cantidad: new Prisma.Decimal(conteoFisico),
        billetes: new Prisma.Decimal(billetes),
        monedas_fisicas: new Prisma.Decimal(monedasFisicas),
        bancos: new Prisma.Decimal(0),
      },
    });
  }

  // 7. Registrar en HistorialSaldo para auditoría completa
  await tx.historialSaldo.create({
    data: {
      punto_atencion_id: puntoId,
      moneda_id: conteo.moneda_id,
      usuario_id: usuarioId,
      cantidad_anterior: new Prisma.Decimal(cantidadSaldoAnterior),
      cantidad_incrementada: new Prisma.Decimal(conteoFisico),
      cantidad_nueva: new Prisma.Decimal(conteoFisico),
      tipo_movimiento: "INGRESO",
      saldo: new Prisma.Decimal(conteoFisico),
      numero_referencia: nuevoSaldoInicial.id,
      descripcion:
        `REBASIFICACIÓN CONTROLADA - Punto: ${puntoNombre}, Moneda: ${conteo.codigo}. ` +
        `Saldo sistema anterior: ${cantidadSaldoAnterior}, ` +
        `Nuevo conteo físico: ${conteoFisico}`,
      fecha_solicitud: new Date(),
    },
  });

  return {
    exito: true,
    detalle: {
      moneda_id: conteo.moneda_id,
      codigo: conteo.codigo,
      saldo_inicial_anterior: cantidadInicialAnterior,
      saldo_inicial_nuevo: conteoFisico,
      saldo_actualizado: conteoFisico,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Modo: Aplicar re-basificación
// ───────────────────────────────────────────────────────────────────────────

async function aplicarRebasificacion(
  inputPath: string,
  usuarioId: string,
  execute: boolean
): Promise<void> {
  console.log(`${execute ? "🔴" : "🟡"} MODO: ${execute ? "EJECUCIÓN REAL" : "DRY-RUN (preview)"}\n`);

  await validarAdmin(usuarioId);

  // Leer plantilla
  const fullPath = path.resolve(inputPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Archivo no encontrado: ${fullPath}`);
  }

  const plantilla: PlantillaRebasificacion = JSON.parse(
    fs.readFileSync(fullPath, "utf-8")
  );

  console.log(`📂 Archivo: ${fullPath}`);
  console.log(`📅 Generado: ${plantilla.generado_el}`);
  console.log(`📍 Puntos a procesar: ${plantilla.conteos.length}\n`);

  const resultados: ResultadoRebasificacion[] = [];
  let totalMonedas = 0;
  let totalExitos = 0;
  let totalErrores = 0;

  for (const punto of plantilla.conteos) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📍 ${punto.punto_nombre} (${punto.punto_atencion_id})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const resultado: ResultadoRebasificacion = {
      punto_atencion_id: punto.punto_atencion_id,
      punto_nombre: punto.punto_nombre,
      exito: true,
      monedas_procesadas: 0,
      errores: [],
      detalle: [],
    };

    // Validar que el punto existe
    const puntoDb = await prisma.puntoAtencion.findUnique({
      where: { id: punto.punto_atencion_id },
      select: { id: true, nombre: true },
    });

    if (!puntoDb) {
      resultado.exito = false;
      resultado.errores.push(`Punto de atención no encontrado en BD`);
      resultados.push(resultado);
      totalErrores++;
      console.log(`   ❌ Punto no encontrado en la base de datos. Saltando.\n`);
      continue;
    }

    // Procesar cada moneda dentro de una transacción por punto
    try {
      const detallesMoneda: ResultadoRebasificacion["detalle"] = [];

      await prisma.$transaction(async (tx) => {
        for (const moneda of punto.monedas) {
          totalMonedas++;

          // Validar que la moneda existe
          const monedaDb = await tx.moneda.findUnique({
            where: { id: moneda.moneda_id },
            select: { id: true, codigo: true },
          });

          if (!monedaDb) {
            resultado.errores.push(`Moneda ${moneda.codigo} (${moneda.moneda_id}) no encontrada`);
            console.log(`   ⚠️  Moneda ${moneda.codigo} no encontrada. Saltando.`);
            continue;
          }

          const res = await rebasificarMoneda(
            tx,
            punto.punto_atencion_id,
            punto.punto_nombre,
            moneda,
            usuarioId,
            execute
          );

          if (res.exito && res.detalle) {
            detallesMoneda.push(res.detalle);
            resultado.monedas_procesadas++;
            const icon = execute ? "✅" : "👁️";
            console.log(
              `   ${icon} ${moneda.codigo}: ` +
                `${res.detalle.saldo_inicial_anterior.toFixed(2)} → ${res.detalle.saldo_inicial_nuevo.toFixed(2)} ` +
                `(saldo: ${res.detalle.saldo_actualizado.toFixed(2)})`
            );
          } else {
            resultado.errores.push(`${moneda.codigo}: ${res.error}`);
            console.log(`   ❌ ${moneda.codigo}: ${res.error}`);
          }
        }

        resultado.detalle = detallesMoneda;
      });

      if (resultado.errores.length > 0) {
        resultado.exito = false;
        totalErrores++;
      } else {
        totalExitos++;
      }

      console.log(`   📊 Procesadas: ${resultado.monedas_procesadas}/${punto.monedas.length} monedas`);
      if (resultado.errores.length > 0) {
        console.log(`   ⚠️  Errores: ${resultado.errores.length}`);
      }
      console.log();
    } catch (error) {
      resultado.exito = false;
      const msg = error instanceof Error ? error.message : String(error);
      resultado.errores.push(`Error en transacción: ${msg}`);
      totalErrores++;
      console.log(`   ❌ Error en transacción: ${msg}\n`);
    }

    resultados.push(resultado);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resumen final
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    RESUMEN DE REBASIFICACIÓN                     ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  console.log(`   Modo:              ${execute ? "🔴 EJECUCIÓN REAL" : "🟡 DRY-RUN (preview)"}`);
  console.log(`   Puntos procesados: ${plantilla.conteos.length}`);
  console.log(`   Monedas evaluadas: ${totalMonedas}`);
  console.log(`   Exitosos:          ${totalExitos}`);
  console.log(`   Con errores:       ${totalErrores}`);
  console.log();

  if (!execute) {
    console.log(`⚠️  ESTO FUE UN PREVIEW. No se modificó la base de datos.`);
    console.log(`   Para ejecutar en serio, agrega la flag --execute\n`);
  } else {
    console.log(`✅ Re-basificación completada. Todos los cambios están en la base de datos.`);
    console.log(`   Las tablas preservadas intactas son:`);
    console.log(`   • MovimientoSaldo (ledger histórico)`);
    console.log(`   • AsignacionSaldo (asignaciones)`);
    console.log(`   • CambioDivisa (transacciones)`);
    console.log(`   • Transferencia (transferencias)`);
    console.log(`   • ServicioExternoMovimiento (servicios)`);
    console.log(`   • ServientregaGuia / ServientregaSaldo / ServientregaHistorialSaldo (Servientrega)`);
    console.log();
    console.log(`   Las tablas modificadas son:`);
    console.log(`   • SaldoInicial (desactivados anteriores, creados nuevos activos)`);
    console.log(`   • Saldo (cantidad actualizada al conteo físico)`);
    console.log(`   • HistorialSaldo (registro de auditoría de la re-basificación)`);
    console.log(`   • MovimientoSaldo (nuevos registros tipo SALDO_INICIAL)`);
    console.log();
  }

  // Guardar reporte
  const reportePath = fullPath.replace(/\.json$/i, `-reporte-${execute ? "EJECUTADO" : "PREVIEW"}-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(
    reportePath,
    JSON.stringify(
      {
        ejecutado_el: new Date().toISOString(),
        modo: execute ? "EJECUCION" : "DRY_RUN",
        usuario_id: usuarioId,
        resumen: {
          puntos: plantilla.conteos.length,
          monedas: totalMonedas,
          exitosos: totalExitos,
          errores: totalErrores,
        },
        resultados,
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log(`📝 Reporte guardado: ${reportePath}\n`);
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  console.log("══════════════════════════════════════════════════════════════════");
  console.log("       REBASIFICACIÓN CONTROLADA DE SALDOS");
  console.log("══════════════════════════════════════════════════════════════════\n");

  try {
    if (args["generar-plantilla"] || args["generar"]) {
      const output = (args["output"] as string) || "scripts/data/rebasificacion-conteos.json";
      // Asegurar que el directorio existe
      const dir = path.dirname(path.resolve(output));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await generarPlantilla(output);
    } else if (args["aplicar"]) {
      const inputPath = args["aplicar"] as string;
      const usuarioId = args["usuario-id"] as string;
      const execute = args["execute"] === true || args["execute"] === "true";

      if (!usuarioId) {
        console.error("❌ Se requiere --usuario-id <ID_ADMIN>");
        console.error("   Ejemplo: npx tsx scripts/rebasificacion-saldos.ts --aplicar conteos.json --usuario-id abc123");
        process.exit(1);
      }

      await aplicarRebasificacion(inputPath, usuarioId, execute);
    } else {
      console.log("Uso:");
      console.log("");
      console.log("  # Generar plantilla con saldos actuales");
      console.log("  npx tsx scripts/rebasificacion-saldos.ts --generar-plantilla --output conteos.json");
      console.log("");
      console.log("  # Preview de cambios (dry-run)");
      console.log("  npx tsx scripts/rebasificacion-saldos.ts --aplicar conteos.json --usuario-id <ADMIN_ID>");
      console.log("");
      console.log("  # Ejecutar re-basificación");
      console.log("  npx tsx scripts/rebasificacion-saldos.ts --aplicar conteos.json --usuario-id <ADMIN_ID> --execute");
      console.log("");
      console.log("Opciones:");
      console.log("  --generar-plantilla   Genera archivo JSON con saldos actuales del sistema");
      console.log("  --output <ruta>       Ruta del archivo a generar (default: scripts/data/rebasificacion-conteos.json)");
      console.log("  --aplicar <ruta>      Aplica la re-basificación desde el archivo JSON");
      console.log("  --usuario-id <id>     ID del usuario ADMIN/SUPER_USUARIO que autoriza");
      console.log("  --execute             Ejecuta de verdad (sin esto es solo preview)");
      console.log("  --verbose             Muestra queries de Prisma");
      console.log("");
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
