import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { pool } from "../lib/database.js";
import { PrismaClient, Prisma } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

/** Parseo numérico robusto para distintos formatos */
const toNumber = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return Number(v);

  const raw = v.trim();
  if (!raw) return NaN;

  // 1) 1.234,56  -> 1234.56
  if (/^\d{1,3}(\.\d{3})+,\d{1,6}$/.test(raw)) {
    return Number(raw.replace(/\./g, "").replace(",", "."));
  }
  // 2) 1,234.56  -> 1234.56
  if (/^\d{1,3}(,\d{3})+\.\d{1,6}$/.test(raw)) {
    return Number(raw.replace(/,/g, ""));
  }
  // 3) 1234,56   -> 1234.56
  if (/^\d+(,\d{1,6})$/.test(raw)) {
    return Number(raw.replace(",", "."));
  }
  // 4) 1234.56 o 1234
  return Number(raw.replace(",", "."));
};

// ======================= GET: saldos iniciales del punto =======================
router.get("/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;

    const query = `
      SELECT 
        si.id, si.punto_atencion_id, si.moneda_id, si.cantidad_inicial,
        si.asignado_por, si.observaciones, si.activo, si.created_at,
        m.nombre AS moneda_nombre, m.codigo AS moneda_codigo, m.simbolo AS moneda_simbolo,
        pa.nombre AS punto_nombre, pa.ciudad
      FROM "SaldoInicial" si
      JOIN "Moneda" m ON si.moneda_id = m.id
      JOIN "PuntoAtencion" pa ON si.punto_atencion_id = pa.id
      WHERE si.punto_atencion_id = $1 AND si.activo = true
      ORDER BY si.created_at DESC
    `;
    const result = await pool.query(query, [pointId]);

    res.json({ success: true, saldos: result.rows });
  } catch (error) {
    console.error("Error in get initial balances route:", error);
    res
      .status(500)
      .json({ success: false, error: "Error interno del servidor" });
  }
});

