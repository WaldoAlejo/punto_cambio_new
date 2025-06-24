
import { PrismaClient } from "@prisma/client";
import { ExchangeData, TransferData, BalanceData, UserActivityData } from "../types/reportTypes.js";

const prisma = new PrismaClient();

export const reportDataService = {
  async getExchangesData(startDate: Date, endDate: Date): Promise<ExchangeData[]> {
    const exchanges = await prisma.cambioDivisa.findMany({
      where: {
        fecha: {
          gte: startDate,
          lte: endDate,
        },
        estado: 'COMPLETADO',
      },
      include: {
        puntoAtencion: {
          select: { nombre: true }
        },
        usuario: {
          select: { nombre: true }
        },
        monedaOrigen: {
          select: { codigo: true, simbolo: true }
        },
        monedaDestino: {
          select: { codigo: true, simbolo: true }
        }
      }
    });

    const exchangesByPoint = exchanges.reduce((acc: Record<string, ExchangeData>, exchange) => {
      const pointName = exchange.puntoAtencion?.nombre || 'Punto desconocido';
      if (!acc[pointName]) {
        acc[pointName] = {
          point: pointName,
          amount: 0,
          exchanges: 0,
          user: exchange.usuario?.nombre || 'Usuario desconocido'
        };
      }
      acc[pointName].amount += parseFloat(exchange.monto_origen.toString());
      acc[pointName].exchanges += 1;
      return acc;
    }, {});

    return Object.values(exchangesByPoint);
  },

  async getTransfersData(startDate: Date, endDate: Date): Promise<TransferData[]> {
    const transfers = await prisma.transferencia.findMany({
      where: {
        fecha: {
          gte: startDate,
          lte: endDate,
        },
        estado: 'APROBADO',
      },
      include: {
        origen: {
          select: { nombre: true }
        },
        destino: {
          select: { nombre: true }
        },
        usuarioSolicitante: {
          select: { nombre: true }
        },
        moneda: {
          select: { codigo: true, simbolo: true }
        }
      }
    });

    const transfersByPoint = transfers.reduce((acc: Record<string, TransferData>, transfer) => {
      const pointName = transfer.destino?.nombre || 'Punto desconocido';
      if (!acc[pointName]) {
        acc[pointName] = {
          point: pointName,
          transfers: 0,
          amount: 0,
          user: transfer.usuarioSolicitante?.nombre || 'Usuario desconocido'
        };
      }
      acc[pointName].transfers += 1;
      acc[pointName].amount += parseFloat(transfer.monto.toString());
      return acc;
    }, {});

    return Object.values(transfersByPoint);
  },

  async getBalancesData(): Promise<BalanceData[]> {
    const balances = await prisma.saldo.findMany({
      include: {
        puntoAtencion: {
          select: { nombre: true }
        },
        moneda: {
          select: { codigo: true, simbolo: true }
        }
      }
    });

    const balancesByPoint = balances.reduce((acc: Record<string, BalanceData>, balance) => {
      const pointName = balance.puntoAtencion?.nombre || 'Punto desconocido';
      if (!acc[pointName]) {
        acc[pointName] = {
          point: pointName,
          balance: 0
        };
      }
      acc[pointName].balance += parseFloat(balance.cantidad.toString());
      return acc;
    }, {});

    return Object.values(balancesByPoint);
  },

  async getUserActivityData(startDate: Date, endDate: Date): Promise<UserActivityData[]> {
    const userActivity = await prisma.jornada.findMany({
      where: {
        fecha_inicio: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        usuario: {
          select: { nombre: true }
        },
        puntoAtencion: {
          select: { nombre: true }
        }
      }
    });

    const activityByPoint = userActivity.reduce((acc: Record<string, UserActivityData>, activity) => {
      const pointName = activity.puntoAtencion?.nombre || 'Punto desconocido';
      if (!acc[pointName]) {
        acc[pointName] = {
          point: pointName,
          user: activity.usuario?.nombre || 'Usuario desconocido',
          transfers: userActivity.filter(a => 
            a.puntoAtencion?.nombre === pointName
          ).length
        };
      }
      return acc;
    }, {});

    return Object.values(activityByPoint);
  }
};
