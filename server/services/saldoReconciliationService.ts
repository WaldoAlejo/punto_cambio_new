import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

export interface ReconciliationResult {
  success: boolean;
  saldoAnterior: number;
  saldoCalculado: number;
  diferencia: number;
  corregido: boolean;
  movimientosCount: number;
  error?: string;
}

export interface ReconciliationSummary {
  puntoAtencionId: string;
  puntoNombre: string;
  monedaId: string;
  monedaCodigo: string;
  saldoRegistrado: number;
  saldoCalculado: number;
  diferencia: number;
  requiereCorreccion: boolean;
}

/**
 * Servicio de Auto-Reconciliación de Saldos
 *
 * Este servicio garantiza que los saldos siempre estén cuadrados con los movimientos registrados,
 * evitando inconsistencias como la encontrada en el punto AMAZONAS.
 */
export const saldoReconciliationService = {
  /**
   * Calcula el saldo correcto basado en todos los movimientos registrados
   */
  async calcularSaldoReal(
    puntoAtencionId: string,
    monedaId: string
  ): Promise<number> {
    try {
      const movimientos = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: monedaId,
        },
        select: {
          monto: true,
          tipo_movimiento: true,
        },
        orderBy: {
          fecha: "asc",
        },
      });

      let saldoCalculado = 0;

      for (const mov of movimientos) {
        const monto = Number(mov.monto);

        switch (mov.tipo_movimiento) {
          case "INGRESO":
            saldoCalculado += monto;
            break;
          case "EGRESO":
            saldoCalculado -= monto;
            break;
          case "AJUSTE":
            // Los ajustes pueden ser positivos o negativos
            saldoCalculado += monto;
            break;
        }
      }

      return Number(saldoCalculado.toFixed(2));
    } catch (error) {
      logger.error("Error calculando saldo real", {
        error: error instanceof Error ? error.message : "Unknown error",
        puntoAtencionId,
        monedaId,
      });
      throw error;
    }
  },

  /**
   * Reconcilia automáticamente un saldo específico
   */
  async reconciliarSaldo(
    puntoAtencionId: string,
    monedaId: string,
    usuarioId?: string
  ): Promise<ReconciliationResult> {
    try {
      logger.info("🔄 Iniciando reconciliación automática de saldo", {
        puntoAtencionId,
        monedaId,
        usuarioId,
      });

      // Obtener saldo actual registrado
      const saldoActual = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: monedaId,
          },
        },
        select: {
          cantidad: true,
        },
      });

      const saldoRegistrado = Number(saldoActual?.cantidad ?? 0);

      // Calcular saldo real basado en movimientos
      const saldoCalculado = await this.calcularSaldoReal(
        puntoAtencionId,
        monedaId
      );

      // Contar movimientos para contexto
      const movimientosCount = await prisma.movimientoSaldo.count({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: monedaId,
        },
      });

      const diferencia = Number((saldoRegistrado - saldoCalculado).toFixed(2));
      const requiereCorreccion = Math.abs(diferencia) > 0.01; // Tolerancia de 1 centavo

      let corregido = false;

      if (requiereCorreccion) {
        logger.warn("⚠️ Inconsistencia detectada en saldo", {
          puntoAtencionId,
          monedaId,
          saldoRegistrado,
          saldoCalculado,
          diferencia,
          movimientosCount,
        });

        // Corregir el saldo
        await prisma.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: puntoAtencionId,
              moneda_id: monedaId,
            },
          },
          update: {
            cantidad: saldoCalculado,
            updated_at: new Date(),
          },
          create: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: monedaId,
            cantidad: saldoCalculado,
            billetes: 0,
            monedas_fisicas: 0,
            bancos: 0,
          },
        });

        // Registrar el ajuste automático
        if (usuarioId) {
          await prisma.movimientoSaldo.create({
            data: {
              punto_atencion_id: puntoAtencionId,
              moneda_id: monedaId,
              tipo_movimiento: "AJUSTE",
              monto: -diferencia, // Negativo porque corregimos la diferencia
              saldo_anterior: saldoRegistrado,
              saldo_nuevo: saldoCalculado,
              usuario_id: usuarioId,
              referencia_id: `AUTO-RECONCILIATION-${Date.now()}`,
              tipo_referencia: "TRANSFERENCIA", // Usamos el tipo existente
              descripcion: `Auto-reconciliación: diferencia de ${diferencia} corregida automáticamente`,
            },
          });
        }

        corregido = true;

        logger.info("✅ Saldo corregido automáticamente", {
          puntoAtencionId,
          monedaId,
          saldoAnterior: saldoRegistrado,
          saldoNuevo: saldoCalculado,
          diferencia,
          usuarioId,
        });
      } else {
        logger.info("✅ Saldo ya está cuadrado", {
          puntoAtencionId,
          monedaId,
          saldo: saldoCalculado,
          movimientosCount,
        });
      }

      return {
        success: true,
        saldoAnterior: saldoRegistrado,
        saldoCalculado,
        diferencia,
        corregido,
        movimientosCount,
      };
    } catch (error) {
      logger.error("❌ Error en reconciliación automática", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        puntoAtencionId,
        monedaId,
        usuarioId,
      });

      return {
        success: false,
        saldoAnterior: 0,
        saldoCalculado: 0,
        diferencia: 0,
        corregido: false,
        movimientosCount: 0,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  },

  /**
   * Reconcilia todos los saldos de un punto de atención
   */
  async reconciliarTodosPuntoAtencion(
    puntoAtencionId: string,
    usuarioId?: string
  ): Promise<ReconciliationResult[]> {
    try {
      logger.info("🔄 Reconciliando todos los saldos del punto", {
        puntoAtencionId,
      });

      // Obtener todas las monedas que tienen saldo en este punto
      const saldos = await prisma.saldo.findMany({
        where: { punto_atencion_id: puntoAtencionId },
        select: { moneda_id: true },
      });

      const resultados: ReconciliationResult[] = [];

      for (const saldo of saldos) {
        const resultado = await this.reconciliarSaldo(
          puntoAtencionId,
          saldo.moneda_id,
          usuarioId
        );
        resultados.push(resultado);
      }

      const corregidos = resultados.filter((r) => r.corregido).length;
      logger.info(
        `✅ Reconciliación completa: ${corregidos} saldos corregidos de ${resultados.length}`,
        {
          puntoAtencionId,
          usuarioId,
        }
      );

      return resultados;
    } catch (error) {
      logger.error("Error en reconciliación masiva", {
        error: error instanceof Error ? error.message : "Unknown error",
        puntoAtencionId,
        usuarioId,
      });
      throw error;
    }
  },

  /**
   * Genera un reporte de inconsistencias en todos los puntos
   */
  async generarReporteInconsistencias(): Promise<ReconciliationSummary[]> {
    try {
      logger.info("📊 Generando reporte de inconsistencias");

      const saldos = await prisma.saldo.findMany({
        include: {
          punto_atencion: {
            select: { id: true, nombre: true },
          },
          moneda: {
            select: { id: true, codigo: true },
          },
        },
      });

      const reporte: ReconciliationSummary[] = [];

      for (const saldo of saldos) {
        const saldoRegistrado = Number(saldo.cantidad);
        const saldoCalculado = await this.calcularSaldoReal(
          saldo.punto_atencion_id,
          saldo.moneda_id
        );
        const diferencia = Number(
          (saldoRegistrado - saldoCalculado).toFixed(2)
        );
        const requiereCorreccion = Math.abs(diferencia) > 0.01;

        if (requiereCorreccion) {
          reporte.push({
            puntoAtencionId: saldo.punto_atencion_id,
            puntoNombre: saldo.punto_atencion.nombre,
            monedaId: saldo.moneda_id,
            monedaCodigo: saldo.moneda.codigo,
            saldoRegistrado,
            saldoCalculado,
            diferencia,
            requiereCorreccion,
          });
        }
      }

      logger.info(
        `📊 Reporte generado: ${reporte.length} inconsistencias encontradas`
      );
      return reporte;
    } catch (error) {
      logger.error("Error generando reporte de inconsistencias", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },

  /**
   * Función de utilidad para verificar si un saldo está cuadrado
   */
  async verificarSaldoCuadrado(
    puntoAtencionId: string,
    monedaId: string
  ): Promise<boolean> {
    try {
      const resultado = await this.reconciliarSaldo(puntoAtencionId, monedaId);
      return Math.abs(resultado.diferencia) <= 0.01;
    } catch (error) {
      logger.error("Error verificando saldo cuadrado", {
        error: error instanceof Error ? error.message : "Unknown error",
        puntoAtencionId,
        monedaId,
      });
      return false;
    }
  },
};

export default saldoReconciliationService;
