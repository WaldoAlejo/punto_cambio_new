#!/bin/bash

# Script para verificar y corregir problemas específicos del servidor simple
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

# Verificar que el archivo simple-server.js existe
if [ ! -f "simple-server.js" ]; then
  log_error "El archivo simple-server.js no existe"
  
  # Crear el archivo simple-server.js
  log_message "Creando el archivo simple-server.js..."
  cat > simple-server.js << 'EOF'
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
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
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Verificar si existe el directorio dist
if (!fs.existsSync(path.join(__dirname, "dist"))) {
  console.log("Creando directorio dist...");
  fs.mkdirSync(path.join(__dirname, "dist"));
}

// Verificar si existe el archivo index.html
if (!fs.existsSync(path.join(__dirname, "dist", "index.html"))) {
  console.log("Creando archivo index.html...");
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Punto Cambio</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 500px;
    }
    h1 {
      color: #333;
    }
    p {
      color: #666;
      margin-bottom: 1.5rem;
    }
    .status {
      padding: 0.5rem 1rem;
      background-color: #e6f7ff;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 1rem;
    }
    .api-link {
      color: #1890ff;
      text-decoration: none;
    }
    .api-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Punto Cambio</h1>
    <div class="status">Servidor en funcionamiento</div>
    <p>El servidor está funcionando correctamente. La API está disponible en:</p>
    <a href="/api" class="api-link">/api</a>
    <p>Verifica el estado del servidor en:</p>
    <a href="/health" class="api-link">/health</a>
  </div>
</body>
</html>
  `;
  fs.writeFileSync(path.join(__dirname, "dist", "index.html"), html);
}

// Servir archivos estáticos
console.log("Serving static files from:", path.join(__dirname, "dist"));
app.use(express.static(path.join(__dirname, "dist")));

// Manejar rutas SPA
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "API route not found",
      path: req.originalUrl,
    });
  }

  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});
EOF
fi

# Verificar que el archivo package.json tiene el tipo module
if ! grep -q '"type": "module"' package.json; then
  log_warning "El archivo package.json no tiene el tipo module"
  
  # Actualizar el archivo package.json
  log_message "Actualizando el archivo package.json..."
  sed -i 's|"private": true,|"private": true,\n  "type": "module",|g' package.json
fi

# Verificar que el directorio dist existe
if [ ! -d "dist" ]; then
  log_error "El directorio dist no existe"
  log_message "Creando directorio dist..."
  mkdir -p dist
fi

# Verificar que el archivo index.html existe en dist
if [ ! -f "dist/index.html" ]; then
  log_error "El archivo dist/index.html no existe"
  
  # Crear un archivo index.html básico
  log_message "Creando un archivo index.html básico..."
  cat > dist/index.html << 'EOF'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Punto Cambio</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 500px;
    }
    h1 {
      color: #333;
    }
    p {
      color: #666;
      margin-bottom: 1.5rem;
    }
    .status {
      padding: 0.5rem 1rem;
      background-color: #e6f7ff;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 1rem;
    }
    .api-link {
      color: #1890ff;
      text-decoration: none;
    }
    .api-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Punto Cambio</h1>
    <div class="status">Servidor en funcionamiento</div>
    <p>El servidor está funcionando correctamente. La API está disponible en:</p>
    <a href="/api" class="api-link">/api</a>
    <p>Verifica el estado del servidor en:</p>
    <a href="/health" class="api-link">/health</a>
  </div>
</body>
</html>
EOF
fi

# Verificar que PM2 está instalado
if ! command -v pm2 &> /dev/null; then
  log_error "PM2 no está instalado"
  
  # Instalar PM2
  log_message "Instalando PM2..."
  npm install -g pm2
fi

# Verificar si el servidor está en ejecución
if ! pm2 list | grep -q "punto-cambio-api"; then
  log_warning "El servidor no está en ejecución"
  
  # Iniciar el servidor
  log_message "Iniciando el servidor..."
  pm2 start simple-server.js --name punto-cambio-api
  pm2 save
else
  # Reiniciar el servidor
  log_message "Reiniciando el servidor..."
  pm2 restart punto-cambio-api
fi

# Verificar que la aplicación está respondiendo
log_message "Verificando que la aplicación está respondiendo..."
curl -s http://localhost:3001/health || {
  log_error "La aplicación no está respondiendo"
  
  # Verificar los logs
  log_message "Verificando los logs..."
  pm2 logs punto-cambio-api --lines 20
  
  # Verificar los puertos en uso
  log_message "Verificando los puertos en uso..."
  netstat -tuln | grep 3001
  
  # Verificar el firewall
  log_message "Verificando el firewall..."
  sudo ufw status | grep 3001
  
  # Intentar con otro puerto
  log_message "Intentando con el puerto 8080..."
  sed -i 's|const PORT = process.env.PORT || 3001;|const PORT = process.env.PORT || 8080;|g' simple-server.js
  pm2 restart punto-cambio-api
  
  # Verificar que la aplicación está respondiendo en el puerto 8080
  log_message "Verificando que la aplicación está respondiendo en el puerto 8080..."
  curl -s http://localhost:8080/health || log_error "La aplicación no está respondiendo en el puerto 8080"
}

log_message "Verificación y corrección completadas con éxito"
log_message "Verifica los logs con: pm2 logs"