
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
  codigoPostal?: string;
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
  created_at: string;
  updated_at: string;
}

export interface Saldo {
  id: string;
  puntoAtencionId: string;
  monedaId: string;
  cantidad: number;
  billetes: number;
  monedas: number;
  updated_at: string;
  moneda?: Moneda;
}

export interface CambioDivisa {
  id: string;
  fecha: string;
  hora: string;
  montoOrigen: number;
  montoDestino: number;
  tasaCambio: number;
  tipoOperacion: 'COMPRA' | 'VENTA';
  monedaOrigenId: string;
  monedaDestinoId: string;
  usuarioId: string;
  puntoAtencionId: string;
  observacion?: string;
  numeroRecibo?: string;
  estado: 'COMPLETADO' | 'PENDIENTE' | 'CANCELADO';
  monedaOrigen?: Moneda;
  monedaDestino?: Moneda;
  usuario?: User;
  puntoAtencion?: PuntoAtencion;
}

export interface Transferencia {
  id: string;
  origenId?: string;
  destinoId: string;
  monedaId: string;
  monto: number;
  tipoTransferencia: 'ENTRE_PUNTOS' | 'DEPOSITO_MATRIZ' | 'RETIRO_GERENCIA' | 'DEPOSITO_GERENCIA';
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  solicitadoPor: string;
  aprobadoPor?: string;
  fecha: string;
  fechaAprobacion?: string;
  descripcion?: string;
  numeroRecibo?: string;
  origen?: PuntoAtencion;
  destino?: PuntoAtencion;
  moneda?: Moneda;
  usuarioAprobador?: User;
}

export interface CuadreCaja {
  id: string;
  usuarioId: string;
  puntoAtencionId: string;
  fecha: string;
  estado: 'ABIERTO' | 'CERRADO';
  totalCambios: number;
  totalTransferenciasEntrada: number;
  totalTransferenciasSalida: number;
  fechaCierre?: string;
  observaciones?: string;
  usuario?: User;
  puntoAtencion?: PuntoAtencion;
  detalles?: DetalleCuadreCaja[];
}

export interface DetalleCuadreCaja {
  id: string;
  cuadreId: string;
  monedaId: string;
  saldoApertura: number;
  saldoCierre: number;
  conteoFisico: number;
  billetes: number;
  monedas: number;
  diferencia: number;
  moneda?: Moneda;
}

export interface HistorialSaldo {
  id: string;
  puntoAtencionId: string;
  monedaId: string;
  usuarioId: string;
  cantidadAnterior: number;
  cantidadIncrementada: number;
  cantidadNueva: number;
  tipo_movimiento: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA_ENTRANTE' | 'TRANSFERENCIA_SALIENTE' | 'CAMBIO_DIVISA';
  fecha: string;
  descripcion?: string;
  puntoAtencion?: PuntoAtencion;
  moneda?: Moneda;
  usuario?: User;
}
