// src/config/servientrega.ts
// Frontend: NO se envían credenciales. El backend inyecta SERVIENTREGA_USER / SERVIENTREGA_PASSWORD desde .env.

// ==============================
// Config & Helpers
// ==============================

export const PRODUCTO_MERCANCIA = "MERCANCIA PREMIER" as const;
export const PRODUCTO_DOCUMENTO = "DOCUMENTO" as const; // ← singular (alineado al WS)
export type ProductoServientrega =
  | typeof PRODUCTO_MERCANCIA
  | typeof PRODUCTO_DOCUMENTO;

export const SERVIENTREGA_CONFIG = {
  // Valores por defecto
  DEFAULT_PRODUCTO: PRODUCTO_MERCANCIA as ProductoServientrega, // Solo 2 opciones según la doc

  // Códigos postales por defecto (para internacional si no vienen)
  DEFAULT_CP_ORI: "170150",
  DEFAULT_CP_DES: "110111",

  // Umbrales y mínimos
  UMBRAL_SALDO_BAJO: 2.0,
  PESO_MINIMO: 0.5,

  // Tipos de empaque válidos (UI) — NO se manda por defecto al WS
  TIPOS_EMPAQUE: ["SOBRE", "CAJA", "AISLANTE DE HUMEDAD", "BOLSA"] as const,

  // Productos válidos (UI) — ALINEADO A DOC OFICIAL
  PRODUCTOS: [PRODUCTO_MERCANCIA, PRODUCTO_DOCUMENTO] as const,
};

// Normalizador (compatible ES5/ES2015): elimina diacríticos sin usar \p{...}
const clean = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const toNum = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

type UnknownRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is UnknownRecord => typeof v === "object" && v !== null;

// Normaliza cualquier input a uno de los DOS productos válidos
export const normalizarProducto = (raw?: string): ProductoServientrega => {
  const c = clean(raw || "");
  if (c === PRODUCTO_DOCUMENTO) return PRODUCTO_DOCUMENTO;
  // Cualquier otro valor cae a MERCANCIA PREMIER por defecto
  return PRODUCTO_MERCANCIA;
};

// Helper para saber si es DOCUMENTO
export const esDocumento = (raw?: string) =>
  normalizarProducto(raw) === PRODUCTO_DOCUMENTO;

// ==============================
// Tipos de ayuda (opcionales)
// ==============================

export type TarifaInput = {
  remitente: {
    ciudad: string;
    provincia: string;
    pais?: string;
    codigo_postal?: string;
  };
  destinatario: {
    ciudad: string;
    provincia: string;
    pais?: string;
    codigo_postal?: string;
  };
  medidas: {
    valor_seguro: number;
    valor_declarado: number;
    peso: number;
    alto: number;
    ancho: number;
    largo: number;
  };
  empaque?: { tipo_empaque?: string }; // opcional
  nombre_producto?: string; // se normaliza a 2 opciones
  recoleccion?: boolean;
};

export type GuiaInput = {
  formData: {
    nombre_producto?: string; // se normaliza a 2 opciones
    remitente: {
      cedula?: string;
      nombre?: string;
      direccion?: string;
      telefono?: string;
      codigo_postal?: string;
      ciudad: string;
      provincia: string;
      email?: string;
      pais?: string;
    };
    destinatario: {
      cedula?: string;
      nombre?: string;
      direccion?: string;
      telefono?: string;
      codigo_postal?: string;
      ciudad: string;
      provincia: string;
      pais?: string;
    };
    medidas: {
      valor_declarado?: number;
      valor_seguro?: number;
      peso?: number;
      alto?: number;
      ancho?: number;
      largo?: number;
    };
  };
  contenido: string;
  retiro_oficina: boolean;
  nombre_agencia_retiro_oficina?: string;
  pedido?: string;
  factura?: string;
};

// ==============================
// Tarifa
// ==============================

