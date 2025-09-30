import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
const router = express.Router();
// GET /api/vista-saldos-puntos — Vista consolidada de saldos por punto
router.get("/", authenticateToken, async (req, res) => {
    try {
        console.log("🔍 Vista saldos: Iniciando consulta...");
        console.log("👤 Usuario solicitante:", {
            id: req.user?.id,
            rol: req.user?.rol,
        });
        // 1) Traer puntos y monedas activas
        const [puntos, monedas] = await Promise.all([
            prisma.puntoAtencion.findMany({
                where: { activo: true },
                select: { id: true, nombre: true, ciudad: true },
            }),
            prisma.moneda.findMany({
                where: { activo: true },
                select: {
                    id: true,
                    nombre: true,
                    simbolo: true,
                    codigo: true,
                    orden_display: true,
                },
                orderBy: [{ orden_display: "asc" }, { nombre: "asc" }],
            }),
        ]);
        // 2) Pre-cargar saldos y saldos iniciales (ACTIVOS)
        const [saldoEntities, saldoInicialEntities] = await Promise.all([
            prisma.saldo.findMany({
                where: {
                    punto_atencion_id: { in: puntos.map((p) => p.id) },
                    moneda_id: { in: monedas.map((m) => m.id) },
                },
                select: {
                    punto_atencion_id: true,
                    moneda_id: true,
                    cantidad: true,
                    billetes: true,
                    monedas_fisicas: true,
                    updated_at: true,
                },
            }),
            prisma.saldoInicial.findMany({
                where: {
                    activo: true,
                    punto_atencion_id: { in: puntos.map((p) => p.id) },
                    moneda_id: { in: monedas.map((m) => m.id) },
                },
                select: {
                    punto_atencion_id: true,
                    moneda_id: true,
                    cantidad_inicial: true,
                    fecha_asignacion: true,
                },
            }),
        ]);
        // 3) Indexar por clave compuesta punto:moneda
        const key = (puntoId, monedaId) => `${puntoId}:${monedaId}`;
        const saldoMap = new Map();
        for (const s of saldoEntities) {
            saldoMap.set(key(s.punto_atencion_id, s.moneda_id), s);
        }
        const inicialMap = new Map();
        for (const si of saldoInicialEntities) {
            inicialMap.set(key(si.punto_atencion_id, si.moneda_id), si);
        }
        // 4) Armar la “vista” (equivalente a CROSS JOIN en memoria) y calcular campos
        const rows = [];
        for (const p of puntos) {
            for (const m of monedas) {
                const k = key(p.id, m.id);
                const s = saldoMap.get(k);
                const si = inicialMap.get(k);
                const saldo_inicial = si ? Number(si.cantidad_inicial) : 0;
                const saldo_actual = s ? Number(s.cantidad) : 0;
                const billetes = s ? Number(s.billetes) : 0;
                const monedas_fisicas = s ? Number(s.monedas_fisicas) : 0;
                const diferencia = Number((saldo_actual - saldo_inicial).toFixed(2));
                rows.push({
                    punto_atencion_id: p.id,
                    punto_nombre: p.nombre,
                    ciudad: p.ciudad ?? null,
                    moneda_id: m.id,
                    moneda_nombre: m.nombre,
                    moneda_simbolo: m.simbolo,
                    moneda_codigo: m.codigo,
                    saldo_inicial,
                    saldo_actual,
                    billetes,
                    monedas_fisicas,
                    diferencia,
                    ultima_actualizacion: s?.updated_at
                        ? s.updated_at.toISOString()
                        : null,
                    fecha_saldo_inicial: si?.fecha_asignacion
                        ? si.fecha_asignacion.toISOString()
                        : null,
                    __punto_sort: p.nombre,
                    __moneda_sort_1: m.orden_display ?? 0,
                    __moneda_sort_2: m.nombre,
                });
            }
        }
        // 5) Ordenar por punto, luego orden_display y nombre de moneda
        rows.sort((a, b) => {
            if (a.__punto_sort !== b.__punto_sort) {
                return a.__punto_sort.localeCompare(b.__punto_sort);
            }
            if (a.__moneda_sort_1 !== b.__moneda_sort_1) {
                return a.__moneda_sort_1 - b.__moneda_sort_1;
            }
            return a.__moneda_sort_2.localeCompare(b.__moneda_sort_2);
        });
        // 6) Output limpio (sin claves internas de orden)
        const vista = rows.map(({ __punto_sort, __moneda_sort_1, __moneda_sort_2, ...rest }) => rest);
        console.log(`💰 Saldos encontrados: ${vista.length} registros`);
        // Resumen por punto (solo para logs)
        const puntosSummary = vista.reduce((acc, row) => {
            if (!acc[row.punto_atencion_id]) {
                acc[row.punto_atencion_id] = {
                    nombre: row.punto_nombre,
                    ciudad: row.ciudad ?? null,
                    monedas: 0,
                };
            }
            acc[row.punto_atencion_id].monedas++;
            return acc;
        }, {});
        console.log("📍 Resumen por puntos:", puntosSummary);
        console.log("💰 Primeros 5 registros:", vista.slice(0, 5));
        res.json({ success: true, saldos: vista });
    }
    catch (error) {
        console.error("❌ Error in balance view route:", error);
        res.status(500).json({
            success: false,
            error: "Error interno del servidor",
        });
    }
});
export default router;
