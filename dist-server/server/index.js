import dotenv from "dotenv";
import fs from "fs";
// Cargar variables de entorno según el entorno
if (fs.existsSync(".env.local")) {
    console.log("Cargando variables de entorno desde .env.local");
    dotenv.config({ path: ".env.local" });
}
else if (fs.existsSync(".env.production")) {
    console.log("Cargando variables de entorno desde .env.production");
    dotenv.config({ path: ".env.production" });
}
else {
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
import currencyBehaviorRoutes from "./routes/currency-behavior.js";
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
import contabilidadDiariaRoutes from "./routes/contabilidad-diaria.js";
import permissionRoutes from "./routes/permissions.js";
import historialSaldoRoutes from "./routes/historial-saldo.js";
// Nuevas rutas: Servicios Externos
import serviciosExternosRoutes from "./routes/servicios-externos.js";
import guardarCierreRoutes from "./routes/guardar-cierre.js";
import balanceCompletoRoutes from "./routes/balance-completo.js";
const app = express();
const PORT = Number(process.env.PORT) || 3001;
// MUY IMPORTANTE cuando hay LB / proxy (GCP / Nginx / Ingress)
app.set("trust proxy", 1);
// ===== Rate limiting =====
// Genera una “clave” por usuario si existe (mejor que por IP del LB)
const keyGenerator = (req) => {
    // Si tu middleware de auth adjunta user en req (p.ej. req.user.id), úsalo:
    // @ts-ignore
    const userId = req.user?.id || req.userId;
    if (userId)
        return `user:${userId}`;
    // Usa el token para diferenciar (sin guardar PII)
    const auth = req.get("authorization");
    if (auth)
        return `auth:${auth}`;
    // Fallback a IP (ya confiable por trust proxy)
    return `ip:${req.ip}`;
};
// Handler 429 que incluye Retry-After (tu front lo usa para backoff)
const rateLimit429Handler = (_req, res, _next, options) => {
    const retryAfterSec = Math.ceil((options.windowMs ?? 60_000) / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(options.statusCode ?? 429).json({
        error: "Too Many Requests",
        message: "Too many requests from this source. Please try again later.",
        retryAfterSeconds: retryAfterSec,
        timestamp: new Date().toISOString(),
    });
};
// Rutas a excluir del limitador global
const excludedPaths = [
    "/health",
    "/api/auth/verify",
    "/api/exchanges",
    "/api/transfers",
    "/api/servientrega",
];
// Limiter global (más permisivo y con keyGenerator por user/token)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 2000,
    standardHeaders: true, // RateLimit-* headers
    legacyHeaders: false,
    keyGenerator,
    handler: rateLimit429Handler,
    skip: (req) => excludedPaths.some((p) => req.path.startsWith(p)),
});
// Limiter relajado para endpoints muy usados en el panel
const relaxedLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 6000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: rateLimit429Handler,
});
app.use(globalLimiter);
// Middleware
app.use(helmet({
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
}));
app.use(cors({
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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Expires",
        "Cache-Control",
        "Pragma",
        "X-Requested-With",
        "Accept",
        "X-Client-Time",
        "x-client-time",
    ],
    exposedHeaders: [
        "Content-Length",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "Retry-After",
    ],
    maxAge: 86400, // cache preflight 24h
}));
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
app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
// Rate limit status endpoint
app.get("/api/rate-limit-status", (req, res) => {
    const rateLimitHeaders = {
        limit: res.get("X-RateLimit-Limit") || res.get("RateLimit-Limit"),
        remaining: res.get("X-RateLimit-Remaining") || res.get("RateLimit-Remaining"),
        reset: res.get("X-RateLimit-Reset") || res.get("RateLimit-Reset"),
    };
    res.json({
        status: "OK",
        rateLimit: rateLimitHeaders,
        clientIP: req.ip,
        timestamp: new Date().toISOString(),
    });
});
// ===== API Routes =====
// Rutas con uso intensivo en panel: aplicar relaxedLimiter ANTES de las rutas
app.use("/api/users", relaxedLimiter, userRoutes);
app.use("/api/points", relaxedLimiter, pointRoutes);
app.use("/api/transfer-approvals", relaxedLimiter, transferApprovalRoutes);
// Resto de rutas
app.use("/api/auth", authRoutes);
app.use("/api/currencies", currencyRoutes);
app.use("/api/currencies", currencyBehaviorRoutes);
app.use("/api/balances", balanceRoutes);
app.use("/api/transfers", transferRoutes);
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
app.use("/api/contabilidad-diaria", contabilidadDiariaRoutes);
app.use("/api/historial-saldo", historialSaldoRoutes);
app.use("/api/servicios-externos", serviciosExternosRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/guardar-cierre", guardarCierreRoutes);
app.use("/api/balance-completo", balanceCompletoRoutes);
// ------- Frontend estático (serve SPA build) -------
try {
    const frontendDistPath = path.join(__dirname, "..", "dist");
    const indexPath = path.join(frontendDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
        // 1) Servir /assets primero (CSS/JS generados por Vite) para evitar que el fallback devuelva HTML
        app.use("/assets", express.static(path.join(frontendDistPath, "assets"), {
            immutable: true,
            maxAge: "1y",
            setHeaders: (res) => {
                res.setHeader("X-Content-Type-Options", "nosniff");
            },
        }));
        // 2) Servir otros archivos estáticos (favicon, manifest, index.html, etc.)
        app.use(express.static(frontendDistPath, {
            setHeaders: (res) => {
                res.setHeader("X-Content-Type-Options", "nosniff");
                res.setHeader("X-Frame-Options", "SAMEORIGIN");
                // CSP adecuado para el build
                res.setHeader("Content-Security-Policy", "default-src 'self' data: http: https:; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:;");
            },
        }));
        // 3) Fallback SPA: devolver index.html para todo excepto /api, /assets y /health
        app.get(/^\/(?!api|assets\/|health).*$/, (_req, res) => {
            res.sendFile(indexPath);
        });
        logger.info(`Frontend estático habilitado desde: ${frontendDistPath}`);
    }
    else {
        logger.warn("No se encontró dist/index.html; frontend estático deshabilitado");
    }
}
catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Error configurando frontend estático", { error: msg });
}
// Error handling middleware
app.use((err, req, res, _next) => {
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
});
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
    logger.info(`Server running on port ${PORT} and accessible on all interfaces`);
});
export default app;
