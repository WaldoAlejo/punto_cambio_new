
import express from "express";
import { supabase } from "../../src/integrations/supabase/client.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Endpoint para generar reportes
router.post(
  "/",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
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

      let reportData: any[] = [];

      switch (reportType) {
        case 'exchanges':
          // Reporte de cambios de divisa
          const { data: exchanges, error: exchangesError } = await supabase
            .from('CambioDivisa')
            .select(`
              *,
              PuntoAtencion:punto_atencion_id (nombre),
              Usuario:usuario_id (nombre),
              MonedaOrigen:moneda_origen_id (codigo, simbolo),
              MonedaDestino:moneda_destino_id (codigo, simbolo)
            `)
            .gte('fecha', startDate.toISOString())
            .lte('fecha', endDate.toISOString())
            .eq('estado', 'COMPLETADO');

          if (exchangesError) {
            throw exchangesError;
          }

          // Group by point
          const exchangesByPoint = exchanges?.reduce((acc: any, exchange) => {
            const pointName = exchange.PuntoAtencion?.nombre || 'Punto desconocido';
            if (!acc[pointName]) {
              acc[pointName] = {
                point: pointName,
                amount: 0,
                exchanges: 0,
                user: exchange.Usuario?.nombre || 'Usuario desconocido'
              };
            }
            acc[pointName].amount += parseFloat(exchange.monto_origen.toString());
            acc[pointName].exchanges += 1;
            return acc;
          }, {}) || {};

          reportData = Object.values(exchangesByPoint);
          break;

        case 'transfers':
          // Reporte de transferencias
          const { data: transfers, error: transfersError } = await supabase
            .from('Transferencia')
            .select(`
              *,
              Origen:origen_id (nombre),
              Destino:destino_id (nombre),
              UsuarioSolicitante:solicitado_por (nombre),
              Moneda:moneda_id (codigo, simbolo)
            `)
            .gte('fecha', startDate.toISOString())
            .lte('fecha', endDate.toISOString())
            .eq('estado', 'APROBADO');

          if (transfersError) {
            throw transfersError;
          }

          const transfersByPoint = transfers?.reduce((acc: any, transfer) => {
            const pointName = transfer.Destino?.nombre || 'Punto desconocido';
            if (!acc[pointName]) {
              acc[pointName] = {
                point: pointName,
                transfers: 0,
                amount: 0,
                user: transfer.UsuarioSolicitante?.nombre || 'Usuario desconocido'
              };
            }
            acc[pointName].transfers += 1;
            acc[pointName].amount += parseFloat(transfer.monto.toString());
            return acc;
          }, {}) || {};

          reportData = Object.values(transfersByPoint);
          break;

        case 'balances':
          // Reporte de saldos actuales
          const { data: balances, error: balancesError } = await supabase
            .from('Saldo')
            .select(`
              *,
              PuntoAtencion:punto_atencion_id (nombre),
              Moneda:moneda_id (codigo, simbolo)
            `);

          if (balancesError) {
            throw balancesError;
          }

          const balancesByPoint = balances?.reduce((acc: any, balance) => {
            const pointName = balance.PuntoAtencion?.nombre || 'Punto desconocido';
            if (!acc[pointName]) {
              acc[pointName] = {
                point: pointName,
                balance: 0
              };
            }
            acc[pointName].balance += parseFloat(balance.cantidad.toString());
            return acc;
          }, {}) || {};

          reportData = Object.values(balancesByPoint);
          break;

        case 'users':
          // Reporte de actividad de usuarios
          const { data: userActivity, error: activityError } = await supabase
            .from('Jornada')
            .select(`
              *,
              Usuario:usuario_id (nombre),
              PuntoAtencion:punto_atencion_id (nombre)
            `)
            .gte('fecha_inicio', startDate.toISOString())
            .lte('fecha_inicio', endDate.toISOString());

          if (activityError) {
            throw activityError;
          }

          const activityByPoint = userActivity?.reduce((acc: any, activity) => {
            const pointName = activity.PuntoAtencion?.nombre || 'Punto desconocido';
            if (!acc[pointName]) {
              acc[pointName] = {
                point: pointName,
                user: activity.Usuario?.nombre || 'Usuario desconocido',
                transfers: userActivity.filter(a => 
                  a.PuntoAtencion?.nombre === pointName
                ).length
              };
            }
            return acc;
          }, {}) || {};

          reportData = Object.values(activityByPoint);
          break;

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
