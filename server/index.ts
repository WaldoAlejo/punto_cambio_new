import dotenv from "dotenv";
dotenv.config({ path: ".env.production" });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import logger from "./utils/logger.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import pointRoutes from "./routes/points.js";
import currencyRoutes from "./routes/currencies.js";
import balanceRoutes from "./routes/balances.js";
import transferRoutes from "./routes/transfers.js";
import transferApprovalRoutes from "./routes/transfer-approvals.js";
import exchangeRoutes from "./routes/exchanges.js";
import scheduleRoutes from "./routes/schedules.js";
import spontaneousExitRoutes from "./routes/spontaneous-exits.js";
import reportRoutes from "./routes/reports.js";
import cuadreCajaRoutes from "./routes/cuadreCaja.js";
import activePointsRoutes from "./routes/activePoints.js";
import saldosInicialesRoutes from "./routes/saldos-iniciales.js";
import vistaSaldosRoutes from "./routes/vista-saldos-puntos.js";
import movimientosSaldoRoutes from "./routes/movimientos-saldo.js";
import servientregaRoutes from "./routes/servientrega.js";

const app = express();
const PORT: number = Number(process.env.PORT) || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:8080",
      "http://35.238.95.118:8080", // IP pública frontend puerto 8080
      "http://35.238.95.118", // IP pública frontend puerto 80
    ],
    credentials: true,
  })
);
app.use(limiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/points", pointRoutes);
app.use("/api/currencies", currencyRoutes);
app.use("/api/balances", balanceRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/transfer-approvals", transferApprovalRoutes);
app.use("/api/exchanges", exchangeRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/spontaneous-exits", spontaneousExitRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/cuadre-caja", cuadreCajaRoutes);
app.use("/api/active-points", activePointsRoutes);
app.use("/api/saldos-iniciales", saldosInicialesRoutes);
app.use("/api/vista-saldos-puntos", vistaSaldosRoutes);
app.use("/api/movimientos-saldo", movimientosSaldoRoutes);
app.use("/api/servientrega", servientregaRoutes);

// Error handling middleware
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const error = err instanceof Error ? err : new Error("Unknown error");

    logger.error("Unhandled error", {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
