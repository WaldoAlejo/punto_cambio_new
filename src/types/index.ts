// Tipos base del sistema
export interface Usuario {
  id: string;
  username: string;
  nombre: string;
  correo?: string;
  telefono?: string;
  rol: "SUPER_USUARIO" | "ADMIN" | "OPERADOR" | "CONCESION";
  activo: boolean;
  punto_atencion_id?: string;
  created_at: string;
  updated_at: string;
}

// Alias para compatibilidad
export type User = Usuario;

export interface PuntoAtencion {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigo_postal?: string;
  telefono?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Moneda {
  id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  activo: boolean;
  orden_display: number;
  created_at: string;
  updated_at: string;
}

// Alias para compatibilidad con currencyService
export type Currency = Moneda;

export interface Saldo {
  id: string;
  punto_atencion_id: string;
  moneda_id: string;
  cantidad: number;
  billetes: number;
  monedas_fisicas: number;
  updated_at: string;
  moneda?: Moneda;
}

export interface DetalleDivisasSimple {
  billetes: number;
  monedas: number;
  total: number;
}

export interface ResponsableMovilizacion {
  nombre: string;
  documento: string;
  cedula: string;
  telefono?: string;
}

export interface CambioDivisa {
  id: string;
  numero_recibo?: string | null;
  fecha: string;
  monto_origen: number;
  monto_destino: number;
  tasa_cambio: number;
  tipo_operacion: "COMPRA" | "VENTA";
  moneda_origen_id: string;
  moneda_destino_id: string;
  usuario_id: string;
  punto_atencion_id: string;
  estado: "PENDIENTE" | "COMPLETADO" | "CANCELADO";
  observacion?: string | null;
  datos_cliente?: DatosCliente;
  divisas_entregadas?: DetalleDivisasSimple;
  divisas_recibidas?: DetalleDivisasSimple;
  monedaOrigen?: Moneda;
  monedaDestino?: Moneda;
  usuario?: Usuario;
  puntoAtencion?: PuntoAtencion;
}

export interface Transferencia {
  id: string;
  origen_id?: string | null;
  destino_id: string;
  moneda_id: string;
  monto: number;
  descripcion?: string | null;
  numero_recibo?: string | null;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  tipo_transferencia: "ENTRADA" | "SALIDA" | "INTERNA" | "ENTRE_PUNTOS" | "DEPOSITO_MATRIZ" | "RETIRO_GERENCIA" | "DEPOSITO_GERENCIA";
  solicitado_por: string;
  aprobado_por?: string | null;
  rechazado_por?: string | null;
  fecha: string;
  fecha_aprobacion?: string | null;
  fecha_rechazo?: string | null;
  observaciones_aprobacion?: string | null;
  detalle_divisas?: DetalleDivisasSimple;
  responsable_movilizacion?: ResponsableMovilizacion;
  origen?: PuntoAtencion;
  destino?: PuntoAtencion;
  moneda?: Moneda;
  usuarioSolicitante?: Usuario;
  usuarioAprobador?: Usuario;
  usuarioRechazador?: Usuario;
}

export interface Jornada {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha_inicio: string;
  fecha_almuerzo?: string | null;
  fecha_regreso?: string | null;
  fecha_salida?: string | null;
  estado: "ACTIVO" | "COMPLETADO" | "CANCELADO";
  ubicacion_inicio?: {
    lat: number;
    lng: number;
    direccion?: string;
  } | null;
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  } | null;
  usuario?: Usuario;
  puntoAtencion?: PuntoAtencion;
}

export interface SalidaEspontanea {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  motivo: "BANCO" | "DILIGENCIA_PERSONAL" | "TRAMITE_GOBIERNO" | "EMERGENCIA_MEDICA" | "OTRO";
  descripcion?: string | null;
  fecha_salida: string;
  fecha_regreso?: string | null;
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  } | null;
  ubicacion_regreso?: {
    lat: number;
    lng: number;
    direccion?: string;
  } | null;
  duracion_minutos?: number | null;
  aprobado_por?: string | null;
  estado: "ACTIVO" | "COMPLETADO" | "CANCELADO";
  created_at: string;
  updated_at: string;
  usuario?: Usuario;
  puntoAtencion?: PuntoAtencion;
  usuarioAprobador?: Usuario;
}

export interface CuadreCaja {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha: string;
  estado: "ABIERTO" | "CERRADO";
  total_cambios: number;
  total_transferencias_entrada: number;
  total_transferencias_salida: number;
  fecha_cierre?: string | null;
  observaciones?: string | null;
}

// Tipos para formularios de intercambio
export interface DatosCliente {
  nombre: string;
  apellido: string;
  documento: string;
  cedula: string;
  telefono?: string;
  email?: string;
}

export interface Schedule {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: "PROGRAMADO" | "ACTIVO" | "COMPLETADO" | "CANCELADO";
  created_at: string;
  updated_at: string;
  usuario?: Usuario;
  puntoAtencion?: PuntoAtencion;
}

// Tipos de respuesta de la API
export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  timestamp?: string;
}

export interface ListResponse<T> extends ApiResponse<T> {
  data?: T[];
}

// Tipos para formularios
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  nombre: string;
  correo?: string;
  telefono?: string;
  rol: "SUPER_USUARIO" | "ADMIN" | "OPERADOR" | "CONCESION";
  punto_atencion_id?: string;
}

export interface CreatePointData {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia?: string;
  codigo_postal?: string;
  telefono?: string;
}

export interface CreateCurrencyData {
  nombre: string;
  simbolo: string;
  codigo: string;
  orden_display?: number;
}

export interface CreateTransferData {
  destino_id: string;
  moneda_id: string;
  monto: number;
  descripcion?: string;
  tipo_transferencia: "ENTRADA" | "SALIDA" | "INTERNA" | "ENTRE_PUNTOS" | "DEPOSITO_MATRIZ" | "RETIRO_GERENCIA" | "DEPOSITO_GERENCIA";
  origen_id?: string;
}

export interface CreateExchangeData {
  moneda_origen_id: string;
  moneda_destino_id: string;
  monto_origen: number;
  tasa_cambio: number;
  tipo_operacion: "COMPRA" | "VENTA";
  observacion?: string;
}

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  reportType: "exchanges" | "transfers" | "balances" | "users";
  pointId?: string;
  userId?: string;
}

export interface ReportData {
  point: string;
  user?: string;
  amount?: number;
  transfers?: number;
  balance?: number;
  exchanges?: number;
}
