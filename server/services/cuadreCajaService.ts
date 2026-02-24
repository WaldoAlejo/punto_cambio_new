/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO DE CUADRE DE CAJA - V2
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este servicio garantiza que el cuadre de caja sea 100% preciso:
 * 
 * 1. Saldo Apertura = Último conteo físico del cierre anterior
 * 2. Saldo Teórico = Saldo Apertura + Ingresos - Egresos (del día)
 * 3. Diferencia = Conteo Físico - Saldo Teórico
 * 
 * REGLAS DE CUADRE:
 * - billetes + monedas_fisicas = cantidad (saldo físico)
 * - Bancos se contabilizan separado (no afecta cuadre físico)
 * - Todos los movimientos deben tener signo correcto:
 *   * INGRESOS: positivos (+)
 *   * EGRESOS: negativos (-)
 */

import { PrismaClient, Prisma } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

export interface CuadreCajaData {
  puntoAtencionId: string;
  monedaId: string;
  fechaInicio: Date;
  fechaFin: Date;
}

export interface DetalleCuadreCalculado {
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  
  // Saldos
  saldo_apertura: number;
  saldo_cierre_teorico: number;
  conteo_fisico: number;
  diferencia: number;
  
  // Desglose físico
  billetes: number;
  monedas_fisicas: number;
  
  // Bancos (separado)
  bancos_teorico: number;
  conteo_bancos: number;
  diferencia_bancos: number;
  
  // Movimientos del período
  ingresos: number;
  egresos: number;
  total_movimientos: number;
  
  // Estado
  cuadrado: boolean;
  fuera_tolerancia: boolean;
}

export interface ResumenCuadre {
  detalles: DetalleCuadreCalculado[];
  totales: {
    total_monedas: number;
    total_diferencias: number;
    total_fuera_tolerancia: number;
  };
  puede_cerrar: boolean;
}

/**
 * Calcula el saldo de apertura basado en el último cierre
 */
export async function calcularSaldoApertura(
  puntoAtencionId: string,
  monedaId: string,
  fechaInicio: Date
): Promise<number> {
  try {
    // Buscar el último cierre CERRADO antes de la fecha de inicio
    const ultimoCierre = await prisma.cierreDiario.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        estado: "CERRADO",
        fecha: {
          lt: fechaInicio,
        },
      },
      orderBy: {
        fecha: "desc",
      },
      include: {
        detalles: {
          where: {
            moneda_id: monedaId,
          },
        },
      },
    });

    if (ultimoCierre?.detalles?.[0]) {
      const apertura = Number(ultimoCierre.detalles[0].conteo_fisico);
      logger.info("Saldo de apertura obtenido del último cierre", {
        puntoAtencionId,
        monedaId,
        fecha: fechaInicio.toISOString(),
        apertura,
        cierreId: ultimoCierre.id,
      });
      return apertura;
    }

    // Si no hay cierre anterior, buscar saldo inicial asignado
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

    if (saldoInicial) {
      const apertura = Number(saldoInicial.cantidad_inicial);
      logger.info("Saldo de apertura obtenido del saldo inicial", {
        puntoAtencionId,
        monedaId,
        apertura,
      });
      return apertura;
    }

    logger.info("No hay cierre anterior ni saldo inicial, apertura = 0", {
      puntoAtencionId,
      monedaId,
    });
    return 0;
  } catch (error) {
    logger.error("Error calculando saldo de apertura", {
      error: error instanceof Error ? error.message : String(error),
      puntoAtencionId,
      monedaId,
    });
    return 0;
  }
}

/**
 * Obtiene los movimientos de saldo del período
 */
export async function obtenerMovimientosPeriodo(
  puntoAtencionId: string,
  monedaId: string,
  fechaInicio: Date,
  fechaFin: Date
): Promise<Array<{
  id: string;
  monto: number;
  tipo_movimiento: string;
  descripcion: string | null;
  fecha: Date;
}>> {
  return prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      fecha: {
        gte: fechaInicio,
        lt: fechaFin,
      },
      // Excluir movimientos de bancos (no afectan cuadre físico)
      NOT: {
        descripcion: {
          contains: "bancos",
          mode: "insensitive",
        },
      },
    },
    select: {
      id: true,
      monto: true,
      tipo_movimiento: true,
      descripcion: true,
      fecha: true,
    },
    orderBy: {
      fecha: "asc",
    },
  });
}

