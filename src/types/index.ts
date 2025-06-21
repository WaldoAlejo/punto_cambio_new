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
  // Extended properties for frontend use
  datos_cliente?: DatosCliente;
  divisas_entregadas?: DetalleDivisasSimple;
  divisas_recibidas?: DetalleDivisasSimple;
  monedaOrigen?: Moneda;
  monedaDestino?: Moneda;
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
  rechazado_por?: string;
  fecha: string;
  fecha_aprobacion?: string;
  fecha_rechazo?: string;
  descripcion?: string;
  numero_recibo?: string;
  observaciones_aprobacion?: string;
  // Extended properties for frontend use
  detalle_divisas?: DetalleDivisasSimple;
  responsable_movilizacion?: ResponsableMovilizacion;
  moneda?: Moneda;
  origen?: PuntoAtencion;
  destino?: PuntoAtencion;
  usuarioSolicitante?: User;
  usuarioAprobador?: User;
  usuarioRechazador?: User;
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
  ubicacion_inicio?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO';
  usuario?: User;
  puntoAtencion?: PuntoAtencion;
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

// Tipos adicionales que se necesitan en los componentes
export interface CuadreCaja {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha: string;
  fecha_cierre?: string;
  estado: 'ABIERTO' | 'CERRADO';
  total_cambios: number;
  total_transferencias_entrada: number;
  total_transferencias_salida: number;
  observaciones?: string;
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
}

export interface SalidaEspontanea {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  motivo: 'BANCO' | 'DILIGENCIA_PERSONAL' | 'TRAMITE_GOBIERNO' | 'EMERGENCIA_MEDICA' | 'OTRO';
  descripcion?: string;
  fecha_salida: string;
  fecha_regreso?: string;
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
  aprobado_por?: string;
  estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO';
  created_at: string;
  updated_at: string;
  usuario?: User;
  puntoAtencion?: PuntoAtencion;
  usuarioAprobador?: User;
}

export interface DatosCliente {
  nombre: string;
  apellido: string;
  cedula: string;
  telefono?: string;
  direccion?: string;
}

// Simplified version for form usage
export interface DetalleDivisasSimple {
  billetes: number;
  monedas: number;
  total: number;
}

// Full version matching Prisma schema
export interface DetalleDivisas {
  moneda_id: string;
  cantidad: number;
  billetes?: {
    denominacion: number;
    cantidad: number;
  }[];
  monedas?: {
    denominacion: number;
    cantidad: number;
  }[];
}

export interface ResponsableMovilizacion {
  nombre: string;
  cedula: string;
  telefono: string;
  empresa?: string;
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
}

export interface Recibo {
  id: string;
  numero_recibo: string;
  tipo_operacion: 'CAMBIO_DIVISA' | 'TRANSFERENCIA';
  referencia_id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha: string;
  datos_operacion: any;
  impreso: boolean;
  numero_copias: number;
}
