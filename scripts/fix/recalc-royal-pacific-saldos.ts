import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import saldoReconciliationService from "../../server/services/saldoReconciliationService.ts";
import { gyeDayRangeUtcFromDateOnly } from "../../server/utils/timezone.ts";

type Target = {
  currency: string;
  billetes: number;
  monedas: number;
};

const DEFAULT_POINT_ID = "fa75bb3a-e881-471a-b558-749b0f0de0ff"; // Royal Pacific

const TARGETS: Target[] = [
  { currency: "COP", billetes: 6579000, monedas: 17540.1 },
  { currency: "GBP", billetes: 520, monedas: 17.24 },
  { currency: "MXN", billetes: 7050, monedas: 0.7 },
];

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function getArgValue(name: string) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function isBankMovement(descripcion: string | null | undefined): boolean {
  const d = (descripcion ?? "").toLowerCase();
  return d.includes("bancos") || d.includes("banco");
}

function isScriptAjusteDescripcion(desc: string | null | undefined): boolean {
  const d = (desc ?? "").toLowerCase();
  // Ajustes creados por este script (versiones anteriores)
  return (
    d.includes("ajuste saldo caja") &&
    d.includes("operador") &&
    d.includes("royal pacific")
  );
}

async function pickAdminUserId(prisma: PrismaClient) {
  const u = await prisma.usuario.findFirst({
    where: { activo: true, rol: { in: ["ADMIN", "SUPER_USUARIO"] } },
    select: { id: true },
    orderBy: { created_at: "asc" },
  });
  return u?.id ?? null;
}

async function calcularCajaReconciliada(
  tx: PrismaClient | Prisma.TransactionClient,
  puntoAtencionId: string,
  monedaId: string,
  opts?: { excludeMovimientoId?: string }
): Promise<number> {
  const saldoInicial = await tx.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      activo: true,
    },
    select: {
      cantidad_inicial: true,
      fecha_asignacion: true,
    },
    orderBy: { fecha_asignacion: "desc" },
  });

  const base = saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;
  const fechaCorte = saldoInicial?.fecha_asignacion ?? null;

  const movs = await tx.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      ...(fechaCorte ? { fecha: { gte: fechaCorte } } : {}),
    },
    select: {
      id: true,
      tipo_movimiento: true,
      monto: true,
      descripcion: true,
    },
    orderBy: { fecha: "asc" },
  });

  let saldo = base;
  for (const m of movs) {
    if (opts?.excludeMovimientoId && m.id === opts.excludeMovimientoId) continue;
    const desc = (m.descripcion ?? "").toLowerCase();
    if (desc.includes("bancos") || desc.includes("banco")) continue;

    const delta = saldoReconciliationService._normalizarMonto(
      String(m.tipo_movimiento),
      Number(m.monto),
      m.descripcion
    );

    if (String(m.tipo_movimiento).toUpperCase() === "SALDO_INICIAL") continue;
    saldo += delta;
  }

  return Number(round2(saldo).toFixed(2));
}

