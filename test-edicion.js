// Script de prueba para validar funcionalidades de edición
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

  const result = await makeRequest(`${API_BASE}/puntos-atencion`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (result.status === 200) {
    console.log("✅ Puntos de atención obtenidos correctamente");
    console.log(`📊 Total de puntos: ${result.data.puntos?.length || 0}`);
    return result.data.puntos;
  } else {
    console.log("❌ Error al obtener puntos de atención:", result);
    return [];
  }
}

// Función para probar obtención de usuarios
async function testUsuarios(token) {
  console.log("\n👤 Probando obtención de usuarios...");

  const result = await makeRequest(`${API_BASE}/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (result.status === 200) {
    console.log("✅ Usuarios obtenidos correctamente");
    console.log(`📊 Total de usuarios: ${result.data.users?.length || 0}`);
    return result.data.users;
  } else {
    console.log("❌ Error al obtener usuarios:", result);
    return [];
  }
}

// Función para probar actualización de punto de atención
async function testActualizarPunto(token, puntos) {
  if (!puntos || puntos.length === 0) {
    console.log("⚠️ No hay puntos de atención para probar actualización");
    return;
  }

  console.log("\n📝 Probando actualización de punto de atención...");

  const punto = puntos[0];
  const updateData = {
    nombre: punto.nombre + " (Actualizado)",
    direccion: punto.direccion,
    ciudad: punto.ciudad,
    provincia: punto.provincia,
    telefono: punto.telefono,
    email: punto.email,
    activo: punto.activo,
  };

  const result = await makeRequest(`${API_BASE}/puntos-atencion/${punto.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updateData),
  });

  if (result.status === 200) {
    console.log("✅ Punto de atención actualizado correctamente");
    console.log(`📝 Nombre actualizado: ${result.data.punto?.nombre}`);
  } else {
    console.log("❌ Error al actualizar punto de atención:", result);
  }
}

// Función para probar actualización de usuario
async function testActualizarUsuario(token, usuarios) {
  if (!usuarios || usuarios.length === 0) {
    console.log("⚠️ No hay usuarios para probar actualización");
    return;
  }

  console.log("\n👤 Probando actualización de usuario...");

  const usuario =
    usuarios.find((u) => u.rol !== "SUPER_USUARIO") || usuarios[0];
  const updateData = {
    nombre: usuario.nombre + " (Actualizado)",
    correo: usuario.correo,
    telefono: usuario.telefono,
    rol: usuario.rol,
    punto_atencion_id: usuario.punto_atencion_id,
  };

  const result = await makeRequest(`${API_BASE}/users/${usuario.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updateData),
  });

  if (result.status === 200) {
    console.log("✅ Usuario actualizado correctamente");
    console.log(`📝 Nombre actualizado: ${result.data.user?.nombre}`);
  } else {
    console.log("❌ Error al actualizar usuario:", result);
  }
}

// Función para probar remitentes de Servientrega
async function testRemitentesServientrega(token) {
  console.log("\n📦 Probando búsqueda de remitentes Servientrega...");

  const result = await makeRequest(
    `${API_BASE}/servientrega/remitente/buscar/1234567890`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (result.status === 200) {
    console.log("✅ Búsqueda de remitentes funcionando");
    console.log(
      `📊 Remitentes encontrados: ${result.data.remitentes?.length || 0}`
    );
  } else {
    console.log("❌ Error al buscar remitentes:", result);
  }
}

// Función para probar puntos de Servientrega
async function testPuntosServientrega(token) {
  console.log("\n📍 Probando obtención de puntos Servientrega...");

  const result = await makeRequest(
    `${API_BASE}/servientrega/remitente/puntos`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (result.status === 200) {
    console.log("✅ Puntos de Servientrega obtenidos correctamente");
    console.log(`📊 Total de puntos: ${result.data.puntos?.length || 0}`);
  } else {
    console.log("❌ Error al obtener puntos Servientrega:", result);
  }
}

// Función principal
async function main() {
  console.log("🚀 Iniciando pruebas de funcionalidades de edición...\n");

  // Autenticación
  const token = await authenticate();
  if (!token) {
    console.log(
      "❌ No se pudo obtener token de autenticación. Terminando pruebas."
    );
    return;
  }

  // Probar puntos de atención
  const puntos = await testPuntosAtencion(token);

  // Probar usuarios
  const usuarios = await testUsuarios(token);

  // Probar actualización de punto de atención
  await testActualizarPunto(token, puntos);

  // Probar actualización de usuario
  await testActualizarUsuario(token, usuarios);

  // Probar funcionalidades de Servientrega
  await testRemitentesServientrega(token);
  await testPuntosServientrega(token);

  console.log("\n🏁 Pruebas completadas");
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
    testUsuarios,
    testActualizarPunto,
    testActualizarUsuario,
    testRemitentesServientrega,
    testPuntosServientrega,
  };
}
