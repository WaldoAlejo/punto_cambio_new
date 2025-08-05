export interface Remitente {
  identificacion: string;
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
