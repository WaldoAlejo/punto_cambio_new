declare function generarInformeSantaFe(): Promise<{
    archivo: string;
    resumen: {
        punto: string;
        saldoActual: number;
        deficit: number;
        transferenciaRequerida: number;
        totalMovimientos: number;
    };
}>;
export { generarInformeSantaFe };
