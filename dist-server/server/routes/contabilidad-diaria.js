// server/routes/contabilidad-diaria.ts
import express from "express";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { gyeDayRangeUtcFromDateOnly, gyeParseDateOnly, } from "../utils/timezone.js";
const router = express.Router();
/**
 * GET /api/contabilidad-diaria/:pointId/:fecha
 * Resumen de movimientos por moneda para el día (zona GYE).
 * Clasificación:
 *  - Ingresos: VENTA, TRANSFERENCIA_ENTRADA/ENTRANTE, SALDO/SALDO_INICIAL/"SALDO EN CAJA", INGRESO/INGRESOS,
 *              AJUSTE (monto > 0), CAMBIO_DIVISA (descripcion inicia con "Ingreso por cambio")
 *  - Egresos:  COMPRA, TRANSFERENCIA_SALIDA/SALIENTE, EGRESO/EGRESOS,
 *              AJUSTE (monto < 0), CAMBIO_DIVISA (descripcion inicia con "Egreso por cambio")
 */
router.get("/:pointId/:fecha", authenticateToken, async (req, res) => {
    try {
        const { pointId, fecha } = req.params;
        const usuario = req.user;
        if (!pointId) {
            return res.status(400).json({ success: false, error: "Falta pointId" });
        }
        // Seguridad: operadores solo pueden consultar su propio punto
        const esAdmin = (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
        if (!esAdmin &&
            usuario?.punto_atencion_id &&
            usuario.punto_atencion_id !== pointId) {
            return res.status(403).json({
                success: false,
                error: "No autorizado para consultar otro punto de atención",
            });
        }
        // Valida YYYY-MM-DD (lanza si no cumple)
        gyeParseDateOnly(fecha);
        // Rango UTC que cubre el día en GYE
        const { gte, lt } = gyeDayRangeUtcFromDateOnly(fecha);
        // === Agregaciones ===
        const ingresosEtiquetas = [
            "VENTA",
            "TRANSFERENCIA_ENTRADA",
            "TRANSFERENCIA_ENTRANTE",
            "SALDO_INICIAL",
            "SALDO",
            "SALDO EN CAJA",
            "INGRESO",
            "INGRESOS",
        ];
        const egresosEtiquetas = [
            "COMPRA",
            "TRANSFERENCIA_SALIDA",
            "TRANSFERENCIA_SALIENTE",
            "EGRESO",
            "EGRESOS",
        ];
        // Ingresos base (etiquetas ampliadas)
        const ingresosBase = await prisma.movimientoSaldo.groupBy({
            by: ["moneda_id"],
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
                tipo_movimiento: { in: ingresosEtiquetas },
            },
            _sum: { monto: true },
        });
        // Ingresos por AJUSTE (monto > 0)
        const ingresosAjustePos = await prisma.movimientoSaldo.groupBy({
            by: ["moneda_id"],
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
                tipo_movimiento: "AJUSTE",
                monto: { gt: 0 },
            },
            _sum: { monto: true },
        });
        // Ingresos por CAMBIO_DIVISA (descripcion inicia con “Ingreso por cambio”)
        const ingresosCambio = await prisma.movimientoSaldo.groupBy({
            by: ["moneda_id"],
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
                tipo_movimiento: "CAMBIO_DIVISA",
                descripcion: {
                    startsWith: "Ingreso por cambio",
                    mode: "insensitive",
                },
            },
            _sum: { monto: true },
        });
        // Egresos base (etiquetas ampliadas)
        const egresosBase = await prisma.movimientoSaldo.groupBy({
            by: ["moneda_id"],
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
                tipo_movimiento: { in: egresosEtiquetas },
            },
            _sum: { monto: true },
        });
        // Egresos por AJUSTE (monto < 0) — luego tomamos ABS
        const egresosAjusteNeg = await prisma.movimientoSaldo.groupBy({
            by: ["moneda_id"],
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
                tipo_movimiento: "AJUSTE",
                monto: { lt: 0 },
            },
            _sum: { monto: true },
        });
        // Egresos por CAMBIO_DIVISA (descripcion inicia con “Egreso por cambio”)
        const egresosCambio = await prisma.movimientoSaldo.groupBy({
            by: ["moneda_id"],
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
                tipo_movimiento: "CAMBIO_DIVISA",
                descripcion: {
                    startsWith: "Egreso por cambio",
                    mode: "insensitive",
                },
            },
            _sum: { monto: true },
        });
        // Conteo de movimientos por moneda
        const counts = await prisma.movimientoSaldo.groupBy({
            by: ["moneda_id"],
            where: { punto_atencion_id: pointId, fecha: { gte, lt } },
            _count: { _all: true },
        });
        const toNum = (v) => (v ? Number(v) : 0);
        const mapIngresos = {};
        for (const r of ingresosBase) {
            mapIngresos[r.moneda_id] =
                (mapIngresos[r.moneda_id] || 0) + toNum(r._sum.monto);
        }
        for (const r of ingresosAjustePos) {
            mapIngresos[r.moneda_id] =
                (mapIngresos[r.moneda_id] || 0) + toNum(r._sum.monto);
        }
        for (const r of ingresosCambio) {
            mapIngresos[r.moneda_id] =
                (mapIngresos[r.moneda_id] || 0) + toNum(r._sum.monto);
        }
        const mapEgresos = {};
        for (const r of egresosBase) {
            mapEgresos[r.moneda_id] =
                (mapEgresos[r.moneda_id] || 0) + toNum(r._sum.monto);
        }
        for (const r of egresosAjusteNeg) {
            mapEgresos[r.moneda_id] =
                (mapEgresos[r.moneda_id] || 0) + Math.abs(toNum(r._sum.monto));
        }
        for (const r of egresosCambio) {
            mapEgresos[r.moneda_id] =
                (mapEgresos[r.moneda_id] || 0) + toNum(r._sum.monto);
        }
        const mapCounts = {};
        for (const r of counts)
            mapCounts[r.moneda_id] = r._count._all;
        // Unificar moneda_ids
        const monedaIds = Array.from(new Set([
            ...Object.keys(mapIngresos),
            ...Object.keys(mapEgresos),
            ...Object.keys(mapCounts),
        ])).sort();
        // Info de moneda (enriquecer respuesta)
        const monedas = monedaIds.length
            ? await prisma.moneda.findMany({
                where: { id: { in: monedaIds } },
                select: { id: true, codigo: true, nombre: true, simbolo: true },
            })
            : [];
        const monedaInfo = new Map(monedas.map((m) => [m.id, m]));
        const resumen = monedaIds.map((mid) => ({
            moneda_id: mid,
            ingresos: mapIngresos[mid] || 0,
            egresos: mapEgresos[mid] || 0,
            movimientos: mapCounts[mid] || 0,
            moneda: monedaInfo.get(mid) || null,
        }));
        return res.json({
            success: true,
            fecha,
            rango_utc: { gte, lt },
            pointId,
            resumen,
        });
    }
    catch (error) {
        logger.error("Error en GET /contabilidad-diaria/:pointId/:fecha", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return res.status(500).json({
            success: false,
            error: "Error interno del servidor",
        });
    }
});
/**
 * GET /api/contabilidad-diaria/cierre/:pointId/:fecha
 * Verifica si existe un cierre para el día especificado
 */
