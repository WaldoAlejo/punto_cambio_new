import "dotenv/config";
import { PrismaClient, EstadoTransferencia } from "@prisma/client";

const TRANSFER_ID = "0d26ffdf-8a9b-422f-84ec-a8aba28e0b27";
const OBS = "Cancelada por solicitud administrativa";

async function main() {
  const prisma = new PrismaClient();
  try {
    const t = await prisma.transferencia.findUnique({
      where: { id: TRANSFER_ID },
      select: {
        id: true,
        numero_recibo: true,
        origen_id: true,
        destino_id: true,
        monto: true,
        moneda_id: true,
        via: true,
        solicitado_por: true,
        estado: true,
      },
    });
    if (!t) {
      console.log("No existe la transferencia.");
      return;
    }
    if (t.estado !== EstadoTransferencia.EN_TRANSITO) {
      console.log(`La transferencia no está en tránsito (estado actual: ${t.estado}).`);
      return;
    }
    const monto = Number(t.monto);
    const usuarioId = t.solicitado_por;
    await prisma.$transaction(async (tx) => {
      await tx.transferencia.update({
        where: { id: t.id },
        data: {
          estado: EstadoTransferencia.CANCELADO,
          fecha_rechazo: new Date(),
          observaciones_rechazo: OBS,
        },
      });
      if (!t.origen_id) return;
      const saldo = await tx.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: t.origen_id,
            moneda_id: t.moneda_id,
          },
        },
      });
      const saldoAnterior = saldo ? Number(saldo.cantidad) : 0;
      const billetesAnterior = saldo ? Number(saldo.billetes) : 0;
      let billetesDevolucion = 0;
      if (t.via === "EFECTIVO" || t.via === "MIXTO") {
        billetesDevolucion = monto;
      }
      const saldoNuevo = saldoAnterior + monto;
      const billetesNuevo = billetesAnterior + billetesDevolucion;
      await tx.saldo.upsert({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: t.origen_id,
            moneda_id: t.moneda_id,
          },
        },
        update: {
          cantidad: saldoNuevo,
          billetes: billetesNuevo,
          updated_at: new Date(),
        },
        create: {
          punto_atencion_id: t.origen_id,
          moneda_id: t.moneda_id,
          cantidad: saldoNuevo,
          billetes: billetesNuevo,
        },
      });
      await tx.movimientoSaldo.create({
        data: {
          punto_atencion_id: t.origen_id,
          moneda_id: t.moneda_id,
          tipo_movimiento: "TRANSFERENCIA_DEVOLUCION",
          monto,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          usuario_id: usuarioId,
          referencia_id: t.id,
          tipo_referencia: "TRANSFERENCIA",
          descripcion: `Devolución por cancelación de transferencia EN_TRANSITO (script) - ${OBS}`,
        },
      });
    });
    console.log(`OK: cancelada transferencia ${t.numero_recibo || t.id} (devolución a origen=${t.origen_id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error al cancelar transferencia:", e);
  process.exitCode = 1;
});
