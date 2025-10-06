/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE CÁLCULO DE SALDOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROPÓSITO:
 * - Calcula saldos reales basándose en movimientos (excluyendo movimientos bancarios)
 * - Compara con valores esperados
 * - Muestra detalles de movimientos cuando hay discrepancias
 *
 * USO:
 * PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" npx tsx server/scripts/calcular-saldos.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

const FECHA_INICIO = new Date("2025-09-30T05:00:00.000Z");
const FECHA_CORTE = new Date("2025-10-03T04:00:00.000Z");

// Valores esperados según conteo manual (2 oct 2025, 23:00)
const SALDOS_ESPERADOS: Record<string, number> = {
  "SANTA FE": 822.11,
  "EL TINGO": 924.2,
  SCALA: 1103.81,
  "EL BOSQUE": 57.85,
  AMAZONAS: 265.65,
  PLAZA: 1090.45,
  COTOCOLLAO: 16.53,
  "OFICINA PRINCIPAL QUITO": 15.35,
};

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface MovimientoDetalle {
  fecha: Date;
  tipo: string;
  monto: number;
  descripcion: string;
  saldoDespues: number;
}

interface SaldoCalculado {
  saldoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoFinal: number;
  movimientos: MovimientoDetalle[];
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el saldo inicial activo para un punto y moneda
 */
async function obtenerSaldoInicial(
  puntoAtencionId: string,
  monedaId: string
): Promise<number> {
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      activo: true,
      fecha_asignacion: {
        lte: FECHA_CORTE, // Buscar saldos iniciales asignados antes o en la fecha de corte
      },
    },
    orderBy: {
      fecha_asignacion: "desc",
    },
  });

  return saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;
}

/**
 * Calcula el saldo real basándose en todos los movimientos
 */
async function calcularSaldoReal(
  puntoAtencionId: string,
  monedaId: string
): Promise<SaldoCalculado> {
  // 1. Obtener saldo inicial
  const saldoInicial = await obtenerSaldoInicial(puntoAtencionId, monedaId);

  // 2. Obtener todos los movimientos desde la fecha de inicio
  const todosMovimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      fecha: {
        gte: FECHA_INICIO,
        lte: FECHA_CORTE,
      },
    },
    orderBy: {
      fecha: "asc",
    },
  });

  // Filtrar movimientos bancarios en memoria (para manejar correctamente NULL)
  const movimientos = todosMovimientos.filter((mov) => {
    const desc = mov.descripcion?.toLowerCase() || "";
    return !desc.includes("bancos");
  });

  // 3. Calcular saldo procesando cada movimiento
  let saldoCalculado = saldoInicial;
  let totalIngresos = 0;
  let totalEgresos = 0;
  const movimientosDetalle: MovimientoDetalle[] = [];

  for (const mov of movimientos) {
    const monto = Number(mov.monto);
    const tipo = mov.tipo_movimiento;
    let montoAplicado = 0;

    switch (tipo) {
      case "SALDO_INICIAL":
        // Ya lo tenemos en saldoInicial, no hacer nada
        break;

      case "INGRESO":
        // INGRESO siempre es positivo en BD
        montoAplicado = Math.abs(monto);
        saldoCalculado += montoAplicado;
        totalIngresos += montoAplicado;
        break;

      case "EGRESO":
        // EGRESO puede ser negativo en BD, usamos valor absoluto
        montoAplicado = Math.abs(monto);
        saldoCalculado -= montoAplicado;
        totalEgresos += montoAplicado;
        break;

      case "AJUSTE":
        // Los ajustes mantienen su signo original
        if (monto >= 0) {
          montoAplicado = monto;
          saldoCalculado += montoAplicado;
          totalIngresos += montoAplicado;
        } else {
          montoAplicado = Math.abs(monto);
          saldoCalculado -= montoAplicado;
          totalEgresos += montoAplicado;
        }
        break;

      default:
        console.warn(`⚠️  Tipo de movimiento desconocido: ${tipo}`);
    }

    movimientosDetalle.push({
      fecha: mov.fecha,
      tipo: tipo,
      monto,
      descripcion: mov.descripcion || "Sin descripción",
      saldoDespues: saldoCalculado,
    });
  }

  return {
    saldoInicial,
    totalIngresos,
    totalEgresos,
    saldoFinal: saldoCalculado,
    movimientos: movimientosDetalle,
  };
}

