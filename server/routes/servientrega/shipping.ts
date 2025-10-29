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

      // Obtener punto de atención si está disponible
      let servientregaAlianza = "PUNTO CAMBIO SAS";
      let servientregaOficinaAlianza = "QUITO_PLAZA DEL VALLE_PC";

      if (punto_atencion_id) {
        try {
          const punto = await prisma.puntoAtencion.findUnique({
            where: { id: punto_atencion_id },
            select: {
              servientrega_alianza: true,
              servientrega_oficina_alianza: true,
            },
          });
          if (punto?.servientrega_alianza) {
            servientregaAlianza = punto.servientrega_alianza;
          }
          if (punto?.servientrega_oficina_alianza) {
            servientregaOficinaAlianza = punto.servientrega_oficina_alianza;
          }
        } catch (e) {
          console.warn("No se pudo obtener datos del punto de atención:", e);
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

      // Primero intentar con total_transacion (suma de todos los costos)
      if (processed?.total_transacion) {
        valorTotalGuia = Number(processed.total_transacion);
      } else if (processed?.gtotal) {
        // gtotal es el gran total (también incluye todos los costos)
        valorTotalGuia = Number(processed.gtotal);
      } else if (processed?.flete) {
        // Si solo viene el flete, usarlo como base
        valorTotalGuia = Number(processed.flete);
        // Sumar otros costos si existen
        if (processed?.valor_asegurado) {
          valorTotalGuia += Number(processed.valor_asegurado);
        }
        if (processed?.valor_empaque) {
          valorTotalGuia += Number(processed.valor_empaque);
        }
      } else if (payload?.valor_total) {
        // Fallback al valor_total del payload
        valorTotalGuia = Number(payload.valor_total);
      }

      console.log("💰 Desglose de costos para guía:", {
        flete: Number(processed?.flete || 0),
        valor_asegurado: Number(processed?.valor_asegurado || 0),
        valor_empaque: Number(processed?.valor_empaque || 0),
        total_transacion: Number(processed?.total_transacion || 0),
        gtotal: Number(processed?.gtotal || 0),
        valor_total_final: valorTotalGuia,
        valor_declarado: Number(req.body?.valor_declarado || 0), // ⚠️ NO se descuenta
      });

      try {
        // 💾 GUARDAR GUÍA SIEMPRE cuando se genera exitosamente
        // (funciona tanto para flujo formateado como no formateado)
        const { remitente, destinatario, punto_atencion_id } = req.body || {};

        // Guardar remitente y destinatario si vienen en el payload (flujo no formateado)
        if (remitente) {
          await db.guardarRemitente(remitente);
        }
        if (destinatario) {
          await db.guardarDestinatario(destinatario);
        }

        // 📌 SIEMPRE guardar la cabecera de guía con punto de atención y costo
        // ⚠️ IMPORTANTE: costo_envio = costo real de envío, NO incluye valor_declarado
        await db.guardarGuia({
          numero_guia: guia,
          proceso: fetchData?.proceso || "Guia Generada",
          base64_response: base64,
          // En este punto no tenemos los IDs de remitente/destinatario creados (si los necesitas, crea primero y usa sus IDs)
          remitente_id: "", // opcional: ajusta si quieres relación estricta
          destinatario_id: "",
          punto_atencion_id: punto_atencion_id || undefined,
          costo_envio: valorTotalGuia > 0 ? Number(valorTotalGuia) : undefined,
          valor_declarado: Number(req.body?.valor_declarado || 0), // Informativo, NO se descuenta
        });

        console.log("✅ Guía guardada en BD:", {
          numero_guia: guia,
          punto_atencion_id,
          costo_envio: valorTotalGuia,
        });

        // 💳 Descontar del saldo SOLO el costo de la guía (no el valor_declarado)
        if (punto_atencion_id && valorTotalGuia > 0) {
          try {
            await db.descontarSaldo(punto_atencion_id, Number(valorTotalGuia));
            console.log("✅ Saldo descontado exitosamente:", {
              punto_atencion_id,
              monto: valorTotalGuia,
            });
          } catch (descError) {
            console.error("❌ Error al descontar saldo:", descError);
            throw descError; // Re-lanzar para que el usuario sepa que falló
          }
        } else {
          console.warn("⚠️ NO se descontó saldo - razones:", {
            punto_atencion_id_presente: !!punto_atencion_id,
            valorTotalGuia_mayor_que_cero: valorTotalGuia > 0,
            punto_atencion_id,
            valorTotalGuia,
          });
        }
      } catch (dbErr) {
        console.error("⚠️ Error al persistir en BD (no bloqueante):", dbErr);
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

    const guias = await dbService.obtenerGuias(
      (desde as string) || undefined,
      (hasta as string) || undefined
    );

    console.log("📋 Guías recuperadas de BD:", {
      cantidad: guias?.length || 0,
      desde,
      hasta,
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
