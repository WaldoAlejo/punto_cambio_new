// Script para probar las rutas de la API
const API_BASE = "http://34.132.200.84:3001/api";

async function testRoute(endpoint, description) {
  try {
    console.log(`\n🔍 Probando: ${description}`);
    console.log(`📡 URL: ${API_BASE}${endpoint}`);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Respuesta exitosa:`, data);
    } else {
      const errorText = await response.text();
      console.log(`❌ Error:`, errorText);
    }
  } catch (error) {
    console.log(`💥 Error de conexión:`, error.message);
  }
}

async function runTests() {
  console.log("🚀 Iniciando pruebas de rutas API...");

  // Probar rutas básicas
  await testRoute("/health", "Health Check (sin auth)");
  await testRoute("/points", "Puntos de atención (requiere auth)");
  await testRoute("/schedules/active", "Jornada activa (requiere auth)");

  console.log("\n🎯 Pruebas completadas");
  console.log("\n📝 Notas:");
  console.log('- Las rutas con "requiere auth" fallarán con 401 sin token');
  console.log("- Esto es normal y esperado");
  console.log("- Lo importante es que no devuelvan 404");
}

// Ejecutar si se llama directamente
if (typeof window === "undefined") {
  runTests();
}

export { testRoute, runTests };
