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
export interface WorkTimeData {
    date: string;
    point: string;
    user: string;
    username?: string;
    entrada: string;
    almuerzo?: string;
    regreso?: string;
    salida: string;
    estado?: string;
    lunchMinutes: number;
    spontaneousMinutes: number;
    effectiveMinutes: number;
}
export interface ExchangeDetailedData {
    id: string;
    fecha: string;
    punto: string;
    usuario: string;
    tipo_operacion: "COMPRA" | "VENTA";
    moneda_origen: string;
    moneda_destino: string;
    monto_origen: number;
    monto_destino: number;
    tasa_billetes: number;
    tasa_monedas: number;
    rate_applied: number;
    tasa_mid: number;
    spread: number;
    margen_bruto: number;
    fuente_tasa_mid: string;
    metodo_entrega: string;
    numero_recibo?: string | null;
    estado: string;
}
export interface TransferDetailedData {
    id: string;
    fecha: string;
    punto_origen: string;
    punto_destino: string;
    usuario_solicitante: string;
    moneda: string;
    monto: number;
    estado: string;
    numero_recibo?: string | null;
    observaciones?: string | null;
}
export interface AccountingMovementData {
    id: string;
    fecha: string;
    punto: string;
    moneda: string;
    tipo_movimiento: string;
    monto: number;
    saldo_anterior?: number | null;
    saldo_nuevo?: number | null;
    usuario: string;
    referencia_id?: string | null;
    tipo_referencia?: string | null;
    numero_referencia?: string | null;
    descripcion?: string | null;
}
export interface EODBalanceData {
    fecha: string;
    punto: string;
    moneda: string;
    saldo_cierre: number;
    diferencia?: number | null;
}
export interface PointAssignmentData {
    fecha: string;
    usuario: string;
    punto_anterior?: string | null;
    punto_nuevo: string;
    autorizado_por?: string | null;
    motivo?: string | null;
    observaciones?: string | null;
}
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
export type ReportData = ExchangeData | TransferData | BalanceData | UserActivityData | WorkTimeData | ExchangeDetailedData | TransferDetailedData | AccountingMovementData | EODBalanceData | PointAssignmentData;
export interface ReportRequest {
    reportType: "exchanges" | "transfers" | "balances" | "users" | "summary" | "worktime" | "exchanges_detailed" | "transfers_detailed" | "accounting_movements" | "eod_balances" | "point_assignments";
    dateFrom: string;
    dateTo: string;
    pointId?: string;
    userId?: string;
    currencyId?: string;
    estado?: string;
    metodoEntrega?: "efectivo" | "transferencia";
}
