import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { gyeDayRangeUtcFromDateOnly } from "../../server/utils/timezone.ts";
import saldoReconciliationService from "../../server/services/saldoReconciliationService.ts";

type SetItem =
  | { by: "name"; needle: string; amount: number }
  | { by: "id"; id: string; amount: number };

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  const sets: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--set") {
      const next = argv[i + 1];
      if (!next) throw new Error("Missing value after --set");
      sets.push(next);
      i++;
      continue;
    }

    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.set(key, next);
        i++;
      } else {
        args.set(key, true);
      }
    }
  }

  return { args, sets };
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function parseSetItem(raw: string): SetItem {
  // "NAME:123.45" (NAME can contain spaces)
  // or "<uuid>:123.45" to match a punto_atencion by id
  const idx = raw.lastIndexOf(":");
  if (idx <= 0) throw new Error(`Invalid --set item: ${raw}. Use "NAME:amount"`);
  const left = raw.slice(0, idx).trim();
  const amountStr = raw.slice(idx + 1).trim();
  const amount = Number(amountStr);
  if (!left) throw new Error(`Invalid --set item (empty name/id): ${raw}`);
  if (!Number.isFinite(amount)) throw new Error(`Invalid --set amount: ${raw}`);

  if (isUuid(left)) {
    return { by: "id", id: left, amount: Number(amount.toFixed(2)) };
  }
  return { by: "name", needle: left, amount: Number(amount.toFixed(2)) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function calcularReconciliadoCajaAsOf(
  tx: PrismaClient | Prisma.TransactionClient,
  puntoAtencionId: string,
  monedaId: string,
  dayEndUtcExclusive: Date,
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
      ...(fechaCorte
        ? { fecha: { gte: fechaCorte, lt: dayEndUtcExclusive } }
        : { fecha: { lt: dayEndUtcExclusive } }),
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

  return Number(saldo.toFixed(2));
}

function printHelp() {
  console.log("\nAplicar saldos (pantallazo) como saldo oficial en Saldo + MovimientoSaldo\n");
  console.log("Uso (dry-run):");
  console.log(
    "  npx tsx scripts/fix/apply-screenshot-saldos.ts --date 2026-02-05 --set \"AMAZONAS:141.14\" --set \"EL BOSQUE:2201.03\""
  );
  console.log("\nPara ejecutar (escribe BD):");
  console.log(
    "  CONFIRM=1 npx tsx scripts/fix/apply-screenshot-saldos.ts --date 2026-02-05 --execute --set \"AMAZONAS:141.14\" ..."
  );
  console.log("\nOpciones:");
  console.log("  --currency USD           Código moneda (default USD)");
  console.log("  --userId <uuid>          Usuario que registra el ajuste (si no se envía, toma el primer ADMIN/SUPER_USUARIO activo)");
  console.log("  --execute                Ejecuta cambios (default: dry-run)");
  console.log("  --allow-ambiguous        Si un nombre matchea múltiples puntos, no falla (solo imprime)");
  console.log("\nNotas:");
  console.log(
    "- Crea un MovimientoSaldo de AJUSTE_MANUAL para que el dashboard reconciliado quede igual al pantallazo."
  );
  console.log(
    "- Actualiza Saldo.cantidad y normaliza billetes/monedas_fisicas para que billetes+monedas == cantidad."
  );
}

async function main() {
  const { args, sets } = parseArgs(process.argv.slice(2));

  if (args.get("help") || args.get("h")) {
    printHelp();
    return;
  }

  const date = (args.get("date") as string | undefined) ?? "2026-02-05";
  const currency = (args.get("currency") as string | undefined) ?? "USD";
  const execute = args.get("execute") === true;
  const allowAmbiguous = args.get("allow-ambiguous") === true;
  const userIdArg = args.get("userId") as string | undefined;

  if (!sets.length) {
    throw new Error("No --set provided. Use --set \"NAME:amount\" (repeatable)");
  }

  if (execute && process.env.CONFIRM !== "1") {
    throw new Error(
      "Blocked: to execute write operations, set CONFIRM=1 and pass --execute"
    );
  }

  const items = sets.map(parseSetItem);
  const prisma = new PrismaClient();

  // Movement timestamps are written at end-of-day (Guayaquil) for the provided date.
  // This makes historical day-based reports line up with the screenshot date.
  const { lt: dayEndUtcExclusive } = gyeDayRangeUtcFromDateOnly(date);
  const movimientoFecha = new Date(dayEndUtcExclusive.getTime() - 1);

  try {
    const moneda = await prisma.moneda.findFirst({
      where: { codigo: currency },
      select: { id: true, codigo: true },
    });
    if (!moneda) throw new Error(`Moneda not found for codigo=${currency}`);

    const userId = execute
      ? userIdArg ??
        (
          await prisma.usuario.findFirst({
            where: {
              activo: true,
              rol: { in: ["ADMIN", "SUPER_USUARIO"] },
            },
            select: { id: true },
            orderBy: { created_at: "asc" },
          })
        )?.id
      : undefined;

    if (execute && !userId) {
      throw new Error(
        "No admin user found to attribute the adjustment. Pass --userId <uuid> or create an admin user."
      );
    }

    console.log("\n# TARGETS");
    console.log("date:", date);
    console.log("currency:", moneda.codigo);
    console.log("mode:", execute ? "EXECUTE" : "DRY-RUN");

    for (const it of items) {
      const matches =
        it.by === "id"
          ? await prisma.puntoAtencion.findMany({
              where: { id: it.id },
              select: { id: true, nombre: true, activo: true },
            })
          : await prisma.puntoAtencion.findMany({
              where: { nombre: { contains: it.needle, mode: "insensitive" } },
              select: { id: true, nombre: true, activo: true },
              orderBy: { nombre: "asc" },
            });

      const label = it.by === "id" ? it.id : it.needle;

      if (matches.length === 0) {
        console.log(`\n- ${label}: NO MATCH (skipping)`);
        continue;
      }

      if (matches.length > 1 && !allowAmbiguous) {
        console.log(`\n- ${label}: AMBIGUOUS (${matches.length} matches) - aborting`);
        for (const m of matches) {
          console.log(`  - ${m.nombre} | ${m.id} | activo=${m.activo}`);
        }
        throw new Error(
          `Ambiguous point match for "${label}". Use a more specific name or pass --allow-ambiguous for print-only.`
        );
      }

      // If ambiguous but allowed, just print and continue (no writes)
      if (matches.length > 1 && allowAmbiguous) {
        console.log(`\n- ${label}: AMBIGUOUS (${matches.length} matches) (print-only)`);
        for (const m of matches) {
          console.log(`  - ${m.nombre} | ${m.id} | activo=${m.activo}`);
        }
        continue;
      }

      const point = matches[0];

      const currentReconciled = await calcularReconciliadoCajaAsOf(
        prisma,
        point.id,
        moneda.id,
        dayEndUtcExclusive
      );
      const target = it.amount;
      const diff = round2(target - currentReconciled);

      console.log(`\n- ${point.nombre} | ${point.id}`);
      console.log(`  - current reconciliado (as-of fin día GYE): ${currentReconciled}`);
      console.log(`  - target  Saldo.cantidad: ${target}`);
      console.log(`  - diff (target-current): ${diff}`);

      if (!execute) continue;

      await prisma.$transaction(async (tx) => {
        // Always keep Saldo table aligned with the operator target (breakdown normalized).
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: point.id,
              moneda_id: moneda.id,
            },
          },
          update: {
            cantidad: new Prisma.Decimal(target),
            billetes: new Prisma.Decimal(target),
            monedas_fisicas: new Prisma.Decimal(0),
          },
          create: {
            punto_atencion_id: point.id,
            moneda_id: moneda.id,
            cantidad: new Prisma.Decimal(target),
            billetes: new Prisma.Decimal(target),
            monedas_fisicas: new Prisma.Decimal(0),
            bancos: new Prisma.Decimal(0),
          },
        });

        const descripcion = `AJUSTE SALDO FIN DIA ${date} (pantallazo)`;
        const { gte: dayStartUtc, lt: dayEndUtc } = gyeDayRangeUtcFromDateOnly(date);

        const existing = await tx.movimientoSaldo.findFirst({
          where: {
            punto_atencion_id: point.id,
            moneda_id: moneda.id,
            tipo_referencia: "AJUSTE_MANUAL",
            descripcion,
            fecha: { gte: dayStartUtc, lt: dayEndUtc },
          },
          select: { id: true },
          orderBy: { created_at: "desc" },
        });

        // Compute base balance excluding the existing adjustment (if present),
        // then set adjustment = target - base. This makes the operation idempotent.
        const baseSinAjuste = await calcularReconciliadoCajaAsOf(
          tx,
          point.id,
          moneda.id,
          dayEndUtcExclusive,
          existing ? { excludeMovimientoId: existing.id } : undefined
        );

        const ajusteNecesario = round2(target - baseSinAjuste);

        if (Math.abs(ajusteNecesario) < 0.005) {
          if (existing) {
            // If the base already matches, the adjustment is unnecessary; remove it.
            await tx.movimientoSaldo.delete({ where: { id: existing.id } });
            console.log("  - removed existing adjustment (no longer needed)");
          } else {
            console.log("  - no-op (base ya coincide; sin ajuste)");
          }
          return;
        }

        const tipo_movimiento = ajusteNecesario > 0 ? "INGRESO" : "EGRESO";
        const signedMonto =
          ajusteNecesario > 0
            ? Math.abs(ajusteNecesario)
            : -Math.abs(ajusteNecesario);

        if (existing) {
          await tx.movimientoSaldo.update({
            where: { id: existing.id },
            data: {
              tipo_movimiento,
              monto: new Prisma.Decimal(signedMonto),
              saldo_anterior: new Prisma.Decimal(baseSinAjuste),
              saldo_nuevo: new Prisma.Decimal(target),
              usuario_id: String(userId),
              fecha: movimientoFecha,
            },
          });
        } else {
          await tx.movimientoSaldo.create({
            data: {
              punto_atencion_id: point.id,
              moneda_id: moneda.id,
              tipo_movimiento,
              monto: new Prisma.Decimal(signedMonto),
              saldo_anterior: new Prisma.Decimal(baseSinAjuste),
              saldo_nuevo: new Prisma.Decimal(target),
              tipo_referencia: "AJUSTE_MANUAL",
              referencia_id: null,
              descripcion,
              usuario_id: String(userId),
              fecha: movimientoFecha,
            },
          });
        }
      });

      console.log("  - applied");
    }

    console.log("\nDone.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("apply-screenshot-saldos failed:", e);
  process.exit(1);
});
