// Script de prueba para validar funcionalidades de saldos Servientrega
// Este script debe ejecutarse con Node.js para probar las APIs

const API_BASE = "http://34.70.184.11:3001/api";

// Función para hacer peticiones HTTP
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { error: error.message };
  }
}

// Función para autenticarse y obtener token
async function authenticate() {
  console.log("🔐 Intentando autenticación...");

  const result = await makeRequest(`${API_BASE}/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      username: "admin", // Cambiar por credenciales válidas
      password: "admin123", // Cambiar por credenciales válidas
    }),
  });

  if (result.data?.token) {
    console.log("✅ Autenticación exitosa");
    return result.data.token;
  } else {
    console.log("❌ Error en autenticación:", result);
    return null;
  }
}

// Función para probar obtención de puntos de atención
async function testPuntosAtencion(token) {
  console.log("\n📍 Probando obtención de puntos de atención...");

  const result = await makeRequest(
    `${API_BASE}/servientrega/remitente/puntos`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (result.status === 200) {
    console.log("✅ Puntos de atención obtenidos correctamente");
    console.log(`📊 Total de puntos: ${result.data.puntos?.length || 0}`);
    return result.data.puntos || [];
  } else {
    console.log("❌ Error al obtener puntos de atención:", result);
    return [];
  }
}

// Función para probar obtención de saldo
async function testObtenerSaldo(token, puntoId) {
  console.log(`\n💰 Probando obtención de saldo para punto ${puntoId}...`);

  const result = await makeRequest(
    `${API_BASE}/servientrega/saldo/${puntoId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (result.status === 200) {
    console.log("✅ Saldo obtenido correctamente");
    console.log(`💵 Saldo disponible: $${result.data.disponible || 0}`);
    console.log(`📊 Monto total: $${result.data.monto_total || 0}`);
    console.log(`📊 Monto usado: $${result.data.monto_usado || 0}`);
    return result.data;
  } else {
    console.log("❌ Error al obtener saldo:", result);
    return null;
  }
}

// Función para probar historial de saldos
async function testHistorialSaldos(token) {
  console.log("\n📋 Probando obtención de historial de saldos...");

  const result = await makeRequest(`${API_BASE}/servientrega/saldo/historial`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (result.status === 200) {
    console.log("✅ Historial obtenido correctamente");
    if (Array.isArray(result.data)) {
      console.log(`📊 Total de registros: ${result.data.length}`);
      if (result.data.length > 0) {
        console.log("📝 Primer registro:", {
          punto: result.data[0].punto_nombre,
          disponible: result.data[0].disponible,
          fecha: result.data[0].created_at,
        });
      }
    } else {
      console.log("⚠️ El historial no es un array:", typeof result.data);
    }
    return result.data;
  } else {
    console.log("❌ Error al obtener historial:", result);
    return [];
  }
}

// Función para probar solicitudes de saldo
async function testSolicitudesSaldo(token) {
  console.log("\n📋 Probando obtención de solicitudes de saldo...");

  const result = await makeRequest(
    `${API_BASE}/servientrega/solicitar-saldo/listar`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (result.status === 200) {
    console.log("✅ Solicitudes obtenidas correctamente");
    console.log("📊 Respuesta completa:", result.data);

    if (result.data && Array.isArray(result.data.solicitudes)) {
      console.log(`📊 Total de solicitudes: ${result.data.solicitudes.length}`);
      const pendientes = result.data.solicitudes.filter(
        (s) => s.estado === "PENDIENTE"
      );
      console.log(`⏳ Solicitudes pendientes: ${pendientes.length}`);
    } else if (Array.isArray(result.data)) {
      console.log(
        `📊 Total de solicitudes (array directo): ${result.data.length}`
      );
    } else {
      console.log("⚠️ Las solicitudes no tienen el formato esperado");
    }
    return result.data;
  } else {
    console.log("❌ Error al obtener solicitudes:", result);
    return [];
  }
}

// Función para probar creación de solicitud de saldo
async function testCrearSolicitudSaldo(token, puntoId) {
  console.log(
    `\n📝 Probando creación de solicitud de saldo para punto ${puntoId}...`
  );

  const solicitudData = {
    punto_atencion_id: puntoId,
    monto_solicitado: 100.0,
    observaciones: "Solicitud de prueba desde script de validación",
    creado_por: "Script de prueba",
  };

  const result = await makeRequest(`${API_BASE}/servientrega/solicitar-saldo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(solicitudData),
  });

  if (result.status === 200) {
    console.log("✅ Solicitud creada correctamente");
    console.log(`📝 ID de solicitud: ${result.data.solicitud?.id}`);
    console.log(
      `💰 Monto solicitado: $${result.data.solicitud?.monto_requerido}`
    );
    return result.data.solicitud;
  } else {
    console.log("❌ Error al crear solicitud:", result);
    return null;
  }
}

// Función para probar gestión de saldo (solo admin)
async function testGestionarSaldo(token, puntoId) {
  console.log(`\n💰 Probando gestión de saldo para punto ${puntoId}...`);

  const saldoData = {
    punto_atencion_id: puntoId,
    monto_total: 500.0,
    creado_por: "Script de prueba",
  };

  const result = await makeRequest(`${API_BASE}/servientrega/saldo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(saldoData),
  });

  if (result.status === 200) {
    console.log("✅ Saldo gestionado correctamente");
    console.log(`💰 Nuevo monto total: $${result.data.saldo?.monto_total}`);
    console.log(`💵 Monto usado: $${result.data.saldo?.monto_usado}`);
    return result.data.saldo;
  } else {
    console.log("❌ Error al gestionar saldo:", result);
    return null;
  }
}

// Función principal
async function main() {
  console.log("🚀 Iniciando pruebas de saldos Servientrega...\n");

  // Autenticación
  const token = await authenticate();
  if (!token) {
    console.log(
      "❌ No se pudo obtener token de autenticación. Terminando pruebas."
    );
    return;
  }

  // Obtener puntos de atención
  const puntos = await testPuntosAtencion(token);
  if (puntos.length === 0) {
    console.log(
      "❌ No hay puntos de atención disponibles. Terminando pruebas."
    );
    return;
  }

  const primerPunto = puntos[0];
  console.log(
    `\n🎯 Usando punto de prueba: ${primerPunto.nombre} (ID: ${primerPunto.id})`
  );

  // Probar funcionalidades de saldo
  await testObtenerSaldo(token, primerPunto.id);
  await testHistorialSaldos(token);
  await testSolicitudesSaldo(token);

  // Probar creación de solicitud
  await testCrearSolicitudSaldo(token, primerPunto.id);

  // Probar gestión de saldo (requiere permisos de admin)
  await testGestionarSaldo(token, primerPunto.id);

  // Verificar cambios
  console.log("\n🔄 Verificando cambios después de las operaciones...");
  await testObtenerSaldo(token, primerPunto.id);
  await testSolicitudesSaldo(token);

  console.log("\n🏁 Pruebas de saldos Servientrega completadas");
}

// Ejecutar si es llamado directamente
if (typeof window === "undefined") {
  // Estamos en Node.js
  main().catch(console.error);
} else {
  // Estamos en el navegador
  console.log("Este script debe ejecutarse en Node.js");
}

// Exportar para uso en otros archivos
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    authenticate,
    testPuntosAtencion,
    testObtenerSaldo,
    testHistorialSaldos,
    testSolicitudesSaldo,
    testCrearSolicitudSaldo,
    testGestionarSaldo,
  };
}
