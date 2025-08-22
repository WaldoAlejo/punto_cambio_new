import express from "express";
import {
  ServientregaAPIService,
  ServientregaCredentials,
} from "../../services/servientregaAPIService.js";
import { ServientregaValidationService } from "../../services/servientregaValidationService.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";

const router = express.Router();

// Interfaces para las respuestas de Servientrega
interface AnularGuiaResponse {
  fetch?: {
    proceso?: string;
  };
}

// Función para obtener las credenciales desde variables de entorno
function getCredentials(isPrueba: boolean = false): ServientregaCredentials {
  if (isPrueba) {
    return {
      usuingreso: "PRUEBA",
      contrasenha: "s12345ABCDe",
    };
  }

  return {
    usuingreso: process.env.SERVIENTREGA_USER || "INTPUNTOC",
    contrasenha: process.env.SERVIENTREGA_PASSWORD || "73Yes7321t",
  };
}

// =============================
// 💰 Cálculo de Tarifas
// =============================

router.post("/tarifas", async (req, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
    const result = await apiService.callAPI({
      tipo: "TarifaConIva",
      ...req.body,
    });
    res.json(result);
  } catch (error) {
    console.error("Error al obtener tarifas:", error);
    res.status(500).json({
      error: "Error al obtener tarifas",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.post("/tarifa", async (req, res) => {
  try {
    console.log(
      "📥 Datos recibidos para tarifa:",
      JSON.stringify(req.body, null, 2)
    );

    const { usar_prueba = false, ...requestData } = req.body;

    // Validar datos de entrada
    const validationErrors =
      ServientregaValidationService.validateTarifaRequest(requestData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Errores de validación",
        errores: validationErrors,
      });
    }

    // Sanitizar y preparar payload
    const sanitizedData =
      ServientregaValidationService.sanitizeTarifaRequest(requestData);

    console.log("🔍 Datos sanitizados:", sanitizedData);

    // Crear servicio API con credenciales apropiadas
    const apiService = new ServientregaAPIService(getCredentials(usar_prueba));
    const result = await apiService.calcularTarifa(sanitizedData);

    // Procesar errores de Servientrega
    const servientregaErrors =
      ServientregaValidationService.parseServientregaErrors(result);
    if (servientregaErrors.length > 0) {
      return res.status(400).json({
        error: "Error en Servientrega",
        errores: servientregaErrors,
        respuesta_original: result,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error al calcular tarifa:", error);
    res.status(500).json({
      error: "Error al calcular tarifa",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Endpoint específico para pruebas
router.post("/tarifa-prueba", async (req, res) => {
  try {
    console.log(
      "🧪 MODO PRUEBA - Datos recibidos:",
      JSON.stringify(req.body, null, 2)
    );

    const defaultData = {
      ciu_ori: "GUAYAQUIL",
      provincia_ori: "GUAYAS",
      ciu_des: "GUAYAQUIL",
      provincia_des: "GUAYAS",
      valor_seguro: "12.5",
      valor_declarado: "2.5",
      peso: "5",
      alto: "20",
      ancho: "25",
      largo: "30",
      recoleccion: "NO",
      nombre_producto: "MERCANCIA PREMIER",
      empaque: "",
    };

    const requestData = { ...defaultData, ...req.body };
    const sanitizedData =
      ServientregaValidationService.sanitizeTarifaRequest(requestData);

    const apiService = new ServientregaAPIService(getCredentials(true));
    const result = await apiService.calcularTarifa(sanitizedData);

    res.json({
      modo: "PRUEBA",
      payload_enviado: sanitizedData,
      respuesta: result,
    });
  } catch (error) {
    console.error("Error en tarifa de prueba:", error);
    res.status(500).json({
      error: "Error en tarifa de prueba",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// =============================
// 🚚 Generar y anular guías
// =============================

interface GenerarGuiaResponse {
  guia?: string;
  base64?: string;
  [key: string]: any;
}

interface AnularGuiaResponse {
  fetch?: {
    proceso?: string;
  };
  [key: string]: any;
}

router.post("/generar-guia", async (req, res) => {
  try {
    const dbService = new ServientregaDBService();
    const apiService = new ServientregaAPIService(getCredentials());

    const response = await apiService.generarGuia(req.body);

    console.log("📥 Respuesta cruda de Servientrega:", response);

    // Procesar la respuesta que puede venir como string mal formateado
    let processedResponse: any = response;

    if (typeof response === "string") {
      const responseString = response as string;
      try {
        // Intentar parsear si es un string JSON
        processedResponse = JSON.parse(responseString);
      } catch (parseError) {
        // Si no es JSON válido, intentar separar las dos partes
        try {
          const firstBracketEnd = responseString.indexOf("}]");
          if (firstBracketEnd !== -1) {
            const tarifaPart = responseString.substring(0, firstBracketEnd + 2);
            const fetchPart = responseString.substring(firstBracketEnd + 2);

            const tarifaData = JSON.parse(tarifaPart);
            const fetchData = JSON.parse(fetchPart);

            processedResponse = {
              ...tarifaData[0],
              fetch: fetchData.fetch,
            };
          }
        } catch (splitError) {
          console.error(
            "Error al procesar respuesta de Servientrega:",
            splitError
          );
          processedResponse = responseString;
        }
      }
    }

    // Extraer datos de la guía
    const fetchData = processedResponse?.fetch || {};
    const guia = fetchData.guia;
    const base64 = fetchData.guia_64;

    if (guia && base64) {
      const { remitente, destinatario, punto_atencion_id } = req.body;

      // Obtener el valor total de la transacción de la respuesta
      const valorTotal =
        processedResponse?.total_transacion ||
        processedResponse?.gtotal ||
        req.body.valor_total ||
        0;

      try {
        // Guardar remitente y destinatario en BD
        const remitenteDB = await dbService.guardarRemitente(remitente);
        const destinatarioDB = await dbService.guardarDestinatario(
          destinatario
        );

        // Guardar guía
        await dbService.guardarGuia({
          numero_guia: guia,
          proceso: fetchData.proceso || "Generada",
          base64_response: base64,
          remitente_id: remitenteDB.id,
          destinatario_id: destinatarioDB.id,
        });

        // Descontar del saldo si hay punto de atención
        if (punto_atencion_id && valorTotal > 0) {
          await dbService.descontarSaldo(
            punto_atencion_id,
            parseFloat(valorTotal.toString())
          );
        }
      } catch (dbError) {
        console.error("Error al guardar en BD:", dbError);
        // Continuar con la respuesta aunque falle el guardado en BD
      }
    }

    res.json(processedResponse);
  } catch (error) {
    console.error("Error al generar guía:", error);
    res.status(500).json({
      error: "Error al generar guía",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.post("/anular-guia", async (req, res) => {
  try {
    const { guia } = req.body;

    if (!guia) {
      return res.status(400).json({ error: "El número de guía es requerido" });
    }

    const apiService = new ServientregaAPIService(getCredentials());
    const response = (await apiService.anularGuia(guia)) as AnularGuiaResponse;

    if (response?.fetch?.proceso === "Guia Actualizada") {
      try {
        const dbService = new ServientregaDBService();
        await dbService.anularGuia(guia);
      } catch (dbError) {
        console.error("Error al actualizar guía en BD:", dbError);
      }
    }

    res.json(response);
  } catch (error) {
    console.error("Error al anular guía:", error);
    res.status(500).json({
      error: "Error al anular guía",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// =============================
// 📋 Consultas de guías
// =============================

router.get("/guias", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const dbService = new ServientregaDBService();

    const guias = await dbService.obtenerGuias(
      desde as string,
      hasta as string
    );

    res.json({ guias });
  } catch (error) {
    console.error("Error al consultar guías:", error);
    res.status(500).json({
      error: "Error al consultar guías",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export { router as shippingRouter };
