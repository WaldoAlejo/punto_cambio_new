import express from "express";
import {
  ServientregaAPIService,
  ServientregaCredentials,
} from "../../services/servientregaAPIService.js";
import { ServientregaValidationService } from "../../services/servientregaValidationService.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";

const router = express.Router();

/** ============================
 *  Tipos auxiliares
 *  ============================ */
interface AnularGuiaResponse {
  fetch?: {
    proceso?: string;
    guia?: string;
  };
  [key: string]: any;
}

interface GenerarGuiaResponse {
  fetch?: {
    proceso?: string;
    guia?: string;
    guia_pdf?: string;
    guia_64?: string;
  };
  [key: string]: any;
}

/** ============================
 *  Helpers de entorno y logging
 *  ============================ */
function getCredentialsFromEnv(): ServientregaCredentials {
  const usuingreso = process.env.SERVIENTREGA_USER;
  const contrasenha = process.env.SERVIENTREGA_PASSWORD;
  if (!usuingreso || !contrasenha) {
    throw new Error(
      "Faltan SERVIENTREGA_USER y/o SERVIENTREGA_PASSWORD en el entorno (.env.production)."
    );
  }
  return { usuingreso, contrasenha };
}

function getApiUrl(): string {
  // Se permite fallback al endpoint oficial si no se definió en env
  return (
    process.env.SERVIENTREGA_URL ||
    "https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php"
  );
}

const maskCreds = (c: ServientregaCredentials) => ({
  usuingreso: c.usuingreso,
  contrasenha: "***",
});

/** ============================
 *  💰 Cálculo de Tarifas
 *  ============================ */
router.post("/tarifa", async (req, res) => {
  try {
    // 1) Forzar tipo nacional / internacional segun país
    const paisOri = (req.body.pais_ori || "").toString().toUpperCase();
    const paisDes = (req.body.pais_des || "").toString().toUpperCase();
    const isInternacional =
      (paisDes && paisDes !== "ECUADOR") || (paisOri && paisOri !== "ECUADOR");

    const bodyConTipo = {
      ...req.body,
      tipo: isInternacional
        ? "obtener_tarifa_internacional"
        : "obtener_tarifa_nacional",
    };

    // 2) Validación
    const validationErrors =
      ServientregaValidationService.validateTarifaRequest(bodyConTipo);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Errores de validación",
        errores: validationErrors,
      });
    }

    // 3) Sanitizar (pone strings y defaults compatibles con WS)
    const sanitizedData =
      ServientregaValidationService.sanitizeTarifaRequest(bodyConTipo);

    // 4) Preparar API Service con credenciales de env
    const credentials = getCredentialsFromEnv();
    const apiService = new ServientregaAPIService(credentials);
    apiService.apiUrl = getApiUrl();

    // 5) Llamar al WS
    const result = await apiService.calcularTarifa(sanitizedData);

    // 6) Parseo de errores embebidos (cuando WS devuelve un string con {"proceso":"..."})
    const servientregaErrors =
      ServientregaValidationService.parseServientregaErrors(result);
    if (servientregaErrors.length > 0) {
      return res.status(400).json({
        error: "Error en Servientrega",
        errores: servientregaErrors,
        respuesta_original: result,
      });
    }

    // 7) Respuesta OK (array con objeto o un objeto)
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return res.status(400).json({
        error: "Respuesta vacía de Servientrega",
        respuesta_original: result,
        payload_enviado: sanitizedData,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("💥 Error al calcular tarifa:", error);
    return res.status(500).json({
      error: "Error al calcular tarifa",
      details: error instanceof Error ? error.message : "Error desconocido",
      timestamp: new Date().toISOString(),
    });
  }
});

/** ============================
 *  🚚 Generación de Guías
 *  ============================ */
