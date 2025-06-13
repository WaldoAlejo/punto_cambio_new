export interface User {
  id: string;
  username: string;
  nombre: string;
  correo?: string;
  telefono?: string;
  rol: 'SUPER_USUARIO' | 'ADMIN' | 'OPERADOR' | 'CONCESION';
  activo: boolean;
  punto_atencion_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PuntoAtencion {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigo_postal?: string;
  telefono?: string;
  activo: boolean;
  usuario_logueado?: User;
  created_at: string;
  updated_at: string;
  saldos?: Saldo[];
}

export interface Moneda {
  id: string;
  nombre: string;
  simbolo: string;
  codigo: string;
  activo: boolean;
  orden_display?: number;
  created_at: string;
  updated_at: string;
}

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

export interface DatosCliente {
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string;
}

export interface DetalleDivisas {
  billetes: number;
  monedas: number;
  total: number;
}

export interface CambioDivisa {
  id: string;
  fecha: string;
  monto_origen: number;
  monto_destino: number;
  tasa_cambio: number;
  tipo_operacion: 'COMPRA' | 'VENTA';
  moneda_origen_id: string;
  moneda_destino_id: string;
  usuario_id: string;
  punto_atencion_id: string;
  observacion?: string;
  numero_recibo?: string;
  estado: 'COMPLETADO' | 'PENDIENTE' | 'CANCELADO';
  // Nuevos campos
  datos_cliente: DatosCliente;
  divisas_entregadas: DetalleDivisas;
  divisas_recibidas: DetalleDivisas;
  monedaOrigen?: Moneda;
  monedaDestino?: Moneda;
  usuario?: User;
  puntoAtencion?: PuntoAtencion;
}

export interface ResponsableMovilizacion {
  nombre: string;
  cedula: string;
  telefono: string;
}

export interface Transferencia {
  id: string;
  origen_id?: string;
  destino_id: string;
  moneda_id: string;
  monto: number;
  tipo_transferencia: 'ENTRE_PUNTOS' | 'DEPOSITO_MATRIZ' | 'RETIRO_GERENCIA' | 'DEPOSITO_GERENCIA';
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'EN_TRANSITO' | 'RECIBIDO';
  solicitado_por: string;
  aprobado_por?: string;
  fecha: string;
  fecha_aprobacion?: string;
  descripcion?: string;
  numero_recibo?: string;
  // Nuevos campos
  detalle_divisas: DetalleDivisas;
  responsable_movilizacion?: ResponsableMovilizacion;
  validacion_recepcion?: {
    fecha: string;
    usuario_receptor: string;
    divisas_recibidas: DetalleDivisas;
    observaciones?: string;
  };
  origen?: PuntoAtencion;
  destino?: PuntoAtencion;
  moneda?: Moneda;
  usuarioSolicitante?: User;
  usuarioAprobador?: User;
}

export interface SalidaEspontanea {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha_salida: string;
  fecha_regreso?: string;
  motivo: 'DEPOSITO' | 'RETIRO' | 'MOVILIZACION_DIVISAS' | 'OTROS';
  descripcion?: string;
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  ubicacion_regreso?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  duracion_minutos?: number;
  usuario?: User;
  puntoAtencion?: PuntoAtencion;
}

export interface JornadaLaboral {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha_inicio: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
  estado: 'TRABAJANDO' | 'ALMUERZO' | 'FINALIZADO';
  ubicacion_inicio?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  salidas_espontaneas?: SalidaEspontanea[];
  usuario?: User;
  puntoAtencion?: PuntoAtencion;
}

export interface CuadreCaja {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha: string;
  tipo_cierre: 'PARCIAL' | 'TOTAL';
  estado: 'ABIERTO' | 'CERRADO';
  total_cambios: number;
  total_transferencias_entrada: number;
  total_transferencias_salida: number;
  fecha_cierre?: string;
  observaciones?: string;
  usuario?: User;
  puntoAtencion?: PuntoAtencion;
  detalles?: DetalleCuadreCaja[];
}

export interface DetalleCuadreCaja {
  id: string;
  cuadre_id: string;
  moneda_id: string;
  saldo_sistema: number;
  saldo_fisico_billetes: number;
  saldo_fisico_monedas: number;
  saldo_fisico_total: number;
  diferencia: number;
  cuadra_automaticamente: boolean;
  moneda?: Moneda;
}

export interface HistorialSaldo {
  id: string;
  punto_atencion_id: string;
  moneda_id: string;
  usuario_id: string;
  cantidad_anterior: number;
  cantidad_incrementada: number;
  cantidad_nueva: number;
  tipo_movimiento: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA_ENTRANTE' | 'TRANSFERENCIA_SALIENTE' | 'CAMBIO_DIVISA';
  fecha: string;
  descripcion?: string;
  numero_referencia?: string;
  puntoAtencion?: PuntoAtencion;
  moneda?: Moneda;
  usuario?: User;
}

// Alias para compatibilidad
export type AttentionPoint = PuntoAtencion;
export type Currency = Moneda;
export type CurrencyExchange = CambioDivisa;
export type Transfer = Transferencia;
export type DailyClose = CuadreCaja;
