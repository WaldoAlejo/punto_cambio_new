/**
 * Diagnóstico y cuadre de saldos para AMAZONAS GERONIMO tras una anulación
 * de cambio de divisa cuyo origen fue pagado por transferencia bancaria.
 *
 * Bug corregido en server/routes/exchanges.ts (DELETE /:id): el reverso de
 * anulación debitaba el efectivo aunque el dinero se hubiera recibido por
 * banco, dejando el saldo en efectivo por debajo del real.
 *
 * Modo por defecto: SOLO DIAGNÓSTICO (no escribe nada).
 * Por defecto usa el día de hoy (hora Ecuador). Para apuntar a otro día:
 *   npx tsx scripts/investigar-cuadrar-amazonas-geronimo.ts --fecha=2026-08-12
 * Para aplicar la corrección, agregar además: --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Ecuador (America/Guayaquil) es UTC-5 todo el año, sin horario de verano.
const OFFSET_ECUADOR_HORAS = 5;

function rangoDiaEcuador() {
  const argFecha = process.argv.find((a) => a.startsWith("--fecha="));

  let year: number, month: number, day: number;
  if (argFecha) {
    const valor = argFecha.split("=")[1]; // formato YYYY-MM-DD
    const [y, m, d] = valor.split("-").map(Number);
    year = y;
    month = m - 1;
    day = d;
  } else {
    const nowUtc = new Date();
    const nowEcuador = new Date(nowUtc.getTime() - OFFSET_ECUADOR_HORAS * 3600 * 1000);
    year = nowEcuador.getUTCFullYear();
    month = nowEcuador.getUTCMonth();
    day = nowEcuador.getUTCDate();
  }

  const inicioComoUtc = new Date(Date.UTC(year, month, day));
  // inicioComoUtc representa 00:00 hora Ecuador, expresado como si fuera UTC;
  // sumamos el offset para obtener el instante UTC real.
  const inicio = new Date(inicioComoUtc.getTime() + OFFSET_ECUADOR_HORAS * 3600 * 1000);
  const fin = new Date(inicio.getTime() + 24 * 3600 * 1000);
  return { inicio, fin };
}

async function main() {
  console.log("=".repeat(100));
  console.log("DIAGNÓSTICO DE SALDOS - AMAZONAS GERONIMO");
  console.log(APPLY ? "MODO: APLICAR CORRECCIÓN" : "MODO: SOLO DIAGNÓSTICO (dry-run)");
  console.log("=".repeat(100));

  const candidatos = await prisma.puntoAtencion.findMany({
    where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
  });

  if (candidatos.length === 0) {
    console.error("No se encontró ningún punto de atención que contenga 'AMAZONAS'.");
    return;
  }

  console.log(`\nPuntos encontrados con 'AMAZONAS' en el nombre: ${candidatos.length}`);
  for (const c of candidatos) console.log(`  - ${c.nombre} (ID: ${c.id})`);

  const punto =
    candidatos.find((c) => c.nombre.toUpperCase().includes("GERONIMO")) ??
    candidatos.find((c) => c.nombre.toUpperCase().includes("GERÓNIMO"));

  if (!punto) {
    console.error(
      "\nNinguno de los puntos encontrados contiene 'GERONIMO' en el nombre. Revisa la lista de arriba y ajusta el filtro del script."
    );
    return;
  }
  console.log(`\nUsando punto: ${punto.nombre} (ID: ${punto.id})\n`);

  const { inicio, fin } = rangoDiaEcuador();
  console.log(
    `Rango de día analizado (hora Ecuador, UTC-5): ${inicio.toISOString()} a ${fin.toISOString()}\n`
  );

  const movimientosDia = await prisma.movimientoSaldo.findMany({
    where: { punto_atencion_id: punto.id, fecha: { gte: inicio, lt: fin } },
    include: { moneda: true },
    orderBy: { fecha: "asc" },
  });

  console.log(`Movimientos del día analizado: ${movimientosDia.length}`);
  for (const m of movimientosDia) {
    console.log(
      `  [${m.fecha.toISOString()}] ${m.moneda.codigo} | ${m.tipo_movimiento} | monto=${Number(
        m.monto
      ).toFixed(2)} | anterior=${Number(m.saldo_anterior).toFixed(2)} | nuevo=${Number(
        m.saldo_nuevo
      ).toFixed(2)} | ref=${m.tipo_referencia}/${m.referencia_id} | ${m.descripcion}`
    );
  }

  // Para la RECONCILIACIÓN no basta con los movimientos del día objetivo: si ya
  // pasaron días desde entonces, el saldo actual en DB incluye también los
  // movimientos posteriores. Por eso recalculamos desde el inicio del día
  // objetivo hasta AHORA, y comparamos ese total contra el saldo actual.
  const movimientosDesdeInicio = await prisma.movimientoSaldo.findMany({
    where: { punto_atencion_id: punto.id, fecha: { gte: inicio } },
    include: { moneda: true },
    orderBy: { fecha: "asc" },
  });

  const porMoneda = new Map<string, { moneda: any; movimientos: typeof movimientosDesdeInicio }>();
  for (const m of movimientosDesdeInicio) {
    if (!porMoneda.has(m.moneda_id)) {
      porMoneda.set(m.moneda_id, { moneda: m.moneda, movimientos: [] as any });
    }
    porMoneda.get(m.moneda_id)!.movimientos.push(m);
  }

  console.log("\n" + "=".repeat(100));
  console.log(
    "COMPARACIÓN: saldo recalculado (desde inicio del día objetivo hasta ahora) vs saldo actual en tabla Saldo"
  );
  console.log("=".repeat(100));

  for (const [monedaId, { moneda, movimientos }] of porMoneda) {
    const saldoInicialDia = Number(movimientos[0].saldo_anterior);
    let saldoCalculado = saldoInicialDia;
    for (const m of movimientos) {
      const monto = Number(m.monto);
      if (m.tipo_movimiento === "INGRESO") saldoCalculado += monto;
      else if (m.tipo_movimiento === "EGRESO") saldoCalculado -= monto;
      else if (m.tipo_movimiento === "AJUSTE") saldoCalculado += monto; // ya viene con signo
    }

    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: monedaId,
        },
      },
    });

    console.log(`\n--- ${moneda.codigo} (${moneda.nombre}) ---`);
    console.log(`  Saldo al inicio del día objetivo: ${saldoInicialDia.toFixed(2)}`);
    console.log(`  Saldo recalculado (efectivo) desde entonces hasta ahora: ${saldoCalculado.toFixed(2)}`);
    console.log(`  Saldo actual en tabla Saldo (cantidad): ${Number(saldoActual?.cantidad ?? 0).toFixed(2)}`);
    console.log(`  Billetes actuales: ${Number(saldoActual?.billetes ?? 0).toFixed(2)} | Monedas físicas: ${Number(saldoActual?.monedas_fisicas ?? 0).toFixed(2)} | Bancos: ${Number(saldoActual?.bancos ?? 0).toFixed(2)}`);

    const diferencia = round2(saldoCalculado - Number(saldoActual?.cantidad ?? 0));
    if (Math.abs(diferencia) > 0.01) {
      console.log(`  ⚠️  DIFERENCIA DETECTADA: ${diferencia > 0 ? "+" : ""}${diferencia.toFixed(2)} (saldo en DB está ${diferencia > 0 ? "por debajo" : "por encima"} de lo que indican los movimientos registrados)`);

      if (APPLY && saldoActual) {
        const usuarioId = await getUsuarioCorreccionId();
        const nuevaCantidad = round2(Number(saldoActual.cantidad) + diferencia);
        const nuevosBilletes = round2(Number(saldoActual.billetes) + diferencia);
        await prisma.saldo.update({
          where: {
            punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: monedaId },
          },
          data: { cantidad: nuevaCantidad, billetes: nuevosBilletes, updated_at: new Date() },
        });
        await prisma.movimientoSaldo.create({
          data: {
            punto_atencion_id: punto.id,
            moneda_id: monedaId,
            tipo_movimiento: "AJUSTE",
            monto: diferencia,
            saldo_anterior: Number(saldoActual.cantidad),
            saldo_nuevo: nuevaCantidad,
            usuario_id: usuarioId,
            tipo_referencia: "CORRECCION_MANUAL",
            descripcion:
              "Corrección: reverso de anulación había debitado efectivo de una transacción pagada por transferencia bancaria (bug en DELETE /exchanges/:id)",
          },
        });
        console.log(`  ✅ Corregido. Nuevo saldo: ${nuevaCantidad.toFixed(2)}`);
      } else if (!APPLY) {
        console.log(`  ℹ️  Ejecuta con --apply para corregir automáticamente este punto/moneda.`);
      }
    } else {
      console.log(`  ✅ Saldo consistente con los movimientos de hoy, no requiere ajuste.`);
    }
  }

  console.log("\n" + "=".repeat(100));
  console.log("FIN DEL DIAGNÓSTICO");
  console.log("=".repeat(100));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

let usuarioCorreccionIdCache: string | null = null;
async function getUsuarioCorreccionId(): Promise<string> {
  if (usuarioCorreccionIdCache) return usuarioCorreccionIdCache;
  const argUsuario = process.argv.find((a) => a.startsWith("--usuario-id="));
  if (argUsuario) {
    usuarioCorreccionIdCache = argUsuario.split("=")[1];
    return usuarioCorreccionIdCache;
  }
  const admin = await prisma.usuario.findFirst({
    where: { rol: { in: ["SUPER_USUARIO", "ADMIN"] as any } },
    orderBy: { rol: "asc" },
  });
  if (!admin) {
    throw new Error(
      "No se encontró un usuario ADMIN/SUPER_USUARIO para atribuir la corrección. Pasa --usuario-id=<id> explícitamente."
    );
  }
  usuarioCorreccionIdCache = admin.id;
  return admin.id;
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
