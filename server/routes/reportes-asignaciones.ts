import express, { Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import {
  ServicioExterno,
  TipoAsignacionServicio,
  TipoAsignacion,
} from "@prisma/client";

const router = express.Router();

/* ============================
 * Tipos
 * ============================ */
type CategoriaReporte = "GENERAL" | "SERVICIO_EXTERNO" | "SERVIENTREGA";

interface UnifiedAssignment {
  id: string;
  fecha: Date;
  categoria: CategoriaReporte;
  tipo: string;
  punto_atencion_id: string;
  punto_atencion_nombre: string;
  moneda_id: string;
  moneda_codigo: string;
  moneda_nombre: string;
  moneda_simbolo: string;
  servicio?: string | null;
  saldo_anterior: number;
  cantidad_asignada: number;
  saldo_nuevo: number;
  asignado_por_id: string;
  asignado_por_nombre: string;
  observaciones: string | null;
}

/* ============================
 * Helpers
 * ============================ */

function parseCategoria(v: unknown): CategoriaReporte | undefined {
  if (v === "GENERAL" || v === "SERVICIO_EXTERNO" || v === "SERVIENTREGA")
    return v;
  return undefined;
}

function parseTipoAsignacion(
  v: unknown
): TipoAsignacionServicio | TipoAsignacion | undefined {
  if (v === "INICIAL") return "INICIAL" as TipoAsignacionServicio;
  if (v === "RECARGA") return "RECARGA" as TipoAsignacionServicio;
  return undefined;
}

function isServicioExterno(v: unknown): v is ServicioExterno {
  return (
    typeof v === "string" && Object.values(ServicioExterno).includes(v as ServicioExterno)
  );
}

function buildDateFilter(
  from?: string,
  to?: string
): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) {
    filter.gte = new Date(`${from}T00:00:00.000-05:00`);
  }
  if (to) {
    filter.lte = new Date(`${to}T23:59:59.999-05:00`);
  }
  return filter;
}

/* ============================
 * GET /api/reportes/asignaciones
 * ============================ */
