import {
  Prisma,
  PrismaClient,
  ServicioExterno,
  TipoAsignacionServicio,
} from "@prisma/client";

const prisma = new PrismaClient();

type Args = {
  execute: boolean;
  force: boolean;
  verbose: boolean;
  preserveServientrega: boolean;
};

type Bucket = "CAJA" | "BANCOS" | "NINGUNO";

type ServientregaSnapshot = {
  puntoAtencionId: string;
  puntoNombre: string;
  monedaId: string;
  cantidad: number;
  billetes: number;
  monedasFisicas: number;
  bancos: number;
  legacyMontoTotal: number;
  legacyMontoUsado: number;
};

type MovimientoDelta = {
  total: number;
  caja: number;
  bancos: number;
};

function parseArgs(): Args {
  const args = new Set(process.argv.slice(2));
  return {
    execute: args.has("--execute") || args.has("-x"),
    force: args.has("--force") || args.has("-f"),
    verbose: args.has("--verbose") || args.has("-v"),
    preserveServientrega: !args.has("--drop-servientrega-balance"),
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number): string {
  return `$${round2(value).toFixed(2)}`;
}

function inferBucket(tipoReferencia?: string | null, descripcion?: string | null): Bucket {
  const tipo = (tipoReferencia || "").toUpperCase();
  const desc = (descripcion || "").toLowerCase();

  if (desc.includes("(caja)")) return "CAJA";
  if (desc.includes("(bancos)")) return "BANCOS";
  if (/\bbancos?\b/i.test(desc)) return "BANCOS";

  if (tipo === "SERVIENTREGA") {
    if (desc.includes("asignaci") && desc.includes("servientrega")) {
      return "NINGUNO";
    }
    if (desc.includes("guía servientrega") || desc.includes("guia servientrega")) {
      return "CAJA";
    }
    return "NINGUNO";
  }

  if (tipo === "CAMBIO_DIVISA" || tipo === "EXCHANGE") return "CAJA";
  if (tipo === "SERVICIO_EXTERNO") return "CAJA";

  return "NINGUNO";
}

async function ensureActorUserId(): Promise<string> {
  const preferred = await prisma.usuario.findFirst({
    where: {
      OR: [
        { correo: "system@puntocambio.com" },
        { username: "system" },
      ],
    },
    select: { id: true },
  });

  if (preferred?.id) return preferred.id;

  const admin = await prisma.usuario.findFirst({
    where: {
      activo: true,
      rol: { in: ["SUPER_USUARIO", "ADMIN", "ADMINISTRATIVO"] },
    },
    orderBy: { created_at: "asc" },
    select: { id: true },
  });

  if (admin?.id) return admin.id;

  const fallback = await prisma.usuario.findFirst({
    where: { activo: true },
    orderBy: { created_at: "asc" },
    select: { id: true },
  });

  if (!fallback?.id) {
    throw new Error("No se encontró un usuario activo para registrar la nueva asignación inicial de Servientrega.");
  }

  return fallback.id;
}

async function getUsdMonedaId(): Promise<string> {
  const usd = await prisma.moneda.findUnique({
    where: { codigo: "USD" },
    select: { id: true },
  });

  if (!usd?.id) {
    throw new Error("No se encontró la moneda USD.");
  }

  return usd.id;
}

async function loadServientregaSnapshots(usdId: string): Promise<ServientregaSnapshot[]> {
  const servicioSaldos = await prisma.servicioExternoSaldo.findMany({
    where: {
      servicio: ServicioExterno.SERVIENTREGA,
      moneda_id: usdId,
    },
    include: {
      puntoAtencion: {
        select: { id: true, nombre: true },
      },
    },
  });

  const legacySaldos = await prisma.servientregaSaldo.findMany({
    include: {
      punto_atencion: {
        select: { id: true, nombre: true },
      },
    },
  });

  const map = new Map<string, ServientregaSnapshot>();

  for (const saldo of servicioSaldos) {
    const cantidad = Number(saldo.cantidad || 0);
    if (Math.abs(cantidad) <= 0.01) continue;

    map.set(saldo.punto_atencion_id, {
      puntoAtencionId: saldo.punto_atencion_id,
      puntoNombre: saldo.puntoAtencion.nombre,
      monedaId: saldo.moneda_id,
      cantidad,
      billetes: Number(saldo.billetes || 0),
      monedasFisicas: Number(saldo.monedas_fisicas || 0),
      bancos: Number(saldo.bancos || 0),
      legacyMontoTotal: 0,
      legacyMontoUsado: 0,
    });
  }

  for (const legacy of legacySaldos) {
    const disponibleLegacy = Number(legacy.monto_total || 0) - Number(legacy.monto_usado || 0);
    if (Math.abs(disponibleLegacy) <= 0.01) continue;

    const existing = map.get(legacy.punto_atencion_id);
    if (existing) {
      existing.legacyMontoTotal = Number(legacy.monto_total || 0);
      existing.legacyMontoUsado = Number(legacy.monto_usado || 0);
      continue;
    }

    map.set(legacy.punto_atencion_id, {
      puntoAtencionId: legacy.punto_atencion_id,
      puntoNombre: legacy.punto_atencion?.nombre || legacy.punto_atencion_id,
      monedaId: usdId,
      cantidad: round2(disponibleLegacy),
      billetes: round2(disponibleLegacy),
      monedasFisicas: 0,
      bancos: 0,
      legacyMontoTotal: Number(legacy.monto_total || 0),
      legacyMontoUsado: Number(legacy.monto_usado || 0),
    });
  }

  return Array.from(map.values()).sort((a, b) => a.puntoNombre.localeCompare(b.puntoNombre));
}

async function loadMovimientoDeltas(): Promise<Map<string, MovimientoDelta>> {
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      OR: [
        { tipo_referencia: { in: ["CAMBIO_DIVISA", "EXCHANGE", "SERVICIO_EXTERNO", "SERVIENTREGA"] } },
        { tipo_movimiento: "CAMBIO_DIVISA" },
      ],
    },
    select: {
      punto_atencion_id: true,
      moneda_id: true,
      monto: true,
      tipo_referencia: true,
      descripcion: true,
    },
  });

  const deltas = new Map<string, MovimientoDelta>();

  for (const mov of movimientos) {
    const bucket = inferBucket(mov.tipo_referencia, mov.descripcion);
    if (bucket === "NINGUNO") continue;

    const key = `${mov.punto_atencion_id}::${mov.moneda_id}`;
    const current = deltas.get(key) || { total: 0, caja: 0, bancos: 0 };
    const amount = Number(mov.monto || 0);

    current.total = round2(current.total + amount);
    if (bucket === "BANCOS") {
      current.bancos = round2(current.bancos + amount);
    } else {
      current.caja = round2(current.caja + amount);
    }

    deltas.set(key, current);
  }

  return deltas;
}

