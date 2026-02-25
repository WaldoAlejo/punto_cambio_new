/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO UNIFICADO DE CIERRE DE CAJA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este servicio consolida toda la lógica de cierre de caja para garantizar
 * consistencia y prevenir errores. Todas las operaciones son atómicas.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import logger from "../utils/logger.js";
import {
  registrarMovimientoSaldo,
  TipoMovimiento,
  TipoReferencia,
} from "./movimientoSaldoService.js";

const prisma = new PrismaClient();

// Constantes de configuración
const UMBRAL_DIFERENCIA_ALERTA = 10; // $10 USD o equivalente
const TOLERANCIA_USD = 1.0; // $1.00 USD
const TOLERANCIA_OTRAS = 0.01; // 1 centavo

export interface DetalleCierreRequest {
  moneda_id: string;
  saldo_apertura?: number;
  saldo_cierre?: number;
  conteo_fisico: number;
  bancos_teorico?: number;
  conteo_bancos?: number;
  billetes: number;
  monedas: number;
  ingresos_periodo?: number;
  egresos_periodo?: number;
  movimientos_periodo?: number;
  observaciones_detalle?: string;
}

export interface ResultadoValidacion {
  valido: boolean;
  puedeForzar: boolean;
  discrepancias: Array<{
    moneda_id: string;
    moneda_codigo?: string;
    tipo: string;
    severidad: "CRITICA" | "ADVERTENCIA" | "INFO";
    mensaje: string;
    diferencia: number;
    esperado: number;
    recibido: number;
  }>;
  resumen: {
    total_monedas: number;
    con_diferencias: number;
    diferencia_total: number;
  };
}

export interface ResultadoCierre {
  success: boolean;
  cuadre_id?: string;
  message: string;
  errores?: string[];
  ajustes_creados?: Array<{
    moneda_id: string;
    monto: number;
    tipo: string;
  }>;
}

/**
 * Valida los detalles del cierre antes de guardar
 */
export async function validarCierre(
  detalles: DetalleCierreRequest[],
  opciones?: { forzar?: boolean; esAdmin?: boolean }
): Promise<ResultadoValidacion> {
  const discrepancias: ResultadoValidacion["discrepancias"] = [];
  let diferenciaTotal = 0;
  let conDiferencias = 0;

  // Obtener códigos de moneda
  const monedaIds = detalles.map((d) => d.moneda_id);
  const monedas = await prisma.moneda.findMany({
    where: { id: { in: monedaIds } },
    select: { id: true, codigo: true },
  });
  const monedaPorId = new Map(monedas.map((m) => [m.id, m]));

  for (const detalle of detalles) {
    const moneda = monedaPorId.get(detalle.moneda_id);
    const codigo = moneda?.codigo || "DESCONOCIDA";
    const tolerancia = codigo === "USD" ? TOLERANCIA_USD : TOLERANCIA_OTRAS;

    // Validación 1: Desglose debe cuadrar
    const sumaDesglose = detalle.billetes + detalle.monedas;
    const diffDesglose = Math.abs(sumaDesglose - detalle.conteo_fisico);

    if (diffDesglose > 0.01) {
      discrepancias.push({
        moneda_id: detalle.moneda_id,
        moneda_codigo: codigo,
        tipo: "DESGLOSE_INVALIDO",
        severidad: "CRITICA",
        mensaje: `Billetes (${detalle.billetes}) + Monedas (${detalle.monedas}) ≠ Conteo (${detalle.conteo_fisico})`,
        diferencia: diffDesglose,
        esperado: detalle.conteo_fisico,
        recibido: sumaDesglose,
      });
      continue;
    }

    // Validación 2: Diferencia vs saldo teórico
    const saldoTeorico = detalle.saldo_cierre || 0;
    const diferencia = Number((detalle.conteo_fisico - saldoTeorico).toFixed(2));
    diferenciaTotal += Math.abs(diferencia);

    if (Math.abs(diferencia) > tolerancia) {
      conDiferencias++;

      const severidad =
        Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA * 2
          ? "CRITICA"
          : Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA
          ? "ADVERTENCIA"
          : "INFO";

      const tipoDiferencia = diferencia > 0 ? "SOBRANTE" : "FALTANTE";

      discrepancias.push({
        moneda_id: detalle.moneda_id,
        moneda_codigo: codigo,
        tipo: `DIFERENCIA_${tipoDiferencia}`,
        severidad,
        mensaje: `${tipoDiferencia} de $${Math.abs(diferencia).toFixed(2)} ${codigo}`,
        diferencia,
        esperado: saldoTeorico,
        recibido: detalle.conteo_fisico,
      });
    }

    // Validación 3: Conteo vacío con movimientos
    if (
      detalle.conteo_fisico === 0 &&
      (detalle.movimientos_periodo || 0) > 0
    ) {
      discrepancias.push({
        moneda_id: detalle.moneda_id,
        moneda_codigo: codigo,
        tipo: "CONTEO_VACIO",
        severidad: "ADVERTENCIA",
        mensaje: `No hay conteo físico pero existen ${detalle.movimientos_periodo} movimientos`,
        diferencia: 0,
        esperado: detalle.saldo_cierre || 0,
        recibido: 0,
      });
    }
  }

  // Determinar si puede cerrar
  const tieneCriticas = discrepancias.some((d) => d.severidad === "CRITICA");
  const puedeForzar = opciones?.esAdmin || false;
  const forzar = opciones?.forzar || false;
  const valido = !tieneCriticas || (puedeForzar && forzar);

  return {
    valido: Boolean(valido),
    puedeForzar,
    discrepancias,
    resumen: {
      total_monedas: detalles.length,
      con_diferencias: conDiferencias,
      diferencia_total: diferenciaTotal,
    },
  };
}

