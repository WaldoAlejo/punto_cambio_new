/* eslint-disable no-console */
// server/scripts/normalize-day.ts
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { argv } from "process";

// Si ya tienes utilidades de zona Guayaquil, puedes importarlas.
// Para hacer el script autocontenido, implemento aquí la ventana del día GYE.
const GYE_TZ = "America/Guayaquil";

// ===== util: rango [gte, lt) para un YYYY-MM-DD en Guayaquil
function gyeDayRangeUtcFromDateOnly(dateYmd: string): { gte: Date; lt: Date } {
  // Creamos el Date como si fuera “fecha a medianoche en GYE” y convertimos a UTC.
  // Para evitar depender de Intl temporal, hacemos un truco: crear a medianoche local
  // y ajustar con el offset de GYE usando una tabla fija (GYE es UTC-5 y sin DST).
  // Nota: Guayaquil (Ecuador continental) es UTC-5 todo el año.
  const [y, m, d] = dateYmd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) throw new Error(`Fecha inválida: ${dateYmd}`);
  const gte = new Date(Date.UTC(y, m - 1, d, 5, 0, 0, 0)); // 00:00 GYE = 05:00 UTC
  const lt = new Date(Date.UTC(y, m - 1, d + 1, 5, 0, 0, 0)); // siguiente 00:00 GYE
  return { gte, lt };
}

function assertYMD(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error("La fecha debe ser YYYY-MM-DD");
  }
}

type MovimientoPlano = {
  punto_atencion_id: string;
  moneda_id: string;
  fecha: Date;
  tipo_movimiento: string; // INGRESO | EGRESO | TRANSFERENCIA_ENTRANTE | ...
  monto: Prisma.Decimal;
  usuario_id: string;
  referencia_id: string | null;
  tipo_referencia: string | null;
  descripcion: string | null;
};

const prisma = new PrismaClient();