router.get("/cierre/:pointId/:fecha", authenticateToken, async (req, res) => {
    try {
        const { pointId, fecha } = req.params;
        const usuario = req.user;
        if (!pointId) {
            return res.status(400).json({ success: false, error: "Falta pointId" });
        }
        // Seguridad: operadores solo pueden consultar su propio punto
        const esAdmin = (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
        if (!esAdmin &&
            usuario?.punto_atencion_id &&
            usuario.punto_atencion_id !== pointId) {
            return res.status(403).json({
                success: false,
                error: "No autorizado para consultar otro punto de atención",
            });
        }
        // Valida YYYY-MM-DD (lanza si no cumple)
        gyeParseDateOnly(fecha);
        // Prisma usa Date para @db.Date (sin hora).
        // Usamos medianoche UTC de esa fecha
        const fechaDate = new Date(`${fecha}T00:00:00.000Z`);
        // Buscar cierre por clave compuesta
        const cierre = await prisma.cierreDiario.findUnique({
            where: {
                fecha_punto_atencion_id: {
                    fecha: fechaDate,
                    punto_atencion_id: pointId,
                },
            },
            include: {
                usuario: {
                    select: { nombre: true, username: true },
                },
            },
        });
        return res.json({
            success: true,
            cierre: cierre || null,
        });
    }
    catch (error) {
        logger.error("Error en GET /contabilidad-diaria/cierre/:pointId/:fecha", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return res.status(500).json({
            success: false,
            error: "Error interno del servidor",
        });
    }
});
/**
 * GET /api/contabilidad-diaria/validar-cierres/:pointId/:fecha
 * Valida qué cierres son necesarios antes de permitir el cierre diario
 */
router.get("/validar-cierres/:pointId/:fecha", authenticateToken, async (req, res) => {
    try {
        const { pointId, fecha } = req.params;
        const usuario = req.user;
        if (!pointId) {
            return res.status(400).json({ success: false, error: "Falta pointId" });
        }
        // Seguridad: operadores solo pueden consultar su propio punto
        const esAdmin = (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
        if (!esAdmin &&
            usuario?.punto_atencion_id &&
            usuario.punto_atencion_id !== pointId) {
            return res.status(403).json({
                success: false,
                error: "No autorizado para consultar otro punto de atención",
            });
        }
        // Valida YYYY-MM-DD (lanza si no cumple)
        gyeParseDateOnly(fecha);
        // Rango UTC que cubre el día en GYE
        const { gte, lt } = gyeDayRangeUtcFromDateOnly(fecha);
        const fechaDate = new Date(`${fecha}T00:00:00.000Z`);
        // 1. Verificar si hay cambios de divisas del día
        const cambiosDivisas = await prisma.cambioDivisa.count({
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
            },
        });
        // 2. Verificar si hay movimientos de servicios externos del día
        const serviciosExternos = await prisma.servicioExternoMovimiento.count({
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
            },
        });
        // 3. Verificar estado de cierres existentes
        const cierreDiario = await prisma.cierreDiario.findUnique({
            where: {
                fecha_punto_atencion_id: {
                    fecha: fechaDate,
                    punto_atencion_id: pointId,
                },
            },
        });
        const cierreServiciosExternos = await prisma.servicioExternoCierreDiario.findUnique({
            where: {
                fecha_punto_atencion_id: {
                    fecha: fechaDate,
                    punto_atencion_id: pointId,
                },
            },
        });
        // Determinar qué cierres son requeridos
        const cierresRequeridos = {
            servicios_externos: serviciosExternos > 0,
            cambios_divisas: cambiosDivisas > 0,
            cierre_diario: true, // Siempre requerido
        };
        // Estado actual de los cierres
        const estadoCierres = {
            servicios_externos: cierreServiciosExternos?.estado === "CERRADO",
            cambios_divisas: true, // Los cambios de divisas no tienen cierre separado, se incluyen en el cierre diario
            cierre_diario: cierreDiario?.estado === "CERRADO",
        };
        // Verificar si todos los cierres requeridos están completos
        const cierresCompletos = (!cierresRequeridos.servicios_externos ||
            estadoCierres.servicios_externos) &&
            (!cierresRequeridos.cambios_divisas || estadoCierres.cambios_divisas) &&
            estadoCierres.cierre_diario;
        return res.json({
            success: true,
            cierres_requeridos: cierresRequeridos,
            estado_cierres: estadoCierres,
            cierres_completos: cierresCompletos,
            conteos: {
                cambios_divisas: cambiosDivisas,
                servicios_externos: serviciosExternos,
            },
        });
    }
    catch (error) {
        logger.error("Error en GET /contabilidad-diaria/validar-cierres/:pointId/:fecha", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return res.status(500).json({
            success: false,
            error: "Error interno del servidor",
        });
    }
});
/**
 * POST /api/contabilidad-diaria/:pointId/:fecha/cerrar
 * Marca el cierre del día como CERRADO de forma idempotente usando la clave compuesta
 * @@unique([fecha, punto_atencion_id]) en CierreDiario.
 */
router.post("/:pointId/:fecha/cerrar", authenticateToken, async (req, res) => {
    try {
        const { pointId, fecha } = req.params;
        const { observaciones, diferencias_reportadas } = req.body || {};
        const usuario = req.user;
        if (!usuario?.id) {
            return res
                .status(401)
                .json({ success: false, error: "No autenticado" });
        }
        if (!pointId) {
            return res.status(400).json({ success: false, error: "Falta pointId" });
        }
        // Seguridad: operadores solo pueden cerrar su propio punto
        const esAdmin = (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
        if (!esAdmin &&
            usuario?.punto_atencion_id &&
            usuario.punto_atencion_id !== pointId) {
            return res.status(403).json({
                success: false,
                error: "No autorizado para cerrar otro punto de atención",
            });
        }
        // Valida YYYY-MM-DD (lanza si es inválida)
        gyeParseDateOnly(fecha);
        // Prisma usa Date para @db.Date (sin hora).
        // Usamos medianoche UTC de esa fecha; la lógica de negocio se
        // apoya en el rango GYE previamente al calcular montos.
        const fechaDate = new Date(`${fecha}T00:00:00.000Z`);
        // Buscar por clave compuesta
        const existing = await prisma.cierreDiario.findUnique({
            where: {
                fecha_punto_atencion_id: {
                    fecha: fechaDate,
                    punto_atencion_id: pointId,
                },
            },
        });
        // Si ya está CERRADO, devolver idempotente
        if (existing && existing.estado === "CERRADO") {
            return res.status(200).json({
                success: true,
                info: "ya_cerrado",
                cierre: existing,
            });
        }
        // Antes de cerrar, validar que todos los cierres requeridos estén completos
        const { gte, lt } = gyeDayRangeUtcFromDateOnly(fecha);
        // Verificar si hay servicios externos que requieren cierre
        const serviciosExternos = await prisma.servicioExternoMovimiento.count({
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
            },
        });
        if (serviciosExternos > 0) {
            // Verificar si el cierre de servicios externos está completo
            const cierreServiciosExternos = await prisma.servicioExternoCierreDiario.findUnique({
                where: {
                    fecha_punto_atencion_id: {
                        fecha: fechaDate,
                        punto_atencion_id: pointId,
                    },
                },
            });
            if (!cierreServiciosExternos ||
                cierreServiciosExternos.estado !== "CERRADO") {
                return res.status(400).json({
                    success: false,
                    error: "Debe completar el cierre de servicios externos antes del cierre diario",
                    codigo: "SERVICIOS_EXTERNOS_PENDIENTE",
                    detalles: {
                        servicios_externos_movimientos: serviciosExternos,
                        cierre_servicios_externos_estado: cierreServiciosExternos?.estado || "NO_EXISTE",
                    },
                });
            }
        }
        // Crear o actualizar a CERRADO y verificar si se puede finalizar jornada
        const result = await prisma.$transaction(async (tx) => {
            let cierre;
            if (!existing) {
                cierre = await tx.cierreDiario.create({
                    data: {
                        punto_atencion_id: pointId,
                        fecha: fechaDate,
                        usuario_id: usuario.id,
                        observaciones: observaciones ?? null,
                        estado: "CERRADO",
                        fecha_cierre: new Date(),
                        cerrado_por: usuario.id,
                        diferencias_reportadas: diferencias_reportadas ?? null,
                    },
                });
            }
            else {
                // existe pero no está cerrado -> actualizar
                cierre = await tx.cierreDiario.update({
                    where: {
                        fecha_punto_atencion_id: {
                            fecha: fechaDate,
                            punto_atencion_id: pointId,
                        },
                    },
                    data: {
                        estado: "CERRADO",
                        fecha_cierre: new Date(),
                        cerrado_por: usuario.id,
                        observaciones: observaciones ?? existing.observaciones,
                        diferencias_reportadas: diferencias_reportadas ?? existing.diferencias_reportadas,
                        updated_at: new Date(),
                    },
                });
            }
            // Verificar si hay jornada activa para finalizar automáticamente
            const jornadaActiva = await tx.jornada.findFirst({
                where: {
                    usuario_id: usuario.id,
                    punto_atencion_id: pointId,
                    fecha_salida: null, // Jornada activa
                },
                orderBy: { fecha_inicio: "desc" },
            });
            let jornadaFinalizada = null;
            if (jornadaActiva) {
                // Finalizar la jornada automáticamente
                jornadaFinalizada = await tx.jornada.update({
                    where: { id: jornadaActiva.id },
                    data: {
                        fecha_salida: new Date(),
                        observaciones: "Jornada finalizada automáticamente tras completar cierre diario",
                    },
                });
                logger.info("🎯 JORNADA_FINALIZADA_AUTOMATICAMENTE", {
                    usuario: usuario.id,
                    punto: pointId,
                    jornada_id: jornadaActiva.id,
                    cierre_id: cierre.id,
                });
            }
            return { cierre, jornadaFinalizada };
        });
        return res.status(existing ? 200 : 201).json({
            success: true,
            cierre: result.cierre,
            jornada_finalizada: !!result.jornadaFinalizada,
            mensaje: result.jornadaFinalizada
                ? "Cierre diario completado y jornada finalizada automáticamente"
                : "Cierre diario completado",
        });
    }
    catch (error) {
        logger.error("Error en POST /contabilidad-diaria/:pointId/:fecha/cerrar", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return res.status(500).json({
            success: false,
            error: "Error interno del servidor",
        });
    }
});
export default router;
