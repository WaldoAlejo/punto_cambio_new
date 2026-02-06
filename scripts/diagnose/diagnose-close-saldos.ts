import { Prisma, PrismaClient } from "@prisma/client";

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.set(key, next);
        i++;
      } else {
        args.set(key, true);
      }
    } else {
      positional.push(a);
    }
  }

  return { args, positional };
}

function parseDateOnly(dateStr: string): { y: number; m: number; d: number } {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateStr);
  if (!m) throw new Error(`Invalid --date. Expected YYYY-MM-DD, got: ${dateStr}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return { y, m: mo, d };
}

function gyeUtcRangeForDateOnly(dateStr: string): { from: Date; to: Date } {
  const { y, m, d } = parseDateOnly(dateStr);
  // GYE is UTC-5; start of local day is 05:00Z.
  const from = new Date(Date.UTC(y, m - 1, d, 5, 0, 0, 0));
  const to = new Date(Date.UTC(y, m - 1, d + 1, 5, 0, 0, 0));
  return { from, to };
}

function utcMidnightRange(dateStr: string): { from: Date; to: Date } {
  const { y, m, d } = parseDateOnly(dateStr);
  const from = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const to = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  return { from, to };
}

function formatMoney(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function normalizarMonto(tipoMovimiento: string, monto: number, descripcion?: string | null): number {
  const abs = Math.abs(monto);
  const tipo = (tipoMovimiento || "").toUpperCase();
  const desc = (descripcion || "").toLowerCase();

  const ingresos = new Set([
    "INGRESO",
    "INGRESOS",
    "VENTA",
    "SALDO",
    "SALDO EN CAJA",
    "TRANSFERENCIA_ENTRANTE",
    "TRANSFERENCIA_ENTRADA",
    "TRANSFERENCIA_RECIBIDA",
    "TRANSFERENCIA_DEVOLUCION",
  ]);

  const egresos = new Set([
    "EGRESO",
    "EGRESOS",
    "COMPRA",
    "TRANSFERENCIA_SALIENTE",
    "TRANSFERENCIA_SALIDA",
    "TRANSFERENCIA_ENVIADA",
  ]);

  if (tipo === "SALDO_INICIAL") return 0;
  if (tipo === "AJUSTE") return monto;

  if (tipo === "CAMBIO_DIVISA") {
    if (desc.startsWith("egreso por cambio")) return -abs;
    if (desc.startsWith("ingreso por cambio")) return abs;
    return monto;
  }

  if (ingresos.has(tipo)) return abs;
  if (egresos.has(tipo)) return -abs;

  if (
    tipo.includes("SALIDA") ||
    tipo.includes("SALIENTE") ||
    tipo.includes("EGRESO") ||
    tipo.includes("COMPRA")
  ) {
    return -abs;
  }
  if (
    tipo.includes("ENTRADA") ||
    tipo.includes("ENTRANTE") ||
    tipo.includes("INGRESO") ||
    tipo.includes("VENTA") ||
    tipo.includes("DEVOLUCION")
  ) {
    return abs;
  }

  return monto;
}

async function main() {
  const { args } = parseArgs(process.argv.slice(2));
  const date = (args.get("date") as string | undefined) ?? "2026-02-05";
  const namesRaw = (args.get("names") as string | undefined) ??
    "AMAZONAS,EL BOSQUE,PLAZA,OFICINA,SCALA";
  const findAmountsRaw = (args.get("findAmounts") as string | undefined) ??
    "141.14,2201.03,155.28,3462.73,2101.12";
  const names = namesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const findAmounts = findAmountsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));

  const prisma = new PrismaClient();

  try {
    const usd = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
      select: { id: true },
    });
    if (!usd) throw new Error("USD moneda not found");

    const points = await prisma.puntoAtencion.findMany({
      where: {
        OR: names.map((n) => ({ nombre: { contains: n, mode: "insensitive" } })),
      },
      select: { id: true, nombre: true, activo: true },
      orderBy: { nombre: "asc" },
    });

    console.log("\n# POINTS (matched)");
    for (const p of points) {
      console.log(`- ${p.nombre} | ${p.id} | activo=${p.activo}`);
    }

    const { from: fromGye, to: toGye } = gyeUtcRangeForDateOnly(date);
    const { from: fromDate, to: toDate } = utcMidnightRange(date);

    console.log("\n# WINDOWS");
    console.log("dateOnly:", date);
    console.log("GYE window UTC:", fromGye.toISOString(), "->", toGye.toISOString());
    console.log("DATE(@db.Date) UTC range:", fromDate.toISOString(), "->", toDate.toISOString());

    const pointIds = points.map((p) => p.id);

    // Recent cierre/cuadre lookback (helps confirm points truly closed)
    const daysBack = Number(args.get("daysBack") ?? 3);
    const fromRecent = new Date(fromGye.getTime() - Math.max(0, daysBack) * 24 * 60 * 60 * 1000);

    const [cierresRecent, cuadresRecent] = await Promise.all([
      prisma.cierreDiario.findMany({
        where: {
          punto_atencion_id: { in: pointIds },
          fecha: { gte: fromRecent },
        },
        select: {
          id: true,
          punto_atencion_id: true,
          fecha: true,
          estado: true,
          fecha_cierre: true,
        },
        orderBy: { fecha: "desc" },
        take: 200,
      }),
      prisma.cuadreCaja.findMany({
        where: {
          punto_atencion_id: { in: pointIds },
          fecha: { gte: fromRecent },
        },
        select: {
          id: true,
          punto_atencion_id: true,
          fecha: true,
          estado: true,
          fecha_cierre: true,
        },
        orderBy: { fecha: "desc" },
        take: 200,
      }),
    ]);

    const cierres = await prisma.cierreDiario.findMany({
      where: {
        punto_atencion_id: { in: pointIds },
        fecha: { gte: fromDate, lt: toDate },
      },
      select: {
        id: true,
        punto_atencion_id: true,
        fecha: true,
        estado: true,
        fecha_cierre: true,
        usuario_id: true,
        cerrado_por: true,
      },
      orderBy: { fecha: "asc" },
    });

    const cuadres = await prisma.cuadreCaja.findMany({
      where: {
        punto_atencion_id: { in: pointIds },
        fecha: { gte: fromGye, lt: toGye },
      },
      select: {
        id: true,
        punto_atencion_id: true,
        fecha: true,
        estado: true,
        fecha_cierre: true,
        detalles: {
          where: { moneda_id: usd.id },
          select: {
            conteo_fisico: true,
            billetes: true,
            monedas_fisicas: true,
            diferencia: true,
            saldo_apertura: true,
            saldo_cierre: true,
          },
        },
      },
      orderBy: { fecha: "asc" },
    });

    const saldos = await prisma.saldo.findMany({
      where: {
        punto_atencion_id: { in: pointIds },
        moneda_id: usd.id,
      },
      select: {
        punto_atencion_id: true,
        cantidad: true,
        billetes: true,
        monedas_fisicas: true,
        bancos: true,
        updated_at: true,
      },
    });

    // Saldo (USD caja) as-of end of the GYE day, based on HistorialSaldo.
    // Useful when there is no CierreDiario/CuadreCaja closed record.
    const lastHistorialRows = pointIds.length
      ? await prisma.$queryRaw<
          Array<{
            punto_atencion_id: string;
            cantidad_nueva: unknown;
            fecha: Date;
          }>
        >(
          Prisma.sql`
          SELECT DISTINCT ON (punto_atencion_id)
            punto_atencion_id,
            cantidad_nueva,
            fecha
          FROM "HistorialSaldo"
          WHERE moneda_id = ${usd.id}
            AND punto_atencion_id = ANY(${pointIds}::text[])
            AND fecha < ${toGye}
          ORDER BY punto_atencion_id, fecha DESC
        `
        )
      : [];
    const lastHistorialByPoint = new Map(
      lastHistorialRows.map((r) => [r.punto_atencion_id, r] as const)
    );

    const pointById = new Map(points.map((p) => [p.id, p] as const));

    console.log("\n# CIERRE_DIARIO (by point)");
    for (const p of points) {
      const c = cierres.find((x) => x.punto_atencion_id === p.id);
      if (!c) {
        console.log(`- ${p.nombre}: (sin registro)`);
        continue;
      }
      console.log(
        `- ${p.nombre}: estado=${c.estado} fecha=${c.fecha.toISOString()} cierre=${
          c.fecha_cierre ? c.fecha_cierre.toISOString() : "null"
        } id=${c.id}`
      );
    }

    console.log("\n# CUADRE_CAJA (by point; within GYE window)");
    for (const p of points) {
      const rows = cuadres.filter((x) => x.punto_atencion_id === p.id);
      if (rows.length === 0) {
        console.log(`- ${p.nombre}: (sin registros)`);
        continue;
      }
      for (const r of rows) {
        const d = r.detalles[0];
        const efectivo = d ? formatMoney(d.conteo_fisico) : null;
        console.log(
          `- ${p.nombre}: ${r.estado} fecha=${r.fecha.toISOString()} cierre=${
            r.fecha_cierre ? r.fecha_cierre.toISOString() : "null"
          } id=${r.id} USD_efectivo=${efectivo}`
        );
      }
    }

    console.log("\n# SALDO USD actual (by point)");
    for (const p of points) {
      const s = saldos.find((x) => x.punto_atencion_id === p.id);
      if (!s) {
        console.log(`- ${p.nombre}: (sin saldo USD)`);
        continue;
      }
      console.log(
        `- ${p.nombre}: caja=${formatMoney(s.cantidad)} billetes=${formatMoney(
          s.billetes
        )} monedas=${formatMoney(s.monedas_fisicas)} bancos=${formatMoney(
          s.bancos
        )} updated_at=${s.updated_at.toISOString()}`
      );
    }

    console.log("\n# SALDO USD (caja) al cierre del día (según HistorialSaldo; < fin ventana GYE)");
    for (const p of points) {
      const r = lastHistorialByPoint.get(p.id);
      if (!r) {
        console.log(`- ${p.nombre}: (sin historial antes de fin del día)`);
        continue;
      }
      console.log(
        `- ${p.nombre}: caja=${formatMoney(r.cantidad_nueva)} fecha=${r.fecha.toISOString()}`
      );
    }

    // Also: extra hint if there are other points matching PLAZA/OFICINA etc.
    const extra = await prisma.puntoAtencion.findMany({
      where: {
        OR: [
          { nombre: { contains: "PLAZA", mode: "insensitive" } },
          { nombre: { contains: "OFICINA", mode: "insensitive" } },
        ],
      },
      select: { id: true, nombre: true, activo: true },
      orderBy: { nombre: "asc" },
    });

    console.log("\n# EXTRA matches (PLAZA/OFICINA)");
    for (const p of extra) {
      console.log(`- ${p.nombre} | ${p.id} | activo=${p.activo}`);
    }

    // Reconciled cash (USD) as-of end of day (same idea as /vista-saldos-puntos?reconciliar=true,
    // but time-bounded to help match a screenshot taken on that day).
    const saldoInicialUsd = await prisma.saldoInicial.findMany({
      where: {
        activo: true,
        punto_atencion_id: { in: pointIds },
        moneda_id: usd.id,
      },
      select: { punto_atencion_id: true, cantidad_inicial: true },
    });
    const saldoInicialMap = new Map(
      saldoInicialUsd.map((r) => [r.punto_atencion_id, Number(r.cantidad_inicial)] as const)
    );

    const movs = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: { in: pointIds },
        moneda_id: usd.id,
        fecha: { lt: toGye },
      },
      select: {
        punto_atencion_id: true,
        tipo_movimiento: true,
        monto: true,
        descripcion: true,
        fecha: true,
      },
      orderBy: { fecha: "asc" },
    });

    const reconciled = new Map<string, number>();
    for (const p of points) {
      reconciled.set(p.id, Number((saldoInicialMap.get(p.id) ?? 0).toFixed(2)));
    }
    for (const m of movs) {
      const desc = (m.descripcion ?? "").toLowerCase();
      if (desc.includes("bancos")) continue; // efectivo excluye bancos
      const current = reconciled.get(m.punto_atencion_id) ?? 0;
      const delta = normalizarMonto(String(m.tipo_movimiento), Number(m.monto), m.descripcion);
      reconciled.set(m.punto_atencion_id, Number((current + delta).toFixed(2)));
    }

    console.log("\n# RECONCILIADO USD (caja) hasta fin del día (MovSaldo<fin GYE + SaldoInicial)" );
    for (const p of points) {
      console.log(`- ${p.nombre}: caja=${Number((reconciled.get(p.id) ?? 0).toFixed(2))}`);
    }

    console.log(`\n# RECIENTES (últimos ${daysBack} días desde inicio GYE) — CierreDiario`);
    for (const p of points) {
      const rows = cierresRecent.filter((x) => x.punto_atencion_id === p.id).slice(0, 3);
      if (rows.length === 0) {
        console.log(`- ${p.nombre}: (sin registros)`);
        continue;
      }
      for (const r of rows) {
        console.log(
          `- ${p.nombre}: ${r.estado} fecha=${r.fecha.toISOString()} cierre=${
            r.fecha_cierre ? r.fecha_cierre.toISOString() : "null"
          } id=${r.id}`
        );
      }
    }

    console.log(`\n# RECIENTES (últimos ${daysBack} días desde inicio GYE) — CuadreCaja`);
    for (const p of points) {
      const rows = cuadresRecent.filter((x) => x.punto_atencion_id === p.id).slice(0, 3);
      if (rows.length === 0) {
        console.log(`- ${p.nombre}: (sin registros)`);
        continue;
      }
      for (const r of rows) {
        console.log(
          `- ${p.nombre}: ${r.estado} fecha=${r.fecha.toISOString()} cierre=${
            r.fecha_cierre ? r.fecha_cierre.toISOString() : "null"
          } id=${r.id}`
        );
      }
    }

    if (findAmounts.length > 0) {
      const amountSql = Prisma.join(findAmounts.map((n) => Prisma.sql`${n}`));
      const hits = await prisma.$queryRaw<
        Array<{ punto_atencion_id: string; nombre: string; cantidad: unknown }>
      >(Prisma.sql`
        SELECT s.punto_atencion_id, p.nombre, s.cantidad
        FROM "Saldo" s
        JOIN "PuntoAtencion" p ON p.id = s.punto_atencion_id
        WHERE s.moneda_id = ${usd.id}
          AND s.cantidad IN (${amountSql})
        ORDER BY p.nombre ASC
      `);

      console.log("\n# FIND AMOUNTS (current Saldo USD matches)");
      if (hits.length === 0) {
        console.log("- (sin coincidencias exactas en Saldo USD)" );
      } else {
        for (const h of hits) {
          console.log(`- ${h.nombre} | ${h.punto_atencion_id} | caja=${formatMoney(h.cantidad)}`);
        }
      }
    }

    // sanity: print unmatched names if any
    const matchedNameCounts = new Map<string, number>();
    for (const n of names) matchedNameCounts.set(n, 0);
    for (const p of points) {
      for (const n of names) {
        if (p.nombre.toLowerCase().includes(n.toLowerCase())) {
          matchedNameCounts.set(n, (matchedNameCounts.get(n) ?? 0) + 1);
        }
      }
    }
    const unmatched = [...matchedNameCounts.entries()].filter(([, c]) => c === 0);
    if (unmatched.length > 0) {
      console.log("\n# UNMATCHED name filters");
      for (const [n] of unmatched) console.log(`- ${n}`);
    }

    // keep maps used (avoid lint complaints)
    void pointById;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("diagnose-close-saldos failed:", e);
  process.exit(1);
});
