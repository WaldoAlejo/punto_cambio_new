import "dotenv/config";
import { PrismaClient, ServicioExterno } from "@prisma/client";

const prisma = new PrismaClient();

const POINT_NAME = "EL BOSQUE";
const SERVICIOS_VALIDOS: ServicioExterno[] = [
  ServicioExterno.YAGANASTE,
  ServicioExterno.BANCO_GUAYAQUIL,
  ServicioExterno.WESTERN,
  ServicioExterno.PRODUBANCO,
  ServicioExterno.BANCO_PACIFICO,
  ServicioExterno.SERVIENTREGA,
  ServicioExterno.INSUMOS_OFICINA,
  ServicioExterno.INSUMOS_LIMPIEZA,
  ServicioExterno.OTROS,
];

const SERVICIOS_CON_ASIGNACION = new Set<ServicioExterno>([
  ServicioExterno.YAGANASTE,
  ServicioExterno.BANCO_GUAYAQUIL,
  ServicioExterno.WESTERN,
  ServicioExterno.PRODUBANCO,
  ServicioExterno.BANCO_PACIFICO,
  ServicioExterno.SERVIENTREGA,
]);

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object") {
    const anyValue = value as { toNumber?: () => number; toString?: () => string };
    if (typeof anyValue.toNumber === "function") return anyValue.toNumber();
    if (typeof anyValue.toString === "function") return Number(anyValue.toString());
  }
  return Number(value);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type TimelineItem = {
  at: Date;
  kind: "ASIGNACION" | "MOVIMIENTO";
  servicio: ServicioExterno;
  delta: number;
  monto: number;
  tipo?: string;
  referencia?: string | null;
  descripcion?: string | null;
  id: string;
};