/**
 * Calcula ingresos y egresos a partir de movimientos
 */
export function calcularIngresosEgresos(
  movimientos: Array<{ monto: number | Prisma.Decimal; tipo_movimiento: string }>
): { ingresos: number; egresos: number } {
  let ingresos = 0;
  let egresos = 0;

  for (const mov of movimientos) {
    const monto = Number(mov.monto);
    const tipo = (mov.tipo_movimiento || "").toUpperCase();

    // Normalizar el monto según el tipo
    let montoNormalizado: number;
    
    if (tipo === "INGRESO" || tipo === "TRANSFERENCIA_ENTRANTE" || tipo === "TRANSFERENCIA_ENTRADA") {
      // Ingresos deben ser positivos
      montoNormalizado = Math.abs(monto);
      ingresos += montoNormalizado;
    } else if (tipo === "EGRESO" || tipo === "TRANSFERENCIA_SALIENTE" || tipo === "TRANSFERENCIA_SALIDA") {
      // Egresos deben ser negativos
      montoNormalizado = -Math.abs(monto);
      egresos += Math.abs(monto);
    } else if (tipo === "AJUSTE") {
      // Ajustes mantienen su signo
      if (monto > 0) {
        ingresos += monto;
      } else {
        egresos += Math.abs(monto);
      }
    } else {
      // Para otros tipos, usar el signo del monto
      if (monto > 0) {
        ingresos += monto;
      } else {
        egresos += Math.abs(monto);
      }
    }
  }

  return {
    ingresos: Number(ingresos.toFixed(2)),
    egresos: Number(egresos.toFixed(2)),
  };
}

/**
 * Obtiene el saldo físico actual de la tabla Saldo
 */
export async function obtenerSaldoFisico(
  puntoAtencionId: string,
  monedaId: string
): Promise<{
  cantidad: number;
  billetes: number;
  monedas_fisicas: number;
  bancos: number;
}> {
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
      },
    },
    select: {
      cantidad: true,
      billetes: true,
      monedas_fisicas: true,
      bancos: true,
    },
  });

  if (!saldo) {
    return { cantidad: 0, billetes: 0, monedas_fisicas: 0, bancos: 0 };
  }

  return {
    cantidad: Number(saldo.cantidad) || 0,
    billetes: Number(saldo.billetes) || 0,
    monedas_fisicas: Number(saldo.monedas_fisicas) || 0,
    bancos: Number(saldo.bancos) || 0,
  };
}

/**
 * Calcula el cuadre de caja completo
 */
