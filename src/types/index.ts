
// Tipos principales basados en el schema de Prisma
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
}

export interface Moneda {
  id: string;
  nombre: string;
  simbolo: string;
  codigo: string;
  activo: boolean;
  orden_display: number;
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
}

export interface Movimiento {
  id: string;
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA_ENTRANTE' | 'TRANSFERENCIA_SALIENTE' | 'CAMBIO_DIVISA';
  monto: number;
  moneda_id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha: string;
  descripcion?: string;
  numero_recibo?: string;
}

export interface Jornada {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha_inicio: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
}

export interface SolicitudSaldo {
  id: string;
  punto_atencion_id: string;
  usuario_id: string;
  moneda_id: string;
  monto_solicitado: number;
  aprobado: boolean;
  fecha_solicitud: string;
  fecha_respuesta?: string;
  observaciones?: string;
}
