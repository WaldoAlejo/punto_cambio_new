/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REPORTE HISTÓRICO COMPLETO: SERVICIOS EXTERNOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Endpoint: GET /api/reportes/servicios-externos-historico
 *
 * Genera un Excel con todo el historial de movimientos y asignaciones
 * de servicios externos desde el inicio de la aplicación hasta hoy.
 *
 * Hojas:
 *   1. Movimientos — ingresos y egresos por punto y servicio
 *   2. Asignaciones — recargas y asignaciones iniciales con saldos
 */

import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const router = express.Router();

/* ============================
 * GET /api/reportes/servicios-externos-historico
 * ============================ */
router.get(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    try {
      logger.info("📊 Iniciando generación de reporte histórico de servicios externos", {
        user_id: (req.user as any)?.id,
      });

      // ─────────────────────────────────────────────────────────────────────
      // 1. Obtener Movimientos de Servicios Externos (histórico completo)
      // ─────────────────────────────────────────────────────────────────────
      const movimientos = await prisma.servicioExternoMovimiento.findMany({
        orderBy: { fecha: "asc" },
        include: {
          puntoAtencion: { select: { id: true, nombre: true } },
          moneda: { select: { id: true, codigo: true, nombre: true, simbolo: true } },
          usuario: { select: { id: true, nombre: true, username: true } },
        },
      });

      logger.info(`📥 Movimientos de servicios externos cargados: ${movimientos.length}`);

      // ─────────────────────────────────────────────────────────────────────
      // 2. Obtener Asignaciones de Servicios Externos (histórico completo)
      // ─────────────────────────────────────────────────────────────────────
      const asignaciones = await prisma.servicioExternoAsignacion.findMany({
        orderBy: { fecha: "asc" },
        include: {
          puntoAtencion: { select: { id: true, nombre: true } },
          moneda: { select: { id: true, codigo: true, nombre: true, simbolo: true } },
          usuarioAsignador: { select: { id: true, nombre: true, username: true } },
        },
      });

      logger.info(`📥 Asignaciones de servicios externos cargadas: ${asignaciones.length}`);

      // ─────────────────────────────────────────────────────────────────────
      // 3. Construir Excel
      // ─────────────────────────────────────────────────────────────────────
      const workbook = new ExcelJS.Workbook();

      // ═══════════════════════════════════════════════════════════════════
      // Hoja 1: Movimientos
      // ═══════════════════════════════════════════════════════════════════
      const wsMovimientos = workbook.addWorksheet("Movimientos");
      wsMovimientos.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Punto de Atención", key: "punto", width: 28 },
        { header: "Servicio", key: "servicio", width: 22 },
        { header: "Tipo Movimiento", key: "tipo_movimiento", width: 18 },
        { header: "Moneda", key: "moneda", width: 12 },
        { header: "Monto", key: "monto", width: 16 },
        { header: "Método Ingreso", key: "metodo_ingreso", width: 16 },
        { header: "Billetes", key: "billetes", width: 14 },
        { header: "Monedas Físicas", key: "monedas_fisicas", width: 16 },
        { header: "Bancos", key: "bancos", width: 14 },
        { header: "Descripción", key: "descripcion", width: 35 },
        { header: "Referencia", key: "referencia", width: 20 },
        { header: "Usuario", key: "usuario", width: 22 },
      ];

      movimientos.forEach((m) => {
        wsMovimientos.addRow({
          fecha: format(new Date(m.fecha), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: m.puntoAtencion?.nombre || "N/A",
          servicio: m.servicio.replace(/_/g, " "),
          tipo_movimiento: m.tipo_movimiento,
          moneda: m.moneda?.codigo || "N/A",
          monto: parseFloat(m.monto?.toString() || "0"),
          metodo_ingreso: m.metodo_ingreso || "N/A",
          billetes: m.billetes ? parseFloat(m.billetes.toString()) : 0,
          monedas_fisicas: m.monedas_fisicas ? parseFloat(m.monedas_fisicas.toString()) : 0,
          bancos: m.bancos ? parseFloat(m.bancos.toString()) : 0,
          descripcion: m.descripcion || "",
          referencia: m.numero_referencia || "N/A",
          usuario: m.usuario?.nombre || m.usuario?.username || "N/A",
        });
      });

      // ═══════════════════════════════════════════════════════════════════
      // Hoja 2: Asignaciones
      // ═══════════════════════════════════════════════════════════════════
      const wsAsignaciones = workbook.addWorksheet("Asignaciones");
      wsAsignaciones.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Punto de Atención", key: "punto", width: 28 },
        { header: "Servicio", key: "servicio", width: 22 },
        { header: "Moneda", key: "moneda", width: 12 },
        { header: "Tipo", key: "tipo", width: 12 },
        { header: "Monto", key: "monto", width: 16 },
        { header: "Saldo Anterior", key: "saldo_anterior", width: 16 },
        { header: "Saldo Nuevo", key: "saldo_nuevo", width: 16 },
        { header: "Asignado Por", key: "asignado_por", width: 22 },
        { header: "Observaciones", key: "observaciones", width: 35 },
      ];

      asignaciones.forEach((a) => {
        wsAsignaciones.addRow({
          fecha: format(new Date(a.fecha), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: a.puntoAtencion?.nombre || "N/A",
          servicio: a.servicio.replace(/_/g, " "),
          moneda: a.moneda?.codigo || "N/A",
          tipo: a.tipo,
          monto: parseFloat(a.monto?.toString() || "0"),
          saldo_anterior: parseFloat(a.saldo_anterior?.toString() || "0"),
          saldo_nuevo: parseFloat(a.saldo_nuevo?.toString() || "0"),
          asignado_por: a.usuarioAsignador?.nombre || a.usuarioAsignador?.username || "N/A",
          observaciones: a.observaciones || "",
        });
      });

      // ─────────────────────────────────────────────────────────────────────
      // 4. Estilizar encabezados
      // ─────────────────────────────────────────────────────────────────────
      [wsMovimientos, wsAsignaciones].forEach((ws) => {
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE6E6FA" },
        };
      });

      // ─────────────────────────────────────────────────────────────────────
      // 5. Enviar respuesta
      // ─────────────────────────────────────────────────────────────────────
      const fechaActual = format(new Date(), "yyyy-MM-dd");
      const fileName = `reporte_servicios_externos_historico_${fechaActual}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${fileName}`
      );

      await workbook.xlsx.write(res);
      res.end();

      const duration = Date.now() - startTime;
      logger.info(`✅ Reporte de servicios externos generado en ${duration}ms`, {
        movimientos: movimientos.length,
        asignaciones: asignaciones.length,
        user_id: (req.user as any)?.id,
      });
    } catch (error) {
      logger.error("❌ Error generando reporte histórico de servicios externos", {
        error: error instanceof Error ? error.message : String(error),
        user_id: (req.user as any)?.id,
      });
      res.status(500).json({
        success: false,
        error: "Error interno del servidor al generar el reporte",
      });
    }
  }
);

export default router;