export const formatearPayloadTarifa = (data: TarifaInput) => {
  const producto = normalizarProducto(data?.nombre_producto);
  const esInternacional =
    clean(data?.destinatario?.pais || "ECUADOR") !== "ECUADOR";

  const basePayload: Record<string, string> = {
    tipo: esInternacional
      ? "obtener_tarifa_internacional"
      : "obtener_tarifa_nacional",
    ciu_ori: clean(data?.remitente?.ciudad || ""),
    provincia_ori: clean(data?.remitente?.provincia || ""),
    ciu_des: clean(data?.destinatario?.ciudad || ""),
    provincia_des: clean(data?.destinatario?.provincia || ""),
    valor_seguro: String(toNum(data?.medidas?.valor_seguro, 0)),
    valor_declarado: String(toNum(data?.medidas?.valor_declarado, 0)),
    peso: String(toNum(data?.medidas?.peso, 0)),
    alto: String(toNum(data?.medidas?.alto, 0)),
    ancho: String(toNum(data?.medidas?.ancho, 0)),
    largo: String(toNum(data?.medidas?.largo, 0)),
    recoleccion: data?.recoleccion ? "SI" : "NO",
    nombre_producto: producto, // SOLO 2 valores válidos
    // ⚠️ empaque: NO se envía por defecto
  };

  // Solo incluir empaque si fue provisto y no está vacío
  const empaque = clean(data?.empaque?.tipo_empaque || "");
  if (empaque) {
    basePayload.empaque = empaque;
  }

  if (esInternacional) {
    return {
      ...basePayload,
      pais_ori: clean(data?.remitente?.pais || "ECUADOR"),
      pais_des: clean(data?.destinatario?.pais || ""),
      codigo_postal_ori:
        data?.remitente?.codigo_postal || SERVIENTREGA_CONFIG.DEFAULT_CP_ORI,
      codigo_postal_des:
        data?.destinatario?.codigo_postal || SERVIENTREGA_CONFIG.DEFAULT_CP_DES,
    };
  }

  return basePayload;
};

export const procesarRespuestaTarifa = (data: unknown) => {
  const rec = isRecord(data) ? data : ({} as UnknownRecord);
  // Mismos nombres que devuelve el WS; convertimos a número donde aplica
  const flete = Number(rec["flete"] || 0);
  const valorEmpaque = Number(rec["valor_empaque"] || 0);
  const valorEmpaqueIva = Number(rec["valor_empaque_iva"] || 0);
  const totalEmpaque = Number(rec["total_empaque"] || 0);
  const prima = Number(rec["prima"] || 0);
  const descuento = Number(rec["descuento"] || 0);
  const tarifa0 = Number(rec["tarifa0"] || 0);
  const tarifa12 = Number(rec["tarifa12"] || 0);
  const tiva = Number(rec["tiva"] || 0);
  const gtotal = Number(rec["gtotal"] || 0);
  const totalTransacion = Number(rec["total_transacion"] || 0);
  const pesoCobrar = Number(rec["peso_cobrar"] || 0);
  const volumen = Number(rec["volumen"] || 0);

  return {
    flete,
    valor_declarado: Number(rec["valor_declarado"] || 0),
    valor_empaque: valorEmpaque,
    valor_empaque_iva: valorEmpaqueIva,
    total_empaque: totalEmpaque,
    seguro: prima, // "prima" = seguro
    tiempo: rec["tiempo"]
      ? `${String(rec["tiempo"])} día(s) hábil(es)`
      : "1-2 días hábiles",
    peso_vol: volumen,
    trayecto: String(rec["trayecto"] || ""),
    descuento,
    tarifa0,
    tarifa12,
    gtotal,
    total_transacion: totalTransacion, // valor real a cobrar
    peso_cobrar: pesoCobrar,
    tiva,
    prima,
  };
};

// ==============================
// Generación de Guía
// ==============================

