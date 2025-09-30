import { Prisma } from "@prisma/client";
export interface RemitenteData {
    identificacion?: string;
    cedula?: string;
    nombre: string;
    direccion: string;
    telefono: string;
    email?: string;
    ciudad: string;
    provincia: string;
    codigo_postal?: string;
    pais?: string;
}
export interface DestinatarioData extends RemitenteData {
}
export interface GuiaData {
    numero_guia: string;
    proceso: string;
    base64_response: string;
    remitente_id: string;
    destinatario_id: string;
}
export interface SaldoData {
    punto_atencion_id: string;
    monto_total: number;
    monto_usado?: number;
    creado_por?: string;
}
export declare class ServientregaDBService {
    buscarRemitentes(cedula: string): Promise<{
        id: string;
        nombre: string;
        telefono: string;
        direccion: string;
        codigo_postal: string | null;
        cedula: string;
        email: string | null;
    }[]>;
    guardarRemitente(data: RemitenteData): Promise<{
        id: string;
        nombre: string;
        telefono: string;
        direccion: string;
        codigo_postal: string | null;
        cedula: string;
        email: string | null;
    }>;
    actualizarRemitente(cedula: string, data: Partial<RemitenteData>): Promise<Prisma.BatchPayload>;
    /**
     * Remitente: NO guardamos ciudad/provincia/pais intencionalmente,
     * porque el remitente SIEMPRE es el punto de atención.
     */
    private sanitizeRemitenteData;
    buscarDestinatarios(cedula: string): Promise<{
        id: string;
        nombre: string;
        telefono: string;
        direccion: string;
        ciudad: string;
        provincia: string | null;
        codigo_postal: string | null;
        cedula: string;
        email: string | null;
        pais: string;
    }[]>;
    buscarDestinatariosPorNombre(nombre: string): Promise<{
        id: string;
        nombre: string;
        telefono: string;
        direccion: string;
        ciudad: string;
        provincia: string | null;
        codigo_postal: string | null;
        cedula: string;
        email: string | null;
        pais: string;
    }[]>;
    guardarDestinatario(data: DestinatarioData): Promise<{
        id: string;
        nombre: string;
        telefono: string;
        direccion: string;
        ciudad: string;
        provincia: string | null;
        codigo_postal: string | null;
        cedula: string;
        email: string | null;
        pais: string;
    }>;
    actualizarDestinatario(cedula: string, data: Partial<DestinatarioData>): Promise<Prisma.BatchPayload>;
    /**
     * Destinatario: ignoramos 'codpais' (numérico). Usar 'pais' (string).
     */
    private sanitizeDestinatarioData;
    guardarGuia(data: GuiaData): Promise<{
        id: string;
        punto_atencion_id: string | null;
        created_at: Date;
        updated_at: Date;
        numero_guia: string;
        proceso: string;
        base64_response: string | null;
        remitente_id: string;
        destinatario_id: string;
        valor_declarado: Prisma.Decimal | null;
        costo_envio: Prisma.Decimal | null;
    }>;
    anularGuia(numeroGuia: string): Promise<Prisma.BatchPayload>;
    obtenerGuias(desde?: string, hasta?: string): Promise<({
        destinatario: {
            id: string;
            nombre: string;
            telefono: string;
            direccion: string;
            ciudad: string;
            provincia: string | null;
            codigo_postal: string | null;
            cedula: string;
            email: string | null;
            pais: string;
        };
        remitente: {
            id: string;
            nombre: string;
            telefono: string;
            direccion: string;
            codigo_postal: string | null;
            cedula: string;
            email: string | null;
        };
    } & {
        id: string;
        punto_atencion_id: string | null;
        created_at: Date;
        updated_at: Date;
        numero_guia: string;
        proceso: string;
        base64_response: string | null;
        remitente_id: string;
        destinatario_id: string;
        valor_declarado: Prisma.Decimal | null;
        costo_envio: Prisma.Decimal | null;
    })[]>;
    obtenerSaldo(puntoAtencionId: string): Promise<{
        id: string;
        punto_atencion_id: string;
        created_at: Date;
        updated_at: Date;
        monto_total: Prisma.Decimal;
        creado_por: string;
        monto_usado: Prisma.Decimal;
    } | null>;
    /**
     * Asignación de saldo: transacción + historial + upsert con increment.
     */
    gestionarSaldo(data: SaldoData): Promise<{
        id: string;
        punto_atencion_id: string;
        created_at: Date;
        updated_at: Date;
        monto_total: Prisma.Decimal;
        creado_por: string;
        monto_usado: Prisma.Decimal;
    }>;
    /**
     * Descuento de saldo: transacción, evita sobregiros y registra historial (débito).
     */
    descontarSaldo(puntoAtencionId: string, monto: number): Promise<{
        id: string;
        punto_atencion_id: string;
        created_at: Date;
        updated_at: Date;
        monto_total: Prisma.Decimal;
        creado_por: string;
        monto_usado: Prisma.Decimal;
    } | null>;
    obtenerHistorialSaldos(): Promise<{
        punto_nombre: string;
        punto_ubicacion: string;
        id: string;
        punto_atencion_id: string;
        punto_atencion_nombre: string;
        monto_total: Prisma.Decimal;
        creado_por: string;
        creado_en: Date;
        punto_atencion: {
            id: string;
            nombre: string;
            ciudad: string;
            provincia: string;
        };
    }[]>;
    crearSolicitudSaldo(data: {
        punto_atencion_id: string;
        monto_solicitado: number;
        observaciones: string;
        creado_por: string;
    }): Promise<{
        punto_atencion: {
            nombre: string;
            ciudad: string;
            provincia: string;
        };
    } & {
        id: string;
        punto_atencion_id: string;
        estado: string;
        observaciones: string | null;
        aprobado_por: string | null;
        punto_atencion_nombre: string;
        creado_en: Date;
        monto_requerido: Prisma.Decimal;
        aprobado_en: Date | null;
    }>;
    listarSolicitudesSaldo(filtros?: {
        estado?: string;
        punto_atencion_id?: string;
    }): Promise<({
        punto_atencion: {
            nombre: string;
            ciudad: string;
            provincia: string;
        };
    } & {
        id: string;
        punto_atencion_id: string;
        estado: string;
        observaciones: string | null;
        aprobado_por: string | null;
        punto_atencion_nombre: string;
        creado_en: Date;
        monto_requerido: Prisma.Decimal;
        aprobado_en: Date | null;
    })[]>;
    actualizarEstadoSolicitudSaldo(id: string, estado: string, aprobado_por?: string): Promise<{
        punto_atencion: {
            nombre: string;
            ciudad: string;
            provincia: string;
        };
    } & {
        id: string;
        punto_atencion_id: string;
        estado: string;
        observaciones: string | null;
        aprobado_por: string | null;
        punto_atencion_nombre: string;
        creado_en: Date;
        monto_requerido: Prisma.Decimal;
        aprobado_en: Date | null;
    }>;
    obtenerPuntosAtencion(): Promise<{
        servientrega_agencia_codigo: string | null;
        servientrega_agencia_nombre: string | null;
        id: string;
        nombre: string;
        telefono: string | null;
        activo: boolean;
        direccion: string;
        ciudad: string;
        provincia: string;
        codigo_postal: string | null;
    }[]>;
    obtenerGuiasConFiltros(filtros: {
        desde?: string;
        hasta?: string;
        estado?: string;
        punto_atencion_id?: string;
    }): Promise<({
        destinatario: {
            id: string;
            nombre: string;
            telefono: string;
            direccion: string;
            ciudad: string;
            provincia: string | null;
            codigo_postal: string | null;
            cedula: string;
            email: string | null;
            pais: string;
        };
        punto_atencion: {
            id: string;
            nombre: string;
            ciudad: string;
            provincia: string;
        } | null;
        remitente: {
            id: string;
            nombre: string;
            telefono: string;
            direccion: string;
            codigo_postal: string | null;
            cedula: string;
            email: string | null;
        };
    } & {
        id: string;
        punto_atencion_id: string | null;
        created_at: Date;
        updated_at: Date;
        numero_guia: string;
        proceso: string;
        base64_response: string | null;
        remitente_id: string;
        destinatario_id: string;
        valor_declarado: Prisma.Decimal | null;
        costo_envio: Prisma.Decimal | null;
    })[]>;
    obtenerEstadisticasGuias(filtros: {
        desde?: string;
        hasta?: string;
    }): Promise<{
        total_guias: number;
        guias_activas: number;
        guias_anuladas: number;
        guias_pendientes_anulacion: number;
        total_por_punto: {
            punto_atencion_nombre: string;
            total: number;
            activas: number;
            anuladas: number;
            valor_total: number;
            costo_total: number;
        }[];
    }>;
    obtenerSolicitudesAnulacion(filtros: {
        desde?: string;
        hasta?: string;
        estado?: string;
    }): Promise<{
        id: string;
        estado: string;
        fecha_solicitud: Date;
        fecha_respuesta: Date | null;
        solicitado_por: string;
        numero_guia: string;
        guia_id: string;
        motivo_anulacion: string;
        solicitado_por_nombre: string;
        respondido_por: string | null;
        respondido_por_nombre: string | null;
        observaciones_respuesta: string | null;
    }[]>;
    crearSolicitudAnulacion(data: {
        guia_id: string;
        numero_guia: string;
        motivo_anulacion: string;
        solicitado_por: string;
        solicitado_por_nombre: string;
    }): Promise<{
        id: string;
        estado: string;
        fecha_solicitud: Date;
        fecha_respuesta: Date | null;
        solicitado_por: string;
        numero_guia: string;
        guia_id: string;
        motivo_anulacion: string;
        solicitado_por_nombre: string;
        respondido_por: string | null;
        respondido_por_nombre: string | null;
        observaciones_respuesta: string | null;
    }>;
    actualizarSolicitudAnulacion(id: string, data: {
        estado?: string;
        respondido_por?: string;
        respondido_por_nombre?: string;
        observaciones_respuesta?: string;
        fecha_respuesta?: Date;
    }): Promise<{
        id: string;
        estado: string;
        fecha_solicitud: Date;
        fecha_respuesta: Date | null;
        solicitado_por: string;
        numero_guia: string;
        guia_id: string;
        motivo_anulacion: string;
        solicitado_por_nombre: string;
        respondido_por: string | null;
        respondido_por_nombre: string | null;
        observaciones_respuesta: string | null;
    }>;
}
