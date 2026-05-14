/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REPORTE HISTÓRICO: ASIGNACIONES DE SALDO Y TRANSFERENCIAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Endpoint: GET /api/reportes/asignaciones-transferencias-historico
 *
 * Genera un Excel con dos hojas:
 *   1. Asignaciones de Saldo — todo el historial de asignaciones iniciales
 *      y recargas en cada punto de atención.
 *   2. Transferencias — todo el historial de transferencias entre puntos,
 *      depósitos, retiros y su trazabilidad completa (solicitud, aprobación,
 *      envío, aceptación, rechazo).
 */

import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════════════
   Helpers — mapeo de enums a etiquetas legibles
   ═══════════════════════════════════════════════════════════════════════ */

const tipoAsignacionLabel: Record<string, string> = {
  INICIAL: "Inicial",
  RECARGA: "Recarga",
};

const tipoTransferenciaLabel: Record<string, string> = {
  ENTRE_PUNTOS: "Entre Puntos",
  DEPOSITO_MATRIZ: "Depósito Matriz",
  RETIRO_GERENCIA: "Retiro Gerencia",
  DEPOSITO_GERENCIA: "Depósito Gerencia",
};

const estadoTransferenciaLabel: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  EN_TRANSITO: "En Tránsito",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
};

const viaTransferenciaLabel: Record<string, string> = {
  EFECTIVO: "Efectivo",
  BANCO: "Banco",
  MIXTO: "Mixto",
};

/* ═══════════════════════════════════════════════════════════════════════
   GET /
   ═══════════════════════════════════════════════════════════════════════ */

