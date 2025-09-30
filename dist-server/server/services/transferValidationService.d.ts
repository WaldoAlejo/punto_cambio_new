export interface ValidationResult {
    success: boolean;
    error?: string;
}
export declare const transferValidationService: {
    validateUser(userId?: string): Promise<ValidationResult>;
    validateDestination(destinoId: string): Promise<ValidationResult>;
    validateCurrency(monedaId: string): Promise<ValidationResult>;
    validateOrigin(origenId?: string | null): Promise<ValidationResult>;
};
