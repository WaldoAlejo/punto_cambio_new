import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Decimal helper
const D = (n: Prisma.Decimal | number | string | null | undefined) =>
  new Prisma.Decimal(n ?? 0);

// CLI flags
type FixMode = "to-theoretical" | "to-current" | "to-target" | "none";
type Bucket = "billetes" | "monedas_fisicas" | "bancos";

const args = process.argv.slice(2);
const getArg = (key: string) => {
  const hit = args.find((a) => a.startsWith(`${key}=`));
  return hit ? hit.split("=")[1] : undefined;
};

// Config
const PUNTO_NAME = process.env.PUNTO_NAME || getArg("--punto") || "AMAZONAS";
const MONEDA_COD = process.env.MONEDA_COD || getArg("--moneda") || "USD";
const FIX_MODE: FixMode =
  (getArg("--fix") as FixMode) || ((process.env.FIX_MODE as FixMode) ?? "none"); // none | to-theoretical | to-current | to-target
const USUARIO_ID_FLAG = process.env.USUARIO_ID || getArg("--usuario-id");
const TARGET_RAW = process.env.TARGET_AMOUNT || getArg("--target"); // solo para to-target
const BUCKET: Bucket =
  ((process.env.BUCKET || getArg("--bucket")) as Bucket) || "billetes"; // dónde aplicar el ajuste físico

// ────────────────────────────────────────────────────────────────────────────────
// Resolver usuario_id válido para registrar el movimiento
// ────────────────────────────────────────────────────────────────────────────────
async function resolveUsuarioId(puntoId: string): Promise<string> {
  if (USUARIO_ID_FLAG) {
    const u = await prisma.usuario.findUnique({
      where: { id: USUARIO_ID_FLAG },
    });
    if (!u)
      throw new Error(
        `El usuario pasado (--usuario-id=${USUARIO_ID_FLAG}) no existe.`
      );
    return u.id;
  }

  const suMismoPunto = await prisma.usuario.findFirst({
    where: { activo: true, rol: "SUPER_USUARIO", punto_atencion_id: puntoId },
    select: { id: true },
  });
  if (suMismoPunto) return suMismoPunto.id;

  const su = await prisma.usuario.findFirst({
    where: { activo: true, rol: "SUPER_USUARIO" },
    select: { id: true },
  });
  if (su) return su.id;

  const admin = await prisma.usuario.findFirst({
    where: { activo: true, rol: "ADMIN" },
    select: { id: true },
  });
  if (admin) return admin.id;

  throw new Error(
    "No se encontró un usuario activo con rol SUPER_USUARIO o ADMIN para registrar el ajuste.\n" +
      "Soluciones:\n" +
      "  - Pasa un usuario explícito: --usuario-id=<UUID>\n" +
      "  - Crea/activa un SUPER_USUARIO o ADMIN en la base.\n"
  );
}

