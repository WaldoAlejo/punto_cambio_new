import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { reportController } from "../controllers/reportController.js";

const router = express.Router();

// Endpoint para generar reportes
router.post("/", authenticateToken, reportController.generateReport);

export default router;
