import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { pool } from "../lib/database.js";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const toNumber = (v: any) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const raw = v.trim();
    if (!raw) return NaN;
    // Caso: 1.234,56 -> 1234.56
    if (/[,]\d{1,6}$/.test(raw) && raw.includes(".")) {
      return Number(raw.replace(/\./g, "").replace(",", "."));
    }
    // Caso: 1234,56 -> 1234.56
    if (/^\d+(?:,\d+)?$/.test(raw)) {
      return Number(raw.replace(",", "."));
    }
    // Caso: 1,234.56 -> 1234.56 (quitar comas como miles)
    return Number(raw.replace(/,/g, ""));
  }
  return Number(v);
};

// Obtener saldos iniciales por punto de atención
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

// Asignar saldo inicial
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
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
      } = req.body;

      console.warn("Extracted data:", {
        punto_atencion_id,
        moneda_id,
        cantidad_inicial,
        billetes,
        monedas_fisicas,
        observaciones,
      });

      if (!punto_atencion_id || !moneda_id || cantidad_inicial === undefined) {
        console.warn("Missing required fields");
        return res
          .status(400)
          .json({ success: false, error: "Faltan campos obligatorios" });
      }

      if (!req.user?.id) {
        console.warn("User not authenticated");
        return res.status(401).json({ success: false, error: "No autorizado" });
      }

      // Validar punto y moneda existen
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

      // Compatibilidad: aceptar cantidad_inicial (total) o desglosado (billetes + monedas_fisicas)
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

      console.warn("Converted amount (total):", cantidad, {
        billetesNum,
        monedasNum,
      });
      if (!Number.isFinite(cantidad) || isNaN(cantidad)) {
        return res
          .status(400)
          .json({ success: false, error: "Cantidad inválida" });
      }
      if (cantidad < 0) {
        return res
          .status(400)
          .json({ success: false, error: "La cantidad no puede ser negativa" });
      }

      // Verificar si ya existe un saldo inicial activo usando Prisma
      console.warn("Checking for existing initial balance with Prisma...");
      const existingSaldo = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id,
          moneda_id,
          activo: true,
        },
      });

      console.warn("Existing balance check result:", existingSaldo);

      if (existingSaldo) {
        console.warn("Initial balance already exists:", existingSaldo);

        // Si ya existe, actualizar el saldo existente
        console.warn("Updating existing initial balance with Prisma...");
        const updatedSaldo = await prisma.saldoInicial.update({
          where: { id: existingSaldo.id },
          data: {
            cantidad_inicial: cantidad,
            observaciones: observaciones || null,
          },
        });
        console.warn("Initial balance updated:", updatedSaldo);

        // Actualizar también el saldo actual
        console.warn("Upserting current balance with Prisma...");
        await prisma.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id,
              moneda_id,
            },
          },
          update: {
            cantidad,
            billetes: billetesNum ?? 0,
            monedas_fisicas: monedasNum ?? 0,
          },
          create: {
            punto_atencion_id,
            moneda_id,
            cantidad,
            billetes: billetesNum ?? 0,
            monedas_fisicas: monedasNum ?? 0,
          },
        });
        console.warn("Current balance updated successfully");

        const response = {
          success: true,
          saldo: updatedSaldo,
          updated: true,
        };
        console.warn("Sending update success response:", response);
        return res.json(response);
      }

      // Crear el saldo inicial usando Prisma
      console.warn("Creating initial balance with Prisma...");
      const nuevoSaldo = await prisma.saldoInicial.create({
        data: {
          punto_atencion_id,
          moneda_id,
          cantidad_inicial: cantidad,
          asignado_por: req.user.id,
          observaciones: observaciones || null,
          activo: true,
        },
      });
      console.warn("Initial balance created:", nuevoSaldo);

      // Crear o actualizar el saldo actual
      console.warn("Upserting current balance with Prisma...");
      await prisma.saldo.upsert({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id,
            moneda_id,
          },
        },
        update: {
          cantidad,
          billetes: billetesNum ?? 0,
          monedas_fisicas: monedasNum ?? 0,
        },
        create: {
          punto_atencion_id,
          moneda_id,
          cantidad,
          billetes: billetesNum ?? 0,
          monedas_fisicas: monedasNum ?? 0,
        },
      });
      console.warn("Current balance upserted successfully");

      const response = { success: true, saldo: nuevoSaldo };
      console.warn("Sending success response:", response);
      res.json(response);
    } catch (error) {
      console.error("=== SALDOS INICIALES POST ERROR ===");
      console.error("Error details:", error);
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack"
      );

      // Manejo fino de errores Prisma
      const code = (error as any)?.code;
      if (code === "P2002") {
        return res.status(409).json({
          success: false,
          error: "Saldo inicial ya existe (conflicto de unicidad)",
        });
      }
      if (code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "Referencia inválida (punto o moneda inexistente)",
        });
      }
      if (code === "P2025") {
        return res
          .status(404)
          .json({ success: false, error: "Registro no encontrado" });
      }

      const errorResponse = {
        success: false,
        error: "Error interno del servidor",
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== SALDOS INICIALES POST END ===");
    }
  }
);

export default router;
