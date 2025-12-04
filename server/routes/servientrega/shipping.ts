import express from "express";
import {
  ServientregaAPIService,
  ServientregaCredentials,
} from "../../services/servientregaAPIService.js";
import { ServientregaValidationService } from "../../services/servientregaValidationService.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import prisma from "../../lib/prisma.js";

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

    // 2) Validación (valor_declarado es opcional en el servicio)
    const validationErrors =
      ServientregaValidationService.validateTarifaRequest(bodyConTipo);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Errores de validación",
        errores: validationErrors,
      });
    }

    // 3) Sanitizar (pone strings y defaults compatibles con WS; valor_declarado→0 si falta)
    const sanitizedData =
      ServientregaValidationService.sanitizeTarifaRequest(bodyConTipo);

    // DEBUG: Log del payload que se va a enviar
    console.log(
      "🔍 PAYLOAD ORIGINAL DEL FRONTEND:",
      JSON.stringify(req.body, null, 2)
    );
    console.log("🔍 PAYLOAD CON TIPO:", JSON.stringify(bodyConTipo, null, 2));
    console.log(
      "🔍 PAYLOAD SANITIZADO:",
      JSON.stringify(sanitizedData, null, 2)
    );

    // 4) Preparar API Service con credenciales de env
    const credentials = getCredentialsFromEnv();
    console.log("🔍 CREDENCIALES:", JSON.stringify(maskCreds(credentials)));
    console.log("🔍 URL API:", getApiUrl());

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

    // 8) Ajustar costos de empaque si no se solicitó empaque
    let adjustedResult = result;
    const noEmpaqueRequested = !sanitizedData.empaque;

    if (noEmpaqueRequested && result) {
      console.log("🔧 AJUSTANDO COSTOS - No se solicitó empaque");

      // Si es un array, ajustar el primer elemento
      const dataToAdjust = Array.isArray(result) ? result[0] : result;

      if (dataToAdjust && typeof dataToAdjust === "object") {
        const valorEmpaque = parseFloat(dataToAdjust.valor_empaque || 0);
        const valorEmpaqueIva = parseFloat(dataToAdjust.valor_empaque_iva || 0);
        const totalEmpaque = parseFloat(dataToAdjust.total_empaque || 0);
        const gtotal = parseFloat(dataToAdjust.gtotal || 0);
        const totalTransacion = parseFloat(dataToAdjust.total_transacion || 0);

        console.log("🔧 Valores originales:", {
          valor_empaque: valorEmpaque,
          valor_empaque_iva: valorEmpaqueIva,
          total_empaque: totalEmpaque,
          gtotal: gtotal,
          total_transacion: totalTransacion,
        });

        // Crear objeto ajustado
        const adjustedData = {
          ...dataToAdjust,
          valor_empaque: 0,
          valor_empaque_iva: 0,
          total_empaque: 0,
          gtotal: Math.max(0, gtotal - totalEmpaque),
          total_transacion: Math.max(0, totalTransacion - totalEmpaque),
        };

        console.log("🔧 Valores ajustados:", {
          valor_empaque: adjustedData.valor_empaque,
          valor_empaque_iva: adjustedData.valor_empaque_iva,
          total_empaque: adjustedData.total_empaque,
          gtotal: adjustedData.gtotal,
          total_transacion: adjustedData.total_transacion,
        });

        adjustedResult = Array.isArray(result) ? [adjustedData] : adjustedData;
      }
    }

    return res.json(adjustedResult);
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

    // ✅ IMPORTANTE: Capturar punto_atencion_id y valor_total ANTES de procesar payloads
    // Esto asegura que se preserven independientemente del formato del request
    const punto_atencion_id_captado = req.body?.punto_atencion_id || undefined;
    const costoEnvioPrecalculado = Number(req.body?.valor_total ?? 0) || 0;

    console.log("🔍 CAPTURA INICIAL:", {
      punto_atencion_id: punto_atencion_id_captado || "NO RECIBIDO",
      costoEnvioPrecalculado,
      yaFormateado,
      req_body_keys: Object.keys(req.body || {}),
      valor_total_type: typeof req.body?.valor_total,
      valor_total_raw: req.body?.valor_total,
      req_user: req.user
        ? { id: req.user.id, punto_atencion_id: req.user.punto_atencion_id }
        : "NO AUTH",
    });

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

    console.log(
      "💰 Costo de envío precalculado (frontend):",
      costoEnvioPrecalculado
    );

    // Construcción robusta del payload si NO viene formateado
    let payload: Record<string, any>;
    if (!yaFormateado) {
            // ...existing code...
      const {
          // ...existing code...
        remitente,
        destinatario,
        nombre_producto,
        contenido,
        retiro_oficina,
        nombre_agencia_retiro_oficina,
        pedido,
        factura,
        medidas,
      } = req.body || {};

      // Normalizar producto
      const productoUpper = String(nombre_producto || "").toUpperCase();
      const producto =
        productoUpper.includes("DOC") || productoUpper === "DOCUMENTO UNITARIO"
          ? "DOCUMENTO UNITARIO"
          : "MERCANCIA PREMIER";

      // Formato "CIUDAD-PROVINCIA" en mayúsculas
      const ciudadOrigen = `${String(
        remitente?.ciudad || ""
      ).toUpperCase()}-${String(remitente?.provincia || "").toUpperCase()}`;
      const ciudadDestino = `${String(
        destinatario?.ciudad || ""
      ).toUpperCase()}-${String(destinatario?.provincia || "").toUpperCase()}`;

      // Normalizaciones numéricas seguras
            // Validar identificación de remitente y destinatario (después de declarar las variables)
            const { ServientregaValidationService } = require("../../services/servientregaValidationService.js");
            const idRemitente = String(remitente?.identificacion || remitente?.cedula || "");
            const idDestinatario = String(destinatario?.identificacion || destinatario?.cedula || "");
            if (!ServientregaValidationService.validarIdentificacionEcuatorianaOExtranjera(idRemitente)) {
              return res.status(400).json({
                error: "IDENTIFICACION_INVALIDA",
                message: `La identificación del remitente (${idRemitente}) no es válida. Debe ser cédula, RUC o pasaporte (nacional o extranjero).`
              });
            }
            if (!ServientregaValidationService.validarIdentificacionEcuatorianaOExtranjera(idDestinatario)) {
              return res.status(400).json({
                error: "IDENTIFICACION_INVALIDA",
                message: `La identificación del destinatario (${idDestinatario}) no es válida. Debe ser cédula, RUC o pasaporte (nacional o extranjero).`
              });
            }
      const vd = Number(medidas?.valor_declarado ?? 0) || 0; // 👈 default 0
      const va = Number(medidas?.valor_seguro ?? 0) || 0;
      const alto = Number(medidas?.alto ?? 0) || 0;
      const ancho = Number(medidas?.ancho ?? 0) || 0;
      const largo = Number(medidas?.largo ?? 0) || 0;
      const peso_fisico = Number(medidas?.peso ?? 0) || 0;
      const piezas = Number((medidas as any)?.piezas ?? 1) || 1;

      // Cálculo de peso volumétrico (si hay dimensiones)
      const peso_volumentrico =
        alto > 0 && ancho > 0 && largo > 0 ? (alto * ancho * largo) / 5000 : 0;

      // Obtener punto de atención si está disponible (usar el que se capturó al inicio)
      let servientregaAlianza = "PUNTO CAMBIO SAS";
      let servientregaOficinaAlianza = "QUITO_PLAZA DEL VALLE_PC";

      if (punto_atencion_id_captado) {
        try {
          const punto = await prisma.puntoAtencion.findUnique({
            where: { id: punto_atencion_id_captado },
            select: {
              nombre: true,
              servientrega_agencia_codigo: true,
              servientrega_agencia_nombre: true,
              servientrega_alianza: true,
              servientrega_oficina_alianza: true,
            },
          });

          // ⚠️ VALIDACIÓN CRÍTICA: Solo puntos con Servientrega configurado pueden generar guías
          if (!punto) {
            return res.status(404).json({
              error: "Punto de atención no encontrado",
              mensaje: `No se encontró el punto de atención con ID: ${punto_atencion_id_captado}`,
            });
          }

          if (!punto.servientrega_agencia_codigo) {
            return res.status(403).json({
              error: "Servientrega no habilitado",
              mensaje:
                `El punto "${punto.nombre}" no tiene Servientrega configurado. ` +
                `Por favor, contacta al administrador para asignar una agencia de Servientrega a este punto.`,
              punto_nombre: punto.nombre,
              punto_id: punto_atencion_id_captado,
              solucion:
                "El administrador debe ir a Puntos de Atención y configurar los campos de Servientrega para este punto.",
            });
          }

          // Si tiene agencia configurada, usar los datos específicos del punto
          if (punto.servientrega_alianza) {
            servientregaAlianza = punto.servientrega_alianza;
          }
          if (punto.servientrega_oficina_alianza) {
            servientregaOficinaAlianza = punto.servientrega_oficina_alianza;
          }

          console.log("✅ Punto con Servientrega habilitado:", {
            punto_id: punto_atencion_id_captado,
            punto_nombre: punto.nombre,
            agencia_codigo: punto.servientrega_agencia_codigo,
            agencia_nombre: punto.servientrega_agencia_nombre,
          });
        } catch (e) {
          console.error("❌ Error al validar punto de atención:", e);
          return res.status(500).json({
            error: "Error de validación",
            mensaje:
              "No se pudo validar la configuración de Servientrega para este punto",
            detalles: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // 🔧 Construcción del payload en el ORDEN EXACTO que Servientrega requiere
      payload = {
        tipo: "GeneracionGuia",
        nombre_producto: producto,
        ciudad_origen: ciudadOrigen,
        cedula_remitente: String(
          remitente?.identificacion || remitente?.cedula || ""
        ),
        nombre_remitente: String(remitente?.nombre || ""),
        direccion_remitente: String(remitente?.direccion || ""),
        telefono_remitente: String(remitente?.telefono || ""),
        codigo_postal_remitente: String(remitente?.codigo_postal || ""),
        cedula_destinatario: String(
          destinatario?.identificacion || destinatario?.cedula || ""
        ),
        nombre_destinatario: String(destinatario?.nombre || ""),
        direccion_destinatario: String(destinatario?.direccion || ""),
        telefono_destinatario: String(destinatario?.telefono || ""),
        ciudad_destinatario: ciudadDestino,
        pais_destinatario: String(
          destinatario?.pais || "ECUADOR"
        ).toUpperCase(),
        codigo_postal_destinatario: String(destinatario?.codigo_postal || ""),
        // 👇 CONTENIDO: normalizar a mayúsculas (el API de Servientrega lo requiere)
        contenido: (
          contenido ||
          (producto === "DOCUMENTO UNITARIO" ? "DOCUMENTOS" : "MERCANCIA")
        ).toUpperCase(),
        retiro_oficina: retiro_oficina ? "SI" : "NO",
        ...(retiro_oficina && nombre_agencia_retiro_oficina
          ? {
              nombre_agencia_retiro_oficina: String(
                nombre_agencia_retiro_oficina
              ),
            }
          : {}),
        pedido: String(pedido || ""),
        factura: String(factura || ""),
        valor_declarado: vd,
        valor_asegurado: va,
        peso_fisico: Number(peso_fisico),
        peso_volumentrico: Number(peso_volumentrico),
        piezas: Number(piezas),
        alto: Number(alto),
        ancho: Number(ancho),
        largo: Number(largo),
        tipo_guia: "1",
        alianza: String(servientregaAlianza),
        alianza_oficina: String(servientregaOficinaAlianza),
        mail_remite: String(remitente?.email || ""),
        usuingreso: String(credentials.usuingreso),
        contrasenha: String(credentials.contrasenha),
      };
    } else {
      // Ya viene formateado (tipo:"GeneracionGuia") → reorganizar en orden correcto
      const vd = Number(req.body?.valor_declarado ?? 0) || 0;
      const va = Number(req.body?.valor_asegurado ?? 0) || 0;

      // 🔧 Reorganizar en el ORDEN EXACTO que Servientrega requiere
      payload = {
        tipo: req.body.tipo || "GeneracionGuia",
        nombre_producto: req.body.nombre_producto,
        ciudad_origen: req.body.ciudad_origen,
        cedula_remitente: String(req.body.cedula_remitente || ""),
        nombre_remitente: String(req.body.nombre_remitente || ""),
        direccion_remitente: String(req.body.direccion_remitente || ""),
        telefono_remitente: String(req.body.telefono_remitente || ""),
        codigo_postal_remitente: String(req.body.codigo_postal_remitente || ""),
        cedula_destinatario: String(req.body.cedula_destinatario || ""),
        nombre_destinatario: String(req.body.nombre_destinatario || ""),
        direccion_destinatario: String(req.body.direccion_destinatario || ""),
        telefono_destinatario: String(req.body.telefono_destinatario || ""),
        ciudad_destinatario: String(req.body.ciudad_destinatario || ""),
        pais_destinatario: String(
          req.body.pais_destinatario || "ECUADOR"
        ).toUpperCase(),
        codigo_postal_destinatario: String(
          req.body.codigo_postal_destinatario || ""
        ),
        // 👇 CONTENIDO: normalizar a mayúsculas con fallback
        contenido: (
          (req.body.contenido || "DOCUMENTO").toString().trim() || "DOCUMENTO"
        ).toUpperCase(),
        retiro_oficina: String(req.body.retiro_oficina || "NO"),
        ...(req.body.nombre_agencia_retiro_oficina
          ? {
              nombre_agencia_retiro_oficina: String(
                req.body.nombre_agencia_retiro_oficina
              ),
            }
          : {}),
        pedido: String(req.body.pedido || ""),
        factura: String(req.body.factura || ""),
        valor_declarado: vd,
        valor_asegurado: va,
        peso_fisico: Number(req.body.peso_fisico || 0),
        peso_volumentrico: Number(req.body.peso_volumentrico || 0),
        piezas: Number(req.body.piezas || 1),
        alto: Number(req.body.alto || 0),
        ancho: Number(req.body.ancho || 0),
        largo: Number(req.body.largo || 0),
        tipo_guia: String(req.body.tipo_guia || "1"),
        alianza: String(req.body.alianza || "PUNTO CAMBIO SAS"),
        alianza_oficina: String(
          req.body.alianza_oficina || "QUITO_PLAZA DEL VALLE_PC"
        ),
        mail_remite: String(req.body.mail_remite || ""),
        usuingreso: String(credentials.usuingreso),
        contrasenha: String(credentials.contrasenha),
      };
    }

    // 🔍 LOG: Payload final reorganizado en orden correcto
    console.log("📤 PAYLOAD FINAL ENVIADO A SERVIENTREGA:");
    console.log(JSON.stringify(payload, null, 2));

    // 🔍 LOG: Mostrar credenciales enmascaradas
    console.log("🔐 Credenciales (enmascaradas):", {
      usuingreso: payload.usuingreso,
      contrasenha: "***",
    });

    // 🔍 LOG: Validación de campos críticos
    console.log("✅ Validación de campos críticos:", {
      tipo: payload.tipo,
      nombre_producto: payload.nombre_producto,
      ciudad_origen: payload.ciudad_origen,
      ciudad_destinatario: payload.ciudad_destinatario,
      pais_destinatario: payload.pais_destinatario,
      contenido: payload.contenido,
      cedula_remitente: payload.cedula_remitente ? "✓ (lleno)" : "✗ (vacío)",
      cedula_destinatario: payload.cedula_destinatario
        ? "✓ (lleno)"
        : "✗ (vacío)",
    });

    // Llamada al WS
    console.log("📡 Llamando a Servientrega API...");
    const response = (await apiService.callAPI(payload)) as GenerarGuiaResponse;

    // 📥 LOG: Respuesta RAW de Servientrega
    console.log("📥 RESPUESTA RAW DE SERVIENTREGA:");
    console.log(JSON.stringify(response, null, 2));

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
    // La respuesta puede venir como {fetch: {...}} o directamente con guia/guia_64
    const fetchData = processed?.fetch || processed || {};
    const guia = fetchData?.guia;
    const base64 = fetchData?.guia_64;

    // 📊 LOG: Extracción de guía y base64
    console.log("📊 Extracción de guía y base64:", {
      guia: guia ? `✓ ${guia}` : "✗ (no encontrada)",
      base64: base64
        ? `✓ (${(base64 as string).length} caracteres)`
        : "✗ (no encontrado)",
      proceso: fetchData?.proceso || processed?.proceso || "N/A",
    });

    // 💰 Calcular valor total de la guía (incluye flete, seguro, empaque, etc.)
    // IMPORTANTE: No incluir valor_declarado, solo el costo del envío
    // ⚠️ Declarar aquí (fuera del if) para usarlo en la respuesta normalizada
    let valorTotalGuia = 0;

    if (guia && base64) {
      const db = new ServientregaDBService();

      console.log("💰 INICIANDO CÁLCULO DE valorTotalGuia...");
      console.log("💰 Fuentes disponibles:", {
        costoEnvioPrecalculado,
        processed_total_transacion: processed?.total_transacion,
        processed_gtotal: processed?.gtotal,
        processed_flete: processed?.flete,
        payload_valor_total: payload?.valor_total,
        payload_gtotal: payload?.gtotal,
        payload_total_transacion: payload?.total_transacion,
        payload_flete: payload?.flete,
        payload_valor_empaque: payload?.valor_empaque,
        payload_seguro: payload?.seguro,
        payload_tiva: payload?.tiva,
      });

      // 🎯 PRIORIDAD 1: Usar el costo precalculado que viene del frontend (confiable)
      if (costoEnvioPrecalculado > 0) {
        valorTotalGuia = costoEnvioPrecalculado;
        console.log(
          "✅ PRIORIDAD 1 MATCH: Usando costo precalculado del frontend:",
          valorTotalGuia
        );
      }
      // PRIORIDAD 2: Intentar con total_transacion de respuesta de Servientrega
      else if (processed?.total_transacion && Number(processed.total_transacion) > 0) {
        valorTotalGuia = Number(processed.total_transacion);
        console.log(
          "✅ PRIORIDAD 2 MATCH: Usando total_transacion de Servientrega:",
          valorTotalGuia
        );
      }
      // PRIORIDAD 3: Usar gtotal de respuesta de Servientrega
      else if (processed?.gtotal && Number(processed.gtotal) > 0) {
        valorTotalGuia = Number(processed.gtotal);
        console.log("✅ PRIORIDAD 3 MATCH: Usando gtotal de Servientrega:", valorTotalGuia);
      }
      // PRIORIDAD 4: Combinar componentes de la respuesta de Servientrega
      else if (processed?.flete && Number(processed.flete) > 0) {
        valorTotalGuia = Number(processed.flete) || 0;
        if (processed?.valor_asegurado) {
          valorTotalGuia += Number(processed.valor_asegurado) || 0;
        }
        if (processed?.valor_empaque) {
          valorTotalGuia += Number(processed.valor_empaque) || 0;
        }
        console.log("✅ PRIORIDAD 4 MATCH: Sumando componentes de Servientrega:", {
          flete: Number(processed.flete),
          valor_asegurado: Number(processed.valor_asegurado || 0),
          valor_empaque: Number(processed.valor_empaque || 0),
          total: valorTotalGuia,
        });
      }
      // PRIORIDAD 5: Combinar componentes enviados desde el payload del frontend
      else if (payload?.flete || payload?.valor_empaque || payload?.seguro || payload?.tiva) {
        valorTotalGuia = 0;
        if (payload?.flete) valorTotalGuia += Number(payload.flete) || 0;
        if (payload?.valor_empaque) valorTotalGuia += Number(payload.valor_empaque) || 0;
        if (payload?.seguro) valorTotalGuia += Number(payload.seguro) || 0;
        if (payload?.tiva) valorTotalGuia += Number(payload.tiva) || 0;
        console.log("✅ PRIORIDAD 5 MATCH: Sumando componentes del payload:", {
          flete: payload?.flete,
          valor_empaque: payload?.valor_empaque,
          seguro: payload?.seguro,
          tiva: payload?.tiva,
          total: valorTotalGuia,
        });
      }
      // PRIORIDAD 6: Usar gtotal del payload
      else if (payload?.gtotal && Number(payload.gtotal) > 0) {
        valorTotalGuia = Number(payload.gtotal);
        console.log("✅ PRIORIDAD 6 MATCH: Usando gtotal del payload:", valorTotalGuia);
      }
      // PRIORIDAD 7: Fallback al valor_total del payload
      else if (payload?.valor_total && Number(payload.valor_total) > 0) {
        valorTotalGuia = Number(payload.valor_total);
        console.log("✅ PRIORIDAD 7 MATCH: Usando valor_total del payload:", valorTotalGuia);
      }

      // ⚠️ FALLBACK FINAL: Si aún es 0, registramos advertencia
      if (valorTotalGuia === 0) {
        console.warn("⚠️ ADVERTENCIA: valorTotalGuia calculado como 0 después de todas las prioridades");
        console.warn("⚠️ NO se descontará saldo ni se registrará ingreso de servicio externo");
      }

      console.log("💰 DESGLOSE FINAL DE COSTOS:", {
        flete_servientrega: Number(processed?.flete || 0),
        valor_asegurado_servientrega: Number(processed?.valor_asegurado || 0),
        valor_empaque_servientrega: Number(processed?.valor_empaque || 0),
        total_transacion_servientrega: Number(processed?.total_transacion || 0),
        gtotal_servientrega: Number(processed?.gtotal || 0),
        valorTotalGuia_FINAL: valorTotalGuia,
        valor_declarado: Number(req.body?.valor_declarado || 0), // ⚠️ NO se descuenta
      });

      try {
        // 💾 GUARDAR GUÍA SIEMPRE cuando se genera exitosamente
        // (funciona tanto para flujo formateado como no formateado)

        // IMPORTANTE: El frontend envía datos FLATTENED, no objetos anidados
        // Reconstituir remitente y destinatario desde los campos disponibles
        const remitente = {
          cedula: req.body?.cedula_remitente || "",
          nombre: req.body?.nombre_remitente || "",
          direccion: req.body?.direccion_remitente || "",
          telefono: req.body?.telefono_remitente || "",
          email: req.body?.mail_remite || "",
          codigo_postal: req.body?.codigo_postal_remitente || "",
          // Remitente NO incluye ciudad/provincia/pais (ver servientregaDBService.ts)
        };

        const destinatario = {
          cedula: req.body?.cedula_destinatario || "",
          nombre: req.body?.nombre_destinatario || "",
          direccion: req.body?.direccion_destinatario || "",
          telefono: req.body?.telefono_destinatario || "",
          email: req.body?.mail_destinatario || "",
          ciudad: req.body?.ciudad_destinatario?.split(",")[0] || "",
          provincia: req.body?.ciudad_destinatario?.split(",")[1] || "",
          pais: req.body?.pais_destinatario || "ECUADOR",
          codigo_postal: req.body?.codigo_postal_destinatario || "",
        };

        let remitente_id: string | undefined;
        let destinatario_id: string | undefined;

        console.log(
          "📝 [shipping] Iniciando guardado de remitente/destinatario:",
          {
            remitente_cedula: remitente?.cedula,
            remitente_nombre: remitente?.nombre,
            destinatario_cedula: destinatario?.cedula,
            destinatario_nombre: destinatario?.nombre,
          }
        );

        // Guardar remitente y capturar su ID
        if (remitente?.cedula && remitente?.nombre) {
          try {
            console.log("🔄 [shipping] Guardando remitente:", remitente);
            const remitenteGuardado = await db.guardarRemitente(remitente);
            remitente_id = remitenteGuardado?.id;
            console.log(
              "✅ [shipping] Remitente guardado con ID:",
              remitente_id,
              "Objeto completo:",
              remitenteGuardado
            );
          } catch (err) {
            console.error("❌ [shipping] Error guardando remitente:", err);
          }
        } else {
          console.log(
            "⚠️ [shipping] Remitente incompleto, saltando guardado:",
            {
              cedula: remitente?.cedula,
              nombre: remitente?.nombre,
            }
          );
        }

        // Guardar destinatario y capturar su ID
        if (destinatario?.cedula && destinatario?.nombre) {
          try {
            console.log("🔄 [shipping] Guardando destinatario:", destinatario);
            const destinatarioGuardado = await db.guardarDestinatario(
              destinatario
            );
            destinatario_id = destinatarioGuardado?.id;
            console.log(
              "✅ [shipping] Destinatario guardado con ID:",
              destinatario_id,
              "Objeto completo:",
              destinatarioGuardado
            );
          } catch (err) {
            console.error("❌ [shipping] Error guardando destinatario:", err);
          }
        } else {
          console.log(
            "⚠️ [shipping] Destinatario incompleto, saltando guardado:",
            {
              cedula: destinatario?.cedula,
              nombre: destinatario?.nombre,
            }
          );
        }

        // 📌 SIEMPRE guardar la cabecera de guía con punto de atención, usuario y costo
        // ⚠️ IMPORTANTE: costo_envio = costo real de envío, NO incluye valor_declarado
        const guiaData: any = {
          numero_guia: guia,
          proceso: fetchData?.proceso || "Guia Generada",
          base64_response: base64,
          punto_atencion_id: punto_atencion_id_captado || undefined,
          usuario_id: req.user?.id || undefined, // 👈 IMPORTANTE: Guardar usuario_id para rastrabilidad
          costo_envio: valorTotalGuia > 0 ? Number(valorTotalGuia) : undefined,
          valor_declarado: Number(req.body?.valor_declarado || 0), // Informativo, NO se descuenta
        };

        // Solo incluir remitente_id y destinatario_id si tienen valor
        if (remitente_id) {
          guiaData.remitente_id = remitente_id;
          console.log(
            "✅ [shipping] Agregado remitente_id a guiaData:",
            remitente_id
          );
        } else {
          console.log("⚠️ [shipping] NO se agregó remitente_id (es undefined)");
        }

        if (destinatario_id) {
          guiaData.destinatario_id = destinatario_id;
          console.log(
            "✅ [shipping] Agregado destinatario_id a guiaData:",
            destinatario_id
          );
        } else {
          console.log(
            "⚠️ [shipping] NO se agregó destinatario_id (es undefined)"
          );
        }

        console.log("📋 [shipping] guiaData FINAL antes de guardar:", guiaData);

        await db.guardarGuia(guiaData);

        console.log("✅ Guía guardada en BD:", {
          numero_guia: guia,
          punto_atencion_id: punto_atencion_id_captado,
          costo_envio: valorTotalGuia,
        });

        // 💳 Descontar del saldo SOLO el costo de la guía (no el valor_declarado)
        console.log("💳 VERIFICACIÓN ANTES DE DESCONTAR:", {
          punto_atencion_id_captado,
          valorTotalGuia,
          deberia_descontar: punto_atencion_id_captado && valorTotalGuia > 0,
          costoEnvioPrecalculado,
          processed_total_transacion: processed?.total_transacion,
          processed_gtotal: processed?.gtotal,
          processed_flete: processed?.flete,
        });

        if (punto_atencion_id_captado && valorTotalGuia > 0) {
          console.log("💳 PROCESANDO FLUJO DE SALDO:", {
            punto_atencion_id: punto_atencion_id_captado,
            monto: valorTotalGuia,
            numero_guia: guia,
          });

          const resultadoDescuento = await db.descontarSaldo(
            punto_atencion_id_captado,
            Number(valorTotalGuia)
          );

          console.log("✅ PASO 1: Saldo descontado de Servientrega", {
            punto_atencion_id: punto_atencion_id_captado,
            monto: valorTotalGuia,
            resultado: resultadoDescuento ? "ACTUALIZADO" : "SIN CAMBIOS",
          });

          console.log("🔄 PASO 2: Registrando ingreso de servicio externo...");
          const resultadoIngreso = await db.registrarIngresoServicioExterno(
            punto_atencion_id_captado,
            Number(valorTotalGuia),
            guia,
            Number(req.body?.billetes || 0),
            Number(req.body?.monedas_fisicas || 0)
          );

          console.log(
            "✅ PASO 2: Ingreso registrado en saldo general USD",
            {
              numero_guia: guia,
              monto: valorTotalGuia,
              saldoServicio: {
                anterior: resultadoIngreso.saldoServicio.anterior,
                nuevo: resultadoIngreso.saldoServicio.nuevo,
              },
              saldoGeneral: {
                anterior: resultadoIngreso.saldoGeneral.anterior,
                nuevo: resultadoIngreso.saldoGeneral.nuevo,
              },
            }
          );

          console.log("✅ FLUJO COMPLETADO: Descuento e ingreso realizados");
        } else {
          console.warn("⚠️ NO se descontó saldo - razones:", {
            punto_atencion_id_presente: !!punto_atencion_id_captado,
            valorTotalGuia_mayor_que_cero: valorTotalGuia > 0,
            punto_atencion_id: punto_atencion_id_captado,
            valorTotalGuia,
          });
        }
      } catch (dbErr) {
        console.error("❌ ERROR CRÍTICO al persistir en BD:", {
          numero_guia: guia,
          punto_atencion_id: punto_atencion_id_captado,
          monto: valorTotalGuia,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          stack: dbErr instanceof Error ? dbErr.stack : undefined,
        });
        throw dbErr;
      }
    } else {
      // ❌ LOG: Guía NO se generó
      console.error("❌ FALLO: Guía NO se generó correctamente");
      console.error("Razón:", {
        guia_presente: !!guia,
        base64_presente: !!base64,
        proceso: fetchData?.proceso || processed?.proceso,
        respuesta_completa: JSON.stringify(processed, null, 2),
      });
    }

    // 🔧 Normalizar respuesta: siempre devolver guia/guia_64 a nivel raíz para que el frontend los encuentre
    // 💾 IMPORTANTE: Incluir valores finales calculados para que el frontend se actualice correctamente
    const normalizedResponse = {
      ...processed,
      guia: guia || processed?.guia || fetchData?.guia,
      guia_64: base64 || processed?.guia_64 || fetchData?.guia_64,
      guia_pdf: processed?.guia_pdf || fetchData?.guia_pdf,
      proceso: fetchData?.proceso || processed?.proceso,
      // 💰 Valores finales de costos (IMPORTANTES para que el frontend se actualice)
      valorTotalGuia: valorTotalGuia || 0,
      costo_total: valorTotalGuia || 0,
      // Si viene en fetch, extraer todos los campos de fetch también
      ...(fetchData && typeof fetchData === "object" ? fetchData : {}),
    };

    return res.json(normalizedResponse);
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

        // Obtener información de la guía antes de anularla
        const guiaInfo = await prisma.servientregaGuia.findFirst({
          where: { numero_guia: guia },
          select: {
            punto_atencion_id: true,
            costo_envio: true,
            created_at: true,
          },
        });

        // Anular la guía en BD
        await dbService.anularGuia(guia);

        // Devolver saldo si la guía se anula el mismo día y tiene punto de atención
        if (guiaInfo?.punto_atencion_id && guiaInfo?.costo_envio) {
          const hoy = new Date();
          const fechaGuia = new Date(guiaInfo.created_at);

          // Verificar si es el mismo día (comparar año, mes y día)
          const esMismoDia =
            hoy.getFullYear() === fechaGuia.getFullYear() &&
            hoy.getMonth() === fechaGuia.getMonth() &&
            hoy.getDate() === fechaGuia.getDate();

          if (esMismoDia) {
            await dbService.devolverSaldo(
              guiaInfo.punto_atencion_id,
              Number(guiaInfo.costo_envio)
            );
            console.log(
              `✅ Saldo devuelto: $${guiaInfo.costo_envio} al punto ${guiaInfo.punto_atencion_id}`
            );
          } else {
            console.log(
              "⚠️ La guía no se anula el mismo día, no se devuelve saldo"
            );
          }
        }
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

    // 🔐 Obtener punto_atencion_id Y usuario_id del usuario autenticado
    const punto_atencion_id = req.user?.punto_atencion_id;
    const usuario_id = req.user?.id;

    console.log("🔍 GET /guias - Filtro de búsqueda:", {
      punto_atencion_id,
      usuario_id,
      desde,
      hasta,
    });

    // ⚠️ IMPORTANTE: Usar usuario_id como filtro principal si no hay punto_atencion_id
    // Esto asegura que se vean las guías creadas aunque la jornada no esté activa
    if (!punto_atencion_id && !usuario_id) {
      console.warn("⚠️ Usuario sin punto_atencion_id ni usuario_id asignado");
      return res.json([]);
    }

    const guias = await dbService.obtenerGuias(
      (desde as string) || undefined,
      (hasta as string) || undefined,
      punto_atencion_id || undefined, // 👈 FILTRAR por punto de atención
      usuario_id || undefined // 👈 FILTRAR por usuario (fallback si no hay punto)
    );

    console.log("📋 Guías recuperadas de BD:", {
      cantidad: guias?.length || 0,
      desde,
      hasta,
      punto_atencion_id,
      usuario_id,
    });

    // 🔧 Devolver array directamente, no envuelto en objeto
    return res.json(guias || []);
  } catch (error) {
    console.error("💥 Error al consultar guías:", error);
    return res.status(500).json({
      error: "Error al consultar guías",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export { router as shippingRouter };
