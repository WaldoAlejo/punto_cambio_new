import express from "express";
import { authenticateTokenDebug } from "../middleware/authDebug.js";
import { requireRole } from "../middleware/auth.js";
import { reportController } from "../controllers/reportController.js";

const router = express.Router();

// Endpoint para generar reportes con middleware de debug
router.post("/", authenticateTokenDebug, requireRole(["ADMIN", "SUPER_USUARIO"]), reportController.generateReport);

export default router;
