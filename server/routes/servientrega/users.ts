import express from "express";
import { ServientregaDBService } from "../../services/servientregaDBService.js";

const router = express.Router();

// =============================
// 👤 Búsqueda de Remitentes y Destinatarios
// =============================

router.get("/remitente/buscar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    
    if (!cedula || cedula.length < 2) {
      return res.status(400).json({ error: "La cédula debe tener al menos 2 caracteres" });
    }

    const dbService = new ServientregaDBService();
    const remitentes = await dbService.buscarRemitentes(cedula);
    
    res.json({ remitentes });
  } catch (error) {
    console.error("Error al buscar remitente:", error);
    res.status(500).json({ 
      error: "Error al buscar remitente",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

router.get("/destinatario/buscar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    
    if (!cedula || cedula.length < 2) {
      return res.status(400).json({ error: "La cédula debe tener al menos 2 caracteres" });
    }

    const dbService = new ServientregaDBService();
    const destinatarios = await dbService.buscarDestinatarios(cedula);
    
    res.json({ destinatarios });
  } catch (error) {
    console.error("Error al buscar destinatario:", error);
    res.status(500).json({ 
      error: "Error al buscar destinatario",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

router.get("/destinatario/buscar-nombre/:nombre", async (req, res) => {
  try {
    const { nombre } = req.params;
    
    if (!nombre || nombre.length < 2) {
      return res.status(400).json({ error: "El nombre debe tener al menos 2 caracteres" });
    }

    const dbService = new ServientregaDBService();
    const destinatarios = await dbService.buscarDestinatariosPorNombre(nombre);
    
    res.json({ destinatarios });
  } catch (error) {
    console.error("Error al buscar destinatario por nombre:", error);
    res.status(500).json({ 
      error: "Error al buscar destinatario por nombre",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

// =============================
// 💾 Guardar y Actualizar Remitentes/Destinatarios
// =============================

router.post("/remitente/guardar", async (req, res) => {
  try {
    const dbService = new ServientregaDBService();
    const remitente = await dbService.guardarRemitente(req.body);
    
    res.json({ 
      success: true, 
      remitente,
      message: "Remitente guardado correctamente" 
    });
  } catch (error) {
    console.error("Error al guardar remitente:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al guardar remitente",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

router.put("/remitente/actualizar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const updateData = req.body;
    
    if (!cedula) {
      return res.status(400).json({ error: "La cédula es requerida" });
    }
    
    console.log(`📝 Actualizando remitente con cédula: ${cedula}`);
    console.log(`📋 Datos a actualizar:`, updateData);
    
    const dbService = new ServientregaDBService();
    const remitente = await dbService.actualizarRemitente(cedula, updateData);
    
    res.json({ 
      success: true, 
      remitente,
      message: "Remitente actualizado correctamente"
    });
  } catch (error) {
    console.error("Error al actualizar remitente:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al actualizar remitente",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

router.post("/destinatario/guardar", async (req, res) => {
  try {
    console.log(`📝 Guardando nuevo destinatario:`, req.body);

    const dbService = new ServientregaDBService();
    const destinatario = await dbService.guardarDestinatario(req.body);

    console.log(`✅ Destinatario guardado correctamente:`, destinatario);

    res.json({
      success: true,
      destinatario,
      message: "Destinatario guardado correctamente",
    });
  } catch (error) {
    console.error("❌ Error al guardar destinatario:", error);
    console.error("📋 Stack trace:", error instanceof Error ? error.stack : "No stack trace");

    res.status(500).json({
      success: false,
      error: "Error al guardar destinatario",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.put("/destinatario/actualizar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const updateData = req.body;

    if (!cedula) {
      return res.status(400).json({ error: "La cédula es requerida" });
    }

    console.log(`📝 Actualizando destinatario con cédula: ${cedula}`);
    console.log(`📋 Datos a actualizar:`, updateData);

    const dbService = new ServientregaDBService();
    const destinatario = await dbService.actualizarDestinatario(cedula, updateData);

    console.log(`✅ Destinatario actualizado correctamente:`, destinatario);

    res.json({
      success: true,
      destinatario,
      message: "Destinatario actualizado correctamente",
    });
  } catch (error) {
    console.error("❌ Error al actualizar destinatario:", error);
    console.error("📋 Stack trace:", error instanceof Error ? error.stack : "No stack trace");

    const statusCode = error instanceof Error && error.message === "Destinatario no encontrado" ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar destinatario",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export { router as usersRouter };