// Script de prueba para Servientrega
const axios = require("axios");
const https = require("https");

const BASE_URL =
  "https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php";
const AUTH = {
  usuingreso: "INTPUNTOC",
  contrasenha: "73Yes7321t",
};

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function testServientrega() {
  console.log("🧪 Probando conexión con Servientrega...");

  try {
    const { data } = await axios.post(
      BASE_URL,
      {
        tipo: "obtener_producto",
        ...AUTH,
      },
      {
        headers: { "Content-Type": "application/json" },
        httpsAgent,
        timeout: 15000,
      }
    );

    console.log("✅ Conexión exitosa!");
    console.log("📦 Productos disponibles:");
    console.log(JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("📄 Respuesta:", error.response.data);
    }
    throw error;
  }
}

// Ejecutar prueba
testServientrega()
  .then(() => {
    console.log("🎉 Prueba completada exitosamente");
    process.exit(0);
  })
  .catch(() => {
    console.log("💥 Prueba falló");
    process.exit(1);
  });
