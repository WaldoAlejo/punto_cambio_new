import express from "express";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Fecha inválida");
const filters = z.object({ desde: dateOnly.optional(), hasta: dateOnly.optional(), punto_atencion_id: z.string().uuid().optional() })
  .refine(v => !v.desde || !v.hasta || v.desde <= v.hasta, "Desde no puede ser posterior a Hasta");
const MAX_ROWS = 50000;
const localTime = (date: Date | null) => date ? new Date(date.getTime() - 5 * 3600000).toISOString().slice(0, 19).replace("T", " ") : "";
const amount = (n: Prisma.Decimal | number) => Number(n);
const difference = (total: Prisma.Decimal, bills: Prisma.Decimal, coins: Prisma.Decimal) => total.minus(bills).minus(coins).toNumber();
function sheet(workbook: ExcelJS.Workbook, name: string, columns: Array<[string, string, number]>) {
  const ws = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map(([header, key, width]) => ({ header, key, width }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

router.get("/", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]), async (req, res) => {
  const parsed = filters.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ success: false, error: "Revisa el punto y las fechas del reporte (Desde debe ser anterior o igual a Hasta)." }); return; }
  const { desde, hasta, punto_atencion_id } = parsed.data;
  const point = punto_atencion_id ? { punto_atencion_id } : {};
  const fecha: Prisma.DateTimeFilter = {};
  if (desde) fecha.gte = new Date(`${desde}T05:00:00Z`);
  if (hasta) fecha.lt = new Date(new Date(`${hasta}T05:00:00Z`).getTime() + 86400000);
  try {
    const data = await prisma.$transaction(async tx => {
      if (punto_atencion_id && !await tx.puntoAtencion.findUnique({ where: { id: punto_atencion_id }, select: { id: true } })) return null;
      const current = await tx.saldo.findMany({
        where: point, take: MAX_ROWS + 1,
        include: { puntoAtencion: { select: { nombre: true, activo: true } }, moneda: { select: { codigo: true } } },
        orderBy: [{ puntoAtencion: { nombre: "asc" } }, { moneda: { codigo: "asc" } }, { id: "asc" }],
      });
      const history = await tx.detalleCuadreCaja.findMany({
        where: { cuadre: { ...point, fecha } }, take: MAX_ROWS + 1,
        select: { saldo_apertura: true, saldo_cierre: true, conteo_fisico: true, billetes: true, monedas_fisicas: true,
          diferencia: true, bancos_teorico: true, conteo_bancos: true, diferencia_bancos: true,
          moneda: { select: { codigo: true } }, cuadre: { select: {
          id: true, fecha: true, fecha_cierre: true, estado: true, puntoAtencion: { select: { nombre: true } },
        } } },
        orderBy: [{ cuadre: { fecha: "asc" } }, { cuadre: { puntoAtencion: { nombre: "asc" } } }, { moneda: { codigo: "asc" } }, { id: "asc" }],
      });
      return { current, history, generated: new Date() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
    if (!data) { res.status(404).json({ success: false, error: "Punto de atención no encontrado." }); return; }
    if (data.current.length > MAX_ROWS || data.history.length > MAX_ROWS) {
      res.status(422).json({ success: false, error: "El reporte supera 50.000 filas por hoja. Reduce el rango de fechas o selecciona un punto." }); return;
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Punto Cambio"; workbook.created = data.generated;
    const current = sheet(workbook, "Saldos actuales", [
      ["Punto de atención", "point", 30], ["Punto activo", "active", 15], ["Divisa", "currency", 12],
      ["Saldo registrado (efectivo)", "total", 26], ["Billetes", "bills", 18], ["Monedas físicas", "coins", 18],
      ["Suma billetes y monedas", "physical", 25], ["Diferencia de desglose", "gap", 24],
      ["Bancos (registro)", "bank", 20], ["Última actualización (Ecuador)", "updated", 30],
    ]);
    for (const s of data.current) current.addRow({ point: s.puntoAtencion.nombre, active: s.puntoAtencion.activo ? "Sí" : "No", currency: s.moneda.codigo,
      total: amount(s.cantidad), bills: amount(s.billetes), coins: amount(s.monedas_fisicas), physical: s.billetes.plus(s.monedas_fisicas).toNumber(),
      gap: difference(s.cantidad, s.billetes, s.monedas_fisicas), bank: amount(s.bancos), updated: localTime(s.updated_at) });
    const history = sheet(workbook, "Cuadres históricos", [
      ["Fecha y hora del cuadre (Ecuador)", "date", 33], ["Punto de atención", "point", 30], ["Divisa", "currency", 12],
      ["Estado del cuadre", "state", 20], ["Saldo de apertura registrado", "opening", 28], ["Saldo de cierre registrado", "closing", 28],
      ["Conteo físico registrado", "count", 26], ["Billetes del conteo", "bills", 22], ["Monedas del conteo", "coins", 22],
      ["Diferencia registrada", "difference", 23], ["Conteo menos desglose", "gap", 24],
      ["Bancos teórico", "bank", 20], ["Conteo bancos", "bankCount", 20], ["Diferencia bancos", "bankDifference", 20],
      ["Fecha de cierre (Ecuador)", "closed", 27], ["ID del cuadre", "id", 38],
    ]);
    for (const d of data.history) history.addRow({ date: localTime(d.cuadre.fecha), point: d.cuadre.puntoAtencion.nombre, currency: d.moneda.codigo,
      state: d.cuadre.estado, opening: amount(d.saldo_apertura), closing: amount(d.saldo_cierre), count: amount(d.conteo_fisico),
      bills: amount(d.billetes), coins: amount(d.monedas_fisicas), difference: amount(d.diferencia), gap: difference(d.conteo_fisico, d.billetes, d.monedas_fisicas),
      bank: amount(d.bancos_teorico), bankCount: amount(d.conteo_bancos), bankDifference: amount(d.diferencia_bancos), closed: localTime(d.cuadre.fecha_cierre), id: d.cuadre.id });
    for (const ws of [current, history]) ws.eachRow((row, i) => { if (i > 1) row.eachCell(cell => { if (typeof cell.value === "number") cell.numFmt = '#,##0.00;[Red]-#,##0.00'; }); });
    const info = sheet(workbook, "Información", [["Concepto", "key", 32], ["Detalle", "value", 110]]);
    info.addRows([
      { key: "Generado (Ecuador)", value: localTime(data.generated) },
      { key: "Punto", value: punto_atencion_id || "Todos los puntos con registros, incluidos inactivos" },
      { key: "Histórico desde / hasta", value: `${desde || "Inicio"} / ${hasta || "Sin límite"}` },
      { key: "Saldos actuales", value: "Saldo al generar el archivo; el filtro de fechas no limita esta hoja. No equivale a un conteo físico confirmado." },
      { key: "Histórico", value: "Cuadres registrados en el rango, incluidos abiertos. Si hay varios cuadres para un día, se conservan separados con su ID. No se inventan saldos en días sin registros." },
      { key: "Desglose histórico", value: "Un conteo sin desglose puede mostrar billetes y monedas en cero. La columna Conteo menos desglose permite identificarlo." },
      { key: "Bancos", value: "Registro informativo separado del efectivo; no representa una conciliación bancaria." },
      { key: "Divisas", value: "Los importes están en la divisa de cada fila. No se suman monedas distintas ni se convierte a USD." },
      { key: "Filas actuales / históricas", value: `${data.current.length} / ${data.history.length}` },
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="reporte_saldos_por_punto.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error("Error generando reporte de saldos por punto", { error: error instanceof Error ? error.message : "Error desconocido" });
    res.status(500).json({ success: false, error: "No se pudo generar el reporte de saldos." });
  }
});
export default router;
