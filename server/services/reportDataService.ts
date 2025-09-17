import { PrismaClient, TipoOperacion } from "@prisma/client";
import {
  ExchangeData,
  TransferData,
  BalanceData,
  UserActivityData,
  ExchangeDetailedData,
} from "../types/reportTypes.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

const prisma = new PrismaClient();

export const reportDataService = {
  async getExchangesData(
    startDate: Date,
    endDate: Date
  ): Promise<ExchangeData[]> {
    const exchanges = await prisma.cambioDivisa.findMany({
      where: {
        fecha: {
          gte: startDate,
          lte: endDate,
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
          lte: endDate,
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
      fecha: { gte: startDate, lte: endDate },
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
      const isCompra = r.tipo_operacion === TipoOperacion.COMPRA;
      const currencyPair = `${r.monedaOrigen.codigo}->${r.monedaDestino.codigo}`;
      const rateApplied = (() => {
        // Tasa efectiva basada en montos y comportamiento
        const origen = Number(r.monto_origen);
        const destino = Number(r.monto_destino);
        if (origen <= 0 || destino <= 0) return 0;
        // Si MULTIPLICA (p.ej. compra): destino = origen * tasa
        // Si DIVIDE: destino = origen / tasa
        // Para una tasa efectiva neutral sin conocer comportamiento exacto, usamos destino/origen como estimador
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

      // Tasa efectiva aplicada por operación según montos
      const rateApplied = origen > 0 ? destino / origen : 0;

      // Obtener tasa_mid como promedio de compra/venta configuradas por punto/día.
      // No existe tabla explícita de configuración diaria en el esquema, así que usamos fallback:
      // promedio de rateApplied de ese punto, día GYE y par de monedas.
      const currencyPair = `${r.monedaOrigen.codigo}->${r.monedaDestino.codigo}`;
      const k = keyMid(r.fecha, r.punto_atencion_id, currencyPair);
      const midAgg = tasasPorGrupo.get(k);
      const tasaMid =
        midAgg && midAgg.count > 0
          ? midAgg.sumRates / midAgg.count
          : rateApplied;

      // Spread según operación: positivo si la tasa_aplicada favorece margen
      const isVenta = r.tipo_operacion === TipoOperacion.VENTA;
      const isCompra = r.tipo_operacion === TipoOperacion.COMPRA;
      const spread = rateApplied - tasaMid; // referencia neutral

      // Margen bruto aproximado: spread * base
      // Base: si usamos rate = destino/origen, una aproximación simple es base = origen
      // Signo: en venta spread>0 es favorable; en compra spread<0 es favorable -> mantenemos spread como está
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
};