export async function calcularCuadreCaja(
  data: CuadreCajaData
): Promise<ResumenCuadre> {
  const { puntoAtencionId, fechaInicio, fechaFin } = data;

  try {
    // Obtener todas las monedas activas
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      orderBy: { orden_display: "asc" },
    });

    const detalles: DetalleCuadreCalculado[] = [];
    let totalFueraTolerancia = 0;

    for (const moneda of monedas) {
      try {
        // 1. Calcular saldo de apertura
        const saldoApertura = await calcularSaldoApertura(
          puntoAtencionId,
          moneda.id,
          fechaInicio
        );

        // 2. Obtener movimientos del período
        const movimientos = await obtenerMovimientosPeriodo(
          puntoAtencionId,
          moneda.id,
          fechaInicio,
          fechaFin
        );

        // 3. Calcular ingresos y egresos
        const { ingresos, egresos } = calcularIngresosEgresos(movimientos);

        // 4. Calcular saldo teórico
        const saldoTeorico = Number(
          (saldoApertura + ingresos - egresos).toFixed(2)
        );

        // 5. Obtener saldo físico actual
        const saldoFisico = await obtenerSaldoFisico(puntoAtencionId, moneda.id);

        // 6. Calcular diferencias
        const diferenciaFisica = Number(
          (saldoFisico.cantidad - saldoTeorico).toFixed(2)
        );
        const diferenciaBancos = 0; // Se calcula aparte si es necesario

        // 7. Verificar si está dentro de tolerancia
        // USD: ±1.00, otras: ±0.01
        const tolerancia = moneda.codigo === "USD" ? 1.0 : 0.01;
        const fueraTolerancia = Math.abs(diferenciaFisica) > tolerancia;

        if (fueraTolerancia) {
          totalFueraTolerancia++;
        }

        // 8. Verificar consistencia del desglose físico
        const desgloseFisico = Number(
          (saldoFisico.billetes + saldoFisico.monedas_fisicas).toFixed(2)
        );
        const desgloseConsistente = Math.abs(desgloseFisico - saldoFisico.cantidad) <= 0.01;

        if (!desgloseConsistente) {
          logger.warn("Inconsistencia en desglose físico detectada", {
            puntoAtencionId,
            monedaId: moneda.id,
            codigo: moneda.codigo,
            cantidad: saldoFisico.cantidad,
            billetes: saldoFisico.billetes,
            monedas: saldoFisico.monedas_fisicas,
            desgloseCalculado: desgloseFisico,
          });
        }

        detalles.push({
          moneda_id: moneda.id,
          codigo: moneda.codigo,
          nombre: moneda.nombre,
          simbolo: moneda.simbolo,
          
          saldo_apertura: saldoApertura,
          saldo_cierre_teorico: saldoTeorico,
          conteo_fisico: saldoFisico.cantidad,
          diferencia: diferenciaFisica,
          
          billetes: saldoFisico.billetes,
          monedas_fisicas: saldoFisico.monedas_fisicas,
          
          bancos_teorico: saldoFisico.bancos,
          conteo_bancos: saldoFisico.bancos,
          diferencia_bancos: diferenciaBancos,
          
          ingresos,
          egresos,
          total_movimientos: movimientos.length,
          
          cuadrado: Math.abs(diferenciaFisica) <= 0.01,
          fuera_tolerancia: fueraTolerancia,
        });
      } catch (error) {
        logger.error(`Error procesando moneda ${moneda.codigo}`, {
          error: error instanceof Error ? error.message : String(error),
          monedaId: moneda.id,
        });
      }
    }

    const puedeCerrar = detalles.length > 0 && detalles.every(d => !d.fuera_tolerancia);

    return {
      detalles,
      totales: {
        total_monedas: detalles.length,
        total_diferencias: detalles.filter(d => d.diferencia !== 0).length,
        total_fuera_tolerancia: totalFueraTolerancia,
      },
      puede_cerrar: puedeCerrar,
    };
  } catch (error) {
    logger.error("Error calculando cuadre de caja", {
      error: error instanceof Error ? error.message : String(error),
      puntoAtencionId,
      fechaInicio: fechaInicio.toISOString(),
    });
    throw error;
  }
}

/**
 * Valida la consistencia de saldos antes de cierre
 */
export async function validarConsistenciaSaldos(
  puntoAtencionId: string,
  monedaId: string
): Promise<{
  consistente: boolean;
  errores: string[];
  saldo: {
    cantidad: number;
    billetes: number;
    monedas: number;
    bancos: number;
  };
}> {
  const errores: string[] = [];
  
  const saldoFisico = await obtenerSaldoFisico(puntoAtencionId, monedaId);
  
  const desgloseFisico = Number(
    (saldoFisico.billetes + saldoFisico.monedas_fisicas).toFixed(2)
  );
  
  // Validar que cantidad = billetes + monedas
  if (Math.abs(desgloseFisico - saldoFisico.cantidad) > 0.01) {
    errores.push(
      `Inconsistencia: cantidad (${saldoFisico.cantidad}) ≠ billetes (${saldoFisico.billetes}) + monedas (${saldoFisico.monedas_fisicas}) = ${desgloseFisico}`
    );
  }
  
  // Validar que no haya valores negativos
  if (saldoFisico.cantidad < 0) errores.push("Saldo cantidad es negativo");
  if (saldoFisico.billetes < 0) errores.push("Saldo billetes es negativo");
  if (saldoFisico.monedas_fisicas < 0) errores.push("Saldo monedas es negativo");
  if (saldoFisico.bancos < 0) errores.push("Saldo bancos es negativo");
  
  return {
    consistente: errores.length === 0,
    errores,
    saldo: {
      cantidad: saldoFisico.cantidad,
      billetes: saldoFisico.billetes,
      monedas: saldoFisico.monedas_fisicas,
      bancos: saldoFisico.bancos,
    },
  };
}

export default {
  calcularCuadreCaja,
  calcularSaldoApertura,
  calcularIngresosEgresos,
  obtenerMovimientosPeriodo,
  obtenerSaldoFisico,
  validarConsistenciaSaldos,
};
