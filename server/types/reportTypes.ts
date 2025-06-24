export interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}

// Datos individuales por tipo de reporte
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
}

export interface UserActivityData {
  point: string;
  user: string;
  transfers: number;
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
  | UserActivityData;

// Tipos de request
export interface ReportRequest {
  reportType: "exchanges" | "transfers" | "balances" | "users" | "summary";
  dateFrom: string;
  dateTo: string;
  pointId?: string; // <-- Agregado
  userId?: string; // <-- Agregado
}
