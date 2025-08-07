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

// Función para obtener credenciales (en producción desde env)
export const getCredenciales = () => {
  return {
    usuingreso:
      process.env.NEXT_PUBLIC_SERVIENTREGA_USUARIO ||
      SERVIENTREGA_CONFIG.USUARIO_PRUEBA,
    contrasenha:
      process.env.NEXT_PUBLIC_SERVIENTREGA_CONTRASENA ||
      SERVIENTREGA_CONFIG.CONTRASENA_PRUEBA,
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
  const tarifaData = Array.isArray(data) ? data[0] : data;

  console.log("🔍 Procesando respuesta de tarifa:", tarifaData);

  // Servientrega puede devolver diferentes campos según la respuesta
  const flete = Number(tarifaData.flete || tarifaData.tarifa0 || 0);
  const valorEmpaque = Number(tarifaData.valor_empaque || 0);
  const seguro = Number(tarifaData.seguro || tarifaData.prima || 0);
  const total = Number(tarifaData.gtotal || 0);

  // Si el flete es 0 pero hay gtotal, usar gtotal como base
  const fleteCalculado =
    flete > 0 ? flete : Math.max(0, total - valorEmpaque - seguro);

  return {
    flete: fleteCalculado,
    valor_declarado: Number(tarifaData.valor_declarado || 0),
    valor_empaque: valorEmpaque,
    seguro: seguro,
    tiempo: tarifaData.tiempo
      ? `${tarifaData.tiempo} día(s) hábil(es)`
      : "1-2 días hábiles",
    peso_vol: Number(tarifaData.volumen || tarifaData.peso_vol || 0),
    // Campos adicionales de Servientrega
    gtotal: total,
    peso_cobrar: Number(tarifaData.peso_cobrar || 0),
    tiva: Number(tarifaData.tiva || 0),
    prima: Number(tarifaData.prima || 0),
  };
};