router.get(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: Request, res: Response) => {
    try {
      const {
        punto_atencion_id,
        from,
        to,
        tipo,
        categoria,
        servicio,
        moneda_id,
      } = req.query as Record<string, string | undefined>;

      const catFilter = parseCategoria(categoria);
      const tipoFilter = parseTipoAsignacion(tipo);
      const dateFilter = buildDateFilter(from, to);
      const servicioFilter = isServicioExterno(servicio) ? servicio : undefined;

      const results: UnifiedAssignment[] = [];

      /* ---------- 1. Asignaciones de Saldos Generales ---------- */
      const shouldQueryGeneral =
        !catFilter || catFilter === "GENERAL";

      if (shouldQueryGeneral) {
        const whereGeneral: any = {};
        if (punto_atencion_id) whereGeneral.punto_atencion_id = punto_atencion_id;
        if (tipoFilter) whereGeneral.tipo = tipoFilter;
        if (moneda_id) whereGeneral.moneda_id = moneda_id;
        if (dateFilter) whereGeneral.fecha = dateFilter;

        const generalRows = await prisma.asignacionSaldo.findMany({
          where: whereGeneral,
          orderBy: { fecha: "desc" },
          include: {
            puntoAtencion: { select: { id: true, nombre: true } },
            moneda: { select: { id: true, codigo: true, nombre: true, simbolo: true } },
            usuarioAsignador: { select: { id: true, nombre: true, username: true } },
          },
        });

        for (const row of generalRows) {
          results.push({
            id: row.id,
            fecha: row.fecha,
            categoria: "GENERAL",
            tipo: row.tipo,
            punto_atencion_id: row.punto_atencion_id,
            punto_atencion_nombre: row.puntoAtencion?.nombre || "N/A",
            moneda_id: row.moneda_id,
            moneda_codigo: row.moneda?.codigo || "",
            moneda_nombre: row.moneda?.nombre || "",
            moneda_simbolo: row.moneda?.simbolo || "",
            servicio: null,
            saldo_anterior: Number(row.saldo_anterior),
            cantidad_asignada: Number(row.cantidad_asignada),
            saldo_nuevo: Number(row.saldo_nuevo),
            asignado_por_id: row.asignado_por,
            asignado_por_nombre:
              row.usuarioAsignador?.nombre || row.usuarioAsignador?.username || "Sistema",
            observaciones: row.observaciones,
          });
        }
      }

      /* ---------- 2. Asignaciones de Servicios Externos ---------- */
      const shouldQueryServicios =
        !catFilter || catFilter === "SERVICIO_EXTERNO" || catFilter === "SERVIENTREGA";

      if (shouldQueryServicios) {
        const whereSEA: any = {};
        if (punto_atencion_id) whereSEA.punto_atencion_id = punto_atencion_id;
        if (tipoFilter) whereSEA.tipo = tipoFilter;
        if (moneda_id) whereSEA.moneda_id = moneda_id;
        if (dateFilter) whereSEA.fecha = dateFilter;

        if (catFilter === "SERVIENTREGA") {
          whereSEA.servicio = ServicioExterno.SERVIENTREGA;
        } else if (catFilter === "SERVICIO_EXTERNO" && servicioFilter) {
          whereSEA.servicio = servicioFilter;
        } else if (catFilter === "SERVICIO_EXTERNO") {
          // Excluir SERVIENTREGA cuando se pide solo SERVICIO_EXTERNO
          whereSEA.servicio = { not: ServicioExterno.SERVIENTREGA };
        } else if (!catFilter && servicioFilter) {
          whereSEA.servicio = servicioFilter;
        }

        const seaRows = await prisma.servicioExternoAsignacion.findMany({
          where: whereSEA,
          orderBy: { fecha: "desc" },
          include: {
            puntoAtencion: { select: { id: true, nombre: true } },
            moneda: { select: { id: true, codigo: true, nombre: true, simbolo: true } },
            usuarioAsignador: { select: { id: true, nombre: true, username: true } },
          },
        });

        // Identificar registros que necesitan recálculo retroactivo
        // (saldo_anterior=0 && saldo_nuevo=0 pero no son el primer registro del grupo)
        const needsRecalc = seaRows.filter(
          (r) => Number(r.saldo_anterior) === 0 && Number(r.saldo_nuevo) === 0
        );

        // Mapa de recálculo: clave = "punto:servicio:moneda", valor = mapa id->saldo_anterior
        const recalcMap = new Map<string, Map<string, number>>();

        if (needsRecalc.length > 0) {
          // Agrupar por combinación única
          const combos = new Map<string, { punto: string; servicio: ServicioExterno; moneda: string }>();
          for (const r of needsRecalc) {
            const key = `${r.punto_atencion_id}:${r.servicio}:${r.moneda_id}`;
            if (!combos.has(key)) {
              combos.set(key, {
                punto: r.punto_atencion_id,
                servicio: r.servicio,
                moneda: r.moneda_id,
              });
            }
          }

          // Para cada combo, cargar TODO el historial y calcular acumulado
          for (const [key, combo] of combos) {
            const historial = await prisma.servicioExternoAsignacion.findMany({
              where: {
                punto_atencion_id: combo.punto,
                servicio: combo.servicio,
                moneda_id: combo.moneda,
              },
              orderBy: [{ fecha: "asc" }, { id: "asc" }],
              select: { id: true, monto: true },
            });

            const idMap = new Map<string, number>();
            let acumulado = 0;
            for (const h of historial) {
              const monto = Number(h.monto);
              idMap.set(h.id, acumulado);
              acumulado += monto;
            }
            recalcMap.set(key, idMap);
          }
        }

        for (const row of seaRows) {
          const cat: CategoriaReporte =
            row.servicio === ServicioExterno.SERVIENTREGA
              ? "SERVIENTREGA"
              : "SERVICIO_EXTERNO";

          let saldoAnterior = Number(row.saldo_anterior);
          let saldoNuevo = Number(row.saldo_nuevo);
          const monto = Number(row.monto);

          // Si está en needsRecalc, usar el valor recalculado
          if (saldoAnterior === 0 && saldoNuevo === 0) {
            const key = `${row.punto_atencion_id}:${row.servicio}:${row.moneda_id}`;
            const idMap = recalcMap.get(key);
            if (idMap?.has(row.id)) {
              saldoAnterior = idMap.get(row.id)!;
              saldoNuevo = saldoAnterior + monto;
            }
          }

          results.push({
            id: row.id,
            fecha: row.fecha,
            categoria: cat,
            tipo: row.tipo,
            punto_atencion_id: row.punto_atencion_id,
            punto_atencion_nombre: row.puntoAtencion?.nombre || "N/A",
            moneda_id: row.moneda_id,
            moneda_codigo: row.moneda?.codigo || "",
            moneda_nombre: row.moneda?.nombre || "",
            moneda_simbolo: row.moneda?.simbolo || "",
            servicio: row.servicio,
            saldo_anterior: saldoAnterior,
            cantidad_asignada: monto,
            saldo_nuevo: saldoNuevo,
            asignado_por_id: row.asignado_por,
            asignado_por_nombre:
              row.usuarioAsignador?.nombre || row.usuarioAsignador?.username || "Sistema",
            observaciones: row.observaciones,
          });
        }
      }

      /* ---------- 3. Ordenar unificado ---------- */
      results.sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      /* ---------- 4. Resúmenes ---------- */
      const resumen = {
        total_general: 0,
        total_servicios_externos: 0,
        total_servientrega: 0,
        total_inicial: 0,
        total_recarga: 0,
        por_punto: new Map<
          string,
          { punto_nombre: string; total: number; cantidad: number }
        >(),
        por_moneda: new Map<
          string,
          { moneda_codigo: string; moneda_nombre: string; total: number; cantidad: number }
        >(),
      };

      for (const r of results) {
        if (r.categoria === "GENERAL") resumen.total_general += r.cantidad_asignada;
        if (r.categoria === "SERVICIO_EXTERNO")
          resumen.total_servicios_externos += r.cantidad_asignada;
        if (r.categoria === "SERVIENTREGA")
          resumen.total_servientrega += r.cantidad_asignada;
        if (r.tipo === "INICIAL") resumen.total_inicial += r.cantidad_asignada;
        if (r.tipo === "RECARGA") resumen.total_recarga += r.cantidad_asignada;

        const puntoKey = r.punto_atencion_id;
        const puntoEntry = resumen.por_punto.get(puntoKey);
        if (puntoEntry) {
          puntoEntry.total += r.cantidad_asignada;
          puntoEntry.cantidad += 1;
        } else {
          resumen.por_punto.set(puntoKey, {
            punto_nombre: r.punto_atencion_nombre,
            total: r.cantidad_asignada,
            cantidad: 1,
          });
        }

        const monedaKey = r.moneda_id;
        const monedaEntry = resumen.por_moneda.get(monedaKey);
        if (monedaEntry) {
          monedaEntry.total += r.cantidad_asignada;
          monedaEntry.cantidad += 1;
        } else {
          resumen.por_moneda.set(monedaKey, {
            moneda_codigo: r.moneda_codigo,
            moneda_nombre: r.moneda_nombre,
            total: r.cantidad_asignada,
            cantidad: 1,
          });
        }
      }

      res.json({
        success: true,
        asignaciones: results,
        resumen: {
          total_general: resumen.total_general,
          total_servicios_externos: resumen.total_servicios_externos,
          total_servientrega: resumen.total_servientrega,
          total_inicial: resumen.total_inicial,
          total_recarga: resumen.total_recarga,
          por_punto: Array.from(resumen.por_punto.entries()).map(
            ([punto_id, data]) => ({
              punto_id,
              ...data,
            })
          ),
          por_moneda: Array.from(resumen.por_moneda.entries()).map(
            ([moneda_id, data]) => ({
              moneda_id,
              ...data,
            })
          ),
        },
      });
    } catch (error) {
      console.error("Error en reporte de asignaciones:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

export default router;
