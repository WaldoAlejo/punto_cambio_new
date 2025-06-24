
import express from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}

interface AuthenticatedRequest extends express.Request {
  user?: AuthenticatedUser;
}

interface ExchangeData {
  point: string;
  amount: number;
  exchanges: number;
  user: string;
}

interface TransferData {
  point: string;
  transfers: number;
  amount: number;
  user: string;
}

interface BalanceData {
  point: string;
  balance: number;
}

interface UserActivityData {
  point: string;
  user: string;
  transfers: number;
}

type ReportData = ExchangeData | TransferData | BalanceData | UserActivityData;

// Endpoint para generar reportes
router.post(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      const { reportType, dateFrom, dateTo } = req.body;

      if (!reportType || !dateFrom || !dateTo) {
        res.status(400).json({
          error: "Faltan parámetros requeridos: reportType, dateFrom, dateTo",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999); // Include the entire end date

      let reportData: ReportData[] = [];

      switch (reportType) {
        case 'exchanges': {
          // Reporte de cambios de divisa
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

          // Group by point
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

          reportData = Object.values(exchangesByPoint);
          break;
        }

        case 'transfers': {
          // Reporte de transferencias
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

          reportData = Object.values(transfersByPoint);
          break;
        }

        case 'balances': {
          // Reporte de saldos actuales
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

          reportData = Object.values(balancesByPoint);
          break;
        }

        case 'users': {
          // Reporte de actividad de usuarios
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

          reportData = Object.values(activityByPoint);
          break;
        }

        default:
          res.status(400).json({
            error: "Tipo de reporte no válido",
            success: false,
            timestamp: new Date().toISOString(),
          });
          return;
      }

      logger.info("Reporte generado exitosamente", {
        reportType,
        dateFrom,
        dateTo,
        recordCount: reportData.length,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        data: reportData,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al generar reporte", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error interno del servidor al generar reporte",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
