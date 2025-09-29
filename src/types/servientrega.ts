export interface Remitente {
  identificacion: string;
  cedula?: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email?: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  pais?: string;
}

export interface Destinatario {
  identificacion: string;
  cedula?: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email?: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  pais: string;
  codpais: number;
}

export interface Medidas {
  alto: number;
  ancho: number;
  largo: number;
  peso: number;
  valor_declarado: number;
  valor_seguro: number;
  recoleccion: boolean;
  contenido: string;
  /** Cantidad de piezas del envío (opcional). */
  piezas?: number;
}

export interface Empaque {
  tipo_empaque: string;
  cantidad: number;
  descripcion: string;
  costo_unitario: number;
  costo_total: number;
}

export interface ResumenCostos {
  costo_empaque: number;
  valor_seguro: number;
  flete: number;
  total: number;
}

export interface FormDataGuia {
  nombre_producto: string;
  contenido: string;
  retiro_oficina: boolean;
  nombre_agencia_retiro_oficina?: string;
  pedido?: string;
  factura?: string;
  punto_atencion_id: string;
  remitente: Remitente;
  destinatario: Destinatario;
  medidas: Medidas;
  empaque?: Empaque;
  requiere_empaque: boolean;
  resumen_costos: ResumenCostos;
}

export interface Guia {
  id: string;
  numero_guia: string;
  base64_response?: string; // Para compatibilidad con código existente
  pdf_base64?: string; // Campo que viene del backend de informes
  created_at?: string; // Para compatibilidad con código existente
  fecha_creacion?: string; // Campo que viene del backend de informes
  estado: "ACTIVA" | "ANULADA" | "PENDIENTE_ANULACION";
  punto_atencion_id: string;
  usuario_id?: string;
  usuario_nombre?: string;
  punto_atencion_nombre?: string;
  destinatario_nombre?: string;
  destinatario_telefono?: string;
  destinatario_direccion?: string;
  valor_declarado?: number;
  costo_envio?: number;
  motivo_anulacion?: string;
  fecha_anulacion?: string;
  anulada_por?: string;
}

export interface SolicitudAnulacionGuia {
  id: string;
  guia_id: string;
  numero_guia: string;
  motivo: string;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  solicitado_por: string;
  solicitado_por_nombre?: string;
  punto_atencion_id: string;
  punto_atencion_nombre?: string;
  fecha_solicitud: string;
  fecha_respuesta?: string;
  respondido_por?: string;
  respondido_por_nombre?: string;
  comentario_respuesta?: string;
}
