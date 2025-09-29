// Configuración para Servientrega
export const SERVIENTREGA_CONFIG = {
  // Credenciales de prueba - En producción deben venir de variables de entorno
  USUARIO_PRUEBA: "PRUEBA",
  CONTRASENA_PRUEBA: "s12345ABCDe",

  // Valores por defecto
  DEFAULT_EMPAQUE: "AISLANTE DE HUMEDAD",
  DEFAULT_PRODUCTO: "PREMIER",

  // Códigos postales por defecto
  DEFAULT_CP_ORI: "170150",
  DEFAULT_CP_DES: "110111",

  // Umbrales
  UMBRAL_SALDO_BAJO: 2.0,
  PESO_MINIMO: 0.5,

  // Tipos de empaque válidos
  TIPOS_EMPAQUE: ["SOBRE", "CAJA", "AISLANTE DE HUMEDAD", "BOLSA"],

  // Productos válidos
  PRODUCTOS: ["PREMIER", "ESTANDAR", "EXPRESS"],
};

// Función para obtener credenciales (usando credenciales de prueba según documentación)
export const getCredenciales = () => {
  return {
    usuingreso: "PRUEBA", // Credenciales de prueba según documentación
    contrasenha: "s12345ABCDe", // Credenciales de prueba según documentación
  };
};

// Función para formatear payload de tarifa
export const formatearPayloadTarifa = (data: {
  remitente: any;
  destinatario: any;
  medidas: any;
  empaque?: any;
  nombre_producto?: string;
  recoleccion?: boolean;
}) => {
  const credenciales = getCredenciales();

  // Determinar si es internacional
  const esInternacional =
    (data.destinatario?.pais || "ECUADOR").toUpperCase() !== "ECUADOR";

  const basePayload = {
    tipo: esInternacional
      ? "obtener_tarifa_internacional"
      : "obtener_tarifa_nacional",
    ciu_ori: data.remitente.ciudad.toUpperCase(),
    provincia_ori: data.remitente.provincia.toUpperCase(),
    ciu_des: data.destinatario.ciudad.toUpperCase(),
    provincia_des: data.destinatario.provincia.toUpperCase(),
    valor_seguro: data.medidas.valor_seguro.toString(),
    valor_declarado: data.medidas.valor_declarado.toString(),
    peso: data.medidas.peso.toString(),
    alto: data.medidas.alto.toString(),
    ancho: data.medidas.ancho.toString(),
    largo: data.medidas.largo.toString(),
    recoleccion: data.recoleccion ? "SI" : "NO",
    nombre_producto:
      data.nombre_producto || SERVIENTREGA_CONFIG.DEFAULT_PRODUCTO,
    empaque: data.empaque?.tipo_empaque || SERVIENTREGA_CONFIG.DEFAULT_EMPAQUE,
    usuingreso: credenciales.usuingreso,
    contrasenha: credenciales.contrasenha,
  };

  // Agregar campos específicos para internacional
  if (esInternacional) {
    return {
      ...basePayload,
      pais_ori: data.remitente?.pais || "ECUADOR",
      pais_des: data.destinatario?.pais || "",
      codigo_postal_ori:
        data.remitente?.codigo_postal || SERVIENTREGA_CONFIG.DEFAULT_CP_ORI,
      codigo_postal_des:
        data.destinatario?.codigo_postal || SERVIENTREGA_CONFIG.DEFAULT_CP_DES,
    };
  }

  return basePayload;
};

// Función para procesar respuesta de tarifa
export const procesarRespuestaTarifa = (data: any) => {
  console.log("🔍 Procesando respuesta de tarifa:", data);

  // Convertir strings a números donde sea necesario
  const flete = Number(data.flete || 0);
  const valorEmpaque = Number(data.valor_empaque || 0);
  const valorEmpaqueIva = Number(data.valor_empaque_iva || 0);
  const totalEmpaque = Number(data.total_empaque || 0);
  const prima = Number(data.prima || 0);
  const descuento = Number(data.descuento || 0);
  const tarifa0 = Number(data.tarifa0 || 0);
  const tarifa12 = Number(data.tarifa12 || 0);
  const tiva = Number(data.tiva || 0);
  const gtotal = Number(data.gtotal || 0);
  const totalTransacion = Number(data.total_transacion || 0);
  const pesoCobrar = Number(data.peso_cobrar || 0);
  const volumen = Number(data.volumen || 0);

  return {
    flete,
    valor_declarado: Number(data.valor_declarado || 0),
    valor_empaque: valorEmpaque,
    valor_empaque_iva: valorEmpaqueIva,
    total_empaque: totalEmpaque,
    seguro: prima, // En Servientrega, el seguro se llama "prima"
    tiempo: data.tiempo
      ? `${data.tiempo} día(s) hábil(es)`
      : "1-2 días hábiles",
    peso_vol: volumen,
    trayecto: data.trayecto || "",
    descuento,
    tarifa0,
    tarifa12,
    // Campos adicionales de Servientrega
    gtotal,
    total_transacion: totalTransacion, // Este es el valor real a cobrar
    peso_cobrar: pesoCobrar,
    tiva,
    prima,
  };
};

