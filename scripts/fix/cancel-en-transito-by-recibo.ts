import "dotenv/config";
import { EstadoTransferencia, Prisma, PrismaClient } from "@prisma/client";
import {
  getArgValueWithEnvFallback,
  hasFlag,
} from "../validate/_shared.js";

function parseRecibos(argv: string[]): string[] {
  const recibos: string[] = [];

  const pushMany = (raw?: string | null) => {
    if (!raw) return;
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    recibos.push(...parts);
  };

  // --recibo <x> (puede repetirse)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--recibo" && argv[i + 1]) {
      recibos.push(String(argv[i + 1]).trim());
    }
  }

  // --recibos a,b,c
  const recibosCsv = getArgValueWithEnvFallback("--recibos");
  pushMany(recibosCsv);

  // fallback: --recibo desde helper (si alguien lo usa solo una vez)
  const reciboSingle = getArgValueWithEnvFallback("--recibo");
  if (reciboSingle) recibos.push(reciboSingle.trim());

  // de-dup
  return Array.from(new Set(recibos.filter(Boolean)));
}

async function cancelTransferEnTransitoByRecibo(args: {
  prisma: PrismaClient;
  numeroRecibo: string;
  usuarioIdForLedger?: string;
  observaciones?: string;
  execute: boolean;
}) {
  const t = await args.prisma.transferencia.findFirst({
    where: { numero_recibo: args.numeroRecibo },
    select: {
      id: true,
      numero_recibo: true,
      estado: true,
      origen_id: true,
      destino_id: true,
      moneda_id: true,
      monto: true,
      via: true,
      solicitado_por: true,
      fecha: true,
    },
  });

  if (!t) {
    console.log(`NO-FOUND: ${args.numeroRecibo}`);
    return;
  }

  const monto = Number(t.monto);
  console.log(
    `FOUND: recibo=${t.numero_recibo} id=${t.id} estado=${t.estado} monto=${monto.toFixed(
      2
    )} origen=${t.origen_id ?? "(null)"} destino=${t.destino_id}`
  );

  if (t.estado !== EstadoTransferencia.EN_TRANSITO) {
    console.log(`SKIP: ${t.id} no está EN_TRANSITO (estado=${t.estado}).`);
    return;
  }

  if (!t.origen_id) {
    console.log(`SKIP: ${t.id} sin origen_id; no se puede devolver saldo.`);
    return;
  }

  const usuarioId =
    args.usuarioIdForLedger || t.solicitado_por || "";

  if (!usuarioId) {
    console.log(
      `SKIP: ${t.id} no tiene usuario para ledger (pasa --usuario <id>).`
    );
    return;
  }

  const observaciones =
    args.observaciones ||
    `Cancelada por script para reintento (recibo ${t.numero_recibo})`;

  if (!args.execute) {
    console.log(`DRY-RUN: cancelaría ${t.id} y devolvería saldo a origen.`);
    return;
  }

  await args.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1) Marcar CANCELADO
    await tx.transferencia.update({
      where: { id: t.id },
      data: {
        estado: EstadoTransferencia.CANCELADO,
        fecha_rechazo: new Date(),
        observaciones_rechazo: observaciones,
      },
    });

    // 2) Obtener saldo origen
    const saldoOrigen = await tx.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: t.origen_id!,
          moneda_id: t.moneda_id,
        },
      },
    });

    if (!saldoOrigen) {
      throw new Error(
        `No se encontró saldo del origen (${t.origen_id}) para moneda (${t.moneda_id}).`
      );
    }

    const saldoAnteriorOrigen = Number(saldoOrigen.cantidad);
    const billetesAnteriorOrigen = Number(saldoOrigen.billetes);
    const monedasAnteriorOrigen = Number(saldoOrigen.monedas_fisicas);

    let billetesDevolucion = 0;
    const monedasDevolucion = 0;

    // Mantener misma lógica del endpoint: si es EFECTIVO o MIXTO devuelve a billetes
    if (t.via === "EFECTIVO" || t.via === "MIXTO") {
      billetesDevolucion = monto;
    }

    const saldoNuevoOrigen = saldoAnteriorOrigen + monto;
    const billetesNuevoOrigen = billetesAnteriorOrigen + billetesDevolucion;
    const monedasNuevaOrigen = monedasAnteriorOrigen + monedasDevolucion;

    // 3) Actualizar saldo origen
    await tx.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: t.origen_id!,
          moneda_id: t.moneda_id,
        },
      },
      data: {
        cantidad: saldoNuevoOrigen,
        billetes: billetesNuevoOrigen,
        monedas_fisicas: monedasNuevaOrigen,
        updated_at: new Date(),
      },
    });

    // 4) Registrar movimiento (ledger)
    // Nota: mantenemos el monto POSITIVO para devoluciones (ingreso al origen).
    await tx.movimientoSaldo.create({
      data: {
        punto_atencion_id: t.origen_id!,
        moneda_id: t.moneda_id,
        tipo_movimiento: "TRANSFERENCIA_DEVOLUCION",
        monto,
        saldo_anterior: saldoAnteriorOrigen,
        saldo_nuevo: saldoNuevoOrigen,
        usuario_id: usuarioId,
        referencia_id: t.id,
        tipo_referencia: "TRANSFERENCIA",
        descripcion: `Devolución por cancelación de transferencia (script) - ${observaciones}`,
      },
    });
  });

  console.log(`OK: ${t.id} cancelada y saldo devuelto al origen.`);
}

async function main() {
  const prisma = new PrismaClient();
  const execute =
    hasFlag("--execute") ||
    process.env.npm_config_execute === "true" ||
    process.env.npm_config_execute === "1";

  const usuarioIdForLedger = getArgValueWithEnvFallback("--usuario") || undefined;
  const observaciones = getArgValueWithEnvFallback("--obs") || undefined;

  const recibos = parseRecibos(process.argv);
  if (recibos.length === 0) {
    console.error(
      "Uso: npx tsx scripts/fix/cancel-en-transito-by-recibo.ts --recibos TR-...-...,TR-...-... [--usuario <userId>] [--obs <texto>] [--execute]"
    );
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  console.log(
    `${execute ? "EXECUTE" : "DRY-RUN"}: cancelar ${recibos.length} recibo(s).`
  );

  for (const r of recibos) {
    // eslint-disable-next-line no-await-in-loop
    await cancelTransferEnTransitoByRecibo({
      prisma,
      numeroRecibo: r,
      usuarioIdForLedger,
      observaciones,
      execute,
    });
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error("Fallo cancel-en-transito-by-recibo:", e);
    process.exitCode = 1;
  });