router.get(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    try {
      logger.info("📊 Iniciando generación de reporte histórico de asignaciones y transferencias", {
        user_id: (req.user as any)?.id,
      });

      /* ─────────────────────────────────────────────────────────────────
         1. Cargar Asignaciones de Saldo
         ───────────────────────────────────────────────────────────────── */
      const asignaciones = await prisma.asignacionSaldo.findMany({
        orderBy: { fecha: "asc" },
      });

      const asigPuntoIds = [...new Set(asignaciones.map((a) => a.punto_atencion_id))];
      const asigMonedaIds = [...new Set(asignaciones.map((a) => a.moneda_id))];
      const asigUsuarioIds = [...new Set(asignaciones.map((a) => a.asignado_por))];

      const [asigPuntos, asigMonedas, asigUsuarios] = await Promise.all([
        prisma.puntoAtencion.findMany({
          where: { id: { in: asigPuntoIds } },
          select: { id: true, nombre: true, ciudad: true },
        }),
        prisma.moneda.findMany({
          where: { id: { in: asigMonedaIds } },
          select: { id: true, codigo: true, nombre: true },
        }),
        prisma.usuario.findMany({
          where: { id: { in: asigUsuarioIds } },
          select: { id: true, nombre: true, username: true },
        }),
      ]);

      const asigPuntoMap = new Map(asigPuntos.map((p) => [p.id, p]));
      const asigMonedaMap = new Map(asigMonedas.map((m) => [m.id, m]));
      const asigUsuarioMap = new Map(asigUsuarios.map((u) => [u.id, u]));

      /* ─────────────────────────────────────────────────────────────────
         2. Cargar Transferencias
         ───────────────────────────────────────────────────────────────── */
      const transferencias = await prisma.transferencia.findMany({
        orderBy: { fecha: "asc" },
      });

      const transOrigenIds = [...new Set(transferencias.map((t) => t.origen_id).filter(Boolean))];
      const transDestinoIds = [...new Set(transferencias.map((t) => t.destino_id))];
      const transMonedaIds = [...new Set(transferencias.map((t) => t.moneda_id))];
      const transSolicitanteIds = [...new Set(transferencias.map((t) => t.solicitado_por))];
      const transAprobadorIds = [...new Set(transferencias.map((t) => t.aprobado_por).filter(Boolean))];
      const transRechazadorIds = [...new Set(transferencias.map((t) => t.rechazado_por).filter(Boolean))];
      const transAceptadorIds = [...new Set(transferencias.map((t) => t.aceptado_por).filter(Boolean))];

      const [transPuntos, transMonedas, transUsuarios] = await Promise.all([
        prisma.puntoAtencion.findMany({
          where: { id: { in: [...transOrigenIds, ...transDestinoIds] as string[] } },
          select: { id: true, nombre: true, ciudad: true },
        }),
        prisma.moneda.findMany({
          where: { id: { in: transMonedaIds } },
          select: { id: true, codigo: true, nombre: true },
        }),
        prisma.usuario.findMany({
          where: { id: { in: [...transSolicitanteIds, ...transAprobadorIds, ...transRechazadorIds, ...transAceptadorIds] as string[] } },
          select: { id: true, nombre: true, username: true },
        }),
      ]);

      const transPuntoMap = new Map(transPuntos.map((p) => [p.id, p]));
      const transMonedaMap = new Map(transMonedas.map((m) => [m.id, m]));
      const transUsuarioMap = new Map(transUsuarios.map((u) => [u.id, u]));

      logger.info(
        `📥 Asignaciones: ${asignaciones.length} | Transferencias: ${transferencias.length}`
      );

      /* ─────────────────────────────────────────────────────────────────
         3. Construir Excel — 2 hojas
         ───────────────────────────────────────────────────────────────── */
      const workbook = new ExcelJS.Workbook();

      /* ── Hoja 1: Asignaciones de Saldo ── */
      const ws1 = workbook.addWorksheet("Asignaciones de Saldo");
      ws1.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Punto de Atención", key: "punto", width: 28 },
        { header: "Ciudad", key: "ciudad", width: 18 },
        { header: "Divisa", key: "divisa", width: 14 },
        { header: "Tipo", key: "tipo", width: 12 },
        { header: "Saldo Anterior", key: "saldo_anterior", width: 16 },
        { header: "Cantidad Asignada", key: "cantidad_asignada", width: 18 },
        { header: "Saldo Nuevo", key: "saldo_nuevo", width: 16 },
        { header: "Saldo Inicial Acumulado", key: "saldo_inicial_acumulado", width: 22 },
        { header: "Billetes Asignados", key: "billetes_asignados", width: 18 },
        { header: "Monedas Asignadas", key: "monedas_asignadas", width: 18 },
        { header: "Bancos Asignados", key: "bancos_asignados", width: 18 },
        { header: "Operador", key: "operador", width: 22 },
        { header: "Observaciones", key: "observaciones", width: 36 },
      ];

      asignaciones.forEach((a) => {
        const punto = asigPuntoMap.get(a.punto_atencion_id);
        const moneda = asigMonedaMap.get(a.moneda_id);
        const operador = asigUsuarioMap.get(a.asignado_por);

        ws1.addRow({
          fecha: format(new Date(a.fecha), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: punto?.nombre || "N/A",
          ciudad: punto?.ciudad || "N/A",
          divisa: moneda ? `${moneda.codigo} - ${moneda.nombre}` : "N/A",
          tipo: tipoAsignacionLabel[a.tipo] || a.tipo,
          saldo_anterior: parseFloat(a.saldo_anterior.toString()),
          cantidad_asignada: parseFloat(a.cantidad_asignada.toString()),
          saldo_nuevo: parseFloat(a.saldo_nuevo.toString()),
          saldo_inicial_acumulado: parseFloat(a.saldo_inicial_acumulado.toString()),
          billetes_asignados: parseFloat(a.billetes_asignados.toString()),
          monedas_asignadas: parseFloat(a.monedas_asignadas.toString()),
          bancos_asignados: parseFloat(a.bancos_asignados.toString()),
          operador: operador?.nombre || operador?.username || "N/A",
          observaciones: a.observaciones || "—",
        });
      });

      ws1.getRow(1).font = { bold: true };
      ws1.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6FA" },
      };

      /* ── Hoja 2: Transferencias ── */
      const ws2 = workbook.addWorksheet("Transferencias");
      ws2.columns = [
        { header: "Fecha Solicitud", key: "fecha", width: 20 },
        { header: "N° Recibo", key: "numero_recibo", width: 18 },
        { header: "Origen", key: "origen", width: 28 },
        { header: "Destino", key: "destino", width: 28 },
        { header: "Divisa", key: "divisa", width: 14 },
        { header: "Monto", key: "monto", width: 16 },
        { header: "Tipo", key: "tipo", width: 18 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Vía", key: "via", width: 12 },
        { header: "Solicitado por", key: "solicitado_por", width: 22 },
        { header: "Aprobado por", key: "aprobado_por", width: 22 },
        { header: "Fecha Aprobación", key: "fecha_aprobacion", width: 20 },
        { header: "Enviado / En Tránsito", key: "fecha_envio", width: 20 },
        { header: "Aceptado por", key: "aceptado_por", width: 22 },
        { header: "Fecha Aceptación", key: "fecha_aceptacion", width: 20 },
        { header: "Rechazado por", key: "rechazado_por", width: 22 },
        { header: "Fecha Rechazo", key: "fecha_rechazo", width: 20 },
        { header: "Descripción", key: "descripcion", width: 32 },
        { header: "Obs. Aprobación", key: "obs_aprobacion", width: 28 },
        { header: "Obs. Aceptación", key: "obs_aceptacion", width: 28 },
        { header: "Obs. Rechazo", key: "obs_rechazo", width: 28 },
      ];

      transferencias.forEach((t) => {
        const origen = t.origen_id ? transPuntoMap.get(t.origen_id) : null;
        const destino = transPuntoMap.get(t.destino_id);
        const moneda = transMonedaMap.get(t.moneda_id);
        const solicitante = transUsuarioMap.get(t.solicitado_por);
        const aprobador = t.aprobado_por ? transUsuarioMap.get(t.aprobado_por) : null;
        const rechazador = t.rechazado_por ? transUsuarioMap.get(t.rechazado_por) : null;
        const aceptador = t.aceptado_por ? transUsuarioMap.get(t.aceptado_por) : null;

        ws2.addRow({
          fecha: format(new Date(t.fecha), "dd/MM/yyyy HH:mm", { locale: es }),
          numero_recibo: t.numero_recibo || "N/A",
          origen: origen?.nombre || "N/A",
          destino: destino?.nombre || "N/A",
          divisa: moneda ? `${moneda.codigo} - ${moneda.nombre}` : "N/A",
          monto: parseFloat(t.monto.toString()),
          tipo: tipoTransferenciaLabel[t.tipo_transferencia] || t.tipo_transferencia,
          estado: estadoTransferenciaLabel[t.estado] || t.estado,
          via: t.via ? viaTransferenciaLabel[t.via] || t.via : "N/A",
          solicitado_por: solicitante?.nombre || solicitante?.username || "N/A",
          aprobado_por: aprobador?.nombre || aprobador?.username || "—",
          fecha_aprobacion: t.fecha_aprobacion
            ? format(new Date(t.fecha_aprobacion), "dd/MM/yyyy HH:mm", { locale: es })
            : "—",
          fecha_envio: t.fecha_envio
            ? format(new Date(t.fecha_envio), "dd/MM/yyyy HH:mm", { locale: es })
            : "—",
          aceptado_por: aceptador?.nombre || aceptador?.username || "—",
          fecha_aceptacion: t.fecha_aceptacion
            ? format(new Date(t.fecha_aceptacion), "dd/MM/yyyy HH:mm", { locale: es })
            : "—",
          rechazado_por: rechazador?.nombre || rechazador?.username || "—",
          fecha_rechazo: t.fecha_rechazo
            ? format(new Date(t.fecha_rechazo), "dd/MM/yyyy HH:mm", { locale: es })
            : "—",
          descripcion: t.descripcion || "—",
          obs_aprobacion: t.observaciones_aprobacion || "—",
          obs_aceptacion: t.observaciones_aceptacion || "—",
          obs_rechazo: t.observaciones_rechazo || "—",
        });
      });

      ws2.getRow(1).font = { bold: true };
      ws2.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6FA" },
      };

      /* ─────────────────────────────────────────────────────────────────
         4. Enviar respuesta
         ───────────────────────────────────────────────────────────────── */
      const fechaActual = format(new Date(), "yyyy-MM-dd");
      const fileName = `reporte_asignaciones_transferencias_historico_${fechaActual}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

      await workbook.xlsx.write(res);
      res.end();

      const duration = Date.now() - startTime;
      logger.info(
        `✅ Reporte de asignaciones y transferencias generado en ${duration}ms`,
        { asignaciones: asignaciones.length, transferencias: transferencias.length, user_id: (req.user as any)?.id }
      );
    } catch (error) {
      logger.error("❌ Error generando reporte histórico de asignaciones y transferencias", {
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