function printHelp() {
  console.log("\nRecalcular y ajustar saldos (Royal Pacific)\n");
  console.log("Objetivo (según operador):");
  for (const t of TARGETS) {
    console.log(
      `  - ${t.currency}: billetes=${t.billetes} monedas=${t.monedas} total=${round2(
        t.billetes + t.monedas
      )}`
    );
  }
  console.log("\nUso (dry-run):");
  console.log("  npx tsx scripts/fix/recalc-royal-pacific-saldos.ts");
  console.log(
    "  npx tsx scripts/fix/recalc-royal-pacific-saldos.ts --initial --date 2026-02-08"
  );
  console.log("\nEjecutar (escribe BD):");
  console.log(
    "  CONFIRM=1 npx tsx scripts/fix/recalc-royal-pacific-saldos.ts --execute"
  );
  console.log(
    "  CONFIRM=1 npx tsx scripts/fix/recalc-royal-pacific-saldos.ts --initial --execute --date 2026-02-08"
  );
  console.log("\nOpciones:");
  console.log("  --pointId <uuid>        Punto de atención (default: Royal Pacific)");
  console.log("  --date YYYY-MM-DD       Fecha base (GYE). Default: 2026-02-08 (domingo)");
  console.log("  --initial               Trata los targets como SaldoInicial del día y recalcula los movimientos desde ese inicio");
  console.log("  --userId <uuid>         Usuario para atribuir el ajuste (default: primer ADMIN/SUPER_USUARIO activo)");
  console.log("  --help                  Mostrar ayuda");
  console.log("\nNotas:");
  console.log(
    "- Modo normal: Crea/actualiza un MovimientoSaldo (tipo_referencia=AJUSTE_MANUAL) por moneda para que el saldo reconciliado cuadre con el objetivo."
  );
  console.log(
    "- Modo --initial: Actualiza SaldoInicial del día y recalcula saldo_anterior/saldo_nuevo de MovimientoSaldo (CAJA) desde el inicio del día."
  );
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const execute = hasFlag("--execute");
  const initialMode = hasFlag("--initial");
  if (execute && process.env.CONFIRM !== "1") {
    throw new Error(
      "Blocked: to execute write operations, set CONFIRM=1 and pass --execute"
    );
  }

  const pointId = getArgValue("--pointId") ?? DEFAULT_POINT_ID;
  const date = getArgValue("--date") ?? "2026-02-08";
  const userIdArg = getArgValue("--userId");

  const { gte: dayStartUtc, lt: dayEndUtcExclusive } = gyeDayRangeUtcFromDateOnly(date);
  // El movimiento (modo ajuste) se escribe al final del día (Guayaquil) para que reporte por fecha cuadre.
  const movimientoFecha = new Date(dayEndUtcExclusive.getTime() - 1);

  const prisma = new PrismaClient();

  try {
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: pointId },
      select: { id: true, nombre: true, activo: true },
    });
    if (!punto) throw new Error(`PuntoAtencion no encontrado: ${pointId}`);

    const userId = execute ? userIdArg ?? (await pickAdminUserId(prisma)) : null;
    if (execute && !userId) {
      throw new Error(
        "No admin user found to attribute the adjustment. Pass --userId <uuid> or create an admin user."
      );
    }

    console.log("\n# TARGET");
    console.log(`point: ${punto.nombre} | ${punto.id} | activo=${punto.activo}`);
    console.log(`mode: ${execute ? "EXECUTE" : "DRY-RUN"}`);
    console.log(`date: ${date} (GYE)`);
    console.log(`initialMode: ${initialMode ? "YES" : "NO"}`);

    for (const t of TARGETS) {
      const moneda = await prisma.moneda.findFirst({
        where: { codigo: t.currency },
        select: { id: true, codigo: true },
      });
      if (!moneda) {
        console.log(`\n- ${t.currency}: moneda no encontrada (skipping)`);
        continue;
      }

      const targetCantidad = round2(t.billetes + t.monedas);

      // =====================
      // MODO: SALDO INICIAL + RECALC CADENA
      // =====================
      if (initialMode) {
        // 1) Ver saldo inicial activo actual
        const saldoInicialActivo = await prisma.saldoInicial.findFirst({
          where: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            activo: true,
          },
          select: {
            id: true,
            cantidad_inicial: true,
            fecha_asignacion: true,
          },
          orderBy: { fecha_asignacion: "desc" },
        });

        // 2) Contar movimientos CAJA desde inicio del día (excluye bancos)
        const movimientosCaja = await prisma.movimientoSaldo.findMany({
          where: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            fecha: { gte: dayStartUtc },
          },
          select: { id: true, monto: true, descripcion: true, tipo_movimiento: true, fecha: true, created_at: true },
          orderBy: [{ fecha: "asc" }, { created_at: "asc" }, { id: "asc" }],
        });

        const movimientosCajaFiltrados = movimientosCaja.filter((m) => {
          if (isBankMovement(m.descripcion)) return false;
          // La tabla SaldoInicial es la línea base; evitar doble conteo.
          if (String(m.tipo_movimiento).toUpperCase() === "SALDO_INICIAL") return false;
          // Evitar re-aplicar ajustes que este script creó anteriormente.
          if (m.tipo_movimiento === "AJUSTE" && isScriptAjusteDescripcion(m.descripcion)) return false;
          if (m.tipo_movimiento === "INGRESO" || m.tipo_movimiento === "EGRESO" || m.tipo_movimiento === "AJUSTE" || m.tipo_movimiento === "TRANSFERENCIA_ENTRANTE" || m.tipo_movimiento === "TRANSFERENCIA_ENTRADA" || m.tipo_movimiento === "TRANSFERENCIA_SALIENTE" || m.tipo_movimiento === "TRANSFERENCIA_SALIDA" || m.tipo_movimiento === "TRANSFERENCIA_DEVOLUCION") {
            return true;
          }
          // Tipos no contemplados: conservar (para no romper) si afectan caja
          return true;
        });

        // 3) Calcular saldo fin de domingo (solo ese día) y saldo actual (desde domingo)
        let saldoEndSunday = targetCantidad;
        for (const m of movimientosCajaFiltrados) {
          if (m.fecha >= dayEndUtcExclusive) break;
          const monto = Number(m.monto);
          if (!Number.isFinite(monto)) continue;
          saldoEndSunday = round2(saldoEndSunday + monto);
        }

        let saldoNow = targetCantidad;
        for (const m of movimientosCajaFiltrados) {
          const monto = Number(m.monto);
          if (!Number.isFinite(monto)) continue;
          saldoNow = round2(saldoNow + monto);
        }

        console.log(`\n- ${t.currency} (INITIAL)`);
        console.log(
          `  - saldoInicial activo actual: ${saldoInicialActivo ? Number(saldoInicialActivo.cantidad_inicial) : 0} @ ${saldoInicialActivo ? saldoInicialActivo.fecha_asignacion.toISOString() : "(none)"}`
        );
        console.log(`  - nuevo saldoInicial (domingo inicio): ${targetCantidad}`);
        console.log(
          `  - movimientos CAJA desde ${date}: total=${movimientosCaja.length}, usados=${movimientosCajaFiltrados.length}`
        );
        console.log(`  - saldo fin domingo (estimado): ${saldoEndSunday}`);
        console.log(`  - saldo actual (estimado desde domingo): ${saldoNow}`);

        if (!execute) continue;

        // Ejecutar: set SaldoInicial + recalc cadena saldo_anterior/saldo_nuevo + actualizar Saldo
        await prisma.$transaction(async (tx) => {
          // (A) desactivar saldoInicial activo
          await tx.saldoInicial.updateMany({
            where: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
              activo: true,
            },
            data: { activo: false },
          });

          // (B) crear saldoInicial nuevo
          await tx.saldoInicial.create({
            data: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
              cantidad_inicial: new Prisma.Decimal(targetCantidad),
              fecha_asignacion: dayStartUtc,
              asignado_por: String(userId),
              activo: true,
              observaciones: `Saldo inicial ${date} (operador)`,
            },
          });

          // (C) eliminar ajustes viejos del script (si existen) para no contaminar el recálculo
          const scriptAdjusts = await tx.movimientoSaldo.findMany({
            where: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
              tipo_referencia: "AJUSTE_MANUAL",
              descripcion: { contains: "Royal Pacific", mode: "insensitive" },
            },
            select: { id: true, descripcion: true },
            orderBy: { created_at: "desc" },
            take: 100,
          });

          for (const a of scriptAdjusts) {
            if (isScriptAjusteDescripcion(a.descripcion)) {
              await tx.movimientoSaldo.delete({ where: { id: a.id } });
            }
          }

          // (D) recalcular cadena CAJA desde inicio del domingo
          const movs = await tx.movimientoSaldo.findMany({
            where: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
              fecha: { gte: dayStartUtc },
            },
            select: {
              id: true,
              monto: true,
              descripcion: true,
              tipo_movimiento: true,
              fecha: true,
              created_at: true,
            },
            orderBy: [{ fecha: "asc" }, { created_at: "asc" }, { id: "asc" }],
          });

          const movsCaja = movs.filter((m) => {
            if (isBankMovement(m.descripcion)) return false;
            if (String(m.tipo_movimiento).toUpperCase() === "SALDO_INICIAL") return false;
            if (m.tipo_movimiento === "AJUSTE" && isScriptAjusteDescripcion(m.descripcion)) return false;
            return true;
          });

          let running = targetCantidad;
          for (const m of movsCaja) {
            const monto = Number(m.monto);
            if (!Number.isFinite(monto)) continue;
            const anterior = running;
            const nuevo = round2(running + monto);
            running = nuevo;

            await tx.movimientoSaldo.update({
              where: { id: m.id },
              data: {
                saldo_anterior: new Prisma.Decimal(anterior),
                saldo_nuevo: new Prisma.Decimal(nuevo),
              },
            });
          }

          // (E) actualizar Saldo (caja) al saldo actual calculado desde domingo
          await tx.saldo.upsert({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: punto.id,
                moneda_id: moneda.id,
              },
            },
            update: {
              cantidad: new Prisma.Decimal(running),
              billetes: new Prisma.Decimal(running),
              monedas_fisicas: new Prisma.Decimal(0),
            },
            create: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
              cantidad: new Prisma.Decimal(running),
              billetes: new Prisma.Decimal(running),
              monedas_fisicas: new Prisma.Decimal(0),
              bancos: new Prisma.Decimal(0),
            },
          });
        });

        console.log("  - applied (SaldoInicial + recalc cadena)");
        continue;
      }

      const descripcion = `AJUSTE SALDO CAJA ${date} (OPERADOR) ${t.currency} Royal Pacific`;
      const legacyDescripcion = `AJUSTE SALDO CAJA (OPERADOR) ${t.currency} Royal Pacific`;

      // Estado actual (reconciliado) y diff
      const existingCandidates = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          tipo_referencia: "AJUSTE_MANUAL",
          descripcion: { in: [descripcion, legacyDescripcion] },
        },
        select: { id: true },
        orderBy: { created_at: "desc" },
        take: 5,
      });

      const existing = existingCandidates[0] ?? null;

      const baseSinAjuste = await calcularCajaReconciliada(
        prisma,
        punto.id,
        moneda.id,
        existing ? { excludeMovimientoId: existing.id } : undefined
      );

      const ajusteNecesario = round2(targetCantidad - baseSinAjuste);

      console.log(`\n- ${t.currency}`);
      console.log(`  - base reconciliado (sin ajuste script): ${baseSinAjuste}`);
      console.log(`  - target cantidad: ${targetCantidad}`);
      console.log(`  - diff (target-base): ${ajusteNecesario}`);
      console.log(
        `  - breakdown: billetes=${t.billetes} monedas=${t.monedas} (sum=${targetCantidad})`
      );

      if (!execute) continue;

      await prisma.$transaction(async (tx) => {
        // Buscar ajustes previos (descripción actual o legacy). Si hay múltiples, dejar solo el más reciente.
        const existingTxCandidates = await tx.movimientoSaldo.findMany({
          where: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            tipo_referencia: "AJUSTE_MANUAL",
            descripcion: { in: [descripcion, legacyDescripcion] },
          },
          select: { id: true, descripcion: true },
          orderBy: { created_at: "desc" },
          take: 10,
        });

        const mainExisting = existingTxCandidates[0] ?? null;
        const extras = existingTxCandidates.slice(1);
        for (const ex of extras) {
          await tx.movimientoSaldo.delete({ where: { id: ex.id } });
        }

        // Recalcular base sin el ajuste "principal", dentro de TX
        const base = await calcularCajaReconciliada(
          tx,
          punto.id,
          moneda.id,
          mainExisting ? { excludeMovimientoId: mainExisting.id } : undefined
        );

        const adj = round2(targetCantidad - base);

        if (Math.abs(adj) < 0.005) {
          if (mainExisting) {
            await tx.movimientoSaldo.delete({ where: { id: mainExisting.id } });
          }
        } else {
          const tipo_movimiento = adj > 0 ? "INGRESO" : "EGRESO";
          const signedMonto =
            adj > 0 ? Math.abs(adj) : -Math.abs(adj);

          const dataCommon = {
            tipo_movimiento,
            monto: new Prisma.Decimal(signedMonto),
            saldo_anterior: new Prisma.Decimal(base),
            saldo_nuevo: new Prisma.Decimal(targetCantidad),
            usuario_id: String(userId),
            fecha: movimientoFecha,
            descripcion,
          };

          if (mainExisting) {
            await tx.movimientoSaldo.update({
              where: { id: mainExisting.id },
              data: dataCommon,
            });
          } else {
            await tx.movimientoSaldo.create({
              data: {
                punto_atencion_id: punto.id,
                moneda_id: moneda.id,
                tipo_referencia: "AJUSTE_MANUAL",
                referencia_id: null,
                ...dataCommon,
              },
            });
          }
        }

        // Finalmente: dejar Saldo con desglose EXACTO indicado por operador
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
            },
          },
          update: {
            cantidad: new Prisma.Decimal(targetCantidad),
            billetes: new Prisma.Decimal(round2(t.billetes)),
            monedas_fisicas: new Prisma.Decimal(round2(t.monedas)),
          },
          create: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            cantidad: new Prisma.Decimal(targetCantidad),
            billetes: new Prisma.Decimal(round2(t.billetes)),
            monedas_fisicas: new Prisma.Decimal(round2(t.monedas)),
            bancos: new Prisma.Decimal(0),
          },
        });
      });

      console.log("  - applied");
    }

    console.log("\nDone.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("recalc-royal-pacific-saldos failed:", e);
  process.exit(1);
});