router.post("/generar-guia", async (req, res) => {
  try {
    const credentials = getCredentialsFromEnv();
    const apiService = new ServientregaAPIService(credentials);
    apiService.apiUrl = getApiUrl();

    // Si el frontend ya envía "tipo":"GeneracionGuia" y todos los campos exactos, usamos tal cual.
    const yaFormateado = String(req.body?.tipo || "") === "GeneracionGuia";

    // Validación de retiro en oficina (si llega ya formateado o no)
    const retiroOficinaValor = (req.body?.retiro_oficina ?? "").toString();
    const retiroEsSi =
      retiroOficinaValor.toUpperCase() === "SI" ||
      req.body?.retiro_oficina === true;
    if (retiroEsSi && !req.body?.nombre_agencia_retiro_oficina) {
      return res.status(400).json({
        error: "Validación",
        mensaje:
          "nombre_agencia_retiro_oficina es requerido cuando retiro_oficina = 'SI'",
      });
    }

    // Construcción robusta del payload si NO viene formateado
    let payload: Record<string, any>;
    if (!yaFormateado) {
      const {
        remitente,
        destinatario,
        nombre_producto,
        contenido,
        retiro_oficina,
        nombre_agencia_retiro_oficina,
        pedido,
        factura,
        medidas,
        // opcionales auxiliares
        punto_atencion_id,
        valor_total,
      } = req.body || {};

      // Normalizar producto
      const productoUpper = String(nombre_producto || "").toUpperCase();
      const producto =
        productoUpper.includes("DOC") || productoUpper === "DOCUMENTO"
          ? "DOCUMENTO"
          : "MERCANCIA PREMIER";

      // Formato "CIUDAD-PROVINCIA" en mayúsculas
      const ciudadOrigen = `${String(
        remitente?.ciudad || ""
      ).toUpperCase()}-${String(remitente?.provincia || "").toUpperCase()}`;
      const ciudadDestino = `${String(
        destinatario?.ciudad || ""
      ).toUpperCase()}-${String(destinatario?.provincia || "").toUpperCase()}`;

      payload = {
        tipo: "GeneracionGuia",
        nombre_producto: producto,
        ciudad_origen: ciudadOrigen,
        cedula_remitente: remitente?.identificacion || remitente?.cedula || "",
        nombre_remitente: remitente?.nombre || "",
        direccion_remitente: remitente?.direccion || "",
        telefono_remitente: remitente?.telefono || "",
        codigo_postal_remitente: remitente?.codigo_postal || "",
        cedula_destinatario:
          destinatario?.identificacion || destinatario?.cedula || "",
        nombre_destinatario: destinatario?.nombre || "",
        direccion_destinatario: destinatario?.direccion || "",
        telefono_destinatario: destinatario?.telefono || "",
        ciudad_destinatario: ciudadDestino,
        pais_destinatario: destinatario?.pais || "ECUADOR",
        codigo_postal_destinatario: destinatario?.codigo_postal || "",
        contenido: contenido || nombre_producto || "PRUEBA",
        retiro_oficina: retiro_oficina ? "SI" : "NO",
        ...(retiro_oficina && nombre_agencia_retiro_oficina
          ? { nombre_agencia_retiro_oficina }
          : {}),
        pedido: pedido || "PRUEBA",
        factura: factura || "PRUEBA",
        valor_declarado: Number(medidas?.valor_declarado ?? 0),
        valor_asegurado: Number(medidas?.valor_seguro ?? 0),
        peso_fisico: Number(medidas?.peso ?? 0),
        peso_volumentrico: 0, // si ya lo tienes calculado, puedes reemplazarlo
        piezas: 1,
        alto: Number(medidas?.alto ?? 0),
        ancho: Number(medidas?.ancho ?? 0),
        largo: Number(medidas?.largo ?? 0),
        tipo_guia: "1",
        alianza: "PRUEBAS",
        alianza_oficina: "DON JUAN_INICIAL_XR",
        mail_remite: remitente?.email || "",
        // Credenciales requeridas por el WS dentro del body
        usuingreso: credentials.usuingreso,
        contrasenha: credentials.contrasenha,

        // Campos opcionales para lógica interna
        punto_atencion_id,
        valor_total,
      };
    } else {
      // Ya viene formateado → sólo inyectamos credenciales si faltan
      payload = {
        ...req.body,
        usuingreso: req.body.usuingreso || credentials.usuingreso,
        contrasenha: req.body.contrasenha || credentials.contrasenha,
      };
    }

    // Llamada al WS
    const response = (await apiService.callAPI(payload)) as GenerarGuiaResponse;

    // A veces el WS devuelve la tarifa al inicio y luego {"fetch":{...}} concatenado
    // Intento de "split & merge" cuando llega como string crudo
    let processed: any = response;
    if (typeof response === "string") {
      const raw = response as string;
      try {
        processed = JSON.parse(raw);
      } catch {
        // try split array + fetch
        const idx = raw.indexOf("}]");
        if (idx !== -1) {
          const first = raw.substring(0, idx + 2);
          const second = raw.substring(idx + 2);
          try {
            const tarifaArr = JSON.parse(first); // [{"flete":...}]
            const fetchObj = JSON.parse(second); // {"fetch":{...}}
            processed = { ...(tarifaArr?.[0] || {}), ...fetchObj };
          } catch {
            processed = raw;
          }
        }
      }
    }

    // Persistencia cuando hay guia/64
    const fetchData = processed?.fetch || {};
    const guia = fetchData?.guia;
    const base64 = fetchData?.guia_64;

    if (guia && base64) {
      const db = new ServientregaDBService();

      // Determinar valor total de la transacción
      const valorTotal =
        Number(processed?.total_transacion) ||
        Number(processed?.gtotal) ||
        Number(payload?.valor_total) ||
        0;

      try {
        // Si vino en payload remitente/destinatario (flujo no formateado), guardamos
        if (!String(req.body?.tipo || "").includes("GeneracionGuia")) {
          const { remitente, destinatario, punto_atencion_id } = req.body || {};

          if (remitente) {
            await db.guardarRemitente(remitente);
          }
          if (destinatario) {
            await db.guardarDestinatario(destinatario);
          }

          // Guardar cabecera de guía
          await db.guardarGuia({
            numero_guia: guia,
            proceso: fetchData?.proceso || "Guia Generada",
            base64_response: base64,
            // En este punto no tenemos los IDs de remitente/destinatario creados (si los necesitas, crea primero y usa sus IDs)
            remitente_id: "", // opcional: ajusta si quieres relación estricta
            destinatario_id: "",
          });

          // Descontar saldo
          if (req.body?.punto_atencion_id && valorTotal > 0) {
            await db.descontarSaldo(
              req.body.punto_atencion_id,
              Number(valorTotal)
            );
          }
        }
      } catch (dbErr) {
        console.error("⚠️ Error al persistir en BD (no bloqueante):", dbErr);
      }
    }

    return res.json(processed);
  } catch (error) {
    console.error("💥 Error al generar guía:", error);
    return res.status(500).json({
      error: "Error al generar guía",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/** ============================
 *  ❌ Anulación de Guías
 *  ============================ */
router.post("/anular-guia", async (req, res) => {
  try {
    const { guia } = req.body;
    if (!guia) {
      return res.status(400).json({ error: "El número de guía es requerido" });
    }

    const credentials = getCredentialsFromEnv();
    const apiService = new ServientregaAPIService(credentials);
    apiService.apiUrl = getApiUrl();

    // Payload EXACTO de la documentación:
    const payload = {
      tipo: "ActualizaEstadoGuia",
      guia,
      estado: "Anulada",
      usuingreso: credentials.usuingreso,
      contrasenha: credentials.contrasenha,
    };

    const response = (await apiService.callAPI(payload)) as AnularGuiaResponse;

    if (response?.fetch?.proceso === "Guia Actualizada") {
      try {
        const dbService = new ServientregaDBService();
        await dbService.anularGuia(guia);
      } catch (dbError) {
        console.error("⚠️ Error al actualizar guía en BD:", dbError);
      }
    }

    return res.json(response);
  } catch (error) {
    console.error("💥 Error al anular guía:", error);
    return res.status(500).json({
      error: "Error al anular guía",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/** ============================
 *  📋 Consulta de Guías (BD)
 *  ============================ */
router.get("/guias", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const dbService = new ServientregaDBService();

    const guias = await dbService.obtenerGuias(
      (desde as string) || undefined,
      (hasta as string) || undefined
    );

    return res.json({ guias });
  } catch (error) {
    console.error("💥 Error al consultar guías:", error);
    return res.status(500).json({
      error: "Error al consultar guías",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export { router as shippingRouter };
