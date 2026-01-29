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
   *
   * ⚠️ IMPORTANTE: Esta lógica debe coincidir EXACTAMENTE con calcular-saldos.ts
   *
   * Reglas:
   * 1. Los EGRESOS se guardan con monto NEGATIVO en la BD
   * 2. Los INGRESOS se guardan con monto POSITIVO en la BD
   * 3. Los AJUSTES mantienen su signo original
   * 4. Se excluyen movimientos con descripción que contenga "bancos"
   */
  async calcularSaldoReal(
    puntoAtencionId: string,
    monedaId: string
  ): Promise<number> {
    try {
      // Validar parámetros de entrada
      if (!puntoAtencionId || !monedaId) {
        logger.error("calcularSaldoReal: Parámetros inválidos", {
          puntoAtencionId,
          monedaId,
        });
        return 0;
      }

      // 1. Obtener saldo inicial más reciente
      const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: monedaId,
          activo: true,
        },
        orderBy: {
          fecha_asignacion: "desc",
        },
      });

      let saldoCalculado = saldoInicial
        ? Number(saldoInicial.cantidad_inicial)
        : 0;

      // 2. Obtener TODOS los movimientos (sin filtrar por tipo)
      const todosMovimientos = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: monedaId,
        },
        select: {
          monto: true,
          tipo_movimiento: true,
          descripcion: true,
        },
        orderBy: {
          fecha: "asc",
        },
      });

      // 3. Filtrar movimientos bancarios (igual que en los scripts)
      const movimientos = todosMovimientos.filter((mov) => {
        const desc = mov.descripcion?.toLowerCase() || "";
        return !desc.includes("bancos");
      });

      // 4. Calcular saldo basado en movimientos
      // ⚠️ CRÍTICO: Los montos YA tienen el signo correcto en la BD gracias a movimientoSaldoService
      // INGRESO: monto POSITIVO (+50)
      // EGRESO: monto NEGATIVO (-30)
      // AJUSTE: monto con signo original (+10 o -10)
      // Por lo tanto, simplemente SUMAMOS todos los montos
      for (const mov of movimientos) {
        const monto = Number(mov.monto);
        const tipoMovimiento = mov.tipo_movimiento;

        // Validar que el monto sea un número válido
        if (isNaN(monto) || !isFinite(monto)) {
          logger.warn("Movimiento con monto inválido detectado", {
            monto: mov.monto,
            tipo: tipoMovimiento,
            descripcion: mov.descripcion,
          });
          continue;
        }

        // Skip SALDO_INICIAL porque ya está incluido en la variable saldoCalculado
        if (tipoMovimiento === "SALDO_INICIAL") {
          continue;
        }

        // Sumar directamente el monto (ya tiene el signo correcto)
        saldoCalculado += monto;

        // Log para debug si es necesario
        if (process.env.DEBUG_SALDO === "true") {
          logger.debug("Procesando movimiento", {
            tipo: tipoMovimiento,
            monto,
            saldoAcumulado: saldoCalculado,
          });
        }
      }

      // Validar resultado final
      if (isNaN(saldoCalculado) || !isFinite(saldoCalculado)) {
        logger.error("Saldo calculado resultó en NaN o Infinity", {
          puntoAtencionId,
          monedaId,
          saldoInicial: saldoInicial?.cantidad_inicial,
          movimientosCount: movimientos.length,
        });
        return 0;
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

        // Corregir el saldo directamente sin crear ajustes
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

        // NO crear movimientos de ajuste - solo actualizar el saldo

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
          puntoAtencion: {
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
            puntoNombre: saldo.puntoAtencion.nombre,
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