function adjustCashBreakdown(
  billetes: number,
  monedas: number,
  deltaCajaToRemove: number
): { billetes: number; monedas: number } {
  let nextBilletes = round2(billetes);
  let nextMonedas = round2(monedas);

  if (Math.abs(deltaCajaToRemove) <= 0.01) {
    return { billetes: nextBilletes, monedas: nextMonedas };
  }

  if (deltaCajaToRemove > 0) {
    let remaining = deltaCajaToRemove;
    const billetesReducidos = Math.min(nextBilletes, remaining);
    nextBilletes = round2(nextBilletes - billetesReducidos);
    remaining = round2(remaining - billetesReducidos);

    if (remaining > 0) {
      const monedasReducidas = Math.min(nextMonedas, remaining);
      nextMonedas = round2(nextMonedas - monedasReducidas);
    }

    return { billetes: nextBilletes, monedas: nextMonedas };
  }

  nextBilletes = round2(nextBilletes + Math.abs(deltaCajaToRemove));
  return { billetes: nextBilletes, monedas: nextMonedas };
}

async function printDryRunSummary(args: Args): Promise<void> {
  const usdId = await getUsdMonedaId();
  const snapshots = args.preserveServientrega
    ? await loadServientregaSnapshots(usdId)
    : [];

  const [
    cambioDivisaCount,
    servicioMovimientoCount,
    movimientoSaldoCount,
    servicioAsignacionCount,
    servicioSaldoCount,
    servicioCierreCount,
    servicioDetalleCierreCount,
    servientregaHistorialCount,
    servientregaSaldoCount,
    saldoInicialNoUsdCount,
    saldoNoUsdCount,
  ] = await Promise.all([
    prisma.cambioDivisa.count(),
    prisma.servicioExternoMovimiento.count(),
    prisma.movimientoSaldo.count({
      where: {
        OR: [
          { tipo_referencia: { in: ["CAMBIO_DIVISA", "EXCHANGE", "SERVICIO_EXTERNO", "SERVIENTREGA"] } },
          { tipo_movimiento: "CAMBIO_DIVISA" },
        ],
      },
    }),
    prisma.servicioExternoAsignacion.count(),
    prisma.servicioExternoSaldo.count(),
    prisma.servicioExternoCierreDiario.count(),
    prisma.servicioExternoDetalleCierre.count(),
    prisma.servientregaHistorialSaldo.count(),
    prisma.servientregaSaldo.count(),
    prisma.saldoInicial.count({
      where: { moneda: { codigo: { not: "USD" } } },
    }),
    prisma.saldo.count({
      where: { moneda: { codigo: { not: "USD" } } },
    }),
  ]);

  console.log("=== DRY RUN: RESET DIVISAS + SERVICIOS EXTERNOS ===");
  console.log(`CambioDivisa a eliminar: ${cambioDivisaCount}`);
  console.log(`ServicioExternoMovimiento a eliminar: ${servicioMovimientoCount}`);
  console.log(`MovimientoSaldo relacionados a eliminar: ${movimientoSaldoCount}`);
  console.log(`ServicioExternoAsignacion a eliminar: ${servicioAsignacionCount}`);
  console.log(`ServicioExternoSaldo a eliminar/recrear: ${servicioSaldoCount}`);
  console.log(`ServicioExternoCierreDiario a eliminar: ${servicioCierreCount}`);
  console.log(`ServicioExternoDetalleCierre a eliminar: ${servicioDetalleCierreCount}`);
  console.log(`ServientregaHistorialSaldo a eliminar: ${servientregaHistorialCount}`);
  console.log(`ServientregaSaldo legacy a recrear: ${servientregaSaldoCount}`);
  console.log(`SaldoInicial no USD a eliminar: ${saldoInicialNoUsdCount}`);
  console.log(`Saldo no USD a eliminar: ${saldoNoUsdCount}`);
  console.log("");

  if (args.preserveServientrega) {
    console.log(`Servientrega preservado como nuevo saldo inicial: ${snapshots.length} punto(s)`);
    for (const snapshot of snapshots) {
      console.log(
        ` - ${snapshot.puntoNombre}: ${formatMoney(snapshot.cantidad)} ` +
          `(billetes ${formatMoney(snapshot.billetes)}, monedas ${formatMoney(snapshot.monedasFisicas)}, bancos ${formatMoney(snapshot.bancos)})`
      );
    }
  } else {
    console.log("Servientrega no se preservará: se eliminarán también sus saldos vivos.");
  }

  console.log("");
  console.log("No se tocarán: usuarios, puntos de atención, jornadas, permisos, guías Servientrega, remitentes ni destinatarios.");
  console.log("Usa --execute para aplicar. En producción agrega --force.");
}

