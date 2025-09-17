// Tipos base del sistema alineados con Prisma Schema
export interface Usuario {
  id: string;
  username: string;
  nombre: string;
  correo?: string | null;
  telefono?: string | null;
  rol: "SUPER_USUARIO" | "ADMIN" | "OPERADOR" | "CONCESION" | "ADMINISTRATIVO";
  activo: boolean;
  punto_atencion_id?: string | null;
  created_at: string;
  updated_at: string;
  // Campos adicionales del login
  jornada_id?: string | null;
  hasActiveJornada?: boolean;
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
  servientrega_agencia_codigo?: string;
  servientrega_agencia_nombre?: string;
  activo: boolean;
  es_principal: boolean;
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
  comportamiento_compra: "MULTIPLICA" | "DIVIDE";
  comportamiento_venta: "MULTIPLICA" | "DIVIDE";
  created_at: string;
  updated_at: string;
}

// Alias para compatibilidad con currencyService
export type Currency = Moneda;

export interface Agencia {
  nombre: string;
  tipo_cs: string;
  direccion: string;
  ciudad: string;
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

export interface SaldoInicial {
  id: string;
  punto_atencion_id: string;
  moneda_id: string;
  cantidad_inicial: number;
  fecha_asignacion: string;
  asignado_por: string;
  activo: boolean;
  observaciones?: string;
  created_at: string;
  updated_at: string;
  moneda?: Moneda;
  puntoAtencion?: PuntoAtencion;
}

// MovimientoSaldo se define más abajo en la sección de tipos contables

export interface VistaSaldosPorPunto {
  punto_atencion_id: string;
  punto_nombre: string;
  ciudad: string;
  moneda_id: string;
  moneda_nombre: string;
  moneda_simbolo: string;
  moneda_codigo: string;
  saldo_inicial: number;
  saldo_actual: number;
  billetes: number;
  monedas_fisicas: number;
  diferencia: number;
  ultima_actualizacion?: string;
  fecha_saldo_inicial?: string;
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

  // Tasas diferenciadas
  tasa_cambio_billetes: number;
  tasa_cambio_monedas: number;

  // Detalles de divisas entregadas (por el cliente)
  divisas_entregadas_billetes: number;
  divisas_entregadas_monedas: number;
  divisas_entregadas_total: number;

  // Detalles de divisas recibidas (por el cliente)
  divisas_recibidas_billetes: number;
  divisas_recibidas_monedas: number;
  divisas_recibidas_total: number;

  tipo_operacion: "COMPRA" | "VENTA";
  moneda_origen_id: string;
  moneda_destino_id: string;
  usuario_id: string;
  punto_atencion_id: string;
  estado: "PENDIENTE" | "COMPLETADO" | "CANCELADO";
  observacion?: string | null;
  datos_cliente?: DatosCliente;

  // Campos para método de entrega
  metodo_entrega?: "efectivo" | "transferencia";
  transferencia_numero?: string | null;
  transferencia_banco?: string | null;
  transferencia_imagen_url?: string | null;

  // Campos para cambios parciales
  abono_inicial_monto?: number | null;
  abono_inicial_fecha?: string | null;
  abono_inicial_recibido_por?: string | null;
  saldo_pendiente?: number | null;
  fecha_compromiso?: string | null;
  observacion_parcial?: string | null;
  referencia_cambio_principal?: string | null;
  cliente?: string | null;

  // Recibos para abonos parciales
  numero_recibo_abono?: string | null;
  numero_recibo_completar?: string | null;
  fecha_completado?: string | null;

