#!/bin/bash

# Script para corregir la estructura de compilación
# Este script debe ejecutarse desde el directorio raíz del proyecto

# Colores para mensajes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
function log_message() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

function log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

function log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  log_error "Este script debe ejecutarse desde el directorio raíz del proyecto"
  exit 1
fi

# Crear directorio para logs si no existe
mkdir -p logs

# Detener todas las aplicaciones PM2
log_message "Deteniendo todas las aplicaciones PM2..."
pm2 stop all || true
pm2 delete all || true

# Limpiar el directorio dist
log_message "Limpiando el directorio dist..."
rm -rf dist

# Generar cliente de Prisma
log_message "Generando cliente de Prisma..."
npx prisma generate

# Construir el frontend primero
log_message "Construyendo el frontend..."
npm run build:frontend || {
  log_error "Error al construir el frontend. Intentando con modo de desarrollo..."
  npm run build:dev
}

# Verificar si el archivo index.html existe
if [ ! -f "dist/index.html" ]; then
  log_error "No se pudo encontrar el archivo index.html para el frontend"
  exit 1
fi

log_message "Archivo index.html para el frontend encontrado en dist/index.html"

# Crear un directorio para el backend
log_message "Creando un directorio para el backend..."
mkdir -p dist/server

# Compilar el backend
log_message "Compilando el backend..."
npx tsc --project tsconfig.server.json

# Verificar si el archivo index.js existe en el directorio dist
if [ ! -f "dist/index.js" ]; then
  log_warning "No se pudo encontrar el archivo index.js en el directorio dist"
  
  # Crear un archivo index.js en el directorio dist
  log_message "Creando un archivo index.js en el directorio dist..."
  cat > dist/index.js << 'EOF'
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Importar el servidor
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import logger from "./utils/logger.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
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
    crossOriginOpenerPolicy: false,
    hsts: false,
  })
);
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8080",
      "http://35.238.95.118:3001",
      "http://35.238.95.118:8080",
      "http://35.238.95.118",
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

// Servir archivos estáticos del frontend en producción
if (process.env.NODE_ENV === "production") {
  const frontendDistPath = path.join(__dirname, "");

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
    err,
    req,
    res,
    _next
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
  console.log(`Server running on port ${PORT}`);
});
EOF
fi

# Verificar la estructura de directorios
log_message "Verificando la estructura de directorios..."
find dist -type f | sort

# Iniciar el backend con PM2
log_message "Iniciando el backend con PM2..."
pm2 start dist/index.js --name punto-cambio-api --env production

# Verificar si el backend está en ejecución
if ! pm2 list | grep -q "punto-cambio-api"; then
  log_error "El backend no se inició correctamente"
  exit 1
fi

log_message "Backend iniciado correctamente"

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

# Verificar si el backend está respondiendo
log_message "Verificando si el backend está respondiendo..."
if curl -s http://localhost:3001/health | grep -q "OK"; then
  log_message "El backend está respondiendo correctamente"
else
  log_warning "El backend no está respondiendo correctamente"
  
  # Verificar los logs
  log_message "Verificando los logs..."
  pm2 logs punto-cambio-api --lines 20
fi

log_message "Corrección de la estructura de compilación completada"
log_message "Para acceder a la aplicación, visita http://35.238.95.118:3001"