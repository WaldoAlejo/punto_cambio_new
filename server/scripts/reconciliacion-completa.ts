/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE RECONCILIACIÓN COMPLETA DE SALDOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROPÓSITO:
 * Reconciliar TODOS los saldos según la lógica del negocio:
 *
 * LÓGICA DEL NEGOCIO:
 * 1. Asignación inicial → INGRESO (saldo_inicial)
 * 2. Cambios de divisa:
 *    - Lo que el cliente ENTREGA → INGRESO (suma a la divisa)
 *    - Lo que el cliente RECIBE → EGRESO (resta de la divisa)
 *    - Transferencia bancaria → NO afecta saldo (solo va a bancos)
 * 3. Transferencias entre puntos:
 *    - Punto que ENVÍA → EGRESO (solo cuando se aprueba)
 *    - Punto que RECIBE → INGRESO (solo cuando se aprueba)
 * 4. Servicios externos:
 *    - El operador selecciona si es INGRESO o EGRESO
 *
 * FÓRMULA:
 * Saldo Actual = Saldo Inicial + INGRESOS - EGRESOS
 *
 * USO:
 * npx tsx server/scripts/reconciliacion-completa.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface MovimientoDetalle {
  id: string;
  fecha: Date;
  tipo: string;
  monto: number;
  descripcion: string;
  tipoReferencia: string | null;
  referenciaId: string | null;
}

interface ResultadoReconciliacion {
  puntoNombre: string;
  monedaCodigo: string;
  saldoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoCalculado: number;
  saldoRegistrado: number;
  diferencia: number;
  movimientosCount: number;
  corregido: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula el saldo real basándose en movimientos
 * Sigue la lógica: Saldo = Inicial + INGRESOS - EGRESOS
 */
async function calcularSaldoReal(
  puntoAtencionId: string,
  monedaId: string
): Promise<{
  saldoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoCalculado: number;
  movimientos: MovimientoDetalle[];
}> {
  // 1. Obtener saldo inicial más reciente
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      activo: true,
    },
    orderBy: {
      fecha_asignacion: "desc",
    },
  });

  const inicial = saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;

  // 2. Obtener TODOS los movimientos (excluyendo movimientos bancarios)
  const todosMovimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
    },
    orderBy: {
      fecha: "asc",
    },
  });

  // Filtrar movimientos bancarios
  const movimientos = todosMovimientos.filter((mov) => {
    const desc = mov.descripcion?.toLowerCase() || "";
    return !desc.includes("bancos");
  });

  // 3. Calcular totales
  let totalIngresos = 0;
  let totalEgresos = 0;
  const movimientosDetalle: MovimientoDetalle[] = [];

  for (const mov of movimientos) {
    const monto = Number(mov.monto);
    const tipo = mov.tipo_movimiento;

    // Según la lógica del negocio:
    // - INGRESO: monto positivo en BD → sumar
    // - EGRESO: monto negativo en BD → restar (usar valor absoluto)
    // - SALDO_INICIAL: ya está en 'inicial', no contar
    // - AJUSTE: mantener signo original

    switch (tipo) {
      case "SALDO_INICIAL":
        // Ya incluido en 'inicial', skip
        break;

      case "INGRESO":
        // INGRESO: siempre suma (usar valor absoluto por si acaso)
        totalIngresos += Math.abs(monto);
        break;

      case "EGRESO":
        // EGRESO: siempre resta (usar valor absoluto)
        totalEgresos += Math.abs(monto);
        break;

      case "AJUSTE":
        // AJUSTE: mantiene signo original
        if (monto >= 0) {
          totalIngresos += monto;
        } else {
          totalEgresos += Math.abs(monto);
        }
        break;

      default:
        console.warn(
          `⚠️  Tipo de movimiento desconocido: ${tipo} (monto: ${monto})`
        );
        // Por defecto, sumar si positivo, restar si negativo
        if (monto >= 0) {
          totalIngresos += monto;
        } else {
          totalEgresos += Math.abs(monto);
        }
    }

    movimientosDetalle.push({
      id: mov.id,
      fecha: mov.fecha,
      tipo: tipo,
      monto,
      descripcion: mov.descripcion || "Sin descripción",
      tipoReferencia: mov.tipo_referencia,
      referenciaId: mov.referencia_id,
    });
  }

  // 4. Calcular saldo final
  const saldoCalculado = inicial + totalIngresos - totalEgresos;

  return {
    saldoInicial: inicial,
    totalIngresos,
    totalEgresos,
    saldoCalculado: Number(saldoCalculado.toFixed(2)),
    movimientos: movimientosDetalle,
  };
}

