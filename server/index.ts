import dotenv from "dotenv";
import fs from "fs";

// Cargar variables de entorno según el entorno
if (fs.existsSync(".env.local")) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: ".env.local" });
} else if (fs.existsSync(".env.production")) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: ".env.production" });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config();
}

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import saldosActualesRoutes from "./routes/saldos-actuales.js";
import movimientosContablesRoutes from "./routes/movimientos-contables.js";
import servientregaRoutes from "./routes/servientrega.js";
import puntosAtencionRoutes from "./routes/puntos-atencion.js";

const app = express();
const PORT: number = Number(process.env.PORT) || 3001;

// Rate limiting - Configuración más permisiva para aplicación interna
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 peticiones por IP en 15 minutos (más permisivo)
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Incluir headers de rate limit
  legacyHeaders: false, // Deshabilitar headers legacy
  skip: (req) => {
    // Excluir rutas críticas del rate limiting
    const excludedPaths = [
      "/health",
      "/api/auth/verify",
      "/api/exchanges",
      "/api/transfers",
      "/api/servientrega",
    ];
    return excludedPaths.some((path) => req.path.startsWith(path));
  },
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginOpenerPolicy: false, // Deshabilitar COOP para HTTP
    hsts: false, // Deshabilitar HSTS para permitir HTTP
    originAgentCluster: false, // Deshabilitar Origin-Agent-Cluster header
  })
);
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8080",
      "http://34.70.184.11:3001", // IP pública puerto 3001 (producción)
      "http://34.70.184.11:8080", // IP pública frontend puerto 8080
      "http://34.70.184.11", // IP pública frontend puerto 80
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

// Rate limit status endpoint
app.get("/api/rate-limit-status", (req, res) => {
  const rateLimitHeaders = {
    limit: res.get("X-RateLimit-Limit"),
    remaining: res.get("X-RateLimit-Remaining"),
    reset: res.get("X-RateLimit-Reset"),
  };

  res.json({
    status: "OK",
    rateLimit: rateLimitHeaders,
    clientIP: req.ip,
    timestamp: new Date().toISOString(),
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
app.use("/api/saldos-actuales", saldosActualesRoutes);
app.use("/api/movimientos-contables", movimientosContablesRoutes);
app.use("/api/servientrega", servientregaRoutes);
app.use("/api/puntos-atencion", puntosAtencionRoutes);

// Servir archivos estáticos del frontend en producción
if (process.env.NODE_ENV === "production") {
  const frontendDistPath = path.join(__dirname, "..", "dist");

  // Servir archivos estáticos con headers específicos
  app.use(
    express.static(frontendDistPath, {
      setHeaders: (res, path) => {
        // Evitar que el navegador fuerce HTTPS
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https:;"
        );
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
      },
    })
  );

  // Manejar rutas SPA - todas las rutas no-API deben servir index.html
  app.get("*", (req, res, next) => {
    // Si es una ruta de API, continuar con el siguiente middleware
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      return next();
    }

    // Para todas las demás rutas, servir index.html
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

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

// 404 handler solo para rutas de API
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: "API route not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  logger.info(
    `Server running on port ${PORT} and accessible on all interfaces`
  );
});

export default app;