async function main() {
  console.log("🔧 Ajuste de saldo");
  console.log(`📍 Punto: ${PUNTO_NAME} | 💱 Moneda: ${MONEDA_COD}`);
  console.log(
    "⚙️  Modo:",
    FIX_MODE === "none" ? "dry-run (sin cambios)" : FIX_MODE,
    "| Bucket físico:",
    BUCKET,
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

  // 3) (Opcional) SaldoInicial + movimientos (se muestra solo como referencia)
  let teorico: Prisma.Decimal | null = null;
  try {
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: punto.id,
        activo: true,
        moneda: { codigo: MONEDA_COD },
      },
      orderBy: { fecha_asignacion: "desc" },
      select: { id: true, cantidad_inicial: true, fecha_asignacion: true },
    });

    if (saldoInicial) {
      const movAgg = await prisma.movimientoSaldo.aggregate({
        where: {
          punto_atencion_id: punto.id,
          moneda: { codigo: MONEDA_COD },
          fecha: { gte: saldoInicial.fecha_asignacion },
        },
        _sum: { monto: true },
      });
      const sumaMovs = D(movAgg._sum.monto ?? 0);
      teorico = D(saldoInicial.cantidad_inicial).plus(sumaMovs);
      console.log("\n🧮 Referencia (teórico)");
      console.log(`   Suma movimientos (desde saldoInicial): $${sumaMovs}`);
      console.log(`   Saldo teórico (inicial + movimientos): $${teorico}`);
    }
  } catch {
    // Solo informativo, no bloquea
  }

  const actual = D(saldo.cantidad);

  // 4) Calcular monto de ajuste según modo
  let montoAjuste = D(0);
  let destinoTexto = "";

  if (FIX_MODE === "to-target") {
    if (!TARGET_RAW) {
      console.error(
        "❌ Falta --target=<monto> (ej: --target=680.79) para el modo to-target."
      );
      process.exit(1);
    }
    const target = D(TARGET_RAW);
    montoAjuste = target.minus(actual); // cuánto mover para llegar exactamente al target
    destinoTexto = `Fijar Saldo.cantidad en $${target}`;
  } else if (FIX_MODE === "to-theoretical") {
    if (teorico === null) {
      console.error(
        "❌ No se pudo calcular el saldo teórico (no hay SaldoInicial activo)."
      );
      process.exit(1);
    }
    montoAjuste = teorico.minus(actual);
    destinoTexto = `Igualar al saldo teórico ($${teorico})`;
  } else if (FIX_MODE === "to-current") {
    // Ajuste contable sin tocar Saldo.cantidad
    if (teorico === null) {
      console.error(
        "❌ No se pudo calcular el saldo teórico (no hay SaldoInicial activo)."
      );
      process.exit(1);
    }
    montoAjuste = actual.minus(teorico); // compensación contable
    destinoTexto = "Conservar Saldo.cantidad actual (compensación contable)";
  } else {
    console.log(
      "\n🔎 Dry-run: no se aplican cambios. Usa --fix=to-target --target=<monto>, --fix=to-theoretical o --fix=to-current"
    );
    return;
  }

  console.log("\n📝 Plan de ajuste");
  console.log(`   Destino: ${destinoTexto}`);
  console.log(
    `   Monto de ajuste: $${montoAjuste} (${
      montoAjuste.greaterThan(0) ? "INGRESO" : "EGRESO"
    })`
  );
  console.log(`   Bucket físico a tocar: ${BUCKET}`);

  // 5) Resolver usuario
  const usuarioId = await resolveUsuarioId(punto.id);
  console.log(`👤 Usuario para registrar el ajuste: ${usuarioId}`);

  // 6) Ejecutar transacción
  console.log("\n🚀 Ejecutando ajuste en base de datos...");
  const ahora = new Date();
  const tipoAjuste = "AJUSTE_CONTABLE";
  const descripcionBase = `Ajuste ${FIX_MODE} (${destinoTexto})`;

  const res = await prisma.$transaction(async (tx) => {
    const saldoLocked = await tx.saldo.findUnique({
      where: { id: saldo.id },
      include: { moneda: true },
    });
    if (!saldoLocked) throw new Error("Saldo no encontrado durante el ajuste.");

    const saldoAnterior = D(saldoLocked.cantidad);
    const billetesAnterior = D(saldoLocked.billetes);
    const monedasAnterior = D(saldoLocked.monedas_fisicas);
    const bancosAnterior = D(saldoLocked.bancos);

    const saldoNuevo =
      FIX_MODE === "to-current"
        ? saldoAnterior
        : saldoAnterior.plus(montoAjuste);

    // Calcular nuevos buckets físicos si aplica
    const billetesNuevo =
      FIX_MODE === "to-current"
        ? billetesAnterior
        : BUCKET === "billetes"
        ? billetesAnterior.plus(montoAjuste)
        : billetesAnterior;

    const monedasNuevo =
      FIX_MODE === "to-current"
        ? monedasAnterior
        : BUCKET === "monedas_fisicas"
        ? monedasAnterior.plus(montoAjuste)
        : monedasAnterior;

    const bancosNuevo =
      FIX_MODE === "to-current"
        ? bancosAnterior
        : BUCKET === "bancos"
        ? bancosAnterior.plus(montoAjuste)
        : bancosAnterior;

    // Validaciones simples: que no queden negativos
    if (
      billetesNuevo.lessThan(0) ||
      monedasNuevo.lessThan(0) ||
      bancosNuevo.lessThan(0)
    ) {
      throw new Error(
        `El ajuste produce valores negativos en ${BUCKET}. Cambia el bucket con --bucket=billetes|monedas_fisicas|bancos o ajusta el monto.`
      );
    }

    // 6.1) Crear movimiento de ajuste
    const mov = await tx.movimientoSaldo.create({
      data: {
        punto_atencion_id: punto.id,
        moneda_id: saldoLocked.moneda_id,
        tipo_movimiento: tipoAjuste,
        monto: montoAjuste,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: FIX_MODE === "to-current" ? saldoAnterior : saldoNuevo,
        usuario_id: usuarioId,
        referencia_id: saldoLocked.id,
        tipo_referencia: "AJUSTE_SALDO",
        descripcion: `${descripcionBase}. Cálculo a ${ahora.toISOString()}. Bucket=${BUCKET}`,
        fecha: ahora,
      },
    });

    // 6.2) Actualizar Saldo si aplica
    let saldoActualizado = saldoLocked;
    if (FIX_MODE !== "to-current") {
      saldoActualizado = await tx.saldo.update({
        where: { id: saldoLocked.id },
        data: {
          cantidad: saldoNuevo,
          billetes: billetesNuevo,
          monedas_fisicas: monedasNuevo,
          bancos: bancosNuevo,
          updated_at: ahora,
        },
        include: { moneda: true },
      });
    }

    return { mov, saldoActualizado };
  });

  console.log("✅ Ajuste aplicado con éxito.");
  console.log("   Movimiento de ajuste ID:", res.mov.id);
  if (FIX_MODE === "to-current") {
    console.log(
      `   Saldo quedó: $${saldo.cantidad} ${saldo.moneda.codigo} (intacto)`
    );
  } else {
    console.log(
      `   Saldo final: $${res.saldoActualizado.cantidad} ${res.saldoActualizado.moneda.codigo}`
    );
  }
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
