import { ExchangeData, TransferData, BalanceData, UserActivityData, ExchangeDetailedData, TransferDetailedData, AccountingMovementData, EODBalanceData, PointAssignmentData } from "../types/reportTypes.js";
export declare const reportDataService: {
    getExchangesData(startDate: Date, endDate: Date): Promise<ExchangeData[]>;
    getTransfersData(startDate: Date, endDate: Date): Promise<TransferData[]>;
    getBalancesData(): Promise<BalanceData[]>;
    getUserActivityData(startDate: Date, endDate: Date): Promise<UserActivityData[]>;
    getWorkTimeData(startDate: Date, endDate: Date, filters?: {
        pointId?: string;
        userId?: string;
    }): Promise<{
        date: string;
        point: string;
        user: string;
        username: string;
        entrada: string;
        almuerzo: string | undefined;
        regreso: string | undefined;
        salida: string;
        estado: import(".prisma/client").$Enums.EstadoJornada;
        lunchMinutes: number;
        spontaneousMinutes: number;
        effectiveMinutes: number;
    }[]>;
    getExchangesDetailedData(startDate: Date, endDate: Date, filters?: {
        pointId?: string;
        userId?: string;
        currencyId?: string;
        estado?: string;
        metodoEntrega?: "efectivo" | "transferencia";
    }): Promise<ExchangeDetailedData[]>;
    getTransfersDetailedData(startDate: Date, endDate: Date, filters?: {
        pointId?: string;
        userId?: string;
        estado?: string;
        currencyId?: string;
    }): Promise<TransferDetailedData[]>;
    getAccountingMovementsData(startDate: Date, endDate: Date, filters?: {
        pointId?: string;
        userId?: string;
        currencyId?: string;
        tipoReferencia?: string;
    }): Promise<AccountingMovementData[]>;
    getEodBalancesData(startDate: Date, endDate: Date, filters?: {
        pointId?: string;
    }): Promise<EODBalanceData[]>;
    getPointAssignmentsData(startDate: Date, endDate: Date, filters?: {
        userId?: string;
    }): Promise<PointAssignmentData[]>;
};