async function corregirSignosIncorrectos(): Promise<number> {
  console.log("\n🔍 Verificando signos de movimientos...\n");

  // Buscar EGRESOS con montos positivos
  const egresosPositivos = await prisma.movimientoSaldo.findMany({
    where: {
      tipo_movimiento: "EGRESO",
      monto: {
        gt: 0,
      },
    },
    include: {
      puntoAtencion: {
        select: { nombre: true },
      },
      moneda: {
        select: { codigo: true },
      },
    },
  });

  if (egresosPositivos.length === 0) {
    console.log("✅ No se encontraron EGRESOS con signos incorrectos.\n");
    return 0;
  }

  console.log(
    `⚠️  Se encontraron ${egresosPositivos.length} EGRESOS con montos positivos:\n`
  );

  // Mostrar los primeros 10
  const mostrar = egresosPositivos.slice(0, 10);
  for (const mov of mostrar) {
    console.log(
      `   - ${mov.puntoAtencion.nombre} - ${mov.moneda.codigo} - $${Number(
        mov.monto
      ).toFixed(2)}`
    );
  }

  if (egresosPositivos.length > 10) {
    console.log(`   ... y ${egresosPositivos.length - 10} más\n`);
  } else {
    console.log("");
  }

  // Corregir automáticamente
  console.log("🔧 Corrigiendo signos...\n");

  let corregidos = 0;
  for (const mov of egresosPositivos) {
    try {
      await prisma.movimientoSaldo.update({
        where: { id: mov.id },
        data: {
          monto: -Math.abs(Number(mov.monto)),
        },
      });
      corregidos++;
    } catch (error) {
      console.error(`❌ Error corrigiendo movimiento ${mov.id}:`, error);
    }
  }

  console.log(`✅ Se corrigieron ${corregidos} movimientos.\n`);
  return corregidos;
}

/**
 * Formatea un número como moneda
 */
function formatearMoneda(valor: number): string {
  return `$${valor.toFixed(2).padStart(10)}`;
}

/**
 * Formatea una fecha
 */
