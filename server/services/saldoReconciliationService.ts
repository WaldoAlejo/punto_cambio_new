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
   * Normaliza el signo del monto según `tipo_movimiento` + `descripcion`.
   */
  _normalizarMonto(
    tipoMovimiento: string,
    monto: number,
    descripcion?: string | null
  ): number {
    const abs = Math.abs(monto);
    const tipo = (tipoMovimiento || "").toUpperCase();
    const desc = (descripcion || "").toLowerCase();

    const ingresos = new Set([
      "INGRESO",
      "INGRESOS",
      "VENTA",
      "SALDO",
      "SALDO EN CAJA",
      "TRANSFERENCIA_ENTRANTE",
      "TRANSFERENCIA_ENTRADA",
      "TRANSFERENCIA_RECIBIDA",
      "TRANSFERENCIA_DEVOLUCION",
      "SALDO_INICIAL", // Consideramos saldo inicial como ingreso positivo
    ]);

    const egresos = new Set([
      "EGRESO",
      "EGRESOS",
      "COMPRA",
      "TRANSFERENCIA_SALIENTE",
      "TRANSFERENCIA_SALIDA",
      "TRANSFERENCIA_ENVIADA",
    ]);

    if (tipo === "AJUSTE") return monto;

    if (tipo === "CAMBIO_DIVISA") {
      if (desc.startsWith("egreso por cambio")) return -abs;
      if (desc.startsWith("ingreso por cambio")) return abs;
      return monto;
    }

    if (ingresos.has(tipo)) return abs;
    if (egresos.has(tipo)) return -abs;

    if (
      tipo.includes("SALIDA") ||
      tipo.includes("SALIENTE") ||
      tipo.includes("EGRESO") ||
      tipo.includes("COMPRA")
    ) {
      return -abs;
    }
    if (
      tipo.includes("ENTRADA") ||
      tipo.includes("ENTRANTE") ||
      tipo.includes("INGRESO") ||
      tipo.includes("VENTA") ||
      tipo.includes("DEVOLUCION")
    ) {
      return abs;
    }

    return monto;
  },

  /**
   * Calcula el saldo correcto basado en todos los movimientos registrados
   */
  async calcularSaldoReal(
    puntoAtencionId: string,
    monedaId: string
  ): Promise<number> {
    try {
      if (!puntoAtencionId || !monedaId) return 0;

      // 1. Empezamos desde 0 y sumamos TODOS los movimientos históricos.
      // Cada asignación de Saldo Inicial genera un MovimientoSaldo tipo SALDO_INICIAL.
      let saldoCalculado = 0;

      // 2. Obtener TODOS los movimientos históricos para esta moneda/punto
      const movimientos = await prisma.movimientoSaldo.findMany({
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

      // 3. Filtrar movimientos bancarios
      const movimientosCaja = movimientos.filter((mov) => {
        const desc = (mov.descripcion ?? "").toString().toLowerCase();
        if (desc.includes("(caja)")) return true;
        const hasBancoWord = /\bbancos?\b/i.test(desc);
        return !hasBancoWord;
      });

      // 4. Calcular saldo basado en movimientos
      for (const mov of movimientosCaja) {
        const montoRaw = Number(mov.monto);
        const tipoMovimiento = mov.tipo_movimiento;

        if (isNaN(montoRaw) || !isFinite(montoRaw)) continue;

        const delta = this._normalizarMonto(
          tipoMovimiento,
          montoRaw,
          mov.descripcion
        );

        saldoCalculado += delta;
      }

      if (isNaN(saldoCalculado) || !isFinite(saldoCalculado)) return 0;

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
      const saldoCalculado = await this.calcularSaldoReal(
        puntoAtencionId,
        monedaId
      );

      const movimientosCount = await prisma.movimientoSaldo.count({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: monedaId,
        },
      });

      const diferencia = Number((saldoRegistrado - saldoCalculado).toFixed(2));
      const requiereCorreccion = Math.abs(diferencia) > 0.01;

      let corregido = false;

      if (requiereCorreccion) {
        if (saldoCalculado < -0.01) {
          return {
            success: false,
            saldoAnterior: saldoRegistrado,
            saldoCalculado,
            diferencia,
            corregido: false,
            movimientosCount,
            error: "SALDO_CALCULADO_NEGATIVO",
          };
        }

        await prisma.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: puntoAtencionId,
              moneda_id: monedaId,
            },
          },
          update: {
            cantidad: saldoCalculado,
            billetes: saldoCalculado,
            monedas_fisicas: 0,
          },
          create: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: monedaId,
            cantidad: saldoCalculado,
            billetes: saldoCalculado,
            monedas_fisicas: 0,
            bancos: 0,
          },
        });

        corregido = true;
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
      return {
        success: false,
        saldoAnterior: 0,
        saldoCalculado: 0,
        diferencia: 0,
        corregido: false,
        movimientosCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async reconciliarTodoElPunto(puntoAtencionId: string): Promise<ReconciliationResult[]> {
    const monedas = await prisma.moneda.findMany({ where: { activo: true } });
    const resultados = [];
    for (const m of monedas) {
      resultados.push(await this.reconciliarSaldo(puntoAtencionId, m.id));
    }
    return resultados;
  }
};
