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
      });

      // ─────────────────────────────────────────────────────────────────────
      // 2. Cargar datos relacionales por IDs (evita problemas con include)
      // ─────────────────────────────────────────────────────────────────────
      const puntoIds = [...new Set(guias.map((g) => g.punto_atencion_id).filter(Boolean))];
      const usuarioIds = [...new Set(guias.map((g) => g.usuario_id).filter(Boolean))];
      const remitenteIds = [...new Set(guias.map((g) => g.remitente_id).filter(Boolean))];
      const destinatarioIds = [...new Set(guias.map((g) => g.destinatario_id).filter(Boolean))];

      const [puntos, usuarios, remitentes, destinatarios] = await Promise.all([
        prisma.puntoAtencion.findMany({
          where: { id: { in: puntoIds as string[] } },
          select: { id: true, nombre: true, ciudad: true },
        }),
        prisma.usuario.findMany({
          where: { id: { in: usuarioIds as string[] } },
          select: { id: true, nombre: true, username: true },
        }),
        prisma.servientregaRemitente.findMany({
          where: { id: { in: remitenteIds as string[] } },
          select: { id: true, nombre: true, cedula: true, direccion: true, telefono: true },
        }),
        prisma.servientregaDestinatario.findMany({
          where: { id: { in: destinatarioIds as string[] } },
          select: { id: true, nombre: true, cedula: true, direccion: true, ciudad: true, provincia: true, pais: true, telefono: true },
        }),
      ]);

      const puntoMap = new Map(puntos.map((p) => [p.id, p]));
      const usuarioMap = new Map(usuarios.map((u) => [u.id, u]));
      const remitenteMap = new Map(remitentes.map((r) => [r.id, r]));
      const destinatarioMap = new Map(destinatarios.map((d) => [d.id, d]));

      logger.info(`📥 Guías Servientrega cargadas: ${guias.length}`);

      // ─────────────────────────────────────────────────────────────────────
      // 3. Construir Excel
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

      guias.forEach((g) => {
        const punto = g.punto_atencion_id ? puntoMap.get(g.punto_atencion_id) : null;
        const usuario = g.usuario_id ? usuarioMap.get(g.usuario_id) : null;
        const remitente = g.remitente_id ? remitenteMap.get(g.remitente_id) : null;
        const destinatario = g.destinatario_id ? destinatarioMap.get(g.destinatario_id) : null;

        ws.addRow({
          fecha: format(new Date(g.created_at), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: punto?.nombre || "N/A",
          ciudad_punto: punto?.ciudad || "N/A",
          numero_guia: g.numero_guia,
          proceso: g.proceso,
          estado: g.estado,
          valor_declarado: parseFloat(g.valor_declarado?.toString() || "0"),
          costo_envio: parseFloat(g.costo_envio?.toString() || "0"),
          agencia: g.agencia_nombre || g.agencia_codigo || "N/A",
          operador: usuario?.nombre || usuario?.username || "N/A",
          remitente: remitente?.nombre || "N/A",
          cedula_remitente: remitente?.cedula || "N/A",
          dir_remitente: remitente?.direccion || "N/A",
          tel_remitente: remitente?.telefono || "N/A",
          destinatario: destinatario?.nombre || "N/A",
          cedula_destinatario: destinatario?.cedula || "N/A",
          dir_destinatario: destinatario?.direccion || "N/A",
          ciudad_destinatario: destinatario?.ciudad || "N/A",
          provincia_destinatario: destinatario?.provincia || "N/A",
          pais_destinatario: destinatario?.pais || "N/A",
          tel_destinatario: destinatario?.telefono || "N/A",
          saldo_descontado: g.saldo_descontado ? "SÍ" : "NO",
        });
      });

      // ─────────────────────────────────────────────────────────────────────
      // 4. Estilizar encabezados
      // ─────────────────────────────────────────────────────────────────────
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6FA" },
      };

      // ─────────────────────────────────────────────────────────────────────
      // 5. Enviar respuesta
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
