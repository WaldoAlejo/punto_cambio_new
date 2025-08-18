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
