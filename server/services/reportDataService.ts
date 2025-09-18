import { TipoOperacion } from "@prisma/client";
import prisma from "../lib/prisma.js";
import {
  ExchangeData,
  TransferData,
  BalanceData,
  UserActivityData,
  ExchangeDetailedData,
  TransferDetailedData,
  AccountingMovementData,
  EODBalanceData,
  PointAssignmentData,
} from "../types/reportTypes.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

export const reportDataService = {
  async getExchangesData(
    startDate: Date,
    endDate: Date
  ): Promise<ExchangeData[]> {
    const exchanges = await prisma.cambioDivisa.findMany({
      where: {
        fecha: {
          gte: startDate,
          lt: endDate,
        },
        estado: "COMPLETADO",
      },
      include: {
        puntoAtencion: {
          select: { nombre: true },
        },
        usuario: {
          select: { nombre: true },
        },
        monedaOrigen: {
          select: { codigo: true, simbolo: true },
        },
        monedaDestino: {
          select: { codigo: true, simbolo: true },
        },
      },
    });

    const exchangesByPoint = exchanges.reduce(
      (acc: Record<string, ExchangeData>, exchange) => {
        const pointName = exchange.puntoAtencion?.nombre || "Punto desconocido";
        if (!acc[pointName]) {
          acc[pointName] = {
            point: pointName,
            amount: 0,
            exchanges: 0,
            user: exchange.usuario?.nombre || "Usuario desconocido",
          };
        }
        acc[pointName].amount += parseFloat(exchange.monto_origen.toString());
        acc[pointName].exchanges += 1;
        return acc;
      },
      {}
    );

    return Object.values(exchangesByPoint);
  },

  async getTransfersData(
    startDate: Date,
    endDate: Date
  ): Promise<TransferData[]> {
    const transfers = await prisma.transferencia.findMany({
      where: {
        fecha: {
          gte: startDate,
          lt: endDate,
        },
        estado: "APROBADO",
      },
      include: {
        origen: {
          select: { nombre: true },
        },
        destino: {
          select: { nombre: true },
        },
        usuarioSolicitante: {
          select: { nombre: true },
        },
        moneda: {
          select: { codigo: true, simbolo: true },
        },
      },
    });

    const transfersByPoint = transfers.reduce(
      (acc: Record<string, TransferData>, transfer) => {
        const pointName = transfer.destino?.nombre || "Punto desconocido";
        if (!acc[pointName]) {
          acc[pointName] = {
            point: pointName,
            transfers: 0,
            amount: 0,
            user: transfer.usuarioSolicitante?.nombre || "Usuario desconocido",
          };
        }
        acc[pointName].transfers += 1;
        acc[pointName].amount += parseFloat(transfer.monto.toString());
        return acc;
      },
      {}
    );

    return Object.values(transfersByPoint);
  },

  async getBalancesData(): Promise<BalanceData[]> {
    const balances = await prisma.saldo.findMany({
      include: {
        puntoAtencion: {
          select: { nombre: true },
        },
        moneda: {
          select: { codigo: true, simbolo: true },
        },
      },
    });

    const balancesByPoint = balances.reduce(
      (acc: Record<string, BalanceData>, balance) => {
        const pointName = balance.puntoAtencion?.nombre || "Punto desconocido";
        if (!acc[pointName]) {
          acc[pointName] = {
            point: pointName,
            balance: 0,
          };
        }
        acc[pointName].balance += parseFloat(balance.cantidad.toString());
        return acc;
      },
      {}
    );

    return Object.values(balancesByPoint);
  },

  async getUserActivityData(
    startDate: Date,
    endDate: Date
  ): Promise<UserActivityData[]> {
    const userActivity = await prisma.jornada.findMany({
      where: {
        fecha_inicio: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        usuario: {
          select: { nombre: true },
        },
        puntoAtencion: {
          select: { nombre: true },
        },
      },
    });

    const activityByPoint = userActivity.reduce(
      (acc: Record<string, { user: string; count: number }>, activity) => {
        const pointName = activity.puntoAtencion?.nombre || "Punto desconocido";
        const userName = activity.usuario?.nombre || "Usuario desconocido";

        if (!acc[pointName]) {
          acc[pointName] = { user: userName, count: 0 };
        }

        acc[pointName].count += 1;

        return acc;
      },
      {}
    );

    return Object.entries(activityByPoint).map(([point, { user, count }]) => ({
      point,
      user,
      transfers: count,
    }));
  },

  // Nuevo: cálculo de tiempo efectivo de trabajo descontando almuerzo y salidas espontáneas
  async getWorkTimeData(
    startDate: Date,
    endDate: Date,
    filters?: { pointId?: string; userId?: string }
  ) {
    const jornadas = await prisma.jornada.findMany({
      where: {
        fecha_inicio: { gte: startDate, lte: endDate },
        ...(filters?.userId ? { usuario_id: filters.userId } : {}),
        ...(filters?.pointId ? { punto_atencion_id: filters.pointId } : {}),
      },
      include: {
        usuario: { select: { nombre: true, username: true } },
        puntoAtencion: { select: { nombre: true } },
      },
      orderBy: { fecha_inicio: "asc" },
    });

    const salidas = await prisma.salidaEspontanea.findMany({
      where: {
        fecha_salida: { gte: startDate, lte: endDate },
        ...(filters?.userId ? { usuario_id: filters.userId } : {}),
        ...(filters?.pointId ? { punto_atencion_id: filters.pointId } : {}),
      },
      select: {
        usuario_id: true,
        punto_atencion_id: true,
        fecha_salida: true,
        fecha_regreso: true,
        duracion_minutos: true,
      },
      orderBy: { fecha_salida: "asc" },
    });

    const salidasPorUsuarioYDia = new Map<string, number>();
    for (const s of salidas) {
      // Normalizar clave de día por zona GYE
      const { gte } = gyeDayRangeUtcFromDate(new Date(s.fecha_salida));
      const key = `${s.usuario_id}|${gte.toISOString()}`;
      const mins =
        s.duracion_minutos ??
        (s.fecha_regreso
          ? Math.max(
              0,
              Math.round(
                (s.fecha_regreso.getTime() - s.fecha_salida.getTime()) / 60000
              )
            )
          : 0);
      salidasPorUsuarioYDia.set(
        key,
        (salidasPorUsuarioYDia.get(key) || 0) + mins
      );
    }

    const results = jornadas.map((j) => {
      const entrada = new Date(j.fecha_inicio);
      const salida = j.fecha_salida ? new Date(j.fecha_salida) : new Date();
      const totalMin = Math.max(
        0,
        Math.round((salida.getTime() - entrada.getTime()) / 60000)
      );

      // Almuerzo: si hay almuerzo y regreso, descontar ese tiempo; si solo hay almuerzo sin regreso, no descontamos hasta que regrese
      const lunchMin =
        j.fecha_almuerzo && j.fecha_regreso
          ? Math.max(
              0,
              Math.round(
                (new Date(j.fecha_regreso).getTime() -
                  new Date(j.fecha_almuerzo).getTime()) /
                  60000
              )
            )
          : 0;

      // Salidas espontáneas: sumar por usuario en el día de la jornada (día GYE)
      const { gte } = gyeDayRangeUtcFromDate(new Date(j.fecha_inicio));
      const key = `${j.usuario_id}|${gte.toISOString()}`;
      const spontaneousMin = salidasPorUsuarioYDia.get(key) || 0;

      const effective = Math.max(0, totalMin - lunchMin - spontaneousMin);

      return {
        // Fecha de reporte según día GYE
        date: gyeDayRangeUtcFromDate(new Date(j.fecha_inicio))
          .gte.toISOString()
          .slice(0, 10),
        point: j.puntoAtencion?.nombre || "Punto desconocido",
        user: j.usuario?.nombre || "Usuario desconocido",
        username: j.usuario?.username,
        entrada: j.fecha_inicio.toISOString(),
        almuerzo: j.fecha_almuerzo ? j.fecha_almuerzo.toISOString() : undefined,
        regreso: j.fecha_regreso ? j.fecha_regreso.toISOString() : undefined,
        salida: j.fecha_salida ? j.fecha_salida.toISOString() : "",
        estado: j.estado,
        lunchMinutes: lunchMin,
        spontaneousMinutes: spontaneousMin,
        effectiveMinutes: effective,
      };
    });

    return results;
  },

  // Nuevo: Cambios detallados con tasa mid y margen
  async getExchangesDetailedData(
    startDate: Date,
    endDate: Date,
    filters?: {
      pointId?: string;
      userId?: string;
      currencyId?: string; // moneda_origen o destino
      estado?: string;
      metodoEntrega?: "efectivo" | "transferencia";
    }
  ): Promise<ExchangeDetailedData[]> {
    const where: any = {
      fecha: { gte: startDate, lt: endDate },
      ...(filters?.estado ? { estado: filters.estado } : {}),
      ...(filters?.metodoEntrega
        ? { metodo_entrega: filters.metodoEntrega }
        : {}),
      ...(filters?.pointId ? { punto_atencion_id: filters.pointId } : {}),
      ...(filters?.userId ? { usuario_id: filters.userId } : {}),
      ...(filters?.currencyId
        ? {
            OR: [
              { moneda_origen_id: filters.currencyId },
              { moneda_destino_id: filters.currencyId },
            ],
          }
        : {}),
    };

    const rows = await prisma.cambioDivisa.findMany({
      where,
      include: {
        puntoAtencion: { select: { id: true, nombre: true } },
        usuario: { select: { nombre: true } },
        monedaOrigen: { select: { id: true, codigo: true } },
        monedaDestino: { select: { id: true, codigo: true } },
      },
      orderBy: { fecha: "asc" },
    });

    // Pre-agrupación por día GYE + punto + moneda para tasa_mid fallback
    type Key = string;
    const tasasPorGrupo = new Map<Key, { sumRates: number; count: number }>();

    function keyMid(date: Date, pointId: string, currencyPair: string) {
      const ymd = gyeDayRangeUtcFromDate(date).gte.toISOString().slice(0, 10);
      return `${ymd}|${pointId}|${currencyPair}`;
    }

    // Recolectar tasas efectivas por operación para usar como fallback del mid
    for (const r of rows) {
      const currencyPair = `${r.monedaOrigen.codigo}->${r.monedaDestino.codigo}`;
      const rateApplied = (() => {
        const origen = Number(r.monto_origen);
        const destino = Number(r.monto_destino);
        if (origen <= 0 || destino <= 0) return 0;
        return destino / origen;
      })();
      const k = keyMid(r.fecha, r.punto_atencion_id, currencyPair);
      const agg = tasasPorGrupo.get(k) || { sumRates: 0, count: 0 };
      if (rateApplied > 0 && isFinite(rateApplied)) {
        agg.sumRates += rateApplied;
        agg.count += 1;
        tasasPorGrupo.set(k, agg);
      }
    }

    const result: ExchangeDetailedData[] = rows.map((r) => {
      const origen = Number(r.monto_origen);
      const destino = Number(r.monto_destino);
      const tasaBilletes = Number(r.tasa_cambio_billetes || 0);
      const tasaMonedas = Number(r.tasa_cambio_monedas || 0);
      const rateApplied = origen > 0 ? destino / origen : 0;
      const currencyPair = `${r.monedaOrigen.codigo}->${r.monedaDestino.codigo}`;
      const k = keyMid(r.fecha, r.punto_atencion_id, currencyPair);
      const midAgg = tasasPorGrupo.get(k);
      const tasaMid =
        midAgg && midAgg.count > 0
          ? midAgg.sumRates / midAgg.count
          : rateApplied;
      const spread = rateApplied - tasaMid;
      const margen = spread * origen;

      return {
        id: r.id,
        fecha: r.fecha.toISOString(),
        punto: r.puntoAtencion?.nombre || "Punto desconocido",
        usuario: r.usuario?.nombre || "Usuario desconocido",
        tipo_operacion: r.tipo_operacion as any,
        moneda_origen: r.monedaOrigen.codigo,
        moneda_destino: r.monedaDestino.codigo,
        monto_origen: origen,
        monto_destino: destino,
        tasa_billetes: tasaBilletes,
        tasa_monedas: tasaMonedas,
        rate_applied: rateApplied,
        tasa_mid: tasaMid,
        spread: spread,
        margen_bruto: margen,
        fuente_tasa_mid:
          midAgg && midAgg.count > 0 ? "promedio_operaciones" : "auto",
        metodo_entrega: r.metodo_entrega,
        numero_recibo: r.numero_recibo,
        estado: r.estado,
      };
    });

    return result;
  },

  // Transferencias detalladas
  async getTransfersDetailedData(
    startDate: Date,
    endDate: Date,
    filters?: {
      pointId?: string;
      userId?: string;
      estado?: string;
      currencyId?: string;
    }
  ): Promise<TransferDetailedData[]> {
    const where: any = {
      fecha: { gte: startDate, lt: endDate },
      ...(filters?.estado ? { estado: filters.estado } : {}),
      ...(filters?.currencyId ? { moneda_id: filters.currencyId } : {}),
      ...(filters?.userId ? { solicitado_por: filters.userId } : {}),
      ...(filters?.pointId ? { destino_id: filters.pointId } : {}),
    };

    const rows = await prisma.transferencia.findMany({
      where,
      include: {
        origen: { select: { nombre: true } },
        destino: { select: { nombre: true } },
        usuarioSolicitante: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
      orderBy: { fecha: "asc" },
    });

    return rows.map((r) => ({
      id: r.id,
      fecha: r.fecha.toISOString(),
      punto_origen: r.origen?.nombre || "(N/A)",
      punto_destino: r.destino?.nombre || "Punto desconocido",
      usuario_solicitante:
        r.usuarioSolicitante?.nombre || "Usuario desconocido",
      moneda: r.moneda.codigo,
      monto: Number(r.monto),
      estado: r.estado,
      numero_recibo: r.numero_recibo,
      observaciones: r.observaciones_aprobacion || r.descripcion || null,
    }));
  },

  // Movimientos contables (MovimientoSaldo)
  async getAccountingMovementsData(
    startDate: Date,
    endDate: Date,
    filters?: {
      pointId?: string;
      userId?: string;
      currencyId?: string;
      tipoReferencia?: string;
    }
  ): Promise<AccountingMovementData[]> {
    const where: any = {
      fecha: { gte: startDate, lt: endDate },
      ...(filters?.pointId ? { punto_atencion_id: filters.pointId } : {}),
      ...(filters?.userId ? { usuario_id: filters.userId } : {}),
      ...(filters?.currencyId ? { moneda_id: filters.currencyId } : {}),
      ...(filters?.tipoReferencia
        ? { tipo_referencia: filters.tipoReferencia }
        : {}),
    };

    const rows = await prisma.movimientoSaldo.findMany({
      where,
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
        usuario: { select: { nombre: true } },
      },
      orderBy: { fecha: "asc" },
    });

    const refIds = rows
      .map((r) => r.referencia_id)
      .filter((x): x is string => !!x);
    let recibosMap = new Map<string, string>();
    if (refIds.length > 0) {
      const recibos = await prisma.recibo.findMany({
        where: { referencia_id: { in: Array.from(new Set(refIds)) } },
        select: { referencia_id: true, numero_recibo: true },
      });
      recibosMap = new Map(
        recibos.map((r) => [r.referencia_id, r.numero_recibo])
      );
    }

    return rows.map((r) => ({
      id: r.id,
      fecha: r.fecha.toISOString(),
      punto: r.puntoAtencion?.nombre || "Punto desconocido",
      moneda: r.moneda.codigo,
      tipo_movimiento: r.tipo_movimiento,
      monto: Number(r.monto),
      saldo_anterior: Number(r.saldo_anterior),
      saldo_nuevo: Number(r.saldo_nuevo),
      usuario: r.usuario?.nombre || "Usuario desconocido",
      referencia_id: r.referencia_id || null,
      tipo_referencia: r.tipo_referencia || null,
      numero_referencia: r.referencia_id
        ? recibosMap.get(r.referencia_id) || null
        : null,
      descripcion: r.descripcion || null,
    }));
  },

  // Saldos de cierre por día (CuadreCaja + Detalle)
  async getEodBalancesData(
    startDate: Date,
    endDate: Date,
    filters?: { pointId?: string }
  ): Promise<EODBalanceData[]> {
    const where: any = {
      fecha: { gte: startDate, lt: endDate },
      ...(filters?.pointId ? { punto_atencion_id: filters.pointId } : {}),
    };

    const rows = await prisma.cuadreCaja.findMany({
      where,
      include: {
        puntoAtencion: { select: { nombre: true } },
        detalles: { include: { moneda: { select: { codigo: true } } } },
      },
      orderBy: { fecha: "asc" },
    });

    const result: EODBalanceData[] = [];
    for (const c of rows) {
      const ymd = gyeDayRangeUtcFromDate(c.fecha_cierre || c.fecha)
        .gte.toISOString()
        .slice(0, 10);
      for (const d of c.detalles) {
        result.push({
          fecha: ymd,
          punto: c.puntoAtencion?.nombre || "Punto desconocido",
          moneda: d.moneda.codigo,
          saldo_cierre: Number(d.saldo_cierre),
          diferencia: Number(d.diferencia),
        });
      }
    }

    return result;
  },

  // Historial de asignaciones de punto
  async getPointAssignmentsData(
    startDate: Date,
    endDate: Date,
    filters?: { userId?: string }
  ): Promise<PointAssignmentData[]> {
    const where: any = {
      fecha_asignacion: { gte: startDate, lt: endDate },
      ...(filters?.userId ? { usuario_id: filters.userId } : {}),
    };

    const rows = await prisma.historialAsignacionPunto.findMany({
      where,
      include: {
        usuario: { select: { nombre: true } },
        puntoAnterior: { select: { nombre: true } },
        puntoNuevo: { select: { nombre: true } },
        usuarioAutorizador: { select: { nombre: true } },
      },
      orderBy: { fecha_asignacion: "asc" },
    });

    return rows.map((r) => ({
      fecha: r.fecha_asignacion.toISOString(),
      usuario: r.usuario?.nombre || "Usuario desconocido",
      punto_anterior: r.puntoAnterior?.nombre || null,
      punto_nuevo: r.puntoNuevo?.nombre || "Punto desconocido",
      autorizado_por: r.usuarioAutorizador?.nombre || null,
      motivo: r.motivo_cambio || null,
      observaciones: r.observaciones || null,
    }));
  },
};
