import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Utilidad decimal segura
const D = (n: Prisma.Decimal | number | string | null | undefined) =>
  new Prisma.Decimal(n ?? 0);

// CLI flags
type FixMode = "to-theoretical" | "to-current" | "none";
const args = process.argv.slice(2);
const getArg = (key: string) => {
  const hit = args.find((a) => a.startsWith(`${key}=`));
  return hit ? hit.split("=")[1] : undefined;
};

// Configuración (puedes override con env o flags)
const PUNTO_NAME = process.env.PUNTO_NAME || getArg("--punto") || "AMAZONAS";
const MONEDA_COD = process.env.MONEDA_COD || getArg("--moneda") || "USD";
const FIX_MODE: FixMode =
  (getArg("--fix") as FixMode) || ((process.env.FIX_MODE as FixMode) ?? "none"); // none | to-theoretical | to-current

async function main() {
  console.log("🔧 Ajuste de saldo");
  console.log(`📍 Punto: ${PUNTO_NAME} | 💱 Moneda: ${MONEDA_COD}`);
  console.log(
    "⚙️  Modo:",
    FIX_MODE === "none" ? "dry-run (sin cambios)" : FIX_MODE,
    "\n"
  );

  // 1) Punto
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: PUNTO_NAME, mode: "insensitive" } },
    select: { id: true, nombre: true, ciudad: true },
  });
  if (!punto) {
    console.error("❌ Punto no encontrado:", PUNTO_NAME);
    process.exit(1);
  }
  console.log(`✅ Punto: ${punto.nombre} (${punto.id}) – ${punto.ciudad}`);

  // 2) Saldo actual
  const saldo = await prisma.saldo.findFirst({
    where: { punto_atencion_id: punto.id, moneda: { codigo: MONEDA_COD } },
    include: { moneda: true },
  });
  if (!saldo) {
    console.error(
      `❌ No existe registro de Saldo para ${MONEDA_COD} en el punto`
    );
    process.exit(1);
  }
  console.log(
    `💰 Saldo actual: $${saldo.cantidad} ${saldo.moneda.codigo}\n` +
      `   Detalle → Billetes: $${saldo.billetes} | Monedas: $${saldo.monedas_fisicas} | Bancos: $${saldo.bancos}`
  );

  // 3) SaldoInicial activo
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: punto.id,
      activo: true,
      moneda: { codigo: MONEDA_COD },
    },
    orderBy: { fecha_asignacion: "desc" },
    select: { id: true, cantidad_inicial: true, fecha_asignacion: true },
  });
  if (!saldoInicial) {
    console.error("❌ No hay SaldoInicial activo para esta moneda/punto.");
    process.exit(1);
  }
  console.log(
    `🧭 SaldoInicial activo: $${
      saldoInicial.cantidad_inicial
    } (desde ${saldoInicial.fecha_asignacion.toISOString()})`
  );

  // 4) Sumatoria de movimientos desde la fecha del SaldoInicial activo
  const movAgg = await prisma.movimientoSaldo.aggregate({
    where: {
      punto_atencion_id: punto.id,
      moneda: { codigo: MONEDA_COD },
      fecha: { gte: saldoInicial.fecha_asignacion },
    },
    _sum: { monto: true },
  });

  const sumaMovs = D(movAgg._sum.monto ?? 0);
  const teorico = D(saldoInicial.cantidad_inicial).plus(sumaMovs);
  const actual = D(saldo.cantidad);
  const delta = teorico.minus(actual); // cuánto falta para alcanzar el teórico

  console.log("\n🧮 Verificación de integridad");
  console.log(`   Suma movimientos (desde saldoInicial): $${sumaMovs}`);
  console.log(`   Saldo teórico (inicial + movimientos): $${teorico}`);
  console.log(`   Saldo actual: $${actual}`);
  console.log(`   Δ (teórico - actual): $${delta}`);

  const absDelta = delta.abs();
  const isZero = Math.abs(Number(absDelta)) < 0.005; // tolerancia 0.5 centavos

  if (isZero) {
    console.log("\n✅ No hay descuadre significativo. No se requiere ajuste.");
    return;
  }

  // 5) Preparar el movimiento de ajuste (no se ejecuta en dry-run)
  // Usamos tipo_movimiento (string libre) "AJUSTE_CONTABLE".
  // saldo_nuevo = saldo_actual + monto_ajuste (si fijamos al teórico).
  // Para el modo to-current, el movimiento es inverso, de modo que el saldo teórico pase a igualar al actual.
  const ahora = new Date();
  const montoAjuste = FIX_MODE === "to-theoretical" ? delta : delta.negated();
  const tipoAjuste = "AJUSTE_CONTABLE";
  const descripcionBase =
    FIX_MODE === "to-theoretical"
      ? "Ajuste para igualar Saldo.cantidad al saldo teórico (SaldoInicial + movimientos)"
      : "Ajuste para igualar saldo teórico al Saldo.cantidad actual (conservador)";

  console.log("\n📝 Plan de ajuste propuesto");
  console.log(`   Modo: ${FIX_MODE}`);
  console.log(`   Monto de ajuste: $${montoAjuste}`);
  console.log(`   Tipo: ${tipoAjuste}`);
  console.log(`   Descripción: ${descripcionBase}`);
  console.log(
    "   (Se registrará en MovimientoSaldo y se actualizará Saldo.cantidad si aplica)"
  );

  if (FIX_MODE === "none") {
    console.log(
      "\n🔎 Dry-run: no se aplican cambios. Usa --fix=to-theoretical o --fix=to-current"
    );
    return;
  }

  // 6) Ejecutar transacción de ajuste
  console.log("\n🚀 Ejecutando ajuste en base de datos...");
  const res = await prisma.$transaction(async (tx) => {
    // Releer saldo dentro de la transacción por seguridad (incluyendo moneda)
    const saldoLocked = await tx.saldo.findUnique({
      where: { id: saldo.id },
      include: { moneda: true },
    });
    if (!saldoLocked) throw new Error("Saldo no encontrado durante el ajuste.");

    const saldoAnterior = D(saldoLocked.cantidad);
    const saldoNuevo =
      FIX_MODE === "to-theoretical"
        ? saldoAnterior.plus(montoAjuste)
        : saldoAnterior;

    // 6.1) Insertar MovimientoSaldo de ajuste
    const mov = await tx.movimientoSaldo.create({
      data: {
        punto_atencion_id: punto.id,
        moneda_id: saldoLocked.moneda_id,
        tipo_movimiento: tipoAjuste,
        monto: montoAjuste,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: FIX_MODE === "to-theoretical" ? saldoNuevo : saldoAnterior,
        usuario_id: "00000000-0000-0000-0000-000000000000", // TODO: reemplazar por UUID de usuario SISTEMA
        referencia_id: saldoInicial.id,
        tipo_referencia: "SALDO_INICIAL_ACTIVO",
        descripcion: `${descripcionBase}. Cálculo a ${ahora.toISOString()}.`,
        fecha: ahora,
      },
    });

    // 6.2) Actualizar Saldo.cantidad sólo si el modo es to-theoretical (incluyendo moneda)
    let saldoActualizado = saldoLocked;
    if (FIX_MODE === "to-theoretical") {
      saldoActualizado = await tx.saldo.update({
        where: { id: saldoLocked.id },
        data: { cantidad: saldoNuevo, updated_at: ahora },
        include: { moneda: true },
      });
    }

    return { mov, saldoActualizado };
  });

  console.log("✅ Ajuste aplicado con éxito.");
  console.log("   Movimiento de ajuste ID:", res.mov.id);
  console.log(
    "   Saldo final:",
    FIX_MODE === "to-theoretical"
      ? `$${res.saldoActualizado.cantidad} ${res.saldoActualizado.moneda.codigo}`
      : `$${saldo.cantidad} ${saldo.moneda.codigo} (intacto)`
  );
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
