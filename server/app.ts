import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "./utils/logger.js";

// Importar rutas
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import pointsRoutes from "./routes/points.js";
import currenciesRoutes from "./routes/currencies.js";
import cuadreCajaRoutes from "./routes/cuadreCaja.js";
import guardarCierreRoutes from "./routes/guardar-cierre.js";
import cierreParcialRoutes from "./routes/cierreParcial.js";

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging de cada request
app.use((req, res, next) => {
  logger.info("Request received", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/currencies", currenciesRoutes);
app.use("/api/cuadre-caja", cuadreCajaRoutes);
app.use("/api/guardar-cierre", guardarCierreRoutes);
app.use("/api/cierre-parcial", cierreParcialRoutes);

// Endpoint de salud
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Manejo de errores
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const error = err instanceof Error ? err : new Error("Error desconocido");

  logger.error("Unhandled error", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    error: "Error interno del servidor",
    success: false,
    timestamp: new Date().toISOString(),
  });
});

// Ruta no encontrada
app.use("*", (req, res) => {
  logger.warn("Route not found", {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    error: "Ruta no encontrada",
    success: false,
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`Servidor iniciado en puerto ${PORT}`, {
    port: PORT,
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

export default app;