// ======================= POST: asignar/INCREMENTAR saldo inicial =======================
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: any, res) => {
    console.warn("=== SALDOS INICIALES POST START ===");
    console.warn("Request body:", req.body);
    console.warn("Request user:", req.user);

    try {
      const {
        punto_atencion_id,
        moneda_id,
        cantidad_inicial,
        observaciones,
        billetes,
        monedas_fisicas,
      } = req.body ?? {};

      // Validaciones base
      if (!punto_atencion_id || !moneda_id || cantidad_inicial === undefined) {
        return res
          .status(400)
          .json({ success: false, error: "Faltan campos obligatorios" });
      }
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: "No autorizado" });
      }

      // Validar existencia/estado de punto y moneda
      const [punto, moneda] = await Promise.all([
        prisma.puntoAtencion.findUnique({
          where: { id: punto_atencion_id },
          select: { id: true, activo: true },
        }),
        prisma.moneda.findUnique({
          where: { id: moneda_id },
          select: { id: true, activo: true },
        }),
      ]);
      if (!punto || punto.activo === false) {
        return res
          .status(404)
          .json({
            success: false,
            error: "Punto de atención inválido o inactivo",
          });
      }
      if (!moneda || moneda.activo === false) {
        return res
          .status(400)
          .json({ success: false, error: "Moneda inválida o inactiva" });
      }

      // Total o desglose (billetes + monedas_fisicas)
      const totalFromField = toNumber(cantidad_inicial);
      const billetesNum =
        billetes !== undefined ? toNumber(billetes) : undefined;
      const monedasNum =
        monedas_fisicas !== undefined ? toNumber(monedas_fisicas) : undefined;

      // Validaciones
      if (
        (billetes !== undefined &&
          (!Number.isFinite(billetesNum!) || isNaN(billetesNum!))) ||
        (monedas_fisicas !== undefined &&
          (!Number.isFinite(monedasNum!) || isNaN(monedasNum!)))
      ) {
        return res
          .status(400)
          .json({ success: false, error: "Billetes/monedas inválidos" });
      }
      if (
        (billetesNum !== undefined && billetesNum < 0) ||
        (monedasNum !== undefined && monedasNum < 0)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Billetes/monedas no pueden ser negativos",
          });
      }

      let cantidad = totalFromField;
      if (billetesNum !== undefined || monedasNum !== undefined) {
        const safeBilletes = billetesNum || 0;
        const safeMonedas = monedasNum || 0;
        cantidad = safeBilletes + safeMonedas;
      }

      if (!Number.isFinite(cantidad) || isNaN(cantidad)) {
        return res
          .status(400)
          .json({ success: false, error: "Cantidad inválida" });
      }
      if (cantidad <= 0) {
        return res
          .status(400)
          .json({ success: false, error: "La cantidad debe ser mayor a 0" });
      }

      // ---------- Transacción atómica (evitar increment sobre NULL) ----------
      const resultado = await prisma.$transaction(async (tx) => {
        const decCantidad = new Prisma.Decimal(cantidad);
        const incBilletes = new Prisma.Decimal(billetesNum ?? 0);
        const incMonedas = new Prisma.Decimal(monedasNum ?? 0);

        // 1) SaldoInicial activo: incrementa cantidad_inicial (o crea)
        const existingInicial = await tx.saldoInicial.findFirst({
          where: { punto_atencion_id, moneda_id, activo: true },
          select: { id: true, cantidad_inicial: true, observaciones: true },
        });

        let saldoInicialResult;
        if (existingInicial) {
          const baseInicial = new Prisma.Decimal(
            existingInicial.cantidad_inicial ?? 0
          );
          saldoInicialResult = await tx.saldoInicial.update({
            where: { id: existingInicial.id },
            data: {
              cantidad_inicial: baseInicial.add(decCantidad), // SET explícito
              observaciones:
                observaciones ?? existingInicial.observaciones ?? null,
            },
          });
        } else {
          saldoInicialResult = await tx.saldoInicial.create({
            data: {
              punto_atencion_id,
              moneda_id,
              cantidad_inicial: decCantidad,
              asignado_por: req.user.id,
              observaciones: observaciones ?? null,
              activo: true,
            },
          });
        }

        // 2) Saldo actual: lee valores actuales (pueden ser NULL) y SET con suma
        const existingSaldo = await tx.saldo.findFirst({
          where: { punto_atencion_id, moneda_id },
          select: {
            id: true,
            cantidad: true,
            billetes: true,
            monedas_fisicas: true,
          },
        });

        let saldoResult;
        if (existingSaldo) {
          const baseCantidad = new Prisma.Decimal(
            existingSaldo.cantidad ?? 0
          ).add(decCantidad);
          const baseBilletes = new Prisma.Decimal(
            existingSaldo.billetes ?? 0
          ).add(incBilletes);
          const baseMonedas = new Prisma.Decimal(
            existingSaldo.monedas_fisicas ?? 0
          ).add(incMonedas);

          saldoResult = await tx.saldo.update({
            where: { id: existingSaldo.id },
            data: {
              cantidad: baseCantidad,
              billetes: baseBilletes,
              monedas_fisicas: baseMonedas,
            },
          });
        } else {
          saldoResult = await tx.saldo.create({
            data: {
              punto_atencion_id,
              moneda_id,
              cantidad: decCantidad,
              billetes: incBilletes,
              monedas_fisicas: incMonedas,
            },
          });
        }

        return {
          saldoInicialResult,
          saldoResult,
          updated: Boolean(existingInicial),
        };
      });
      // ---------- Fin transacción ----------

      return res.json({
        success: true,
        saldo: resultado.saldoInicialResult,
        updated: resultado.updated,
      });
    } catch (error: any) {
      console.error("=== SALDOS INICIALES POST ERROR ===");
      console.error("Message:", error?.message);
      console.error("Code:", error?.code, "Meta:", error?.meta);
      console.error("Stack:", error?.stack);

      // Responder con más detalle para depurar (si prefieres, deja sólo en logs)
      const code = error?.code as string | undefined;
      if (code === "P2002")
        return res
          .status(409)
          .json({
            success: false,
            error: "Saldo inicial ya existe (unicidad)",
          });
      if (code === "P2003")
        return res
          .status(400)
          .json({ success: false, error: "Referencia inválida (FK)" });
      if (code === "P2025")
        return res
          .status(404)
          .json({ success: false, error: "Registro no encontrado" });

      // Incluye el mensaje técnico para ver la causa real mientras depuras
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        details: error?.message ?? null,
        code: error?.code ?? null,
      });
    } finally {
      console.warn("=== SALDOS INICIALES POST END ===");
    }
  }
);

export default router;
