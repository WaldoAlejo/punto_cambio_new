import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { reportController } from "../controllers/reportController.js";

const router = express.Router();

// Endpoint para generar reportes
router.post("/", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]), reportController.generateReport);

export default router;
