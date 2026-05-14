/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REPORTE HISTÓRICO COMPLETO: GUÍAS SERVIENTREGA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Endpoint: GET /api/reportes/servientrega-guias-historico
 *
 * Genera un Excel con todo el historial de guías Servientrega generadas
 * en todos los puntos de atención desde el inicio de la aplicación.
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
 * GET /api/reportes/servientrega-guias-historico
 * ============================ */
router.get(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    try {
      logger.info("📊 Iniciando generación de reporte histórico de guías Servientrega", {
        user_id: (req.user as any)?.id,
      });

      // ─────────────────────────────────────────────────────────────────────
      // 1. Obtener Guías Servientrega (histórico completo)
      // ─────────────────────────────────────────────────────────────────────
      const guias = await prisma.servientregaGuia.findMany({
        orderBy: { created_at: "asc" },
        include: {
          puntoAtencion: { select: { id: true, nombre: true, ciudad: true } },
          usuario: { select: { id: true, nombre: true, username: true } },
          remitente: { select: { id: true, nombre: true, cedula: true, direccion: true, telefono: true } },
          destinatario: { select: { id: true, nombre: true, cedula: true, direccion: true, ciudad: true, provincia: true, pais: true, telefono: true } },
        } as any,
      });

      logger.info(`📥 Guías Servientrega cargadas: ${guias.length}`);

      // ─────────────────────────────────────────────────────────────────────
      // 2. Construir Excel
      // ─────────────────────────────────────────────────────────────────────
      const workbook = new ExcelJS.Workbook();

      const ws = workbook.addWorksheet("Guías Servientrega");
      ws.columns = [
        { header: "Fecha Creación", key: "fecha", width: 20 },
        { header: "Punto de Atención", key: "punto", width: 28 },
        { header: "Ciudad Punto", key: "ciudad_punto", width: 18 },
        { header: "Número de Guía", key: "numero_guia", width: 18 },
        { header: "Proceso", key: "proceso", width: 14 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Valor Declarado", key: "valor_declarado", width: 16 },
        { header: "Costo Envío", key: "costo_envio", width: 14 },
        { header: "Agencia", key: "agencia", width: 22 },
        { header: "Operador", key: "operador", width: 22 },
        { header: "Remitente", key: "remitente", width: 24 },
        { header: "Cédula Remitente", key: "cedula_remitente", width: 18 },
        { header: "Dirección Remitente", key: "dir_remitente", width: 30 },
        { header: "Teléfono Remitente", key: "tel_remitente", width: 18 },
        { header: "Destinatario", key: "destinatario", width: 24 },
        { header: "Cédula Destinatario", key: "cedula_destinatario", width: 20 },
        { header: "Dirección Destinatario", key: "dir_destinatario", width: 30 },
        { header: "Ciudad Destinatario", key: "ciudad_destinatario", width: 20 },
        { header: "Provincia Destinatario", key: "provincia_destinatario", width: 20 },
        { header: "País Destinatario", key: "pais_destinatario", width: 18 },
        { header: "Teléfono Destinatario", key: "tel_destinatario", width: 20 },
        { header: "Saldo Descontado", key: "saldo_descontado", width: 16 },
      ];

      guias.forEach((g: any) => {
        ws.addRow({
          fecha: format(new Date(g.created_at), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: g.puntoAtencion?.nombre || "N/A",
          ciudad_punto: g.puntoAtencion?.ciudad || "N/A",
          numero_guia: g.numero_guia,
          proceso: g.proceso,
          estado: g.estado,
          valor_declarado: parseFloat(g.valor_declarado?.toString() || "0"),
          costo_envio: parseFloat(g.costo_envio?.toString() || "0"),
          agencia: g.agencia_nombre || g.agencia_codigo || "N/A",
          operador: g.usuario?.nombre || g.usuario?.username || "N/A",
          remitente: g.remitente?.nombre || "N/A",
          cedula_remitente: g.remitente?.cedula || "N/A",
          dir_remitente: g.remitente?.direccion || "N/A",
          tel_remitente: g.remitente?.telefono || "N/A",
          destinatario: g.destinatario?.nombre || "N/A",
          cedula_destinatario: g.destinatario?.cedula || "N/A",
          dir_destinatario: g.destinatario?.direccion || "N/A",
          ciudad_destinatario: g.destinatario?.ciudad || "N/A",
          provincia_destinatario: g.destinatario?.provincia || "N/A",
          pais_destinatario: g.destinatario?.pais || "N/A",
          tel_destinatario: g.destinatario?.telefono || "N/A",
          saldo_descontado: g.saldo_descontado ? "SÍ" : "NO",
        });
      });

      // ─────────────────────────────────────────────────────────────────────
      // 3. Estilizar encabezados
      // ─────────────────────────────────────────────────────────────────────
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6FA" },
      };

      // ─────────────────────────────────────────────────────────────────────
      // 4. Enviar respuesta
      // ─────────────────────────────────────────────────────────────────────
      const fechaActual = format(new Date(), "yyyy-MM-dd");
      const fileName = `reporte_servientrega_guias_historico_${fechaActual}.xlsx`;

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
      logger.info(`✅ Reporte de guías Servientrega generado en ${duration}ms`, {
        guias: guias.length,
        user_id: (req.user as any)?.id,
      });
    } catch (error) {
      logger.error("❌ Error generando reporte histórico de guías Servientrega", {
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
