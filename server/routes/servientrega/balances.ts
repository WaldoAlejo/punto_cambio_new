import express from "express";
import { ServientregaDBService } from "../../services/servientregaDBService.js";

const router = express.Router();

// =============================
// 💰 Gestión de Saldos
// =============================

router.get("/saldo/historial", async (_, res) => {
  try {
    const dbService = new ServientregaDBService();
    const historial = await dbService.obtenerHistorialSaldos();
    
    res.json(historial);
  } catch (error) {
    console.error("Error al obtener historial Servientrega:", error);
    res.status(500).json({ 
      error: "Error al obtener historial",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

router.get("/saldo/:puntoAtencionId", async (req, res) => {
  try {
    const { puntoAtencionId } = req.params;
    
    if (!puntoAtencionId) {
      return res.status(400).json({ error: "El ID del punto de atención es requerido" });
    }

    const dbService = new ServientregaDBService();
    const saldo = await dbService.obtenerSaldo(puntoAtencionId);

    if (!saldo) {
      return res.json({ disponible: 0 });
    }

    const disponible = saldo.monto_total.sub(saldo.monto_usado);
    res.json({ 
      disponible: disponible.toNumber(),
      monto_total: saldo.monto_total.toNumber(),
      monto_usado: saldo.monto_usado.toNumber()
    });
  } catch (error) {
    console.error("Error al obtener saldo:", error);
    res.status(500).json({ 
      error: "Error al obtener saldo",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

router.post("/saldo", async (req, res) => {
  try {
    const { monto_total, creado_por, punto_atencion_id } = req.body;

    // Validaciones
    if (!punto_atencion_id) {
      return res.status(400).json({ error: "El ID del punto de atención es requerido" });
    }

    if (!monto_total || isNaN(parseFloat(monto_total))) {
      return res.status(400).json({ error: "El monto total debe ser un número válido" });
    }

    const dbService = new ServientregaDBService();
    const resultado = await dbService.gestionarSaldo({
      punto_atencion_id,
      monto_total: parseFloat(monto_total),
      creado_por
    });

    res.json({ 
      success: true, 
      saldo: {
        ...resultado,
        monto_total: resultado.monto_total.toNumber(),
        monto_usado: resultado.monto_usado.toNumber()
      }
    });
  } catch (error) {
    console.error("Error al gestionar saldo:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al gestionar saldo",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

export { router as balancesRouter };