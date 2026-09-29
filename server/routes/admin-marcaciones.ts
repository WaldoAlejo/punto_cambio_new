import express from 'express';
import prisma from '../lib/prisma.js';
import logger from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { marcacionesQuery, reportSql, buildMarcacionesReport, type MarcacionRow } from '../services/marcacionesReport.js';

const router = express.Router();
router.get('/', authenticateToken, requireRole(['ADMIN', 'SUPER_USUARIO']), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const parsed = marcacionesQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Revise los filtros: fechas válidas y período máximo de 93 días.', details: parsed.error.flatten() });
    return;
  }
  try {
    const [rows, users, points] = await prisma.$transaction([
      prisma.$queryRaw<MarcacionRow[]>(reportSql(parsed.data)),
      prisma.usuario.findMany({ select: { id: true, nombre: true, username: true, activo: true }, orderBy: [{ nombre: 'asc' }, { id: 'asc' }] }),
      prisma.puntoAtencion.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    ], { isolationLevel: 'RepeatableRead' });
    if (rows.length > 50000) {
      res.status(422).json({ success: false, error: 'La consulta supera 50.000 marcaciones. Reduzca las fechas o filtre por usuario o punto.' });
      return;
    }
    res.json({ success: true, data: { ...buildMarcacionesReport(rows, parsed.data), users, points } });
  } catch (error) {
    logger.error('Error consultando marcaciones administrativas', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
    res.status(500).json({ success: false, error: 'No se pudieron consultar las marcaciones.' });
  }
});
export default router;
