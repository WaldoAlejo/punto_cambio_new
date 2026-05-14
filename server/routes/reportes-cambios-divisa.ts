/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REPORTE HISTÓRICO COMPLETO: CAMBIOS DE DIVISA + ASIGNACIONES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Endpoint: GET /api/reportes/cambios-divisa-historico
 *
 * Genera un Excel con todo el historial de cambios de divisa y asignaciones
 * de saldo desde el inicio de la aplicación hasta hoy.
 *
 * Hojas:
 *   1. Cambios de Divisa — todas las transacciones con tasa, montos, punto, etc.
 *   2. Asignaciones de Saldo — todas las asignaciones iniciales y recargas
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
 * GET /api/reportes/cambios-divisa-historico
 * ============================ */
router.get(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    try {
      logger.info("📊 Iniciando generación de reporte histórico de cambios de divisa", {
        user_id: (req.user as any)?.id,
      });

      // ─────────────────────────────────────────────────────────────────────
      // 1. Obtener Cambios de Divisa (histórico completo)
      // ─────────────────────────────────────────────────────────────────────
      const cambios = await prisma.cambioDivisa.findMany({
        orderBy: { fecha: "asc" },
        include: {
          puntoAtencion: { select: { id: true, nombre: true } },
          monedaOrigen: { select: { id: true, codigo: true, nombre: true, simbolo: true } },
          monedaDestino: { select: { id: true, codigo: true, nombre: true, simbolo: true } },
          usuario: { select: { id: true, nombre: true, username: true } },
        },
      });

      logger.info(`📥 Cambios de divisa cargados: ${cambios.length}`);

      // ─────────────────────────────────────────────────────────────────────
      // 2. Obtener Asignaciones de Saldo (histórico completo)
      // ─────────────────────────────────────────────────────────────────────
      const asignaciones = await prisma.asignacionSaldo.findMany({
        orderBy: { fecha: "asc" },
        include: {
          puntoAtencion: { select: { id: true, nombre: true } },
          moneda: { select: { id: true, codigo: true, nombre: true, simbolo: true } },
          usuarioAsignador: { select: { id: true, nombre: true, username: true } },
        },
      });

      logger.info(`📥 Asignaciones de saldo cargadas: ${asignaciones.length}`);

      // ─────────────────────────────────────────────────────────────────────
      // 3. Construir Excel
      // ─────────────────────────────────────────────────────────────────────
      const workbook = new ExcelJS.Workbook();

      // ═══════════════════════════════════════════════════════════════════
      // Hoja 1: Cambios de Divisa
      // ═══════════════════════════════════════════════════════════════════
      const wsCambios = workbook.addWorksheet("Cambios de Divisa");
      wsCambios.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Punto de Atención", key: "punto", width: 28 },
        { header: "Operador", key: "operador", width: 22 },
        { header: "Recibo", key: "recibo", width: 18 },
        { header: "Moneda Origen", key: "moneda_origen", width: 14 },
        { header: "Moneda Destino", key: "moneda_destino", width: 16 },
        { header: "Tipo Operación", key: "tipo_operacion", width: 14 },
        { header: "Monto Origen", key: "monto_origen", width: 16 },
        { header: "Monto Destino", key: "monto_destino", width: 16 },
        { header: "Tasa Billetes", key: "tasa_billetes", width: 14 },
        { header: "Tasa Monedas", key: "tasa_monedas", width: 14 },
        { header: "Entregado Efectivo", key: "usd_entregado_efectivo", width: 18 },
        { header: "Entregado Transfer", key: "usd_entregado_transfer", width: 18 },
        { header: "Recibido Efectivo", key: "usd_recibido_efectivo", width: 18 },
        { header: "Recibido Transfer", key: "usd_recibido_transfer", width: 18 },
        { header: "Método Entrega", key: "metodo_entrega", width: 16 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Cliente", key: "cliente", width: 22 },
        { header: "Observación", key: "observacion", width: 35 },
      ];

      cambios.forEach((c) => {
        wsCambios.addRow({
          fecha: format(new Date(c.fecha), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: c.puntoAtencion?.nombre || "N/A",
          operador: c.usuario?.nombre || c.usuario?.username || "N/A",
          recibo: c.numero_recibo || "N/A",
          moneda_origen: c.monedaOrigen?.codigo || "N/A",
          moneda_destino: c.monedaDestino?.codigo || "N/A",
          tipo_operacion: c.tipo_operacion,
          monto_origen: parseFloat(c.monto_origen?.toString() || "0"),
          monto_destino: parseFloat(c.monto_destino?.toString() || "0"),
          tasa_billetes: parseFloat(c.tasa_cambio_billetes?.toString() || "0"),
          tasa_monedas: parseFloat(c.tasa_cambio_monedas?.toString() || "0"),
          usd_entregado_efectivo: c.usd_entregado_efectivo ? parseFloat(c.usd_entregado_efectivo.toString()) : 0,
          usd_entregado_transfer: c.usd_entregado_transfer ? parseFloat(c.usd_entregado_transfer.toString()) : 0,
          usd_recibido_efectivo: c.usd_recibido_efectivo ? parseFloat(c.usd_recibido_efectivo.toString()) : 0,
          usd_recibido_transfer: c.usd_recibido_transfer ? parseFloat(c.usd_recibido_transfer.toString()) : 0,
          metodo_entrega: c.metodo_entrega || "N/A",
          estado: c.estado,
          cliente: c.cliente || "N/A",
          observacion: c.observacion || "",
        });
      });

      // ═══════════════════════════════════════════════════════════════════
      // Hoja 2: Asignaciones de Saldo
      // ═══════════════════════════════════════════════════════════════════
      const wsAsignaciones = workbook.addWorksheet("Asignaciones de Saldo");
      wsAsignaciones.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Punto de Atención", key: "punto", width: 28 },
        { header: "Moneda", key: "moneda", width: 12 },
        { header: "Tipo", key: "tipo", width: 12 },
        { header: "Saldo Anterior", key: "saldo_anterior", width: 16 },
        { header: "Cantidad Asignada", key: "cantidad_asignada", width: 18 },
        { header: "Saldo Nuevo", key: "saldo_nuevo", width: 16 },
        { header: "Saldo Inicial Acumulado", key: "saldo_inicial_acumulado", width: 22 },
        { header: "Billetes Asignados", key: "billetes_asignados", width: 18 },
        { header: "Monedas Asignadas", key: "monedas_asignadas", width: 18 },
        { header: "Bancos Asignados", key: "bancos_asignados", width: 18 },
        { header: "Asignado Por", key: "asignado_por", width: 22 },
        { header: "Observaciones", key: "observaciones", width: 35 },
      ];

      asignaciones.forEach((a) => {
        wsAsignaciones.addRow({
          fecha: format(new Date(a.fecha), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: a.puntoAtencion?.nombre || "N/A",
          moneda: a.moneda?.codigo || "N/A",
          tipo: a.tipo,
          saldo_anterior: parseFloat(a.saldo_anterior?.toString() || "0"),
          cantidad_asignada: parseFloat(a.cantidad_asignada?.toString() || "0"),
          saldo_nuevo: parseFloat(a.saldo_nuevo?.toString() || "0"),
          saldo_inicial_acumulado: parseFloat(a.saldo_inicial_acumulado?.toString() || "0"),
          billetes_asignados: parseFloat(a.billetes_asignados?.toString() || "0"),
          monedas_asignadas: parseFloat(a.monedas_asignadas?.toString() || "0"),
          bancos_asignados: parseFloat(a.bancos_asignados?.toString() || "0"),
          asignado_por: a.usuarioAsignador?.nombre || a.usuarioAsignador?.username || "N/A",
          observaciones: a.observaciones || "",
        });
      });

      // ─────────────────────────────────────────────────────────────────────
      // 4. Estilizar encabezados
      // ─────────────────────────────────────────────────────────────────────
      [wsCambios, wsAsignaciones].forEach((ws) => {
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
      const fileName = `reporte_cambios_divisa_historico_${fechaActual}.xlsx`;

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
      logger.info(`✅ Reporte de cambios de divisa generado en ${duration}ms`, {
        cambios: cambios.length,
        asignaciones: asignaciones.length,
        user_id: (req.user as any)?.id,
      });
    } catch (error) {
      logger.error("❌ Error generando reporte histórico de cambios de divisa", {
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