export const formatearPayloadGuia = (data: GuiaInput) => {
  const { formData } = data;
  const producto = normalizarProducto(formData?.nombre_producto);

  // "CIUDAD-PROVINCIA" según WS
  const ciudadOrigen = `${clean(formData?.remitente?.ciudad || "")}-${clean(
    formData?.remitente?.provincia || ""
  )}`;
  const ciudadDestino = `${clean(formData?.destinatario?.ciudad || "")}-${clean(
    formData?.destinatario?.provincia || ""
  )}`;

  // Documento: medidas a 0 y peso mínimo
  const isDoc = producto === PRODUCTO_DOCUMENTO;

  return {
    tipo: "GeneracionGuia",

    // Producto (solo 2 valores válidos)
    nombre_producto: producto,

    // Remitente
    ciudad_origen: ciudadOrigen,
    cedula_remitente: formData?.remitente?.cedula || "",
    nombre_remitente: formData?.remitente?.nombre || "",
    direccion_remitente: formData?.remitente?.direccion || "",
    telefono_remitente: formData?.remitente?.telefono || "",
    codigo_postal_remitente: formData?.remitente?.codigo_postal || "",

    // Destinatario
    cedula_destinatario: formData?.destinatario?.cedula || "",
    nombre_destinatario: formData?.destinatario?.nombre || "",
    direccion_destinatario: formData?.destinatario?.direccion || "",
    telefono_destinatario: formData?.destinatario?.telefono || "",
    ciudad_destinatario: ciudadDestino,
    pais_destinatario: formData?.destinatario?.pais || "ECUADOR",
    codigo_postal_destinatario: formData?.destinatario?.codigo_postal || "",

    // Envío
    contenido: data.contenido,
    retiro_oficina: data.retiro_oficina ? "SI" : "NO",
    nombre_agencia_retiro_oficina:
      data.retiro_oficina && data.nombre_agencia_retiro_oficina
        ? data.nombre_agencia_retiro_oficina
        : undefined,

    // Referencias opcionales (no mandar "PRUEBA")
    pedido: data.pedido || undefined,
    factura: data.factura || undefined,

    // Valores y medidas
    valor_declarado: toNum(formData?.medidas?.valor_declarado, 0),
    valor_asegurado: toNum(formData?.medidas?.valor_seguro, 0),
    peso_fisico: isDoc
      ? Math.max(
          toNum(formData?.medidas?.peso, 0),
          SERVIENTREGA_CONFIG.PESO_MINIMO
        )
      : toNum(formData?.medidas?.peso, 0),
    peso_volumentrico: 0, // el backend lo recalcula si aplica
    piezas: 1,
    alto: isDoc ? 0 : Math.max(toNum(formData?.medidas?.alto, 0), 1),
    ancho: isDoc ? 0 : Math.max(toNum(formData?.medidas?.ancho, 0), 1),
    largo: isDoc ? 0 : Math.max(toNum(formData?.medidas?.largo, 0), 1),

    // Tipo de guía
    tipo_guia: "1",

    // Contacto remitente (requerido por WS)
    mail_remite: formData?.remitente?.email || "correoremitente@gmail.com",

    // ⚠️ No enviar credenciales ni 'alianza' desde el front.
  };
};

export const procesarRespuestaGuia = (data: unknown) => {
  // La respuesta puede venir como string (dos JSON pegados) o como objeto
  let tarifaData: unknown = {};
  let fetchData: unknown = {};

  if (typeof data === "string") {
    try {
      const firstBracketEnd = data.indexOf("}]");
      if (firstBracketEnd !== -1) {
        const tarifaPart = data.substring(0, firstBracketEnd + 2);
        const fetchPart = data.substring(firstBracketEnd + 2);

        const parsedTarifa = JSON.parse(tarifaPart);
        tarifaData = Array.isArray(parsedTarifa) ? parsedTarifa[0] : parsedTarifa;
        fetchData = JSON.parse(fetchPart) || {};
      }
    } catch (error) {
      console.error("Error al parsear respuesta de guía:", error);
    }
  } else if (isRecord(data) || Array.isArray(data)) {
    tarifaData = Array.isArray(data) ? data[0] : data;
    fetchData = isRecord(data) ? (data["fetch"] ?? {}) : {};
  }

  const tarifaRec = isRecord(tarifaData) ? tarifaData : ({} as UnknownRecord);
  const fetchRec = isRecord(fetchData) ? fetchData : ({} as UnknownRecord);
  const trayectoRaw = tarifaRec["trayecto"];
  const trayectoNum = Number(trayectoRaw);
  const trayecto = Number.isFinite(trayectoNum)
    ? trayectoNum
    : typeof trayectoRaw === "string"
      ? trayectoRaw
      : "";

  return {
    // Datos de tarifa
    flete: Number(tarifaRec["flete"] || 0),
    valor_declarado: Number(tarifaRec["valor_declarado"] || 0),
    tiempo: String(tarifaRec["tiempo"] || "1-2 días"),
    valor_empaque: Number(tarifaRec["valor_empaque"] || 0),
    valor_empaque_iva: Number(tarifaRec["valor_empaque_iva"] || 0),
    total_empaque: Number(tarifaRec["total_empaque"] || 0),
    trayecto,
    prima: Number(tarifaRec["prima"] || 0),
    peso: Number(tarifaRec["peso"] || 0),
    volumen: Number(tarifaRec["volumen"] || 0),
    peso_cobrar: Number(tarifaRec["peso_cobrar"] || 0),
    descuento: Number(tarifaRec["descuento"] || 0),
    tarifa0: Number(tarifaRec["tarifa0"] || 0),
    tarifa12: Number(tarifaRec["tarifa12"] || 0),
    tiva: Number(tarifaRec["tiva"] || 0),
    gtotal: Number(tarifaRec["gtotal"] || 0),
    total_transacion: Number(
      (tarifaRec["total_transacion"] as unknown) || tarifaRec["gtotal"] || 0
    ),

    // Guía
    proceso: String(fetchRec["proceso"] || ""),
    guia: String(fetchRec["guia"] || ""),
    guia_pdf: String(fetchRec["guia_pdf"] || ""),
    guia_64: String(fetchRec["guia_64"] || ""),
  };
};
