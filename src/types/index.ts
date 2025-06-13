
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'super_usuario' | 'administrador' | 'operador' | 'concesion';
  name: string;
  created_at: string;
  is_active: boolean;
}

export interface AttentionPoint {
  id: string;
  name: string;
  address: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  balances: CurrencyBalance[];
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
  created_at: string;
}

export interface CurrencyBalance {
  id: string;
  point_id: string;
  currency_id: string;
  balance: number;
  currency: Currency;
}

export interface CurrencyExchange {
  id: string;
  point_id: string;
  user_id: string;
  from_currency_id: string;
  to_currency_id: string;
  from_amount: number;
  to_amount: number;
  exchange_rate: number;
  transaction_type: 'compra' | 'venta';
  date: string;
  time: string;
  status: 'completado' | 'pendiente' | 'cancelado';
}

export interface Transfer {
  id: string;
  from_point_id?: string;
  to_point_id: string;
  currency_id: string;
  amount: number;
  transfer_type: 'entre_puntos' | 'deposito_matriz' | 'retiro_gerencia' | 'deposito_gerencia';
  status: 'pendiente' | 'aprobado' | 'rechazado';
  requested_by: string;
  approved_by?: string;
  date: string;
  notes?: string;
  receipt_number?: string;
}

export interface DailyClose {
  id: string;
  point_id: string;
  date: string;
  user_id: string;
  currency_balances: DailyCurrencyBalance[];
  total_exchanges: number;
  total_transfers_in: number;
  total_transfers_out: number;
  status: 'abierto' | 'cerrado';
  closed_at?: string;
}

export interface DailyCurrencyBalance {
  currency_id: string;
  currency: Currency;
  opening_balance: number;
  closing_balance: number;
  bills_count: number;
  coins_count: number;
  calculated_balance: number;
  difference: number;
}
