import express from "express";
import { authenticateTokenDebug } from "../middleware/authDebug.js";
import { reportController } from "../controllers/reportController.js";
const router = express.Router();
// Endpoint para generar reportes con middleware de debug
router.post("/", authenticateTokenDebug, reportController.generateReport);
export default router;
