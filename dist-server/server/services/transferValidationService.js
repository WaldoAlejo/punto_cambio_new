import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
export const transferValidationService = {
    async validateUser(userId) {
        if (!userId) {
            logger.error("Usuario no autenticado intentando crear transferencia");
            return {
                success: false,
                error: "Usuario no autenticado",
            };
        }
        return { success: true };
    },
    async validateDestination(destinoId) {
        const destinoExists = await prisma.puntoAtencion.findUnique({
            where: { id: destinoId },
        });
        if (!destinoExists) {
            logger.error("Punto de destino no encontrado", { destino_id: destinoId });
            return {
                success: false,
                error: "Punto de destino no válido",
            };
        }
        return { success: true };
    },
    async validateCurrency(monedaId) {
        const monedaExists = await prisma.moneda.findUnique({
            where: { id: monedaId },
        });
        if (!monedaExists) {
            logger.error("Moneda no encontrada", { moneda_id: monedaId });
            return {
                success: false,
                error: "Moneda no válida",
            };
        }
        return { success: true };
    },
    async validateOrigin(origenId) {
        if (origenId) {
            const origenExists = await prisma.puntoAtencion.findUnique({
                where: { id: origenId },
            });
            if (!origenExists) {
                logger.error("Punto de origen no encontrado", { origen_id: origenId });
                return {
                    success: false,
                    error: "Punto de origen no válido",
                };
            }
        }
        return { success: true };
    },
};
