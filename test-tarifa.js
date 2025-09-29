#!/usr/bin/env node

/**
 * Script de prueba para el endpoint de tarifa de Servientrega
 * Uso: node test-tarifa.js [URL_BASE]
 *
 * Ejemplo:
 * node test-tarifa.js http://localhost:3001
 * node test-tarifa.js http://34.70.184.11:3001
 */

const axios = require("axios");

const BASE_URL = process.argv[2] || "http://localhost:3001";
const ENDPOINT = `${BASE_URL}/api/servientrega/tarifa`;

const testPayload = {
  tipo: "obtener_tarifa_nacional",
  ciu_ori: "GUAYAQUIL",
  provincia_ori: "GUAYAS",
  ciu_des: "QUITO",
  provincia_des: "PICHINCHA",
  valor_seguro: "100.00",
  valor_declarado: "100.00",
  peso: "2",
  alto: "10",
  ancho: "10",
  largo: "10",
  recoleccion: "NO",
  nombre_producto: "PREMIER",
  empaque: "AISLANTE DE HUMEDAD",
  usuingreso: "INTPUNTOC",
  contrasenha: "73Yes7321t",
};

async function testTarifa() {
  console.log("🚀 Iniciando prueba de tarifa...");
  console.log("📍 Endpoint:", ENDPOINT);
  console.log("📦 Payload:", JSON.stringify(testPayload, null, 2));
  console.log("⏱️ Enviando petición...\n");

  try {
    const startTime = Date.now();
    const response = await axios.post(ENDPOINT, testPayload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 segundos
    });
    const endTime = Date.now();

    console.log("✅ Respuesta exitosa!");
    console.log("⏱️ Tiempo de respuesta:", endTime - startTime, "ms");
    console.log("📊 Status:", response.status);
    console.log("📋 Headers:", JSON.stringify(response.headers, null, 2));
    console.log("📥 Data:", JSON.stringify(response.data, null, 2));

    // Analizar la respuesta
    if (Array.isArray(response.data) && response.data.length > 0) {
      const tarifa = response.data[0];
      console.log("\n💰 Análisis de tarifa:");
      console.log("  - Flete:", tarifa.flete || "N/A");
      console.log("  - Empaque:", tarifa.valor_empaque || "N/A");
      console.log("  - Prima/Seguro:", tarifa.prima || "N/A");
      console.log(
        "  - Total:",
        tarifa.total_transacion || tarifa.gtotal || "N/A"
      );
      console.log("  - Tiempo:", tarifa.tiempo || "N/A");
    }
  } catch (error) {
    console.error("❌ Error en la petición:");

    if (error.response) {
      console.error("📊 Status:", error.response.status);
      console.error(
        "📋 Headers:",
        JSON.stringify(error.response.headers, null, 2)
      );
      console.error("📥 Data:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("📡 No se recibió respuesta del servidor");
      console.error(
        "🔧 Request config:",
        JSON.stringify(error.config, null, 2)
      );
    } else {
      console.error("💥 Error:", error.message);
    }

    console.error("📋 Stack:", error.stack);
  }
}

// Ejecutar la prueba
testTarifa();