async function main() {
  // ====== parámetros ======
  // por defecto: 2020-09-21 (lunes)
  const dateArg =
    (argv.find((a) => a.startsWith("--date="))?.split("=")[1] as string) ||
    "2020-09-21";

  assertYMD(dateArg);
  const { gte, lt } = gyeDayRangeUtcFromDateOnly(dateArg);

  console.log("⏱️ Normalizando día:", dateArg, "(GYE)");
  console.log("UTC window:", { gte, lt });

  // 1) Traer todos los puntos y monedas activos para tener el abanico
  const [puntos, monedas] = await Promise.all([
    prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    }),
    prisma.moneda.findMany({
      where: { activo: true },
      select: { id: true, codigo: true },
    }),
  ]);

  // 2) Construir la tabla de eventos “plana” desde FUENTES DE VERDAD para esta fecha
  // -------------------------------------------------------------------------------

  // a) CAMBIOS DE DIVISAS (COMPLETADOS) -> 2 líneas por cambio
  const cambios = await prisma.cambioDivisa.findMany({
    where: { estado: "COMPLETADO", fecha: { gte, lt } },
    select: {
      id: true,
      punto_atencion_id: true,
      usuario_id: true,
      fecha: true,
      moneda_origen_id: true,
      monto_origen: true,
      moneda_destino_id: true,
      monto_destino: true,
      numero_recibo: true,
    },
  });

  const planos: MovimientoPlano[] = [];

  for (const c of cambios) {
    // Moneda que ENTRA a caja (cliente entrega) -> INGRESO
    planos.push({
      punto_atencion_id: c.punto_atencion_id,
      moneda_id: c.moneda_origen_id,
      fecha: c.fecha,
      tipo_movimiento: "INGRESO",
      monto: c.monto_origen as unknown as Prisma.Decimal,
      usuario_id: c.usuario_id,
      referencia_id: c.id,
      tipo_referencia: "CAMBIO_DIVISA",
      descripcion: `Ingreso por cambio ${c.numero_recibo || c.id}`,
    });
    // Moneda que SALE de caja (se entrega al cliente) -> EGRESO
    planos.push({
      punto_atencion_id: c.punto_atencion_id,
      moneda_id: c.moneda_destino_id,
      fecha: c.fecha,
      tipo_movimiento: "EGRESO",
      monto: c.monto_destino as unknown as Prisma.Decimal,
      usuario_id: c.usuario_id,
      referencia_id: c.id,
      tipo_referencia: "CAMBIO_DIVISA",
      descripcion: `Egreso por cambio ${c.numero_recibo || c.id}`,
    });
  }

  // b) TRANSFERENCIAS (APROBADAS en la fecha) -> origen: EGRESO / destino: INGRESO
  const trans = await prisma.transferencia.findMany({
    where: { estado: "APROBADO", fecha_aprobacion: { gte, lt } },
    select: {
      id: true,
      moneda_id: true,
      monto: true,
      solicitado_por: true,
      aprobado_por: true,
      origen_id: true,
      destino_id: true,
      fecha_aprobacion: true,
      numero_recibo: true,
    },
  });

  for (const t of trans) {
    if (t.origen_id) {
      planos.push({
        punto_atencion_id: t.origen_id,
        moneda_id: t.moneda_id,
        fecha: t.fecha_aprobacion || new Date(),
        tipo_movimiento: "TRANSFERENCIA_SALIENTE",
        monto: t.monto as unknown as Prisma.Decimal,
        usuario_id: t.aprobado_por || t.solicitado_por,
        referencia_id: t.id,
        tipo_referencia: "TRANSFERENCIA",
        descripcion: `Transferencia salida ${t.numero_recibo || t.id}`,
      });
    }
    // destino (obligatorio)
    planos.push({
      punto_atencion_id: t.destino_id,
      moneda_id: t.moneda_id,
      fecha: t.fecha_aprobacion || new Date(),
      tipo_movimiento: "TRANSFERENCIA_ENTRANTE",
      monto: t.monto as unknown as Prisma.Decimal,
      usuario_id: t.aprobado_por || t.solicitado_por,
      referencia_id: t.id,
      tipo_referencia: "TRANSFERENCIA",
      descripcion: `Transferencia entrada ${t.numero_recibo || t.id}`,
    });
  }

  // c) SERVICIOS EXTERNOS (ya tienen tipo_movimiento INGRESO/EGRESO)
  const servMovs = await prisma.servicioExternoMovimiento.findMany({
    where: { fecha: { gte, lt } },
    select: {
      id: true,
      punto_atencion_id: true,
      servicio: true,
      tipo_movimiento: true, // INGRESO | EGRESO
      moneda_id: true,
      monto: true,
      usuario_id: true,
      fecha: true,
      descripcion: true,
      numero_referencia: true,
    },
  });

  for (const sm of servMovs) {
    planos.push({
      punto_atencion_id: sm.punto_atencion_id,
      moneda_id: sm.moneda_id,
      fecha: sm.fecha,
      tipo_movimiento: sm.tipo_movimiento,
      monto: sm.monto as unknown as Prisma.Decimal,
      usuario_id: sm.usuario_id,
      referencia_id: sm.id,
      tipo_referencia: "SERVICIO_EXTERNO",
      descripcion:
        sm.descripcion ||
        `${sm.tipo_movimiento} servicio ${sm.servicio} ${
          sm.numero_referencia || sm.id
        }`,
    });
  }

  // d) SALDO INICIAL creados en ese día (si hubo asignaciones ese día)
  const saldosIni = await prisma.saldoInicial.findMany({
    where: { fecha_asignacion: { gte, lt }, activo: true },
    select: {
      id: true,
      punto_atencion_id: true,
      moneda_id: true,
      cantidad_inicial: true,
      asignado_por: true,
      fecha_asignacion: true,
      observaciones: true,
    },
  });

  for (const si of saldosIni) {
    planos.push({
      punto_atencion_id: si.punto_atencion_id,
      moneda_id: si.moneda_id,
      fecha: si.fecha_asignacion,
      tipo_movimiento: "SALDO_INICIAL",
      monto: si.cantidad_inicial as unknown as Prisma.Decimal,
      usuario_id: si.asignado_por,
      referencia_id: si.id,
      tipo_referencia: "SALDO_INICIAL",
      descripcion: si.observaciones || "Saldo inicial asignado",
    });
  }

  // e) MOVIMIENTOS manuales (tabla Movimiento): INGRESO/EGRESO del día
  const manuales = await prisma.movimiento.findMany({
    where: {
      fecha: { gte, lt },
      tipo: { in: ["INGRESO", "EGRESO"] },
    },
    select: {
      id: true,
      punto_atencion_id: true,
      moneda_id: true,
      monto: true,
      usuario_id: true,
      fecha: true,
      tipo: true, // INGRESO | EGRESO
      descripcion: true,
      numero_recibo: true,
    },
  });

  for (const mv of manuales) {
    planos.push({
      punto_atencion_id: mv.punto_atencion_id,
      moneda_id: mv.moneda_id,
      fecha: mv.fecha,
      tipo_movimiento: mv.tipo, // igual etiqueta
      monto: mv.monto as unknown as Prisma.Decimal,
      usuario_id: mv.usuario_id,
      referencia_id: mv.id,
      tipo_referencia: "MOVIMIENTO",
      descripcion:
        mv.descripcion || `Movimiento ${mv.tipo} ${mv.numero_recibo || mv.id}`,
    });
  }

  console.log(`📦 Eventos recolectados para ${dateArg}:`, planos.length);

  // 3) Agrupar por (punto, moneda) y re-generar MovimientoSaldo ordenado
  //    - Antes de insertar, BORRAR movimientos del día que provienen de estas fuentes
  //      para evitar duplicados.
  // --------------------------------------------------------------------
  // Creamos índice por (punto, moneda)
  const bucket = new Map<string, MovimientoPlano[]>();
  for (const p of planos) {
    const key = `${p.punto_atencion_id}__${p.moneda_id}`;
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key)!.push(p);
  }

  let totalDeleted = 0;
  let totalInserted = 0;

  for (const [key, items] of bucket.entries()) {
    const [puntoId, monedaId] = key.split("__");

    // a) borrar movimientos del día que sean de estas fuentes
    const del = await prisma.movimientoSaldo.deleteMany({
      where: {
        punto_atencion_id: puntoId,
        moneda_id: monedaId,
        fecha: { gte, lt },
        OR: [
          { tipo_referencia: "CAMBIO_DIVISA" },
          { tipo_referencia: "TRANSFERENCIA" },
          { tipo_referencia: "SERVICIO_EXTERNO" },
          { tipo_referencia: "SALDO_INICIAL" },
          { tipo_referencia: "MOVIMIENTO" },
        ],
      },
    });
    totalDeleted += del.count;

    // b) obtener saldo base (último saldo_nuevo antes de gte)
    const prev = await prisma.movimientoSaldo.findFirst({
      where: {
        punto_atencion_id: puntoId,
        moneda_id: monedaId,
        fecha: { lt: gte },
      },
      orderBy: { fecha: "desc" },
      select: { saldo_nuevo: true },
    });
    let running = new Prisma.Decimal(prev?.saldo_nuevo ?? 0);

    // c) ordenar eventos por fecha (y por referencia para estabilidad)
    items.sort((a, b) => {
      const ta = a.fecha.getTime();
      const tb = b.fecha.getTime();
      if (ta !== tb) return ta - tb;
      // desempate: tipo -> referencia_id
      return (
        (a.tipo_referencia || "").localeCompare(b.tipo_referencia || "") ||
        (a.referencia_id || "").localeCompare(b.referencia_id || "")
      );
    });

    // d) insertar nuevamente, manteniendo acumulado
    await prisma.$transaction(async (tx) => {
      for (const ev of items) {
        const monto = new Prisma.Decimal(ev.monto);
        const delta =
          ev.tipo_movimiento === "EGRESO" ||
          ev.tipo_movimiento === "TRANSFERENCIA_SALIENTE"
            ? monto.negated()
            : monto; // INGRESO/TRANSF_ENTRANTE/SALDO_INICIAL suman

        const saldo_anterior = running;
        const saldo_nuevo = running.add(delta);

        await tx.movimientoSaldo.create({
          data: {
            punto_atencion_id: ev.punto_atencion_id,
            moneda_id: ev.moneda_id,
            tipo_movimiento: ev.tipo_movimiento,
            monto: monto,
            saldo_anterior,
            saldo_nuevo,
            usuario_id: ev.usuario_id,
            referencia_id: ev.referencia_id,
            tipo_referencia: ev.tipo_referencia,
            descripcion: ev.descripcion,
            fecha: ev.fecha,
            created_at: new Date(),
          },
        });

        running = saldo_nuevo;
        totalInserted++;
      }
    });
  }

  console.log(
    "🧹 Eliminados:",
    totalDeleted,
    " | ✍️ Insertados:",
    totalInserted
  );

  // 4) (Opcional) Recalcular la tabla ServicioExternoSaldo (stock por servicio) a partir de todo el histórico
  //    Si prefieres mantenerla como “derivada”, descomenta este bloque para recalcular completo.
  /*
  console.log("♻️ Recalculando ServicioExternoSaldo (completo)...");
  await prisma.$transaction(async (tx) => {
    await tx.servicioExternoSaldo.deleteMany({});
    // netos por punto/servicio/moneda
    const netos = await prisma.servicioExternoMovimiento.groupBy({
      by: ["punto_atencion_id", "servicio", "moneda_id"],
      _sum: {
        monto: true,
      },
    });
    for (const n of netos) {
      const signo =
        // ojo: necesitamos neto real ingreso - egreso. Para esto,
        // volvemos a agrupar por tipo, o hacemos 2 queries.
        1;
      // versión en 2 queries:
    }
  });
  */

  console.log("✅ Normalización finalizada para", dateArg);
}

main()
  .catch((e) => {
    console.error("❌ Error en normalización:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
