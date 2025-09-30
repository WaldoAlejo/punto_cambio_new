import { TipoTransferencia, Transferencia, TipoViaTransferencia } from "@prisma/client";
export interface TransferData {
    origen_id?: string | null;
    destino_id: string;
    moneda_id: string;
    monto: number;
    tipo_transferencia: TipoTransferencia;
    solicitado_por: string;
    descripcion?: string | null;
    numero_recibo: string;
    estado: "PENDIENTE";
    fecha: Date;
    via?: TipoViaTransferencia | null;
}
export declare const transferCreationService: {
    generateReceiptNumber(): string;
    createTransfer(transferData: TransferData): Promise<{
        moneda: {
            id: string;
            nombre: string;
            simbolo: string;
            codigo: string;
        };
        destino: {
            id: string;
            nombre: string;
        };
        origen: {
            id: string;
            nombre: string;
        } | null;
        usuarioSolicitante: {
            id: string;
            username: string;
            nombre: string;
        };
    } & {
        id: string;
        origen_id: string | null;
        destino_id: string;
        moneda_id: string;
        monto: import("@prisma/client/runtime/library.js").Decimal;
        tipo_transferencia: import(".prisma/client").$Enums.TipoTransferencia;
        estado: import(".prisma/client").$Enums.EstadoTransferencia;
        solicitado_por: string;
        aprobado_por: string | null;
        rechazado_por: string | null;
        fecha: Date;
        fecha_aprobacion: Date | null;
        fecha_rechazo: Date | null;
        descripcion: string | null;
        numero_recibo: string | null;
        via: import(".prisma/client").$Enums.TipoViaTransferencia | null;
        observaciones_aprobacion: string | null;
    }>;
    contabilizarEntradaDestino(args: {
        destino_id: string;
        moneda_id: string;
        usuario_id: string;
        transferencia: Transferencia;
        numero_recibo: string;
        via: TipoViaTransferencia;
        monto: number;
        monto_efectivo?: number;
        monto_banco?: number;
    }): Promise<void>;
    createReceipt(data: {
        numero_recibo: string;
        usuario_id: string;
        punto_atencion_id: string;
        transferencia: Transferencia;
        detalle_divisas?: object;
        responsable_movilizacion?: object;
        tipo_transferencia: TipoTransferencia;
        monto: number;
        via: TipoViaTransferencia;
        monto_efectivo?: number;
        monto_banco?: number;
    }): Promise<void>;
};
export default transferCreationService;