/**
 * Corrige signos incorrectos en movimientos
 * REGLA: EGRESO debe tener monto NEGATIVO, INGRESO debe tener monto POSITIVO
 */
async function corregirSignosIncorrectos(): Promise<number> {
  console.log("🔍 Verificando signos de movimientos...\n");

  let corregidos = 0;

  // 1. Buscar EGRESOS con montos positivos
  const egresosPositivos = await prisma.movimientoSaldo.findMany({
    where: {
      tipo_movimiento: "EGRESO",
      monto: {
        gt: 0,
      },
    },
    include: {
      puntoAtencion: { select: { nombre: true } },
      moneda: { select: { codigo: true } },
    },
  });

  if (egresosPositivos.length > 0) {
    console.log(
      `⚠️  Encontrados ${egresosPositivos.length} EGRESOS con monto positivo\n`
    );

    for (const mov of egresosPositivos) {
      console.log(
        `   Corrigiendo: ${mov.puntoAtencion.nombre} - ${
          mov.moneda.codigo
        } - $${Number(mov.monto).toFixed(2)}`
      );

      await prisma.movimientoSaldo.update({
        where: { id: mov.id },
        data: {
          monto: new Prisma.Decimal(-Math.abs(Number(mov.monto))),
        },
      });

      corregidos++;
    }
    console.log("");
  }

  // 2. Buscar INGRESOS con montos negativos
  const ingresosNegativos = await prisma.movimientoSaldo.findMany({
    where: {
      tipo_movimiento: "INGRESO",
      monto: {
        lt: 0,
      },
    },
    include: {
      puntoAtencion: { select: { nombre: true } },
      moneda: { select: { codigo: true } },
    },
  });

  if (ingresosNegativos.length > 0) {
    console.log(
      `⚠️  Encontrados ${ingresosNegativos.length} INGRESOS con monto negativo\n`
    );

    for (const mov of ingresosNegativos) {
      console.log(
        `   Corrigiendo: ${mov.puntoAtencion.nombre} - ${
          mov.moneda.codigo
        } - $${Number(mov.monto).toFixed(2)}`
      );

      await prisma.movimientoSaldo.update({
        where: { id: mov.id },
        data: {
          monto: new Prisma.Decimal(Math.abs(Number(mov.monto))),
        },
      });

      corregidos++;
    }
    console.log("");
  }

  if (corregidos === 0) {
    console.log("✅ No se encontraron signos incorrectos\n");
  } else {
    console.log(`✅ Se corrigieron ${corregidos} movimientos\n`);
  }

  return corregidos;
}

/**
 * Reconcilia un saldo específico
 */
async function reconciliarSaldo(
  puntoAtencionId: string,
  monedaId: string,
  puntoNombre: string,
  monedaCodigo: string
): Promise<ResultadoReconciliacion> {
  // Calcular saldo real
  const {
    saldoInicial,
    totalIngresos,
    totalEgresos,
    saldoCalculado,
    movimientos,
  } = await calcularSaldoReal(puntoAtencionId, monedaId);

  // Obtener saldo registrado
  const saldoActual = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
      },
    },
  });

  const saldoRegistrado = saldoActual ? Number(saldoActual.cantidad) : 0;
  const diferencia = Number((saldoRegistrado - saldoCalculado).toFixed(2));
  const requiereCorreccion = Math.abs(diferencia) > 0.01; // Tolerancia de 1 centavo

  let corregido = false;

  if (requiereCorreccion) {
    console.log(`⚠️  ${puntoNombre} - ${monedaCodigo}:`);
    console.log(`   Saldo Inicial:    $${saldoInicial.toFixed(2)}`);
    console.log(`   Total Ingresos:   $${totalIngresos.toFixed(2)}`);
    console.log(`   Total Egresos:    $${totalEgresos.toFixed(2)}`);
    console.log(`   Saldo Calculado:  $${saldoCalculado.toFixed(2)}`);
    console.log(`   Saldo Registrado: $${saldoRegistrado.toFixed(2)}`);
    console.log(`   Diferencia:       $${diferencia.toFixed(2)}`);

    // Actualizar saldo
    await prisma.saldo.upsert({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: monedaId,
        },
      },
      update: {
        cantidad: new Prisma.Decimal(saldoCalculado),
        updated_at: new Date(),
      },
      create: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
        cantidad: new Prisma.Decimal(saldoCalculado),
        billetes: 0,
        monedas_fisicas: 0,
        bancos: 0,
      },
    });

    corregido = true;
    console.log(`   ✅ Saldo corregido\n`);
  }

  return {
    puntoNombre,
    monedaCodigo,
    saldoInicial,
    totalIngresos,
    totalEgresos,
    saldoCalculado,
    saldoRegistrado,
    diferencia,
    movimientosCount: movimientos.length,
    corregido,
  };
}