  // Relaciones
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
  tipo_transferencia:
    | "ENTRE_PUNTOS"
    | "DEPOSITO_MATRIZ"
    | "RETIRO_GERENCIA"
    | "DEPOSITO_GERENCIA";
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
  motivo:
    | "BANCO"
    | "DILIGENCIA_PERSONAL"
    | "TRAMITE_GOBIERNO"
    | "EMERGENCIA_MEDICA"
    | "OTRO";
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

// ===== Permisos =====
export type PermisoTipo = "PERSONAL" | "SALUD" | "OFICIAL" | "OTRO";
export type EstadoPermiso = "PENDIENTE" | "APROBADO" | "RECHAZADO";

export interface Permiso {
  id: string;
  usuario_id: string;
  punto_atencion_id?: string | null;
  tipo: PermisoTipo;
  fecha_inicio: string; // ISO
  fecha_fin: string; // ISO
  descripcion?: string | null;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
  estado: EstadoPermiso;
  aprobado_por?: string | null;
  fecha_aprobacion?: string | null;
  created_at: string;
  updated_at: string;
  usuario?: Usuario;
  puntoAtencion?: PuntoAtencion;
  aprobador?: Usuario;
}

export interface HistorialAsignacionPunto {
  id: string;
  usuario_id: string;
  punto_atencion_anterior_id?: string | null;
  punto_atencion_nuevo_id: string;
  fecha_asignacion: string;
  motivo_cambio?: string | null;
  autorizado_por?: string | null;
  tipo_asignacion:
    | "MANUAL"
    | "AUTO_LOGIN"
    | "JORNADA_INICIO"
    | "JORNADA_FIN"
    | "AUTO_UPDATE";
  observaciones?: string | null;
  created_at: string;
  // Relaciones opcionales
  usuario?: Usuario;
  punto_anterior?: PuntoAtencion;
  punto_nuevo?: PuntoAtencion;
  usuario_autorizador?: Usuario;
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
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface ListResponse<T> extends Omit<ApiResponse<T>, "data"> {
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
  rol: "SUPER_USUARIO" | "ADMIN" | "OPERADOR" | "CONCESION" | "ADMINISTRATIVO";
  punto_atencion_id?: string;
}

export interface CreatePointData {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia?: string;
  codigo_postal?: string;
  telefono?: string;
  servientrega_agencia_codigo?: string;
  servientrega_agencia_nombre?: string;
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
  tipo_transferencia:
    | "ENTRE_PUNTOS"
    | "DEPOSITO_MATRIZ"
    | "RETIRO_GERENCIA"
    | "DEPOSITO_GERENCIA";
  origen_id?: string;
}

// ===== TIPOS PARA SISTEMA CONTABLE =====

export interface MovimientoContableData {
  punto_atencion_id: string;
  moneda_id: string;
  tipo_movimiento:
    | "INGRESO"
    | "EGRESO"
    | "TRANSFERENCIA_ENTRANTE"
    | "TRANSFERENCIA_SALIENTE"
    | "CAMBIO_DIVISA";
  monto: number;
  usuario_id: string;
  referencia_id: string;
  tipo_referencia:
    | "CAMBIO_DIVISA"
    | "TRANSFERENCIA"
    | "AJUSTE_MANUAL"
    | "SALDO_INICIAL"
    | "SERVICIO_EXTERNO"
    | "REVERSO_CAMBIO"
    | "REVERSO_SERVICIO_EXTERNO";
  descripcion: string;
}

export interface MovimientoSaldo {
  id: string;
  punto_atencion_id: string;
  moneda_id: string;
  moneda_codigo: string;
  tipo_movimiento:
    | "INGRESO"
    | "EGRESO"
    | "TRANSFERENCIA_ENTRANTE"
    | "TRANSFERENCIA_SALIENTE"
    | "CAMBIO_DIVISA";
  monto: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  usuario_id: string;
  usuario_nombre?: string;
  referencia_id: string;
  tipo_referencia:
    | "CAMBIO_DIVISA"
    | "TRANSFERENCIA"
    | "AJUSTE_MANUAL"
    | "SALDO_INICIAL"
    | "SERVICIO_EXTERNO"
    | "REVERSO_CAMBIO"
    | "REVERSO_SERVICIO_EXTERNO";
  descripcion: string;
  fecha: string;
  created_at: string;
  // Propiedades opcionales para relaciones
  moneda?: Moneda;
  usuario?: Usuario;
  puntoAtencion?: PuntoAtencion;
}

export interface SaldoActual {
  moneda_id: string;
  moneda_codigo: string;
  saldo: number;
}

export interface SaldoActualizado {
  moneda_id: string;
  saldo_anterior: number;
  saldo_nuevo: number;
  diferencia: number;
}

export interface ResultadoMovimientoContable {
  movimientos: MovimientoSaldo[];
  saldos_actualizados: SaldoActualizado[];
  success: boolean;
  message: string;
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

// Interfaces para contabilidad diaria
export interface MovimientoDiario {
  id: string;
  fecha: string;
  tipo: "INGRESO" | "EGRESO";
  concepto:
    | "CAMBIO_COMPRA"
    | "CAMBIO_VENTA"
    | "TRANSFERENCIA_RECIBIDA"
    | "TRANSFERENCIA_ENVIADA"
    | "SALDO_INICIAL";
  moneda_id: string;
  moneda_codigo: string;
  moneda_simbolo: string;
  monto: number;
  referencia?: string; // ID del cambio o transferencia
  numero_recibo?: string;
  usuario_nombre?: string;
  observaciones?: string;
}

export interface ResumenDiario {
  fecha: string;
  punto_atencion_id: string;
  punto_atencion_nombre: string;
  moneda_id: string;
  moneda_codigo: string;
  moneda_simbolo: string;
  saldo_inicial: number;
  total_ingresos: number;
  total_egresos: number;
  saldo_final: number;
  diferencia: number;
  movimientos: MovimientoDiario[];
}

export interface CierreDiario {
  id: string;
  fecha: string;
  punto_atencion_id: string;
  usuario_id: string;
  resumen_por_moneda: ResumenDiario[];
  observaciones?: string;
  estado: "ABIERTO" | "CERRADO";
  fecha_cierre?: string;
  cerrado_por?: string;
  diferencias_reportadas?: {
    moneda_id: string;
    diferencia_sistema: number;
    diferencia_fisica: number;
    justificacion?: string;
  }[];
}

// Tipos para contabilidad consolidada
export interface SaldoMoneda {
  moneda_id: string;
  moneda_codigo: string;
  saldo: number;
}

export interface SaldoConsolidado extends SaldoMoneda {
  punto_nombre: string;
  punto_id: string;
}
