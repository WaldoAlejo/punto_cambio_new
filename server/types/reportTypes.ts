export interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}

// Datos individuales por tipo de reporte (agregados simples)
export interface ExchangeData {
  point: string;
  amount: number;
  exchanges: number;
  user: string;
}

export interface TransferData {
  point: string;
  transfers: number;
  amount: number;
  user: string;
}

export interface BalanceData {
  point: string;
  balance: number;
  currency: string;
  symbol?: string;
}

export interface UserActivityData {
  point: string;
  user: string;
  transfers: number;
}

// Nuevo: Reporte de tiempo de trabajo por jornada
export interface WorkTimeData {
  date: string; // YYYY-MM-DD
  point: string;
  user: string;
  username?: string;
  entrada: string; // ISO
  almuerzo?: string; // ISO (inicio almuerzo)
  regreso?: string; // ISO (fin almuerzo)
  salida: string; // ISO
  estado?: string;
  lunchMinutes: number; // minutos descontados por almuerzo
  spontaneousMinutes: number; // minutos descontados por salidas espontáneas
  effectiveMinutes: number; // (salida-entrada) - lunch - spontaneous
}

// Nuevos: Estructuras detalladas
export interface ExchangeDetailedData {
  id: string;
  fecha: string; // ISO
  punto: string;
  usuario: string;
  tipo_operacion: "COMPRA" | "VENTA";
  moneda_origen: string; // CODIGO
  moneda_destino: string; // CODIGO
  monto_origen: number;
  monto_destino: number;
  tasa_billetes: number; // aplicada
  tasa_monedas: number; // aplicada
  rate_applied: number; // tasa efectiva calculada
  tasa_mid: number; // promedio compra/venta del día/punto/moneda
  spread: number; // rate_applied - tasa_mid (signo según operación)
  margen_bruto: number; // en moneda base del cálculo
  fuente_tasa_mid: string; // e.g., "promedio_configurado" | "promedio_operaciones"
  metodo_entrega: string; // efectivo|transferencia
  numero_recibo?: string | null;
  estado: string;
}

export interface TransferDetailedData {
  id: string;
  fecha: string; // ISO
  punto_origen: string;
  punto_destino: string;
  usuario_solicitante: string;
  moneda: string; // CODIGO
  monto: number;
  estado: string;
  numero_recibo?: string | null;
  observaciones?: string | null;
}

export interface AccountingMovementData {
  id: string;
  fecha: string; // ISO
  punto: string;
  moneda: string; // CODIGO
  tipo_movimiento: string;
  monto: number; // ✅ Siempre positivo (valor absoluto)
  signo: "+" | "-"; // ✅ Signo del movimiento
  saldo_anterior?: number | null;
  saldo_nuevo?: number | null;
  usuario: string;
  referencia_id?: string | null;
  tipo_referencia?: string | null;
  numero_referencia?: string | null; // puede ser numero_recibo u otro
  descripcion?: string | null;
}

export interface EODBalanceData {
  fecha: string; // YYYY-MM-DD
  punto: string;
  moneda: string; // CODIGO
  saldo_cierre: number;
  diferencia?: number | null;
}

export interface PointAssignmentData {
  fecha: string; // ISO
  usuario: string;
  punto_anterior?: string | null;
  punto_nuevo: string;
  autorizado_por?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
}

// Datos agregados para reportes tipo summary
export interface SummaryReportResponse {
  exchanges: ExchangeData[];
  transfers: TransferData[];
  summary: {
    totalExchanges: number;
    totalTransfers: number;
    totalVolume: number;
    averageTransaction: number;
  };
}

// Tipo genérico para otros reportes
export type ReportData =
  | ExchangeData
  | TransferData
  | BalanceData
  | UserActivityData
  | WorkTimeData
  | ExchangeDetailedData
  | TransferDetailedData
  | AccountingMovementData
  | EODBalanceData
  | PointAssignmentData;

// Tipos de request
export interface ReportRequest {
  reportType:
    | "exchanges"
    | "transfers"
    | "balances"
    | "users"
    | "summary"
    | "worktime"
    | "exchanges_detailed"
    | "transfers_detailed"
    | "accounting_movements"
    | "eod_balances"
    | "point_assignments";
  dateFrom: string;
  dateTo: string;
  pointId?: string;
  userId?: string;
  currencyId?: string;
  estado?: string;
  metodoEntrega?: "efectivo" | "transferencia";
}
