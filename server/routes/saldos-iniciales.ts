import express, { Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { pool } from "../lib/database.js";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";

const router = express.Router();

// ===== helpers =====
const toNumber = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return Number(v);
  const raw = v.trim();
  if (!raw) return NaN;
  // 1.234,56 -> 1234.56
  if (/^\d{1,3}(\.\d{3})+,\d{1,6}$/.test(raw))
    return Number(raw.replace(/\./g, "").replace(",", "."));
  // 1,234.56 -> 1234.56
  if (/^\d{1,3}(,\d{3})+\.\d{1,6}$/.test(raw))
    return Number(raw.replace(/,/g, ""));
  // 1234,56 -> 1234.56
  if (/^\d+(,\d{1,6})$/.test(raw)) return Number(raw.replace(",", "."));
  return Number(raw.replace(",", "."));
};
const round2 = (n: number) => Math.round(n * 100) / 100;

// Tipos de Request
interface GetSaldosParams {
  pointId: string;
}
interface PostSaldoBody {
  punto_atencion_id: string;
  moneda_id: string;
  cantidad_inicial: number | string; // puede venir como texto
  observaciones?: string;
  billetes?: number | string;
  monedas_fisicas?: number | string;
}

// ======================= GET: saldos iniciales (punto) =======================
router.get<{ pointId: string }>(
  "/:pointId",
  authenticateToken,
  async (req, res) => {
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
      return res.json({ success: true, saldos: result.rows });
    } catch (error) {
      console.error("GET /saldos-iniciales/:pointId error:", error);
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        details: (error as any)?.message ?? null,
      });
    }
  }
);

// ======================= POST: asignar / INCREMENTAR =======================
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request<unknown, unknown, PostSaldoBody>, res: Response) => {
    // logs de entrada (útiles en PM2)
    console.warn("=== POST /saldos-iniciales START ===");
    console.warn("user:", req.user);
    console.warn("body:", req.body);

    try {
      const {
        punto_atencion_id,
        moneda_id,
        cantidad_inicial,
        observaciones,
        billetes,
        monedas_fisicas,
      } = req.body ?? {};

      // Validaciones base: aceptar cantidad_inicial o billetes/monedas_fisicas
      const hasCantidad =
        cantidad_inicial !== undefined && cantidad_inicial !== null;
      const hasDesglose =
        billetes !== undefined || monedas_fisicas !== undefined;

      if (!punto_atencion_id || !moneda_id || (!hasCantidad && !hasDesglose)) {
        return res
          .status(400)
          .json({ success: false, error: "Faltan campos obligatorios" });
      }
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: "No autorizado" });
      }
      // A partir de aquí, req.user está definido por los middlewares
      const user = req.user as NonNullable<typeof req.user>;

      // Validar punto y moneda existen y están activos
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
        return res.status(404).json({
          success: false,
          error: "Punto de atención inválido o inactivo",
        });
      }
      if (!moneda || moneda.activo === false) {
        return res
          .status(400)
          .json({ success: false, error: "Moneda inválida o inactiva" });
      }

      // Parseo y redondeo
      const totalFromField = toNumber(cantidad_inicial);
      const billetesNum =
        billetes !== undefined ? toNumber(billetes) : undefined;
      const monedasNum =
        monedas_fisicas !== undefined ? toNumber(monedas_fisicas) : undefined;

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
      if ((billetesNum ?? 0) < 0 || (monedasNum ?? 0) < 0) {
        return res.status(400).json({
          success: false,
          error: "Billetes/monedas no pueden ser negativos",
        });
      }

      let cantidad = totalFromField;
      if (billetesNum !== undefined || monedasNum !== undefined) {
        cantidad = (billetesNum || 0) + (monedasNum || 0);
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

      // Redondeo para cumplir DECIMAL(15,2)
      cantidad = round2(cantidad);
      const incBilletes = round2(billetesNum ?? 0);
      const incMonedas = round2(monedasNum ?? 0);

      // Transacción: incrementar sin usar { increment } (evita fallos con NULL históricos)
      const resultado = await prisma.$transaction(async (tx) => {
        const decCantidad = new Prisma.Decimal(cantidad);
        const decBilletes = new Prisma.Decimal(incBilletes);
        const decMonedas = new Prisma.Decimal(incMonedas);

        // 1) SaldoInicial activo: si existe, sumar; si no, crear
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
              // Enviar como Decimal directamente (evita error 22P03 en bind binario)
              cantidad_inicial: baseInicial.add(decCantidad),
              observaciones:
                observaciones ?? existingInicial.observaciones ?? null,
            },
          });
        } else {
          saldoInicialResult = await tx.saldoInicial.create({
            data: {
              punto_atencion_id,
              moneda_id,
              // Enviar como Decimal directamente (evita error 22P03 en bind binario)
              cantidad_inicial: decCantidad,
              asignado_por: user.id,
              observaciones: observaciones ?? null,
              activo: true,
            },
          });
        }

        // 2) Saldo actual: si existe, sumar; si no, crear
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
          ).add(decBilletes);
          const baseMonedas = new Prisma.Decimal(
            existingSaldo.monedas_fisicas ?? 0
          ).add(decMonedas);

          saldoResult = await tx.saldo.update({
            where: { id: existingSaldo.id },
            data: {
              // Enviar como Decimal directamente (evita error 22P03 en bind binario)
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
              // Enviar como Decimal directamente (evita error 22P03 en bind binario)
              cantidad: decCantidad,
              billetes: decBilletes,
              monedas_fisicas: decMonedas,
            },
          });
        }

        // (Opcional) registrar movimiento de saldo; descomenta si lo quieres persistir
        // await tx.movimientoSaldo.create({
        //   data: {
        //     punto_atencion_id,
        //     moneda_id,
        //     tipo_movimiento: "SALDO_INICIAL",
        //     monto: decCantidad,
        //     saldo_anterior: new Prisma.Decimal(existingSaldo?.cantidad ?? 0),
        //     saldo_nuevo: saldoResult.cantidad,
        //     usuario_id: user.id,
        //     referencia_id: saldoInicialResult.id,
        //     tipo_referencia: "SALDO_INICIAL",
        //     descripcion: observaciones ?? null,
        //   },
        // });

        return {
          saldoInicialResult,
          saldoResult,
          updated: Boolean(existingInicial),
        };
      });

      console.warn("=== POST /saldos-iniciales OK ===", {
        saldoInicialId: resultado.saldoInicialResult.id,
        updated: resultado.updated,
      });

      return res.json({
        success: true,
        saldo: resultado.saldoInicialResult,
        updated: resultado.updated,
      });
    } catch (error: any) {
      // Prisma codes más comunes
      const code = error?.code as string | undefined;
      const meta = error?.meta;

      console.error("=== POST /saldos-iniciales ERROR ===");
      console.error("message:", error?.message);
      console.error("code:", code, "meta:", meta);
      console.error("stack:", error?.stack);

      if (code === "P2002") {
        return res.status(409).json({
          success: false,
          error: "Saldo inicial ya existe (unicidad)",
          code,
          meta,
        });
      }
      if (code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "Referencia inválida (FK)",
          code,
          meta,
        });
      }
      if (code === "P2025") {
        return res.status(404).json({
          success: false,
          error: "Registro no encontrado",
          code,
          meta,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        code: code ?? null,
        meta: meta ?? null,
        details: error?.message ?? null,
      });
    } finally {
      console.warn("=== POST /saldos-iniciales END ===");
    }
  }
);

export default router;
