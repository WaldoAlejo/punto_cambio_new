import { PrismaClient } from "@prisma/client";
import {
  ExchangeData,
  TransferData,
  BalanceData,
  UserActivityData,
} from "../types/reportTypes.js";

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
        usuario: { select: { nombre: true } },
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
      const dia = new Date(s.fecha_salida);
      dia.setHours(0, 0, 0, 0);
      const key = `${s.usuario_id}|${dia.toISOString()}`;
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

      // Salidas espontáneas: sumar por usuario en el día de la jornada
      const dia = new Date(j.fecha_inicio);
      dia.setHours(0, 0, 0, 0);
      const key = `${j.usuario_id}|${dia.toISOString()}`;
      const spontaneousMin = salidasPorUsuarioYDia.get(key) || 0;

      const effective = Math.max(0, totalMin - lunchMin - spontaneousMin);

      return {
        date: j.fecha_inicio.toISOString().slice(0, 10),
        point: j.puntoAtencion?.nombre || "Punto desconocido",
        user: j.usuario?.nombre || "Usuario desconocido",
        entrada: j.fecha_inicio.toISOString(),
        salida: j.fecha_salida ? j.fecha_salida.toISOString() : "",
        lunchMinutes: lunchMin,
        spontaneousMinutes: spontaneousMin,
        effectiveMinutes: effective,
      };
    });

    return results;
  },
};