async function executeReset(args: Args): Promise<void> {
  const usdId = await getUsdMonedaId();
  const actorUserId = await ensureActorUserId();
  const servientregaSnapshots = args.preserveServientrega
    ? await loadServientregaSnapshots(usdId)
    : [];
  const movimientoDeltas = await loadMovimientoDeltas();

  await prisma.$transaction(async (tx) => {
    const usdSaldos = await tx.saldo.findMany({
      where: { moneda_id: usdId },
      select: {
        id: true,
        punto_atencion_id: true,
        moneda_id: true,
        cantidad: true,
        billetes: true,
        monedas_fisicas: true,
        bancos: true,
      },
    });

    for (const saldo of usdSaldos) {
      const key = `${saldo.punto_atencion_id}::${saldo.moneda_id}`;
      const delta = movimientoDeltas.get(key);
      if (!delta) continue;

      const cantidadActual = Number(saldo.cantidad || 0);
      const bancosActual = Number(saldo.bancos || 0);
      const billetesActual = Number(saldo.billetes || 0);
      const monedasActual = Number(saldo.monedas_fisicas || 0);

      const nuevaCantidad = round2(cantidadActual - delta.total);
      const nuevosBancos = round2(bancosActual - delta.bancos);
      const breakdown = adjustCashBreakdown(
        billetesActual,
        monedasActual,
        delta.caja
      );

      await tx.saldo.update({
        where: { id: saldo.id },
        data: {
          cantidad: new Prisma.Decimal(Math.max(0, nuevaCantidad)),
          bancos: new Prisma.Decimal(Math.max(0, nuevosBancos)),
          billetes: new Prisma.Decimal(Math.max(0, breakdown.billetes)),
          monedas_fisicas: new Prisma.Decimal(Math.max(0, breakdown.monedas)),
          updated_at: new Date(),
        },
      });

      if (args.verbose) {
        console.log(
          `[saldo-usd-ajustado] punto=${saldo.punto_atencion_id} total=${formatMoney(cantidadActual)} -> ${formatMoney(Math.max(0, nuevaCantidad))}`
        );
      }
    }

    await tx.servicioExternoDetalleCierre.deleteMany();
    await tx.servicioExternoCierreDiario.deleteMany();
    await tx.servientregaHistorialSaldo.deleteMany();
    await tx.movimientoSaldo.deleteMany({
      where: {
        OR: [
          { tipo_referencia: { in: ["CAMBIO_DIVISA", "EXCHANGE", "SERVICIO_EXTERNO", "SERVIENTREGA"] } },
          { tipo_movimiento: "CAMBIO_DIVISA" },
        ],
      },
    });
    await tx.cambioDivisa.deleteMany();
    await tx.servicioExternoMovimiento.deleteMany();
    await tx.servicioExternoAsignacion.deleteMany();
    await tx.servicioExternoSaldo.deleteMany();
    await tx.servientregaSaldo.deleteMany();
    await tx.saldoInicial.deleteMany({
      where: { moneda: { codigo: { not: "USD" } } },
    });
    await tx.saldo.deleteMany({
      where: { moneda: { codigo: { not: "USD" } } },
    });

    if (!args.preserveServientrega) return;

    for (const snapshot of servientregaSnapshots) {
      const cantidad = Math.max(0, round2(snapshot.cantidad));
      if (cantidad <= 0.01) continue;

      const billetes = Math.max(0, round2(snapshot.billetes));
      const monedasFisicas = Math.max(0, round2(snapshot.monedasFisicas));
      const bancos = Math.max(0, round2(snapshot.bancos));

      await tx.servicioExternoSaldo.create({
        data: {
          punto_atencion_id: snapshot.puntoAtencionId,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: snapshot.monedaId,
          cantidad: new Prisma.Decimal(cantidad),
          billetes: new Prisma.Decimal(billetes),
          monedas_fisicas: new Prisma.Decimal(monedasFisicas),
          bancos: new Prisma.Decimal(bancos),
        },
      });

      await tx.servicioExternoAsignacion.create({
        data: {
          punto_atencion_id: snapshot.puntoAtencionId,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: snapshot.monedaId,
          monto: new Prisma.Decimal(cantidad),
          saldo_anterior: new Prisma.Decimal(0),
          saldo_nuevo: new Prisma.Decimal(cantidad),
          tipo: TipoAsignacionServicio.INICIAL,
          asignado_por: actorUserId,
          observaciones: "Reset controlado: saldo final previo migrado como nuevo saldo inicial de Servientrega.",
        },
      });

      await tx.servientregaSaldo.create({
        data: {
          punto_atencion_id: snapshot.puntoAtencionId,
          monto_total: new Prisma.Decimal(cantidad),
          monto_usado: new Prisma.Decimal(0),
          billetes: new Prisma.Decimal(billetes),
          monedas_fisicas: new Prisma.Decimal(monedasFisicas),
          creado_por: "RESET_SERVIENTREGA",
        },
      });

      if (args.verbose) {
        console.log(
          `[servientrega-preservado] punto=${snapshot.puntoNombre} saldo=${formatMoney(cantidad)}`
        );
      }
    }
  });

  console.log("Reset completado correctamente.");
  if (args.preserveServientrega) {
    console.log("Servientrega quedó preservado como nueva asignación inicial.");
  }
}

async function main() {
  const args = parseArgs();
  const isProd = process.env.NODE_ENV === "production";

  if (args.execute && isProd && !args.force) {
    throw new Error("NODE_ENV=production detectado. Usa --force para ejecutar.");
  }

  if (!args.execute) {
    await printDryRunSummary(args);
    return;
  }

  console.log("Ejecutando reset controlado de divisas y servicios externos...");
  await executeReset(args);
}

main()
  .catch((error) => {
    console.error("Error en reset de divisas y servicios externos:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });