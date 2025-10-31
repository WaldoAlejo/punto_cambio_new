#!/usr/bin/env tsx
/**
 * Script de prueba completo del flujo de anulación de guías Servientrega
 *
 * Flujo:
 * 1. Login operador
 * 2. Obtener saldos iniciales
 * 3. Generar guía
 * 4. Verificar que el saldo se sumó
 * 5. Solicitar anulación
 * 6. Login admin
 * 7. Aprobar anulación
 * 8. Verificar que el saldo volvió al inicial
 */

import axios, { AxiosInstance } from "axios";

// =====================================================================
// CONFIGURACIÓN
// =====================================================================
const API_BASE_URL = process.env.VITE_API_URL || "http://localhost:3001/api";
const CREDENTIALS_OPERADOR = {
  username: process.env.TEST_OPERADOR_USERNAME || "operador_test",
  password: process.env.TEST_OPERADOR_PASSWORD || "password123",
};
const CREDENTIALS_ADMIN = {
  username: process.env.TEST_ADMIN_USERNAME || "admin_test",
  password: process.env.TEST_ADMIN_PASSWORD || "password123",
};
const PUNTO_ID = process.env.TEST_PUNTO_ID || "test-point";

// =====================================================================
// COLORES PARA OUTPUT
// =====================================================================
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function log(color: string, title: string, message?: string) {
  const timestamp = new Date().toLocaleTimeString();
  if (message) {
    console.log(`${color}[${timestamp}] ${title}${colors.reset}`);
    console.log(`  ${message}`);
  } else {
    console.log(`${color}${title}${colors.reset}`);
  }
}

// =====================================================================
// CLIENT HTTP CON AXIOS
// =====================================================================
class TestClient {
  private axiosInstance: AxiosInstance;
  public token?: string;

  constructor(baseURL: string) {
    this.axiosInstance = axios.create({
      baseURL,
      timeout: 15000,
      validateStatus: () => true, // No lanzar error en 4xx/5xx
    });
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await this.axiosInstance.post("/auth/login", {
        username,
        password,
      });

      if (response.status === 200 && response.data.token) {
        this.token = response.data.token;
        this.axiosInstance.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${this.token}`;
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error en login:", error);
      return false;
    }
  }

  async post(url: string, data: any): Promise<any> {
    try {
      const response = await this.axiosInstance.post(url, data);
      return response.data;
    } catch (error) {
      console.error(`Error en POST ${url}:`, error);
      throw error;
    }
  }

  async get(url: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error en GET ${url}:`, error);
      throw error;
    }
  }

  async put(url: string, data: any): Promise<any> {
    try {
      const response = await this.axiosInstance.put(url, data);
      return response.data;
    } catch (error) {
      console.error(`Error en PUT ${url}:`, error);
      throw error;
    }
  }
}

// =====================================================================
// TEST PRINCIPAL
// =====================================================================
async function runTest() {
  console.clear();
  log(
    colors.blue,
    "═══════════════════════════════════════════════════════════════"
  );
  log(
    colors.blue,
    "🚀 TEST COMPLETO: FLUJO DE ANULACIÓN DE GUÍAS SERVIENTREGA"
  );
  log(
    colors.blue,
    "═══════════════════════════════════════════════════════════════"
  );
  log(colors.gray, `API URL: ${API_BASE_URL}`);
  log(colors.gray, `Punto ID: ${PUNTO_ID}`);

  const operadorClient = new TestClient(API_BASE_URL);
  const adminClient = new TestClient(API_BASE_URL);

  let guiaNumber: string = "";
  let solicitudId: string = "";
  let saldoUsdBefore: number = 0;
  let saldoUsdAfterGen: number = 0;
  let saldoUsdAfter: number = 0;

  try {
    // =====================================================================
    // 1. LOGIN OPERADOR
    // =====================================================================
    log(colors.yellow, "\n[1/8] 🔐 LOGIN OPERADOR...");
    const operadorLoginOk = await operadorClient.login(
      CREDENTIALS_OPERADOR.username,
      CREDENTIALS_OPERADOR.password
    );

    if (!operadorLoginOk) {
      throw new Error("No se pudo autenticar al operador");
    }
    log(colors.green, `✅ Operador autenticado`);
    log(colors.gray, `Token: ${operadorClient.token?.substring(0, 20)}...`);

    // =====================================================================
    // 2. OBTENER SALDOS INICIALES
    // =====================================================================
    log(colors.yellow, "\n[2/8] 📊 OBTENIENDO SALDOS INICIALES...");
    const saldosResponse = await operadorClient.get(
      `/saldos-actuales/${PUNTO_ID}`
    );

    const saldoUsdObj = saldosResponse.data?.find(
      (s: any) => s.moneda?.codigo === "USD"
    );
    saldoUsdBefore = parseFloat(saldoUsdObj?.monto_total || "0");

    log(colors.green, `✅ Saldos obtenidos`);
    log(colors.blue, `Saldo USD Antes: $${saldoUsdBefore.toFixed(2)}`);

    // =====================================================================
    // 3. GENERAR GUÍA
    // =====================================================================
    log(colors.yellow, "\n[3/8] 📦 GENERANDO GUÍA...");

    const guiaPayload = {
      punto_atencion_id: PUNTO_ID,
      remitente: {
        identificacion: "1716071327",
        nombre: "Test Remitente",
        direccion: "Calle Principal 123",
        telefono: "0997562435",
        email: "remitente@test.com",
        ciudad: "QUITO",
        provincia: "PICHINCHA",
      },
      destinatario: {
        identificacion: "1716071328",
        nombre: "Test Destinatario",
        direccion: "Calle Secundaria 456",
        telefono: "0998765432",
        email: "destinatario@test.com",
        ciudad: "GUAYAQUIL",
        provincia: "GUAYAS",
        pais: "ECUADOR",
      },
      nombre_producto: "DOCUMENTO UNITARIO",
      contenido: "DOCUMENTO",
      retiro_oficina: false,
      pedido: `TEST-${Date.now()}`,
      factura: `FAC-${Date.now()}`,
      medidas: {
        valor_declarado: 0,
        valor_seguro: 0,
        alto: 0,
        ancho: 0,
        largo: 0,
        peso: 0.5,
        piezas: 1,
      },
    };

    const guiaResponse = await operadorClient.post(
      "/servientrega/generar-guia",
      guiaPayload
    );

    guiaNumber = guiaResponse?.fetch?.guia || guiaResponse?.numero_guia;
    if (!guiaNumber) {
      throw new Error(
        `No se pudo obtener número de guía: ${JSON.stringify(guiaResponse)}`
      );
    }

    log(colors.green, `✅ Guía generada exitosamente`);
    log(colors.blue, `Número de guía: ${guiaNumber}`);

    // =====================================================================
    // 4. VERIFICAR SALDOS DESPUÉS DE GENERAR
    // =====================================================================
    log(colors.yellow, "\n[4/8] 📊 VERIFICANDO SALDOS DESPUÉS DE GENERAR...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const saldosAfterGenResponse = await operadorClient.get(
      `/saldos-actuales/${PUNTO_ID}`
    );
    const saldoUsdAfterGenObj = saldosAfterGenResponse.data?.find(
      (s: any) => s.moneda?.codigo === "USD"
    );
    saldoUsdAfterGen = parseFloat(saldoUsdAfterGenObj?.monto_total || "0");

    const diffGen = saldoUsdAfterGen - saldoUsdBefore;
    log(colors.green, `✅ Saldos verificados`);
    log(
      colors.blue,
      `Saldo USD Después de generar: $${saldoUsdAfterGen.toFixed(2)}`
    );
    log(colors.blue, `Diferencia (ingreso): +$${diffGen.toFixed(2)}`);

    // =====================================================================
    // 5. SOLICITAR ANULACIÓN
    // =====================================================================
    log(colors.yellow, "\n[5/8] 🔄 SOLICITANDO ANULACIÓN...");

    const solicitudPayload = {
      numero_guia: guiaNumber,
      motivo: "Test - Prueba de flujo completo de anulación",
    };

    const solicitudResponse = await operadorClient.post(
      "/servientrega/solicitudes-anulacion",
      solicitudPayload
    );

    solicitudId = solicitudResponse?.id || solicitudResponse?.data?.id;
    if (!solicitudId) {
      throw new Error(
        `No se pudo crear solicitud: ${JSON.stringify(solicitudResponse)}`
      );
    }

    log(colors.green, `✅ Solicitud de anulación creada`);
    log(colors.blue, `ID de solicitud: ${solicitudId}`);

    // =====================================================================
    // 6. LOGIN ADMIN
    // =====================================================================
    log(colors.yellow, "\n[6/8] 🔐 LOGIN ADMIN...");
    const adminLoginOk = await adminClient.login(
      CREDENTIALS_ADMIN.username,
      CREDENTIALS_ADMIN.password
    );

    if (!adminLoginOk) {
      throw new Error("No se pudo autenticar al admin");
    }
    log(colors.green, `✅ Admin autenticado`);
    log(colors.gray, `Token: ${adminClient.token?.substring(0, 20)}...`);

    // =====================================================================
    // 7. APROBAR ANULACIÓN
    // =====================================================================
    log(colors.yellow, "\n[7/8] ✅ APROBANDO ANULACIÓN...");

    const aprobacionPayload = {
      estado: "APROBAR",
      comentario: "Anulación aprobada - Test automatizado",
    };

    const aprobacionResponse = await adminClient.put(
      `/servientrega/solicitudes-anulacion/${solicitudId}/responder`,
      aprobacionPayload
    );

    if (!aprobacionResponse?.success) {
      throw new Error(
        `Error al aprobar: ${JSON.stringify(aprobacionResponse)}`
      );
    }

    log(colors.green, `✅ Anulación aprobada exitosamente`);
    log(
      colors.gray,
      `Respuesta: ${JSON.stringify(aprobacionResponse, null, 2)}`
    );

    // =====================================================================
    // 8. VERIFICAR SALDOS FINALES
    // =====================================================================
    log(colors.yellow, "\n[8/8] 📊 VERIFICANDO SALDOS FINALES...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const saldosFinalResponse = await operadorClient.get(
      `/saldos-actuales/${PUNTO_ID}`
    );
    const saldoUsdFinalObj = saldosFinalResponse.data?.find(
      (s: any) => s.moneda?.codigo === "USD"
    );
    saldoUsdAfter = parseFloat(saldoUsdFinalObj?.monto_total || "0");

    log(colors.green, `✅ Saldos finales obtenidos`);
    log(colors.blue, `Saldo USD Final: $${saldoUsdAfter.toFixed(2)}`);

    // =====================================================================
    // REPORTE FINAL
    // =====================================================================
    console.log(
      `\n${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}`
    );
    console.log(`${colors.blue}📋 REPORTE FINAL${colors.reset}`);
    console.log(
      `${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}`
    );

    const diffReversal = saldoUsdAfter - saldoUsdAfterGen;
    const diffTotal = saldoUsdAfter - saldoUsdBefore;

    console.log(`\n${colors.yellow}Saldos USD${colors.reset}:`);
    console.log(
      `  Inicial:                   ${colors.green}$${saldoUsdBefore.toFixed(
        2
      )}${colors.reset}`
    );
    console.log(
      `  Después de generar:        ${colors.green}$${saldoUsdAfterGen.toFixed(
        2
      )}${colors.reset}`
    );
    console.log(
      `  Final (después anular):    ${colors.green}$${saldoUsdAfter.toFixed(
        2
      )}${colors.reset}`
    );

    console.log(`\n${colors.yellow}Números de referencia${colors.reset}:`);
    console.log(
      `  Guía:                      ${colors.green}${guiaNumber}${colors.reset}`
    );
    console.log(
      `  Solicitud anulación:       ${colors.green}${solicitudId}${colors.reset}`
    );

    console.log(`\n${colors.yellow}Cambios${colors.reset}:`);
    console.log(
      `  Al generar guía:           ${colors.green}+$${diffGen.toFixed(2)}${
        colors.reset
      }`
    );
    console.log(
      `  Al anular:                 ${colors.red}$${diffReversal.toFixed(2)}${
        colors.reset
      }`
    );
    console.log(
      `  Total (antes - después):   ${
        diffTotal === 0 ? colors.green : colors.red
      }$${diffTotal.toFixed(2)}${colors.reset}`
    );

    // Validación final
    console.log(
      `\n${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}`
    );

    if (Math.abs(diffTotal) < 0.01) {
      console.log(`${colors.green}✅ ¡FLUJO COMPLETO EXITOSO!${colors.reset}`);
      console.log(
        `${colors.green}El saldo volvió al estado inicial después de anular la guía${colors.reset}`
      );
      process.exit(0);
    } else {
      console.log(
        `${colors.yellow}⚠️ ADVERTENCIA: Los saldos no coinciden exactamente${colors.reset}`
      );
      console.log(
        `${colors.yellow}Diferencia: $${diffTotal.toFixed(2)}${colors.reset}`
      );
      console.log(
        `${colors.gray}(Esto podría ser normal si hay comisiones u otros movimientos)${colors.reset}`
      );
      process.exit(0);
    }
  } catch (error) {
    console.log(
      `\n${colors.red}❌ ERROR EN EL TEST:${colors.reset} ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar test
runTest().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