async function main() {
  console.log("=".repeat(100));
  console.log("AUDITORIA DETALLADA DE SERVICIOS EXTERNOS - EL BOSQUE");
  console.log("=".repeat(100));
  console.log("Regla usada por el sistema: saldo teorico = asignaciones + egresos - ingresos");
  console.log("Validaciones: movimientos, sumas/restas, duplicados, cierres y saldo persistido\n");

  const point = await prisma.puntoAtencion.findFirst({
    where: {
      nombre: {
        contains: POINT_NAME,
        mode: "insensitive",
      },
      activo: true,
    },
    select: { id: true, nombre: true },
  });

  if (!point) {
    console.error(`❌ No se encontró un punto activo que contenga '${POINT_NAME}'`);
    process.exit(1);
  }

  const usd = await prisma.moneda.findFirst({
    where: { codigo: "USD" },
    select: { id: true, codigo: true },
  });

  if (!usd) {
    console.error("❌ No se encontró la moneda USD");
    process.exit(1);
  }

  console.log(`Punto: ${point.nombre}`);
  console.log(`Point ID: ${point.id}`);
  console.log(`Moneda auditada: ${usd.codigo}\n`);

  const [asignaciones, movimientos, saldos, cierres] = await Promise.all([
    prisma.servicioExternoAsignacion.findMany({
      where: { punto_atencion_id: point.id, moneda_id: usd.id },
      select: {
        id: true,
        servicio: true,
        monto: true,
        tipo: true,
        fecha: true,
        observaciones: true,
      },
      orderBy: { fecha: "asc" },
    }),
    prisma.servicioExternoMovimiento.findMany({
      where: { punto_atencion_id: point.id, moneda_id: usd.id },
      select: {
        id: true,
        servicio: true,
        tipo_movimiento: true,
        monto: true,
        fecha: true,
        descripcion: true,
        numero_referencia: true,
        billetes: true,
        monedas_fisicas: true,
        bancos: true,
        metodo_ingreso: true,
      },
      orderBy: { fecha: "asc" },
    }),
    prisma.servicioExternoSaldo.findMany({
      where: { punto_atencion_id: point.id, moneda_id: usd.id },
      select: {
        servicio: true,
        cantidad: true,
        billetes: true,
        monedas_fisicas: true,
        bancos: true,
        updated_at: true,
      },
    }),
    prisma.servicioExternoCierreDiario.findMany({
      where: { punto_atencion_id: point.id },
      include: {
        detalles: {
          where: { moneda_id: usd.id },
          select: {
            servicio: true,
            monto_movimientos: true,
            monto_validado: true,
            diferencia: true,
            observaciones: true,
          },
        },
      },
      orderBy: { fecha: "asc" },
    }),
  ]);

  let mismatchCount = 0;

  for (const servicio of SERVICIOS_VALIDOS) {
    const asignacionesServicio = asignaciones.filter((item) => item.servicio === servicio);
    const movimientosServicio = movimientos.filter((item) => item.servicio === servicio);
    const saldoPersistido = saldos.find((item) => item.servicio === servicio);
    const cierresServicio = cierres
      .map((cierre) => ({
        fecha: cierre.fecha,
        estado: cierre.estado,
        detalle: cierre.detalles.find((detalle) => detalle.servicio === servicio),
      }))
      .filter((item) => item.detalle);

    const totalAsignaciones = asignacionesServicio.reduce((acc, item) => acc + toNumber(item.monto), 0);
    const totalIngresos = movimientosServicio
      .filter((item) => item.tipo_movimiento === "INGRESO")
      .reduce((acc, item) => acc + toNumber(item.monto), 0);
    const totalEgresos = movimientosServicio
      .filter((item) => item.tipo_movimiento === "EGRESO")
      .reduce((acc, item) => acc + toNumber(item.monto), 0);
    const totalOtrosTipos = movimientosServicio.filter(
      (item) => item.tipo_movimiento !== "INGRESO" && item.tipo_movimiento !== "EGRESO"
    );

    const saldoTeorico = Number((totalAsignaciones + totalEgresos - totalIngresos).toFixed(2));
    const saldoActual = toNumber(saldoPersistido?.cantidad ?? 0);
    const diferencia = Number((saldoActual - saldoTeorico).toFixed(2));

    const duplicateMap = new Map<string, string[]>();
    for (const mov of movimientosServicio) {
      const key = [
        mov.servicio,
        mov.tipo_movimiento,
        toNumber(mov.monto).toFixed(2),
        mov.fecha.toISOString(),
        mov.numero_referencia ?? "",
      ].join("|");
      const existing = duplicateMap.get(key) ?? [];
      existing.push(mov.id);
      duplicateMap.set(key, existing);
    }
    const duplicateGroups = Array.from(duplicateMap.values()).filter((group) => group.length > 1);

    const breakdownIssues = movimientosServicio.filter((mov) => {
      const monto = toNumber(mov.monto);
      const billetes = toNumber(mov.billetes ?? 0);
      const monedas = toNumber(mov.monedas_fisicas ?? 0);
      const bancos = toNumber(mov.bancos ?? 0);
      return Math.abs(monto - (billetes + monedas + bancos)) > 0.02;
    });

    const timeline: TimelineItem[] = [
      ...asignacionesServicio.map((item) => ({
        at: item.fecha,
        kind: "ASIGNACION" as const,
        servicio,
        delta: toNumber(item.monto),
        monto: toNumber(item.monto),
        tipo: item.tipo,
        descripcion: item.observaciones,
        id: item.id,
      })),
      ...movimientosServicio.map((item) => ({
        at: item.fecha,
        kind: "MOVIMIENTO" as const,
        servicio,
        delta: item.tipo_movimiento === "INGRESO" ? -toNumber(item.monto) : toNumber(item.monto),
        monto: toNumber(item.monto),
        tipo: item.tipo_movimiento,
        referencia: item.numero_referencia,
        descripcion: item.descripcion,
        id: item.id,
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    let running = 0;
    const negativeMoments: Array<{ at: Date; balance: number; item: TimelineItem }> = [];
    const dailyNet = new Map<string, { asignaciones: number; ingresos: number; egresos: number; neto: number }>();

    for (const item of timeline) {
      running = Number((running + item.delta).toFixed(2));
      const key = dayKey(item.at);
      const current = dailyNet.get(key) ?? { asignaciones: 0, ingresos: 0, egresos: 0, neto: 0 };

      if (item.kind === "ASIGNACION") {
        current.asignaciones = Number((current.asignaciones + item.monto).toFixed(2));
      } else if (item.tipo === "INGRESO") {
        current.ingresos = Number((current.ingresos + item.monto).toFixed(2));
      } else if (item.tipo === "EGRESO") {
        current.egresos = Number((current.egresos + item.monto).toFixed(2));
      }

      current.neto = Number((current.asignaciones + current.egresos - current.ingresos).toFixed(2));
      dailyNet.set(key, current);

      if (running < -0.01) {
        negativeMoments.push({ at: item.at, balance: running, item });
      }
    }

    const cierreDiferencias = cierresServicio
      .map((item) => ({
        fecha: item.fecha,
        montoMovimientos: toNumber(item.detalle?.monto_movimientos ?? 0),
        montoValidado: toNumber(item.detalle?.monto_validado ?? 0),
        diferencia: toNumber(item.detalle?.diferencia ?? 0),
        observaciones: item.detalle?.observaciones ?? null,
        estado: item.estado,
      }))
      .filter((item) => Math.abs(item.diferencia) > 0.02);

    const breakdownSaldo = saldoPersistido
      ? Math.abs(
          toNumber(saldoPersistido.cantidad) -
            (toNumber(saldoPersistido.billetes) +
              toNumber(saldoPersistido.monedas_fisicas) +
              toNumber(saldoPersistido.bancos))
        ) > 0.02
      : false;

    const descriptionCounts = new Map<string, number>();
    for (const mov of movimientosServicio) {
      const key = (mov.descripcion ?? "Sin descripcion").trim() || "Sin descripcion";
      descriptionCounts.set(key, (descriptionCounts.get(key) ?? 0) + 1);
    }
    const topDescriptions = Array.from(descriptionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const tieneProblema =
      Math.abs(diferencia) > 0.02 ||
      duplicateGroups.length > 0 ||
      totalOtrosTipos.length > 0 ||
      breakdownIssues.length > 0 ||
      negativeMoments.length > 0 ||
      cierreDiferencias.length > 0 ||
      breakdownSaldo;

    if (tieneProblema) mismatchCount++;

    console.log("-".repeat(100));
    console.log(`Servicio: ${servicio}`);
    console.log(`  Tiene asignacion propia: ${SERVICIOS_CON_ASIGNACION.has(servicio) ? "SI" : "NO"}`);
    console.log(`  Asignaciones: ${asignacionesServicio.length} | Total: ${totalAsignaciones.toFixed(2)}`);
    console.log(`  Ingresos: ${movimientosServicio.filter((item) => item.tipo_movimiento === "INGRESO").length} | Total: ${totalIngresos.toFixed(2)}`);
    console.log(`  Egresos: ${movimientosServicio.filter((item) => item.tipo_movimiento === "EGRESO").length} | Total: ${totalEgresos.toFixed(2)}`);
    console.log(`  Saldo teorico: ${saldoTeorico.toFixed(2)}`);
    console.log(`  Saldo persistido: ${saldoActual.toFixed(2)}`);
    console.log(`  Diferencia: ${diferencia.toFixed(2)}`);
    if (saldoPersistido) {
      console.log(
        `  Desglose saldo persistido: billetes=${toNumber(saldoPersistido.billetes).toFixed(2)} | monedas=${toNumber(saldoPersistido.monedas_fisicas).toFixed(2)} | bancos=${toNumber(saldoPersistido.bancos).toFixed(2)} | updated_at=${saldoPersistido.updated_at.toISOString()}`
      );
    }
    console.log(`  Duplicados exactos: ${duplicateGroups.length}`);
    console.log(`  Tipos inesperados: ${totalOtrosTipos.length}`);
    console.log(`  Breakdowns malos en movimientos: ${breakdownIssues.length}`);
    console.log(`  Cierres con diferencia: ${cierreDiferencias.length}`);
    console.log(`  Saldo negativo historico: ${negativeMoments.length}`);
    console.log(`  Saldo persistido con desglose inconsistente: ${breakdownSaldo ? "SI" : "NO"}`);

    if (duplicateGroups.length > 0) {
      console.log("  Duplicados detectados:");
      for (const group of duplicateGroups.slice(0, 10)) {
        console.log(`    - IDs: ${group.join(", ")}`);
      }
    }

    if (totalOtrosTipos.length > 0) {
      console.log("  Movimientos con tipo inesperado:");
      for (const mov of totalOtrosTipos.slice(0, 10)) {
        console.log(`    - ${mov.fecha.toISOString()} | ${mov.tipo_movimiento} | ${toNumber(mov.monto).toFixed(2)} | ${mov.descripcion ?? "Sin descripcion"}`);
      }
    }

    if (breakdownIssues.length > 0) {
      console.log("  Movimientos con desglose inconsistente:");
      for (const mov of breakdownIssues.slice(0, 10)) {
        const billetes = toNumber(mov.billetes ?? 0);
        const monedas = toNumber(mov.monedas_fisicas ?? 0);
        const bancos = toNumber(mov.bancos ?? 0);
        console.log(`    - ${mov.id} | ${mov.fecha.toISOString()} | monto=${toNumber(mov.monto).toFixed(2)} | desglose=${(billetes + monedas + bancos).toFixed(2)}`);
      }
    }

    if (negativeMoments.length > 0) {
      console.log("  Primeros momentos con saldo historico negativo:");
      for (const item of negativeMoments.slice(0, 10)) {
        console.log(`    - ${item.at.toISOString()} | saldo=${item.balance.toFixed(2)} | ${item.item.kind} | ${item.item.tipo ?? "N/A"} | ${item.item.monto.toFixed(2)} | ${item.item.descripcion ?? "Sin descripcion"}`);
      }
    }

    if (cierreDiferencias.length > 0) {
      console.log("  Cierres con diferencia reportada:");
      for (const cierre of cierreDiferencias.slice(0, 10)) {
        console.log(`    - ${cierre.fecha.toISOString().slice(0, 10)} | mov=${cierre.montoMovimientos.toFixed(2)} | validado=${cierre.montoValidado.toFixed(2)} | diff=${cierre.diferencia.toFixed(2)} | ${cierre.observaciones ?? "Sin observaciones"}`);
      }
    }

    if (topDescriptions.length > 0) {
      console.log("  Descripciones mas frecuentes:");
      for (const [descripcion, count] of topDescriptions) {
        console.log(`    - ${count}x | ${descripcion}`);
      }
    }

    const dailyLeaders = Array.from(dailyNet.entries())
      .sort((a, b) => Math.abs(b[1].neto) - Math.abs(a[1].neto))
      .slice(0, 10);
    if (dailyLeaders.length > 0) {
      console.log("  Dias con mayor impacto neto:");
      for (const [fecha, data] of dailyLeaders) {
        console.log(`    - ${fecha} | asignaciones=${data.asignaciones.toFixed(2)} | ingresos=${data.ingresos.toFixed(2)} | egresos=${data.egresos.toFixed(2)} | neto=${data.neto.toFixed(2)}`);
      }
    }
  }

  console.log("=".repeat(100));
  if (mismatchCount > 0) {
    console.log(`RESULTADO: SE DETECTARON ${mismatchCount} SERVICIOS CON HALLAZGOS EN EL BOSQUE.`);
    process.exitCode = 1;
  } else {
    console.log("RESULTADO: NO SE DETECTARON DESCUADRES NI ANOMALIAS EN LOS SERVICIOS EXTERNOS DE EL BOSQUE.");
  }
}

main()
  .catch((error) => {
    console.error("Fallo analyze-el-bosque-servicios-externos:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });