import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import saldoValidation from "../middleware/saldoValidation.js";
import prisma from "../lib/prisma.js";
import { registrarMovimientoSaldo, TipoMovimiento as TipoMov, TipoReferencia, } from "../services/movimientoSaldoService.js";
const router = express.Router();
/** Type guard: asegura que req.user existe y es OPERADOR */
function isOperador(req) {
    return !!req.user && req.user.rol === "OPERADOR";
}
/** Catálogos válidos (coinciden con Prisma enums) */
const SERVICIOS_VALIDOS = [
    "YAGANASTE",
    "BANCO_GUAYAQUIL",
    "WESTERN",
    "PRODUBANCO",
    "BANCO_PACIFICO",
    "INSUMOS_OFICINA",
    "INSUMOS_LIMPIEZA",
    "OTROS",
];
const TIPOS_VALIDOS = ["INGRESO", "EGRESO"];
/** Utils fecha GYE */
async function gyeTodayWindow() {
    const { gyeDayRangeUtcFromDate } = await import("../utils/timezone.js");
    return gyeDayRangeUtcFromDate(new Date()); // { gte, lt }
}
/** Asegura que exista USD y devuelve su id (usa unique por codigo) */
async function ensureUsdMonedaId() {
    const existing = await prisma.moneda.findUnique({
        where: { codigo: "USD" },
        select: { id: true },
    });
    if (existing?.id)
        return existing.id;
    const created = await prisma.moneda.create({
        data: {
            nombre: "Dólar estadounidense",
            simbolo: "$",
            codigo: "USD",
            activo: true,
            orden_display: 0,
            comportamiento_compra: "MULTIPLICA",
            comportamiento_venta: "DIVIDE",
        },
        select: { id: true },
    });
    return created.id;
}
/* ==============================
 * POST /servicios-externos/movimientos  (OPERADOR)
 * ============================== */
router.post("/movimientos", authenticateToken, saldoValidation.validarSaldoSuficiente, async (req, res) => {
    try {
        if (!isOperador(req)) {
            res.status(403).json({
                success: false,
                message: "Permisos insuficientes (solo OPERADOR)",
            });
            return;
        }
        const { servicio, tipo_movimiento, monto, descripcion, numero_referencia, comprobante_url, } = req.body;
        const puntoId = req.user?.punto_atencion_id;
        if (!puntoId) {
            res.status(400).json({
                success: false,
                message: "Debes iniciar una jornada y tener un punto de atención asignado para registrar movimientos.",
            });
            return;
        }
        if (!servicio || !SERVICIOS_VALIDOS.includes(servicio)) {
            res.status(400).json({ success: false, message: "servicio inválido" });
            return;
        }
        if (!tipo_movimiento || !TIPOS_VALIDOS.includes(tipo_movimiento)) {
            res
                .status(400)
                .json({ success: false, message: "tipo_movimiento inválido" });
            return;
        }
        const montoNum = typeof monto === "string" ? parseFloat(monto) : Number(monto);
        if (!isFinite(montoNum) || montoNum <= 0) {
            res
                .status(400)
                .json({ success: false, message: "monto debe ser un número > 0" });
            return;
        }
        // Insumos forzosamente EGRESO
        const esInsumo = servicio === "INSUMOS_OFICINA" || servicio === "INSUMOS_LIMPIEZA";
        if (esInsumo && tipo_movimiento !== "EGRESO") {
            res.status(400).json({
                success: false,
                message: "Los movimientos de Insumos (Oficina/Limpieza) deben registrarse como EGRESO.",
            });
            return;
        }
        const usdId = await ensureUsdMonedaId();
        const movimiento = await prisma.$transaction(async (tx) => {
            // Saldo USD del punto
            const saldo = await tx.saldo.findUnique({
                where: {
                    punto_atencion_id_moneda_id: {
                        punto_atencion_id: puntoId,
                        moneda_id: usdId,
                    },
                },
            });
            const anterior = Number(saldo?.cantidad || 0);
            const delta = tipo_movimiento === "INGRESO" ? montoNum : -montoNum;
            const nuevo = anterior + delta;
            if (saldo) {
                await tx.saldo.update({
                    where: { id: saldo.id },
                    data: {
                        cantidad: nuevo,
                        updated_at: new Date(),
                    },
                });
            }
            else {
                await tx.saldo.create({
                    data: {
                        punto_atencion_id: puntoId,
                        moneda_id: usdId,
                        cantidad: nuevo,
                        billetes: 0,
                        monedas_fisicas: 0,
                    },
                });
            }
            // Registro principal
            const svcMov = await tx.servicioExternoMovimiento.create({
                data: {
                    punto_atencion_id: puntoId,
                    servicio,
                    tipo_movimiento,
                    moneda_id: usdId,
                    monto: montoNum,
                    usuario_id: req.user.id,
                    fecha: new Date(),
                    descripcion: descripcion || null,
                    numero_referencia: numero_referencia || null,
                    comprobante_url: comprobante_url || null,
                },
                include: {
                // por si luego quieres enriquecer respuesta
                },
            });
            // Trazabilidad en MovimientoSaldo usando servicio centralizado
            await registrarMovimientoSaldo({
                puntoAtencionId: puntoId,
                monedaId: usdId,
                tipoMovimiento: tipo_movimiento === "INGRESO" ? TipoMov.INGRESO : TipoMov.EGRESO,
                monto: montoNum, // ⚠️ Pasar monto POSITIVO, el servicio aplica el signo
                saldoAnterior: anterior,
                saldoNuevo: nuevo,
                tipoReferencia: TipoReferencia.SERVICIO_EXTERNO,
                referenciaId: svcMov.id,
                descripcion: descripcion || undefined,
                usuarioId: req.user.id,
            });
            return {
                id: svcMov.id,
                punto_atencion_id: puntoId,
                servicio: svcMov.servicio,
                tipo_movimiento: svcMov.tipo_movimiento,
                moneda_id: usdId,
                monto: Number(svcMov.monto),
                usuario_id: req.user.id,
                usuario: {
                    id: req.user.id,
                    nombre: req.user.nombre,
                },
                fecha: svcMov.fecha.toISOString(),
                descripcion: svcMov.descripcion,
                numero_referencia: svcMov.numero_referencia,
                comprobante_url: svcMov.comprobante_url,
                saldo_anterior: anterior,
                saldo_nuevo: nuevo,
            };
        });
        res.status(201).json({ success: true, movimiento });
    }
    catch (error) {
        console.error("Error creando movimiento de servicios externos:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Error desconocido",
        });
    }
});
/* ==============================
 * GET /movimientos/:pointId  (OPERADOR — solo su punto)
 * ============================== */
router.get("/movimientos/:pointId", authenticateToken, async (req, res) => {
    try {
        if (!isOperador(req)) {
            res.status(403).json({
                success: false,
                message: "Permisos insuficientes (solo OPERADOR)",
            });
            return;
        }
        const puntoAsignado = req.user?.punto_atencion_id;
        if (!puntoAsignado) {
            res.status(400).json({
                success: false,
                message: "Debes iniciar una jornada y tener un punto de atención asignado para consultar movimientos.",
            });
            return;
        }
        const { pointId } = req.params;
        if (pointId !== puntoAsignado) {
            res.status(403).json({
                success: false,
                message: "Solo puedes consultar movimientos del punto de atención asignado.",
            });
            return;
        }
        const { servicio, tipo_movimiento, desde, hasta, limit } = req.query;
        const take = Math.min(Math.max(parseInt(limit || "100", 10), 1), 500);
        const where = { punto_atencion_id: pointId };
        if (servicio && SERVICIOS_VALIDOS.includes(servicio)) {
            where.servicio = servicio;
        }
        if (tipo_movimiento && TIPOS_VALIDOS.includes(tipo_movimiento)) {
            where.tipo_movimiento = tipo_movimiento;
        }
        if (desde || hasta) {
            where.fecha = {
                gte: desde ? new Date(`${desde}T00:00:00.000Z`) : undefined,
                lte: hasta ? new Date(`${hasta}T23:59:59.999Z`) : undefined,
            };
        }
        const rows = await prisma.servicioExternoMovimiento.findMany({
            where,
            orderBy: { fecha: "desc" },
            take,
            include: {
                usuario: { select: { id: true, nombre: true } },
                moneda: {
                    select: { id: true, nombre: true, codigo: true, simbolo: true },
                },
                puntoAtencion: { select: { id: true, nombre: true } },
            },
        });
        const movimientos = rows.map((r) => ({
            id: r.id,
            punto_atencion_id: r.punto_atencion_id,
            servicio: r.servicio,
            tipo_movimiento: r.tipo_movimiento,
            moneda_id: r.moneda_id,
            monto: Number(r.monto),
            usuario_id: r.usuario_id,
            fecha: r.fecha.toISOString(),
            descripcion: r.descripcion || null,
            numero_referencia: r.numero_referencia || null,
            comprobante_url: r.comprobante_url || null,
            usuario: {
                id: r.usuario?.id || r.usuario_id,
                nombre: r.usuario?.nombre || "",
            },
            moneda: {
                id: r.moneda?.id || r.moneda_id,
                nombre: r.moneda?.nombre || "",
                codigo: r.moneda?.codigo || "",
                simbolo: r.moneda?.simbolo || "",
            },
            puntoAtencion: {
                id: r.puntoAtencion?.id || r.punto_atencion_id,
                nombre: r.puntoAtencion?.nombre || "",
            },
        }));
        res.json({ success: true, movimientos });
    }
    catch (error) {
        console.error("Error listando movimientos de servicios externos:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Error desconocido",
        });
    }
});
/* ==============================
 * DELETE /movimientos/:id  (ADMIN/SUPER_USUARIO)
 * Reversa + ajuste MovimientoSaldo
 * ============================== */
router.delete("/movimientos/:id", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.$transaction(async (tx) => {
            const mov = await tx.servicioExternoMovimiento.findUnique({
                where: { id },
                select: {
                    id: true,
                    punto_atencion_id: true,
                    moneda_id: true,
                    monto: true,
                    tipo_movimiento: true,
                    usuario_id: true,
                    fecha: true,
                },
            });
            if (!mov) {
                res
                    .status(404)
                    .json({ success: false, error: "Movimiento no encontrado" });
                throw new Error("abort");
            }
            // Restringir a día actual (GYE)
            const { gte, lt } = await gyeTodayWindow();
            const f = mov.fecha;
            if (!(f >= gte && f < lt)) {
                res.status(400).json({
                    success: false,
                    error: "Solo se pueden eliminar movimientos del día actual",
                });
                throw new Error("abort");
            }
            // Saldo actual
            const saldo = await tx.saldo.findUnique({
                where: {
                    punto_atencion_id_moneda_id: {
                        punto_atencion_id: mov.punto_atencion_id,
                        moneda_id: mov.moneda_id,
                    },
                },
            });
            const anterior = Number(saldo?.cantidad || 0);
            // Ajuste inverso: si era INGRESO, ahora es EGRESO (negativo)
            // Si era EGRESO, ahora es INGRESO (positivo)
            const delta = mov.tipo_movimiento === "INGRESO"
                ? -Number(mov.monto)
                : Number(mov.monto);
            const nuevo = anterior + delta;
            if (saldo) {
                await tx.saldo.update({
                    where: { id: saldo.id },
                    data: { cantidad: nuevo, updated_at: new Date() },
                });
            }
            else {
                await tx.saldo.create({
                    data: {
                        punto_atencion_id: mov.punto_atencion_id,
                        moneda_id: mov.moneda_id,
                        cantidad: nuevo,
                        billetes: 0,
                        monedas_fisicas: 0,
                    },
                });
            }
            // ⚠️ USAR SERVICIO CENTRALIZADO para registrar el ajuste
            // El servicio espera monto positivo y aplica el signo según el tipo
            await registrarMovimientoSaldo({
                puntoAtencionId: mov.punto_atencion_id,
                monedaId: mov.moneda_id,
                tipoMovimiento: TipoMov.AJUSTE,
                monto: delta, // AJUSTE mantiene el signo original (positivo o negativo)
                saldoAnterior: anterior,
                saldoNuevo: nuevo,
                tipoReferencia: TipoReferencia.SERVICIO_EXTERNO,
                referenciaId: mov.id,
                descripcion: `Reverso eliminación servicio externo ${mov.tipo_movimiento}`,
                usuarioId: req.user.id,
            });
            await tx.servicioExternoMovimiento.delete({ where: { id: mov.id } });
        });
        res.json({ success: true });
    }
    catch (error) {
        if (error.message === "abort")
            return;
        console.error("Error eliminando movimiento de servicios externos (Prisma):", error);
        res
            .status(500)
            .json({ success: false, error: "No se pudo eliminar el movimiento" });
    }
});
/* ==============================
 * GET /admin/movimientos  (ADMIN/SUPER_USUARIO)
 * ============================== */
router.get("/admin/movimientos", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
    try {
        const { pointId, servicio, tipo_movimiento, desde, hasta, limit } = req.query;
        const where = {};
        if (pointId && pointId !== "ALL")
            where.punto_atencion_id = pointId;
        if (servicio && SERVICIOS_VALIDOS.includes(servicio))
            where.servicio = servicio;
        if (tipo_movimiento && TIPOS_VALIDOS.includes(tipo_movimiento))
            where.tipo_movimiento = tipo_movimiento;
        if (desde || hasta) {
            where.fecha = {
                gte: desde ? new Date(`${desde}T00:00:00.000Z`) : undefined,
                lte: hasta ? new Date(`${hasta}T23:59:59.999Z`) : undefined,
            };
        }
        const take = Math.min(Math.max(parseInt(limit || "100", 10), 1), 500);
        const rows = await prisma.servicioExternoMovimiento.findMany({
            where,
            orderBy: { fecha: "desc" },
            take,
            include: {
                usuario: { select: { id: true, nombre: true } },
                moneda: {
                    select: { id: true, nombre: true, codigo: true, simbolo: true },
                },
                puntoAtencion: { select: { id: true, nombre: true } },
            },
        });
        const movimientos = rows.map((r) => ({
            id: r.id,
            punto_atencion_id: r.punto_atencion_id,
            servicio: r.servicio,
            tipo_movimiento: r.tipo_movimiento,
            moneda_id: r.moneda_id,
            monto: Number(r.monto),
            usuario_id: r.usuario_id,
            fecha: r.fecha.toISOString(),
            descripcion: r.descripcion || null,
            numero_referencia: r.numero_referencia || null,
            comprobante_url: r.comprobante_url || null,
            usuario: {
                id: r.usuario?.id || r.usuario_id,
                nombre: r.usuario?.nombre || "",
            },
            moneda: {
                id: r.moneda?.id || r.moneda_id,
                nombre: r.moneda?.nombre || "",
                codigo: r.moneda?.codigo || "",
                simbolo: r.moneda?.simbolo || "",
            },
            puntoAtencion: {
                id: r.puntoAtencion?.id || r.punto_atencion_id,
                nombre: r.puntoAtencion?.nombre || "",
            },
        }));
        res.json({ success: true, movimientos });
    }
    catch (error) {
        console.error("Error listando movimientos de servicios externos (admin):", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Error desconocido",
        });
    }
});
/* ==============================
 * POST /cierre/abrir  (OPERADOR/ADMIN/..)
 * Usa fecha del día GYE
 * ============================== */
router.post("/cierre/abrir", authenticateToken, async (req, res) => {
    try {
        const user = req.user || {};
        const isAdmin = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(user.rol);
        let pointId = req.body?.pointId;
        if (!isAdmin)
            pointId = user.punto_atencion_id;
        if (!pointId) {
            res.status(400).json({
                success: false,
                error: "Debes tener un punto de atención asignado para abrir el cierre diario.",
            });
            return;
        }
        const { gte, lt } = await gyeTodayWindow();
        const existing = await prisma.servicioExternoCierreDiario.findFirst({
            where: {
                punto_atencion_id: pointId,
                fecha: { gte, lt },
            },
            select: { id: true, fecha: true, estado: true },
        });
        if (existing) {
            res.json({ success: true, cierre: existing });
            return;
        }
        const created = await prisma.servicioExternoCierreDiario.create({
            data: {
                punto_atencion_id: pointId,
                usuario_id: user.id,
                fecha: gte, // @db.Date => guardará solo la fecha
                estado: "ABIERTO",
                created_at: new Date(),
                updated_at: new Date(),
            },
            select: { id: true, fecha: true, estado: true },
        });
        res.status(201).json({ success: true, cierre: created });
    }
    catch (error) {
        console.error("Error abriendo cierre servicios externos:", error);
        res
            .status(500)
            .json({ success: false, error: "No se pudo abrir el cierre" });
    }
});
/* ==============================
 * GET /cierre/status  (OPERADOR/ADMIN/..)
 * ============================== */
router.get("/cierre/status", authenticateToken, async (req, res) => {
    try {
        const user = req.user || {};
        const isAdmin = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(user.rol);
        const queryPointId = String(req.query?.pointId || "").trim();
        let pointId = queryPointId || undefined;
        if (!isAdmin)
            pointId = user.punto_atencion_id;
        if (!pointId) {
            res.status(400).json({
                success: false,
                error: "Debes tener un punto de atención asignado para consultar el estado de cierre.",
            });
            return;
        }
        const fechaStr = String(req.query?.fecha || "").trim();
        const { gyeDayRangeUtcFromDate, gyeParseDateOnly, gyeDayRangeUtcFromYMD, } = await import("../utils/timezone.js");
        let gte, lt;
        if (fechaStr) {
            const { y, m, d } = gyeParseDateOnly(fechaStr);
            ({ gte, lt } = gyeDayRangeUtcFromYMD(y, m, d));
        }
        else {
            ({ gte, lt } = gyeDayRangeUtcFromDate(new Date()));
        }
        const usdId = await ensureUsdMonedaId();
        const cierre = await prisma.servicioExternoCierreDiario.findFirst({
            where: { punto_atencion_id: pointId, fecha: { gte, lt } },
            select: {
                id: true,
                fecha: true,
                estado: true,
                observaciones: true,
                fecha_cierre: true,
                cerrado_por: true,
            },
        });
        // Detalles de cierre (si existe)
        const detalles = cierre &&
            (await prisma.servicioExternoDetalleCierre.findMany({
                where: { cierre_id: cierre.id },
                orderBy: { servicio: "asc" },
                select: {
                    servicio: true,
                    moneda_id: true,
                    monto_movimientos: true,
                    monto_validado: true,
                    diferencia: true,
                    observaciones: true,
                },
            })).map((r) => ({
                servicio: r.servicio,
                moneda_id: r.moneda_id,
                monto_movimientos: Number(r.monto_movimientos),
                monto_validado: Number(r.monto_validado),
                diferencia: Number(r.diferencia),
                observaciones: r.observaciones,
            }));
        // Resumen neto por servicio (USD)
        const movs = await prisma.servicioExternoMovimiento.groupBy({
            by: ["servicio"],
            where: {
                punto_atencion_id: pointId,
                moneda_id: usdId,
                fecha: { gte, lt },
            },
            _sum: {
                monto: true,
            },
        });
        // Como groupBy no diferencia INGRESO/EGRESO, calculamos con findMany:
        const rows = await prisma.servicioExternoMovimiento.findMany({
            where: {
                punto_atencion_id: pointId,
                moneda_id: usdId,
                fecha: { gte, lt },
            },
            select: { servicio: true, tipo_movimiento: true, monto: true },
        });
        const netoMap = new Map();
        for (const s of SERVICIOS_VALIDOS)
            netoMap.set(s, 0);
        for (const r of rows) {
            const prev = netoMap.get(r.servicio) || 0;
            const delta = r.tipo_movimiento === "INGRESO" ? Number(r.monto) : -Number(r.monto);
            netoMap.set(r.servicio, +(prev + delta).toFixed(2));
        }
        const resumen_movimientos = Array.from(netoMap.entries())
            .filter(([, neto]) => neto !== 0)
            .map(([servicio, neto]) => ({ servicio, neto }));
        res.json({
            success: true,
            cierre: cierre || null,
            detalles: detalles || [],
            resumen_movimientos,
        });
    }
    catch (error) {
        console.error("Error consultando status cierre servicios externos (Prisma):", error);
        res
            .status(500)
            .json({ success: false, error: "No se pudo obtener el estado" });
    }
});
/* ==============================
 * POST /cierre/cerrar  (OPERADOR/ADMIN/..)
 * Tolerancia ±1.00 USD por servicio
 * ============================== */
router.post("/cierre/cerrar", authenticateToken, async (req, res) => {
    try {
        const user = req.user || {};
        const isAdmin = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(user.rol);
        let pointId = req.body?.pointId;
        if (!isAdmin)
            pointId = user.punto_atencion_id;
        if (!pointId) {
            res.status(400).json({
                success: false,
                error: "Debes tener un punto de atención asignado para cerrar el día.",
            });
            return;
        }
        const detallesInput = Array.isArray(req.body?.detalles) ? req.body.detalles : [];
        const obsGeneral = req.body?.observaciones || undefined;
        const { gte, lt } = await gyeTodayWindow();
        const usdId = await ensureUsdMonedaId();
        await prisma.$transaction(async (tx) => {
            // Obtener/crear cierre ABIERTO del día
            let cierre = await tx.servicioExternoCierreDiario.findFirst({
                where: { punto_atencion_id: pointId, fecha: { gte, lt } },
                select: { id: true, estado: true },
            });
            if (!cierre) {
                cierre = await tx.servicioExternoCierreDiario.create({
                    data: {
                        punto_atencion_id: pointId,
                        usuario_id: user.id,
                        fecha: gte,
                        estado: "ABIERTO",
                        observaciones: obsGeneral || null,
                        created_at: new Date(),
                        updated_at: new Date(),
                    },
                    select: { id: true, estado: true },
                });
            }
            if (cierre.estado === "CERRADO") {
                res
                    .status(400)
                    .json({ success: false, error: "El día ya está cerrado" });
                throw new Error("abort");
            }
            // Neto movimientos por servicio (USD)
            const rows = await tx.servicioExternoMovimiento.findMany({
                where: {
                    punto_atencion_id: pointId,
                    moneda_id: usdId,
                    fecha: { gte, lt },
                },
                select: { servicio: true, tipo_movimiento: true, monto: true },
            });
            const netoByServicio = new Map();
            for (const s of SERVICIOS_VALIDOS)
                netoByServicio.set(s, 0);
            for (const r of rows) {
                const prev = netoByServicio.get(r.servicio) || 0;
                const delta = r.tipo_movimiento === "INGRESO"
                    ? Number(r.monto)
                    : -Number(r.monto);
                netoByServicio.set(r.servicio, +(prev + delta).toFixed(2));
            }
            const serviciosSet = new Set([
                ...Array.from(netoByServicio.keys()),
                ...detallesInput.map((d) => d.servicio),
            ]);
            const TOL = 1.0;
            const detalles = [];
            const errores = [];
            for (const svc of serviciosSet) {
                const neto = Number((netoByServicio.get(svc) || 0).toFixed(2));
                const input = detallesInput.find((d) => d.servicio === svc);
                const validado = Number((input?.monto_validado || 0).toFixed(2));
                const diff = Number((validado - neto).toFixed(2));
                detalles.push({
                    servicio: svc,
                    monto_movimientos: neto,
                    monto_validado: validado,
                    diferencia: diff,
                    observaciones: input?.observaciones,
                });
                if (Math.abs(diff) > TOL) {
                    errores.push({ servicio: svc, diferencia: diff });
                }
            }
            if (errores.length > 0) {
                res.status(400).json({
                    success: false,
                    error: "Las diferencias por servicio exceden la tolerancia de ±1.00 USD",
                    detalles: errores,
                });
                throw new Error("abort");
            }
            // Limpiar detalles previos e insertar los nuevos
            await tx.servicioExternoDetalleCierre.deleteMany({
                where: { cierre_id: cierre.id },
            });
            for (const d of detalles) {
                await tx.servicioExternoDetalleCierre.create({
                    data: {
                        cierre_id: cierre.id,
                        servicio: d.servicio,
                        moneda_id: usdId,
                        monto_movimientos: d.monto_movimientos,
                        monto_validado: d.monto_validado,
                        diferencia: d.diferencia,
                        observaciones: d.observaciones || null,
                    },
                });
            }
            // Cerrar el día
            await tx.servicioExternoCierreDiario.update({
                where: { id: cierre.id },
                data: {
                    estado: "CERRADO",
                    fecha_cierre: new Date(),
                    cerrado_por: user.id,
                    observaciones: obsGeneral || undefined,
                    diferencias_reportadas: {
                        resumen: detalles.map((d) => ({
                            servicio: d.servicio,
                            diferencia: d.diferencia,
                        })),
                    },
                    updated_at: new Date(),
                },
            });
        });
        res.json({ success: true });
    }
    catch (error) {
        if (error.message === "abort")
            return;
        console.error("Error cerrando cierre servicios externos (Prisma):", error);
        res
            .status(500)
            .json({ success: false, error: "No se pudo cerrar el día" });
    }
});
/* ==============================
 * GET /movimientos  (ADMIN/SUPER_USUARIO/ADMINISTRATIVO)
 * ============================== */