// Función para formatear payload de generación de guía
export const formatearPayloadGuia = (data: {
  formData: any;
  contenido: string;
  retiro_oficina: boolean;
  nombre_agencia_retiro_oficina?: string;
  pedido?: string;
  factura?: string;
}) => {
  const credenciales = getCredenciales();
  const { formData } = data;

  // Formatear ciudad con provincia
  const ciudadOrigen = `${formData.remitente.ciudad.toUpperCase()}-${formData.remitente.provincia.toUpperCase()}`;
  const ciudadDestino = `${formData.destinatario.ciudad.toUpperCase()}-${formData.destinatario.provincia.toUpperCase()}`;

  return {
    tipo: "GeneracionGuia",
    nombre_producto:
      formData.nombre_producto || SERVIENTREGA_CONFIG.DEFAULT_PRODUCTO,
    ciudad_origen: ciudadOrigen,
    cedula_remitente: formData.remitente.cedula || "PRUEBA",
    nombre_remitente: formData.remitente.nombre || "PRUEBA",
    direccion_remitente: formData.remitente.direccion || "PRUEBA",
    telefono_remitente: formData.remitente.telefono || "PRUEBA",
    codigo_postal_remitente: formData.remitente.codigo_postal || "PRUEBA",
    cedula_destinatario: formData.destinatario.cedula || "PRUEBA",
    nombre_destinatario: formData.destinatario.nombre || "PRUEBA",
    direccion_destinatario: formData.destinatario.direccion || "PRUEBA",
    telefono_destinatario: formData.destinatario.telefono || "PRUEBA",
    ciudad_destinatario: ciudadDestino,
    pais_destinatario: formData.destinatario.pais || "ECUADOR",
    codigo_postal_destinatario: formData.destinatario.codigo_postal || "PRUEBA",
    contenido: data.contenido,
    retiro_oficina: data.retiro_oficina ? "SI" : "NO",
    nombre_agencia_retiro_oficina: data.nombre_agencia_retiro_oficina || "",
    pedido: data.pedido || "PRUEBA",
    factura: data.factura || "PRUEBA",
    valor_declarado: Number(formData.medidas.valor_declarado || 0),
    valor_asegurado: Number(formData.medidas.valor_seguro || 0),
    peso_fisico: Math.max(Number(formData.medidas.peso || 1), 1),
    peso_volumentrico: 0, // Se calcula automáticamente
    piezas: 1,
    alto: Math.max(Number(formData.medidas.alto || 10), 1),
    ancho: Math.max(Number(formData.medidas.ancho || 10), 1),
    largo: Math.max(Number(formData.medidas.largo || 10), 1),
    tipo_guia: "1",
    // Campos obligatorios para el entorno de pruebas de Servientrega
    alianza: "PRUEBAS",
    alianza_oficina:
      data.retiro_oficina && data.nombre_agencia_retiro_oficina
        ? data.nombre_agencia_retiro_oficina
        : "DON JUAN_INICIAL_XR",
    mail_remite: formData.remitente.email || "correoremitente@gmail.com",
    usuingreso: credenciales.usuingreso,
    contrasenha: credenciales.contrasenha,
  };
};

// Función para procesar respuesta de generación de guía
export const procesarRespuestaGuia = (data: any) => {
  console.log("🔍 Procesando respuesta de guía:", data);

  let tarifaData: any = {};
  let fetchData: any = {};

  // Si la respuesta es un string, intentar parsear las dos partes
  if (typeof data === "string") {
    try {
      // Buscar donde termina el primer JSON y empieza el segundo
      const firstBracketEnd = data.indexOf("}]");
      if (firstBracketEnd !== -1) {
        const tarifaPart = data.substring(0, firstBracketEnd + 2);
        const fetchPart = data.substring(firstBracketEnd + 2);

        tarifaData = JSON.parse(tarifaPart)[0] || {};
        fetchData = JSON.parse(fetchPart) || {};
      }
    } catch (error) {
      console.error("Error al parsear respuesta de guía:", error);
    }
  } else if (data && typeof data === "object") {
    // Si ya es un objeto, usar la estructura existente
    tarifaData = Array.isArray(data) ? data[0] : data;
    fetchData = data.fetch || {};
  }

  return {
    // Datos de tarifa actualizados
    flete: Number(tarifaData.flete || 0),
    valor_declarado: Number(tarifaData.valor_declarado || 0),
    tiempo: tarifaData.tiempo || "1-2 días",
    valor_empaque: Number(tarifaData.valor_empaque || 0),
    valor_empaque_iva: Number(tarifaData.valor_empaque_iva || 0),
    total_empaque: Number(tarifaData.total_empaque || 0),
    trayecto: tarifaData.trayecto || "",
    prima: Number(tarifaData.prima || 0),
    peso: Number(tarifaData.peso || 0),
    volumen: Number(tarifaData.volumen || 0),
    peso_cobrar: Number(tarifaData.peso_cobrar || 0),
    descuento: Number(tarifaData.descuento || 0),
    tarifa0: Number(tarifaData.tarifa0 || 0),
    tarifa12: Number(tarifaData.tarifa12 || 0),
    tiva: Number(tarifaData.tiva || 0),
    gtotal: Number(tarifaData.gtotal || 0),
    total_transacion: Number(
      tarifaData.total_transacion || tarifaData.gtotal || 0
    ),

    // Datos de la guía generada
    proceso: fetchData.proceso || "",
    guia: fetchData.guia || "",
    guia_pdf: fetchData.guia_pdf || "",
    guia_64: fetchData.guia_64 || "",
  };
};
