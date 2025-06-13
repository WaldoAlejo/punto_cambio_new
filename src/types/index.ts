
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
  monedaOrigen?: Moneda;
  monedaDestino?: Moneda;
  usuario?: User;
  puntoAtencion?: PuntoAtencion;
}

export interface Transferencia {
  id: string;
  origen_id?: string;
  destino_id: string;
  moneda_id: string;
  monto: number;
  tipo_transferencia: 'ENTRE_PUNTOS' | 'DEPOSITO_MATRIZ' | 'RETIRO_GERENCIA' | 'DEPOSITO_GERENCIA';
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  solicitado_por: string;
  aprobado_por?: string;
  fecha: string;
  fecha_aprobacion?: string;
  descripcion?: string;
  numero_recibo?: string;
  origen?: PuntoAtencion;
  destino?: PuntoAtencion;
  moneda?: Moneda;
  usuarioAprobador?: User;
}

export interface CuadreCaja {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha: string;
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
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  billetes: number;
  monedas_fisicas: number;
  diferencia: number;
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