/**
 * Función principal
 */
async function main(): Promise<void> {
  console.log("\n" + "═".repeat(100));
  console.log("🔄 RECONCILIACIÓN COMPLETA DE SALDOS");
  console.log("═".repeat(100));
  console.log("Lógica: Saldo = Inicial + INGRESOS - EGRESOS");
  console.log("═".repeat(100) + "\n");

  // PASO 1: Corregir signos incorrectos
  console.log("📋 PASO 1: Corregir signos incorrectos\n");
  const signosCorregidos = await corregirSignosIncorrectos();

  // PASO 2: Reconciliar todos los saldos
  console.log("📋 PASO 2: Reconciliar todos los saldos\n");

  const saldos = await prisma.saldo.findMany({
    include: {
      puntoAtencion: { select: { nombre: true } },
      moneda: { select: { codigo: true } },
    },
    orderBy: [
      { puntoAtencion: { nombre: "asc" } },
      { moneda: { codigo: "asc" } },
    ],
  });

  const resultados: ResultadoReconciliacion[] = [];

  for (const saldo of saldos) {
    const resultado = await reconciliarSaldo(
      saldo.punto_atencion_id,
      saldo.moneda_id,
      saldo.puntoAtencion.nombre,
      saldo.moneda.codigo
    );
    resultados.push(resultado);
  }

  // PASO 3: Mostrar resumen
  console.log("\n" + "═".repeat(100));
  console.log("📊 RESUMEN DE RECONCILIACIÓN");
  console.log("═".repeat(100));

  const saldosCorregidos = resultados.filter((r) => r.corregido).length;
  const saldosCorrectos = resultados.filter((r) => !r.corregido).length;

  console.log(`\n✅ Saldos correctos:  ${saldosCorrectos}`);
  console.log(`⚠️  Saldos corregidos: ${saldosCorregidos}`);
  console.log(`🔧 Signos corregidos: ${signosCorregidos}`);

  // Mostrar tabla de resultados
  if (resultados.length > 0) {
    console.log("\n" + "─".repeat(100));
    console.log(
      "Punto".padEnd(30) +
        "Moneda".padEnd(10) +
        "Inicial".padStart(12) +
        "Ingresos".padStart(12) +
        "Egresos".padStart(12) +
        "Calculado".padStart(12) +
        "Registrado".padStart(12) +
        " Estado"
    );
    console.log("─".repeat(100));

    for (const r of resultados) {
      const estado = r.corregido ? "⚠️ " : "✅";
      console.log(
        r.puntoNombre.padEnd(30) +
          r.monedaCodigo.padEnd(10) +
          `$${r.saldoInicial.toFixed(2)}`.padStart(12) +
          `$${r.totalIngresos.toFixed(2)}`.padStart(12) +
          `$${r.totalEgresos.toFixed(2)}`.padStart(12) +
          `$${r.saldoCalculado.toFixed(2)}`.padStart(12) +
          `$${r.saldoRegistrado.toFixed(2)}`.padStart(12) +
          ` ${estado}`
      );
    }
    console.log("─".repeat(100));
  }

  console.log("\n" + "═".repeat(100));
  console.log("✅ RECONCILIACIÓN COMPLETADA");
  console.log("═".repeat(100) + "\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// EJECUCIÓN
// ═══════════════════════════════════════════════════════════════════════════

main()
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
