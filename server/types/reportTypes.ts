
export interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}

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

export type ReportData = ExchangeData | TransferData | BalanceData | UserActivityData;

export interface ReportRequest {
  reportType: 'exchanges' | 'transfers' | 'balances' | 'users';
  dateFrom: string;
  dateTo: string;
}