router.get("/movimientos", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]), async (req, res) => {
    try {
        const { punto_id, servicio, fecha_desde, fecha_hasta } = req.query;
        const where = {};
        if (punto_id && punto_id !== "todos")
            where.punto_atencion_id = punto_id;
        if (servicio && servicio !== "todos")
            where.servicio = servicio;
        if (fecha_desde || fecha_hasta) {
            where.fecha = {
                gte: fecha_desde
                    ? new Date(`${fecha_desde}T00:00:00.000Z`)
                    : undefined,
                lte: fecha_hasta
                    ? new Date(`${fecha_hasta}T23:59:59.999Z`)
                    : undefined,
            };
        }
        const rows = await prisma.servicioExternoMovimiento.findMany({
            where,
            orderBy: { fecha: "desc" },
            take: 500,
            include: {
                puntoAtencion: { select: { nombre: true } },
                usuario: { select: { nombre: true } },
            },
        });
        res.json({
            success: true,
            movimientos: rows.map((r) => ({
                id: r.id,
                servicio: r.servicio,
                tipo: r.tipo_movimiento,
                monto: Number(r.monto),
                descripcion: r.descripcion || null,
                punto_atencion_nombre: r.puntoAtencion?.nombre || "",
                creado_por: r.usuario?.nombre || "",
                creado_en: r.fecha.toISOString(),
            })),
        });
    }
    catch (error) {
        console.error("Error al obtener movimientos (Prisma):", error);
        res.status(500).json({
            success: false,
            error: "Error interno del servidor",
        });
    }
});
/* ==============================
 * POST /asignar-saldo  (ADMIN/SUPER_USUARIO)
 * ============================== */
