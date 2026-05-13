import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { nowEcuador, gyeDayRangeUtcFromDate } from "../utils/timezone.js";

const router = express.Router();

router.get(
  "/dashboard-stats",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { gte: todayStart, lt: todayEnd } = gyeDayRangeUtcFromDate(nowEcuador());

      // 1. Conteos básicos
      const [
        totalUsuarios,
        totalPuntos,
        totalMonedas,
        operadoresActivos,
        transaccionesHoy,
        transferenciasHoy,
        serviciosHoy,
        cierresPendientes,
        aperturasPendientes,
      ] = await Promise.all([
        prisma.usuario.count(),
        prisma.puntoAtencion.count({ where: { activo: true } }),
        prisma.moneda.count({ where: { activo: true } }),
        prisma.usuario.count({ where: { rol: "OPERADOR", activo: true } }),
        prisma.cambioDivisa.count({
          where: { fecha: { gte: todayStart, lt: todayEnd } },
        }),
        prisma.transferencia.count({
          where: { fecha: { gte: todayStart, lt: todayEnd } },
        }),
        prisma.servicioExternoMovimiento.count({
          where: { fecha: { gte: todayStart, lt: todayEnd } },
        }),
        prisma.cierreDiario.count({ where: { estado: "ABIERTO" } }),
        prisma.aperturaCaja.count({ where: { estado: "PENDIENTE" } }),
      ]);

      // 2. Cierres recientes con diferencias (últimos 5)
      const cierresRecientesRaw = await prisma.cuadreCaja.findMany({
        where: { estado: "CERRADO" },
        orderBy: { fecha_cierre: "desc" },
        take: 5,
        include: {
          puntoAtencion: { select: { nombre: true } },
          usuarioCierreParcial: { select: { nombre: true } },
          usuario: { select: { nombre: true } },
          detalles: {
            include: {
              moneda: { select: { codigo: true } },
            },
          },
        },
      });

      const cierresRecientes = cierresRecientesRaw.map((c) => {
        const diferenciaTotal = c.detalles.reduce(
          (sum, d) => sum + Number(d.diferencia) + Number(d.diferencia_bancos),
          0
        );
        const estado =
          Math.abs(diferenciaTotal) < 0.01
            ? "perfecto"
            : diferenciaTotal > 0
            ? "sobrante"
            : "faltante";
        return {
          id: c.id,
          fecha: c.fecha_cierre?.toISOString() || c.fecha.toISOString(),
          punto: c.puntoAtencion?.nombre || "N/A",
          operador:
            c.usuarioCierreParcial?.nombre || c.usuario?.nombre || "Sistema",
          moneda: c.detalles[0]?.moneda?.codigo || "USD",
          diferencia: diferenciaTotal,
          estado,
        };
      });

      // 3. Actividad por hora (8am a 7pm)
      const actividadHoras: Array<{
        hora: string;
        cambios: number;
        transferencias: number;
        servicios: number;
      }> = [];

      for (let h = 8; h <= 19; h++) {
        const hourStart = new Date(todayStart);
        hourStart.setHours(h, 0, 0, 0);
        const hourEnd = new Date(todayStart);
        hourEnd.setHours(h + 1, 0, 0, 0);

        const [cambios, transferencias, servicios] = await Promise.all([
          prisma.cambioDivisa.count({
            where: { fecha: { gte: hourStart, lt: hourEnd } },
          }),
          prisma.transferencia.count({
            where: { fecha: { gte: hourStart, lt: hourEnd } },
          }),
          prisma.servicioExternoMovimiento.count({
            where: { fecha: { gte: hourStart, lt: hourEnd } },
          }),
        ]);

        actividadHoras.push({
          hora: `${h}:00`,
          cambios,
          transferencias,
          servicios,
        });
      }

      // 4. Estado de puntos
      const puntosResumen = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        select: {
          id: true,
          nombre: true,
          _count: {
            select: {
              cambios: { where: { fecha: { gte: todayStart, lt: todayEnd } } },
              transferenciasOrigen: {
                where: { fecha: { gte: todayStart, lt: todayEnd } },
              },
              jornadas: {
                where: { fecha_inicio: { gte: todayStart, lt: todayEnd } },
              },
            },
          },
        },
        orderBy: { nombre: "asc" },
      });

      const puntosEstado = puntosResumen.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        cambiosHoy: p._count.cambios,
        transferenciasHoy: p._count.transferenciasOrigen,
        jornadasHoy: p._count.jornadas,
        estado:
          p._count.jornadas > 0
            ? "operativo"
            : p._count.cambios > 0 || p._count.transferenciasOrigen > 0
            ? "en_cierre"
            : "cerrado",
      }));

      const operativos = puntosEstado.filter((p) => p.estado === "operativo").length;
      const enCierre = puntosEstado.filter((p) => p.estado === "en_cierre").length;
      const cerrados = puntosEstado.filter((p) => p.estado === "cerrado").length;

      res.json({
        success: true,
        stats: {
          totalUsuarios,
          totalPuntos,
          totalMonedas,
          operadoresActivos,
          transaccionesHoy,
          transferenciasHoy,
          serviciosHoy,
          cierresPendientes,
          aperturasPendientes,
          diferenciasHoy: cierresRecientes.filter((c) => c.estado !== "perfecto").length,
        },
        cierresRecientes,
        actividad: actividadHoras,
        puntosEstado: {
          operativos,
          enCierre,
          cerrados,
          detalle: puntosEstado,
        },
      });
    } catch (error) {
      console.error("Error en dashboard-stats:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

export default router;