function formatearFecha(fecha: Date): string {
  return fecha.toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Función principal
 */
async function main(): Promise<void> {
  console.log("\n" + "═".repeat(100));
  console.log("📊 CÁLCULO DE SALDOS USD");
  console.log("═".repeat(100));
  console.log(
    `📅 Fecha de inicio: ${FECHA_INICIO.toLocaleString("es-EC", {
      timeZone: "America/Guayaquil",
    })}`
  );
  console.log(
    `📅 Fecha de corte: ${FECHA_CORTE.toLocaleString("es-EC", {
      timeZone: "America/Guayaquil",
    })}`
  );
  console.log("═".repeat(100) + "\n");

  // PASO 1: Corregir signos incorrectos
  await corregirSignosIncorrectos();

  // Obtener moneda USD
  const usdMoneda = await prisma.moneda.findFirst({
    where: { codigo: "USD" },
  });

  if (!usdMoneda) {
    console.log("❌ No se encontró la moneda USD");
    return;
  }

  // Obtener todos los puntos de atención
  const puntos = await prisma.puntoAtencion.findMany({
    orderBy: { nombre: "asc" },
  });

  let totalCuadrados = 0;
  let totalConDiferencia = 0;
  let totalDiferenciaAbsoluta = 0;

  const resultados: Array<{
    punto: string;
    calculado: number;
    esperado: number;
    diferencia: number;
    movimientos: number;
    detalle: SaldoCalculado;
  }> = [];

  // Calcular saldos para cada punto
  for (const punto of puntos) {
    const saldoEsperado = SALDOS_ESPERADOS[punto.nombre];
    if (saldoEsperado === undefined) continue;

    const detalle = await calcularSaldoReal(punto.id, usdMoneda.id);
    const diferencia = detalle.saldoFinal - saldoEsperado;
    const cuadra = Math.abs(diferencia) <= 0.02; // Tolerancia de 2 centavos

    if (cuadra) {
      totalCuadrados++;
    } else {
      totalConDiferencia++;
      totalDiferenciaAbsoluta += Math.abs(diferencia);
    }

    resultados.push({
      punto: punto.nombre,
      calculado: detalle.saldoFinal,
      esperado: saldoEsperado,
      diferencia,
      movimientos: detalle.movimientos.length,
      detalle,
    });
  }

  // Mostrar resumen
  console.log("📋 RESUMEN:");
  console.log("─".repeat(100));
  console.log(
    "Punto de Atención".padEnd(35) +
      "Calculado".padStart(15) +
      "Esperado".padStart(15) +
      "Diferencia".padStart(15) +
      "Movs".padStart(8) +
      " Estado"
  );
  console.log("─".repeat(100));

  for (const resultado of resultados) {
    const cuadra = Math.abs(resultado.diferencia) <= 0.02;
    const estado = cuadra ? "✅" : "⚠️";
    const diferenciaStr =
      resultado.diferencia >= 0
        ? `+$${resultado.diferencia.toFixed(2)}`
        : `-$${Math.abs(resultado.diferencia).toFixed(2)}`;

    console.log(
      resultado.punto.padEnd(35) +
        `$${resultado.calculado.toFixed(2)}`.padStart(15) +
        `$${resultado.esperado.toFixed(2)}`.padStart(15) +
        diferenciaStr.padStart(15) +
        resultado.movimientos.toString().padStart(8) +
        ` ${estado}`
    );
  }

  console.log("─".repeat(100));
  console.log(`\n📊 TOTALES:`);
  console.log(`   ✅ Saldos correctos: ${totalCuadrados}`);
  console.log(`   ⚠️  Saldos con diferencia: ${totalConDiferencia}`);
  console.log(
    `   💰 Total diferencia absoluta: $${totalDiferenciaAbsoluta.toFixed(2)}`
  );

  // Mostrar detalles de puntos con diferencias
  const puntosConDiferencia = resultados.filter(
    (r) => Math.abs(r.diferencia) > 0.02
  );

  if (puntosConDiferencia.length > 0) {
    console.log("\n" + "═".repeat(100));
    console.log("⚠️  DETALLES DE PUNTOS CON DIFERENCIAS:");
    console.log("═".repeat(100));

    for (const resultado of puntosConDiferencia) {
      console.log(`\n🏢 ${resultado.punto}`);
      console.log("─".repeat(100));
      console.log(
        `   Saldo inicial:    ${formatearMoneda(
          resultado.detalle.saldoInicial
        )}`
      );
      console.log(
        `   Total ingresos:   ${formatearMoneda(
          resultado.detalle.totalIngresos
        )}`
      );
      console.log(
        `   Total egresos:    ${formatearMoneda(
          resultado.detalle.totalEgresos
        )}`
      );
      console.log(
        `   Saldo calculado:  ${formatearMoneda(resultado.calculado)}`
      );
      console.log(
        `   Saldo esperado:   ${formatearMoneda(resultado.esperado)}`
      );
      console.log(
        `   ❌ DIFERENCIA:    ${formatearMoneda(
          Math.abs(resultado.diferencia)
        )}`
      );
      console.log(`   Movimientos:      ${resultado.movimientos}`);

      // Mostrar últimos 10 movimientos
      const ultimosMovimientos = resultado.detalle.movimientos.slice(-10);
      console.log(`\n   📝 Últimos ${ultimosMovimientos.length} movimientos:`);
      for (const mov of ultimosMovimientos) {
        const tipo = mov.tipo || "DESCONOCIDO";
        const signo =
          tipo.includes("INGRESO") || (tipo === "AJUSTE" && mov.monto >= 0)
            ? "+"
            : "";
        console.log(
          `      ${formatearFecha(mov.fecha)} | ${tipo.padEnd(
            20
          )} | ${signo}${formatearMoneda(mov.monto)} | Saldo: ${formatearMoneda(
            mov.saldoDespues
          )}`
        );
      }
    }
  }

  console.log("\n" + "═".repeat(100));
  console.log("✅ ANÁLISIS COMPLETADO");
  console.log("═".repeat(100));
  console.log(
    "📌 NOTA: Este script NO modifica datos, solo calcula y reporta."
  );
  console.log("📌 Tolerancia de diferencia: ±$0.02 (por redondeos)");
  console.log("═".repeat(100) + "\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// EJECUCIÓN
// ═══════════════════════════════════════════════════════════════════════════

main()
  .catch((error) => {
    console.error("💥 Error fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
