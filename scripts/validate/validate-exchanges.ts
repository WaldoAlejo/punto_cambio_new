import "dotenv/config";
import { EstadoTransaccion, PrismaClient, TipoViaTransferencia } from "@prisma/client";
import {
  approxEqual,
  makeCollector,
  pickRangeFromArgs,
  printResult,
  toNumber,
} from "./_shared.js";

function upper(s: unknown): string {
  return typeof s === "string" ? s.toUpperCase() : "";
}

async function main() {
  const prisma = new PrismaClient();
  const c = makeCollector("validate:exchanges");

  const { from, to, pointId, limit } = pickRangeFromArgs();

  const where: Record<string, unknown> = {};
  if (pointId) where.punto_atencion_id = pointId;
  if (from || to) {
    where.fecha = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const rows = await prisma.cambioDivisa.findMany({
    where: Object.keys(where).length ? (where as never) : undefined,
    select: {
      id: true,
      fecha: true,
      estado: true,
      tipo_operacion: true,
      punto_atencion_id: true,
      usuario_id: true,
      moneda_origen_id: true,
      moneda_destino_id: true,
      monto_origen: true,
      monto_destino: true,
      tasa_cambio_billetes: true,
      tasa_cambio_monedas: true,
      divisas_entregadas_billetes: true,
      divisas_entregadas_monedas: true,
      divisas_entregadas_total: true,
      divisas_recibidas_billetes: true,
      divisas_recibidas_monedas: true,
      divisas_recibidas_total: true,
      metodo_entrega: true,
      transferencia_numero: true,
      transferencia_banco: true,
      abono_inicial_monto: true,
      saldo_pendiente: true,
      fecha_completado: true,
      numero_recibo: true,
      numero_recibo_abono: true,
      numero_recibo_completar: true,
      metodo_pago_origen: true,
      usd_entregado_efectivo: true,
      usd_entregado_transfer: true,
      usd_recibido_efectivo: true,
      usd_recibido_transfer: true,
      monedaOrigen: { select: { codigo: true } },
      monedaDestino: { select: { codigo: true } },
    },
    orderBy: { fecha: "desc" },
    take: limit && limit > 0 ? limit : undefined,
  });

  for (const r of rows) {
    const codigoOrigen = upper(r.monedaOrigen?.codigo);
    const codigoDestino = upper(r.monedaDestino?.codigo);

    if (r.moneda_origen_id === r.moneda_destino_id) {
      c.error("EXC_SAME_CURRENCY", "CambioDivisa usa la misma moneda en origen y destino", {
        id: r.id,
        punto: r.punto_atencion_id,
      });
    }

    const montoOrigen = toNumber(r.monto_origen);
    const montoDestino = toNumber(r.monto_destino);
    if (!(montoOrigen > 0) || !(montoDestino > 0)) {
      c.error("EXC_MONTO_INVALID", "CambioDivisa tiene montos no positivos", {
        id: r.id,
        montoOrigen,
        montoDestino,
        estado: r.estado,
      });
    }

    const entB = toNumber(r.divisas_entregadas_billetes);
    const entM = toNumber(r.divisas_entregadas_monedas);
    const entT = toNumber(r.divisas_entregadas_total);
    if ([entB, entM, entT].every(Number.isFinite)) {
      const sum = entB + entM;
      if (!approxEqual(entT, sum, 0.02)) {
        c.error("EXC_ENT_TOTAL_MISMATCH", "divisas_entregadas_total no coincide con billetes+monedas", {
          id: r.id,
          entT,
          sum,
        });
      }
    }

    const recB = toNumber(r.divisas_recibidas_billetes);
    const recM = toNumber(r.divisas_recibidas_monedas);
    const recT = toNumber(r.divisas_recibidas_total);
    if ([recB, recM, recT].every(Number.isFinite)) {
      const sum = recB + recM;
      if (!approxEqual(recT, sum, 0.02)) {
        c.error("EXC_REC_TOTAL_MISMATCH", "divisas_recibidas_total no coincide con billetes+monedas", {
          id: r.id,
          recT,
          sum,
        });
      }
    }

    // Tasas: si hay componente, debería haber tasa > 0
    const tasaB = toNumber(r.tasa_cambio_billetes);
    const tasaM = toNumber(r.tasa_cambio_monedas);
    if ((entB > 0.01 || recB > 0.01) && !(tasaB > 0)) {
      c.warn("EXC_TASA_BILLETES_ZERO", "Hay billetes pero tasa_cambio_billetes es 0", {
        id: r.id,
        entB,
        recB,
        tasaB,
      });
    }
    if ((entM > 0.01 || recM > 0.01) && !(tasaM > 0)) {
      c.warn("EXC_TASA_MONEDAS_ZERO", "Hay monedas pero tasa_cambio_monedas es 0", {
        id: r.id,
        entM,
        recM,
        tasaM,
      });
    }

    // Transferencia: si metodo_entrega es transferencia, debe tener banco + referencia
    if (upper(r.metodo_entrega) === "TRANSFERENCIA") {
      if (!r.transferencia_banco || !String(r.transferencia_banco).trim()) {
        c.error("EXC_TRANSFER_BANK_MISSING", "metodo_entrega=transferencia pero falta transferencia_banco", {
          id: r.id,
        });
      }
      if (!r.transferencia_numero || !String(r.transferencia_numero).trim()) {
        c.error("EXC_TRANSFER_REF_MISSING", "metodo_entrega=transferencia pero falta transferencia_numero", {
          id: r.id,
        });
      }
    }

    // Validaciones USD (si aplica)
    const usdEntE = toNumber(r.usd_entregado_efectivo);
    const usdEntT = toNumber(r.usd_entregado_transfer);
    const usdRecE = toNumber(r.usd_recibido_efectivo);
    const usdRecT = toNumber(r.usd_recibido_transfer);

    if (codigoDestino === "USD") {
      if ([usdEntE, usdEntT].some((x) => Number.isFinite(x))) {
        const sum = (Number.isFinite(usdEntE) ? usdEntE : 0) + (Number.isFinite(usdEntT) ? usdEntT : 0);
        if (Number.isFinite(recT) && !approxEqual(sum, recT, 0.02)) {
          c.warn("EXC_USD_ENT_SUM", "USD entregado (efectivo+transfer) no coincide con divisas_recibidas_total", {
            id: r.id,
            sum,
            recT,
          });
        }
        if (upper(r.metodo_entrega) === "EFECTIVO" && Number.isFinite(usdEntT) && usdEntT > 0.01) {
          c.warn("EXC_USD_ENT_METHOD", "metodo_entrega=efectivo pero usd_entregado_transfer > 0", {
            id: r.id,
            usdEntT,
          });
        }
        if (upper(r.metodo_entrega) === "TRANSFERENCIA" && Number.isFinite(usdEntE) && usdEntE > 0.01) {
          c.warn("EXC_USD_ENT_METHOD", "metodo_entrega=transferencia pero usd_entregado_efectivo > 0", {
            id: r.id,
            usdEntE,
          });
        }
      }
    }

    if (codigoOrigen === "USD") {
      if ([usdRecE, usdRecT].some((x) => Number.isFinite(x))) {
        const sum = (Number.isFinite(usdRecE) ? usdRecE : 0) + (Number.isFinite(usdRecT) ? usdRecT : 0);
        if (Number.isFinite(entT) && !approxEqual(sum, entT, 0.02)) {
          c.warn("EXC_USD_REC_SUM", "USD recibido (efectivo+transfer) no coincide con divisas_entregadas_total", {
            id: r.id,
            sum,
            entT,
          });
        }
        if (r.metodo_pago_origen === TipoViaTransferencia.EFECTIVO && Number.isFinite(usdRecT) && usdRecT > 0.01) {
          c.warn("EXC_USD_REC_METHOD", "metodo_pago_origen=EFECTIVO pero usd_recibido_transfer > 0", {
            id: r.id,
            usdRecT,
          });
        }
        if (r.metodo_pago_origen === TipoViaTransferencia.BANCO && Number.isFinite(usdRecE) && usdRecE > 0.01) {
          c.warn("EXC_USD_REC_METHOD", "metodo_pago_origen=BANCO pero usd_recibido_efectivo > 0", {
            id: r.id,
            usdRecE,
          });
        }
      }
    }

    // Reglas de estado / recibo (tolerantes a históricos)
    if (r.estado === EstadoTransaccion.COMPLETADO) {
      if (!r.numero_recibo) {
        c.warn("EXC_NO_RECIBO", "CambioDivisa COMPLETADO sin numero_recibo (posible histórico)", {
          id: r.id,
        });
      }
    }

    const saldoPend = toNumber(r.saldo_pendiente);
    const abonoIni = toNumber(r.abono_inicial_monto);
    if (Number.isFinite(saldoPend) && saldoPend > 0.01) {
      if (!(abonoIni > 0)) {
        c.warn("EXC_PARTIAL_NO_ABONO", "Cambio con saldo_pendiente > 0 pero sin abono_inicial_monto", {
          id: r.id,
          saldoPend,
        });
      }
      if (r.estado === EstadoTransaccion.COMPLETADO && !r.fecha_completado) {
        c.warn("EXC_PARTIAL_STATE", "CambioDivisa COMPLETADO con saldo_pendiente > 0 y sin fecha_completado", {
          id: r.id,
          saldoPend,
        });
      }
      if (!r.numero_recibo_abono) {
        c.warn("EXC_PARTIAL_RECIBO_ABONO", "Cambio parcial sin numero_recibo_abono", {
          id: r.id,
        });
      }
    }

    if (r.numero_recibo_completar && !r.fecha_completado) {
      c.warn("EXC_RECIBO_COMPLETAR_NO_FECHA", "numero_recibo_completar existe pero fecha_completado es null", {
        id: r.id,
      });
    }
  }

  const result = c.finish();
  printResult(result);
  await prisma.$disconnect();

  if (result.counts.errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Fallo validate-exchanges:", e);
  process.exitCode = 1;
});