/**
 * Ejecuta el cierre de caja de forma atómica
 */
export async function ejecutarCierre(
  params: {
    usuarioId: string;
    puntoAtencionId: string;
    detalles: DetalleCierreRequest[];
    observaciones?: string;
    tipoCierre: "CERRADO" | "PARCIAL";
  },
  tx?: Prisma.TransactionClient
): Promise<ResultadoCierre> {
  const { usuarioId, puntoAtencionId, detalles, observaciones, tipoCierre } =
    params;

  const ejecutor = tx || prisma;
  const ajustesCreados: ResultadoCierre["ajustes_creados"] = [];

  try {
    // 1. Buscar o crear cabecera del cuadre
    let cabecera = await ejecutor.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        estado: { in: ["ABIERTO", "PARCIAL"] },
        fecha: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    });

    if (!cabecera) {
      cabecera = await ejecutor.cuadreCaja.create({
        data: {
          usuario_id: usuarioId,
          punto_atencion_id: puntoAtencionId,
          fecha: new Date(),
          estado: tipoCierre,
          observaciones: observaciones || "",
          fecha_cierre: tipoCierre === "CERRADO" ? new Date() : null,
          total_ingresos: detalles.reduce(
            (sum, d) => sum + (d.ingresos_periodo || 0),
            0
          ),
          total_egresos: detalles.reduce(
            (sum, d) => sum + (d.egresos_periodo || 0),
            0
          ),
          total_cambios: detalles.reduce(
            (sum, d) => sum + (d.movimientos_periodo || 0),
            0
          ),
        },
      });
    } else {
      cabecera = await ejecutor.cuadreCaja.update({
        where: { id: cabecera.id },
        data: {
          estado: tipoCierre,
          observaciones: observaciones || cabecera.observaciones,
          fecha_cierre: tipoCierre === "CERRADO" ? new Date() : null,
          total_ingresos: detalles.reduce(
            (sum, d) => sum + (d.ingresos_periodo || 0),
            0
          ),
          total_egresos: detalles.reduce(
            (sum, d) => sum + (d.egresos_periodo || 0),
            0
          ),
          total_cambios: detalles.reduce(
            (sum, d) => sum + (d.movimientos_periodo || 0),
            0
          ),
        },
      });
    }

    // 2. Guardar detalles
    if (detalles.length > 0) {
      // Eliminar detalles anteriores
      await ejecutor.detalleCuadreCaja.deleteMany({
        where: { cuadre_id: cabecera.id },
      });

      // Crear nuevos detalles
      const payload = detalles.map((d) => ({
        cuadre_id: cabecera.id,
        moneda_id: d.moneda_id,
        saldo_apertura: d.saldo_apertura || 0,
        saldo_cierre: d.saldo_cierre || 0,
        conteo_fisico: d.conteo_fisico,
        bancos_teorico: d.bancos_teorico || 0,
        conteo_bancos: d.conteo_bancos || 0,
        diferencia_bancos: Number(
          ((d.conteo_bancos || 0) - (d.bancos_teorico || 0)).toFixed(2)
        ),
        billetes: d.billetes,
        monedas_fisicas: d.monedas,
        diferencia: Number(
          ((d.conteo_fisico || 0) - (d.saldo_cierre || 0)).toFixed(2)
        ),
        movimientos_periodo: d.movimientos_periodo || 0,
        observaciones_detalle: d.observaciones_detalle || null,
      }));

      await ejecutor.detalleCuadreCaja.createMany({ data: payload });
    }

    // 3. Si es cierre definitivo, ejecutar acciones adicionales
    if (tipoCierre === "CERRADO") {
      // 3.1 Actualizar saldos
      for (const detalle of detalles) {
        await ejecutor.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: puntoAtencionId,
              moneda_id: detalle.moneda_id,
            },
          },
          update: {
            cantidad: detalle.conteo_fisico,
            billetes: detalle.billetes,
            monedas_fisicas: detalle.monedas,
            bancos: detalle.conteo_bancos || 0,
            updated_at: new Date(),
          },
          create: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: detalle.moneda_id,
            cantidad: detalle.conteo_fisico,
            billetes: detalle.billetes,
            monedas_fisicas: detalle.monedas,
            bancos: detalle.conteo_bancos || 0,
          },
        });

        // 3.2 Crear ajuste contable si hay diferencia
        const diferencia = Number(
          (detalle.conteo_fisico - (detalle.saldo_cierre || 0)).toFixed(2)
        );

        if (Math.abs(diferencia) >= 0.01) {
          // Verificar si ya existe ajuste
          const yaExiste = await ejecutor.movimientoSaldo.findFirst({
            where: {
              punto_atencion_id: puntoAtencionId,
              moneda_id: detalle.moneda_id,
              tipo_referencia: TipoReferencia.CIERRE_DIARIO,
              referencia_id: cabecera.id,
              descripcion: { contains: "AJUSTE CIERRE", mode: "insensitive" },
            },
          });

          if (!yaExiste) {
            await registrarMovimientoSaldo(
              {
                puntoAtencionId: puntoAtencionId,
                monedaId: detalle.moneda_id,
                tipoMovimiento:
                  diferencia > 0
                    ? TipoMovimiento.INGRESO
                    : TipoMovimiento.EGRESO,
                monto: Math.abs(diferencia),
                saldoAnterior: detalle.saldo_cierre || 0,
                saldoNuevo: detalle.conteo_fisico,
                tipoReferencia: TipoReferencia.CIERRE_DIARIO,
                referenciaId: cabecera.id,
                descripcion: `AJUSTE CIERRE ${new Date().toISOString().slice(0, 10)}`,
                usuarioId: usuarioId,
                saldoBucket: "CAJA",
              },
              ejecutor
            );

            ajustesCreados.push({
              moneda_id: detalle.moneda_id,
              monto: Math.abs(diferencia),
              tipo: diferencia > 0 ? "INGRESO" : "EGRESO",
            });
          }
        }
      }

      // 3.3 Cerrar jornada activa
      const jornadaActiva = await ejecutor.jornada.findFirst({
        where: {
          usuario_id: usuarioId,
          punto_atencion_id: puntoAtencionId,
          estado: { in: ["ACTIVO", "ALMUERZO"] },
        },
        orderBy: { fecha_inicio: "desc" },
      });

      if (jornadaActiva) {
        await ejecutor.jornada.update({
          where: { id: jornadaActiva.id },
          data: {
            fecha_salida: new Date(),
            estado: "COMPLETADO",
            observaciones:
              "Jornada finalizada automáticamente al cerrar caja",
            minutos_trabajados: calcularMinutosTrabajados(jornadaActiva),
          },
        });
      }

      // 3.4 Liberar punto de atención
      await ejecutor.usuario.update({
        where: { id: usuarioId },
        data: { punto_atencion_id: null },
      });
    }

    logger.info("✅ Cierre de caja ejecutado exitosamente", {
      cuadre_id: cabecera.id,
      usuario_id: usuarioId,
      tipo: tipoCierre,
      ajustes: ajustesCreados.length,
    });

    return {
      success: true,
      cuadre_id: cabecera.id,
      message:
        tipoCierre === "PARCIAL"
          ? "Cierre parcial guardado correctamente"
          : "Cierre de caja completado exitosamente",
      ajustes_creados: ajustesCreados,
    };
  } catch (error) {
    logger.error("❌ Error en ejecutarCierre", {
      error: error instanceof Error ? error.message : String(error),
      usuario_id: usuarioId,
      punto_atencion_id: puntoAtencionId,
    });

    throw error;
  }
}

/**
 * Calcula los minutos trabajados de una jornada
 */
function calcularMinutosTrabajados(jornada: {
  fecha_inicio: Date;
  fecha_almuerzo?: Date | null;
  fecha_regreso?: Date | null;
  fecha_salida?: Date | null;
}): number {
  const inicio = jornada.fecha_inicio;
  const fin = jornada.fecha_salida || new Date();

  let minutos = Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60));

  // Restar tiempo de almuerzo
  if (jornada.fecha_almuerzo && jornada.fecha_regreso) {
    const minutosAlmuerzo = Math.floor(
      (jornada.fecha_regreso.getTime() - jornada.fecha_almuerzo.getTime()) /
        (1000 * 60)
    );
    minutos -= minutosAlmuerzo;
  }

  return Math.max(0, minutos);
}

export const cierreUnificadoService = {
  validarCierre,
  ejecutarCierre,
};

export default cierreUnificadoService;