router.post("/asignar-saldo", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
    try {
        const { punto_atencion_id, servicio, monto_asignado, creado_por, tipo_asignacion, observaciones, } = req.body;
        if (!punto_atencion_id || !servicio || !monto_asignado || !creado_por) {
            res.status(400).json({
                success: false,
                error: "Todos los campos son obligatorios: punto_atencion_id, servicio, monto_asignado, creado_por",
            });
            return;
        }
        if (!SERVICIOS_VALIDOS.includes(servicio)) {
            res.status(400).json({ success: false, error: "Servicio no válido" });
            return;
        }
        if (monto_asignado <= 0) {
            res.status(400).json({
                success: false,
                error: "El monto debe ser mayor a 0",
            });
            return;
        }
        const usdId = await ensureUsdMonedaId();
        const result = await prisma.$transaction(async (tx) => {
            // Verificar punto
            const punto = await tx.puntoAtencion.findUnique({
                where: { id: punto_atencion_id },
                select: { id: true, nombre: true },
            });
            if (!punto) {
                res
                    .status(404)
                    .json({ success: false, error: "Punto de atención no encontrado" });
                throw new Error("abort");
            }
            // Registrar asignación
            const asignacion = await tx.servicioExternoAsignacion.create({
                data: {
                    punto_atencion_id,
                    servicio,
                    moneda_id: usdId,
                    monto: monto_asignado,
                    tipo: tipo_asignacion || "INICIAL",
                    observaciones: observaciones || null,
                    asignado_por: creado_por,
                    fecha: new Date(),
                },
                select: {
                    id: true,
                    fecha: true,
                },
            });
            // Upsert saldo del servicio en el punto
            const saldo = await tx.servicioExternoSaldo.findUnique({
                where: {
                    punto_atencion_id_servicio_moneda_id: {
                        punto_atencion_id,
                        servicio,
                        moneda_id: usdId,
                    },
                },
            });
            if (saldo) {
                await tx.servicioExternoSaldo.update({
                    where: { id: saldo.id },
                    data: {
                        cantidad: Number(saldo.cantidad) + monto_asignado,
                        updated_at: new Date(),
                    },
                });
            }
            else {
                await tx.servicioExternoSaldo.create({
                    data: {
                        punto_atencion_id,
                        servicio,
                        moneda_id: usdId,
                        cantidad: monto_asignado,
                        updated_at: new Date(),
                    },
                });
            }
            return {
                asignacionId: asignacion.id,
                puntoNombre: punto.nombre,
            };
        });
        res.status(201).json({
            success: true,
            message: `Saldo de $${monto_asignado.toFixed(2)} asignado correctamente para ${servicio} en ${result.puntoNombre}`,
            asignacion: {
                id: result.asignacionId,
                punto_atencion_id,
                punto_atencion_nombre: result.puntoNombre,
                servicio,
                monto_asignado,
                creado_por,
                creado_en: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        if (error.message === "abort")
            return;
        console.error("Error al asignar saldo (Prisma):", error);
        res.status(500).json({
            success: false,
            error: "Error interno del servidor",
        });
    }
});
/* ==============================
 * GET /saldos-por-punto  (ADMIN/SUPER_USUARIO)
 * ============================== */
router.get("/saldos-por-punto", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
    try {
        const rows = await prisma.servicioExternoSaldo.findMany({
            orderBy: [{ punto_atencion_id: "asc" }, { servicio: "asc" }],
            include: {
                puntoAtencion: { select: { nombre: true } },
            },
        });
        res.json({
            success: true,
            saldos: rows.map((r) => ({
                punto_atencion_id: r.punto_atencion_id,
                punto_atencion_nombre: r.puntoAtencion?.nombre || "",
                servicio: r.servicio,
                saldo_actual: Number(r.cantidad || 0),
            })),
        });
    }
    catch (error) {
        console.error("Error al obtener saldos por punto (Prisma):", error);
        res.status(500).json({
            success: false,
            error: "Error interno del servidor",
        });
    }
});
/* ==============================
 * GET /historial-asignaciones  (ADMIN/SUPER_USUARIO)
 * ============================== */
router.get("/historial-asignaciones", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
    try {
        const rows = await prisma.servicioExternoAsignacion.findMany({
            orderBy: { fecha: "desc" },
            take: 100,
            include: {
                puntoAtencion: { select: { nombre: true } },
                usuarioAsignador: { select: { nombre: true } },
            },
        });
        res.json({
            success: true,
            historial: rows.map((r) => ({
                id: r.id,
                punto_atencion_nombre: r.puntoAtencion?.nombre || "",
                servicio: r.servicio,
                monto_asignado: Number(r.monto),
                creado_por: r.usuarioAsignador?.nombre || "",
                creado_en: r.fecha.toISOString(),
                tipo: r.tipo,
                observaciones: r.observaciones || null,
            })),
        });
    }
    catch (error) {
        console.error("Error al obtener historial de asignaciones (Prisma):", error);
        res.status(500).json({
            success: false,
            error: "Error interno del servidor",
        });
    }
});
export default router;
