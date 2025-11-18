// server/services/cierreService.ts
/**
 * Servicio unificado para el proceso de cierre diario
 * Consolida la lógica de cierre de caja y cierre contable
 */

import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";
import saldoReconciliationService from "./saldoReconciliationService.js";

interface DetalleMoneda {
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  saldo_apertura: number;
  saldo_cierre_teorico: number;
  conteo_fisico: number;
  billetes: number;
  monedas_fisicas: number;
  diferencia: number;
  ingresos_periodo: number;
  egresos_periodo: number;
  movimientos_periodo: number;
  observaciones_detalle?: string;
}

interface ResultadoCierre {
  success: boolean;
  cierre_id?: string;
  cuadre_id?: string;
  jornada_finalizada?: boolean;
  mensaje?: string;
  error?: string;
  codigo?: string;
  detalles?: any;
}

interface DatosCierre {
  punto_atencion_id: string;
  usuario_id: string;
  fecha: Date;
  detalles: DetalleMoneda[];
  observaciones?: string;
  diferencias_reportadas?: any;
}

class CierreService {
  /**
   * Valida que un cierre sea posible
   */
  async validarCierrePosible(
    puntoId: string,
    fecha: Date,
    usuarioId: string
  ): Promise<{ valido: boolean; razon?: string; codigo?: string }> {
    try {
      const fechaDate = new Date(
        `${fecha.toISOString().split("T")[0]}T00:00:00.000Z`
      );

      // 1. Verificar que no exista ya un cierre CERRADO para ese día
      const cierreExistente = await prisma.cierreDiario.findUnique({
        where: {
          fecha_punto_atencion_id: {
            fecha: fechaDate,
            punto_atencion_id: puntoId,
          },
        },
      });

      if (cierreExistente && cierreExistente.estado === "CERRADO") {
        return {
          valido: false,
          razon: "Ya existe un cierre completado para este día",
          codigo: "YA_CERRADO",
        };
      }

      // 2. Verificar que el punto de atención esté activo
      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: puntoId },
      });

      if (!punto || !punto.activo) {
        return {
          valido: false,
          razon: "El punto de atención no está activo",
          codigo: "PUNTO_INACTIVO",
        };
      }

      // 3. Verificar que el usuario tenga acceso al punto
      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
      });

      if (!usuario) {
        return {
          valido: false,
          razon: "Usuario no encontrado",
          codigo: "USUARIO_NO_ENCONTRADO",
        };
      }

      // Si es OPERADOR, debe estar asignado al punto
      if (usuario.rol === "OPERADOR" && usuario.punto_atencion_id !== puntoId) {
        return {
          valido: false,
          razon: "No tiene permisos para cerrar este punto de atención",
          codigo: "SIN_PERMISO",
        };
      }

      return { valido: true };
    } catch (error) {
      logger.error("Error validando cierre posible", { error, puntoId, fecha });
      return {
        valido: false,
        razon: "Error interno al validar cierre",
        codigo: "ERROR_VALIDACION",
      };
    }
  }

  /**
   * Calcula el saldo de apertura para una moneda específica
   * Busca el último cierre (CERRADO o PARCIAL) anterior a la fecha
   */
  async calcularSaldoApertura(
    puntoId: string,
    monedaId: string,
    fechaInicio: Date
  ): Promise<number> {
    try {
      // Buscar último cierre con conteo físico
      const ultimoCierre = await prisma.cuadreCaja.findFirst({
        where: {
          punto_atencion_id: puntoId,
          estado: { in: ["CERRADO", "PARCIAL"] },
          fecha: { lt: fechaInicio },
        },
        orderBy: { fecha: "desc" },
        include: {
          detalles: {
            where: { moneda_id: monedaId },
            select: { conteo_fisico: true },
          },
        },
      });

      if (ultimoCierre?.detalles?.[0]) {
        return Number(ultimoCierre.detalles[0].conteo_fisico);
      }

      // Si no hay cierre anterior, usar saldo inicial de la tabla Saldo
      const saldo = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoId,
            moneda_id: monedaId,
          },
        },
      });

      return saldo ? Number(saldo.cantidad) : 0;
    } catch (error) {
      logger.error("Error calculando saldo apertura", {
        error,
        puntoId,
        monedaId,
      });
      return 0;
    }
  }

  /**
   * Obtiene el resumen de movimientos del día para preparar el cierre
   */
  async obtenerResumenMovimientos(
    puntoId: string,
    fecha: Date,
    usuarioId: string
  ): Promise<{
    success: boolean;
    detalles?: DetalleMoneda[];
    totales?: any;
    error?: string;
  }> {
    try {
      const { gte: fechaInicio, lt: fechaFin } = gyeDayRangeUtcFromDate(fecha);

      // Obtener todas las monedas que tuvieron movimientos
      const monedasConMovimientos = await prisma.$queryRaw<
        Array<{ moneda_id: string }>
      >`
        SELECT DISTINCT moneda_id 
        FROM (
          SELECT moneda_origen_id as moneda_id FROM "CambioDivisa"
          WHERE punto_atencion_id = ${puntoId}::uuid
            AND fecha >= ${fechaInicio}::timestamp
            AND fecha < ${fechaFin}::timestamp
            AND estado = 'COMPLETADO'
          UNION
          SELECT moneda_destino_id as moneda_id FROM "CambioDivisa"
          WHERE punto_atencion_id = ${puntoId}::uuid
            AND fecha >= ${fechaInicio}::timestamp
            AND fecha < ${fechaFin}::timestamp
            AND estado = 'COMPLETADO'
          UNION
          SELECT moneda_id FROM "Transferencia"
          WHERE (origen_id = ${puntoId}::uuid OR destino_id = ${puntoId}::uuid)
            AND fecha >= ${fechaInicio}::timestamp
            AND fecha < ${fechaFin}::timestamp
            AND estado = 'APROBADO'
          UNION
          SELECT moneda_id FROM "ServicioExternoMovimiento"
          WHERE punto_atencion_id = ${puntoId}::uuid
            AND fecha >= ${fechaInicio}::timestamp
            AND fecha < ${fechaFin}::timestamp
        ) AS monedas_usadas
        WHERE moneda_id IS NOT NULL
      `;

      if (monedasConMovimientos.length === 0) {
        return {
          success: true,
          detalles: [],
          totales: {
            cambios: 0,
            servicios_externos: 0,
            transferencias: 0,
          },
        };
      }

      const monedaIds = monedasConMovimientos.map((m) => m.moneda_id);

      // Obtener información de las monedas
      const monedas = await prisma.moneda.findMany({
        where: { id: { in: monedaIds } },
        orderBy: [{ orden_display: "asc" }, { nombre: "asc" }],
      });

      // Calcular detalles para cada moneda
      const detalles = await Promise.all(
        monedas.map(async (moneda) => {
          const saldoApertura = await this.calcularSaldoApertura(
            puntoId,
            moneda.id,
            new Date(fechaInicio)
          );

          const saldoCierreTeórico =
            await saldoReconciliationService.calcularSaldoReal(
              puntoId,
              moneda.id
            );

          // Calcular ingresos y egresos del período
          const movimientos = await prisma.movimientoSaldo.findMany({
            where: {
              punto_atencion_id: puntoId,
              moneda_id: moneda.id,
              fecha: {
                gte: new Date(fechaInicio),
                lt: new Date(fechaFin),
              },
            },
          });

          let ingresos = 0;
          let egresos = 0;

          for (const mov of movimientos) {
            const monto = Number(mov.monto);
            if (monto > 0) {
              ingresos += monto;
            } else {
              egresos += Math.abs(monto);
            }
          }

          return {
            moneda_id: moneda.id,
            codigo: moneda.codigo,
            nombre: moneda.nombre,
            simbolo: moneda.simbolo,
            saldo_apertura: saldoApertura,
            saldo_cierre_teorico: saldoCierreTeórico,
            conteo_fisico: saldoCierreTeórico, // Inicialmente igual al teórico
            billetes: 0,
            monedas_fisicas: 0,
            diferencia: 0,
            ingresos_periodo: ingresos,
            egresos_periodo: egresos,
            movimientos_periodo: movimientos.length,
          };
        })
      );

      // Calcular totales
      const cambios = await prisma.cambioDivisa.count({
        where: {
          punto_atencion_id: puntoId,
          fecha: {
            gte: new Date(fechaInicio),
            lt: new Date(fechaFin),
          },
          estado: "COMPLETADO",
        },
      });

      const serviciosExternos = await prisma.servicioExternoMovimiento.count({
        where: {
          punto_atencion_id: puntoId,
          fecha: {
            gte: new Date(fechaInicio),
            lt: new Date(fechaFin),
          },
        },
      });

      const transferencias = await prisma.transferencia.count({
        where: {
          OR: [{ origen_id: puntoId }, { destino_id: puntoId }],
          fecha: {
            gte: new Date(fechaInicio),
            lt: new Date(fechaFin),
          },
          estado: "APROBADO",
        },
      });

      return {
        success: true,
        detalles,
        totales: {
          cambios,
          servicios_externos: serviciosExternos,
          transferencias,
        },
      };
    } catch (error) {
      logger.error("Error obteniendo resumen movimientos", {
        error,
        puntoId,
        fecha,
      });
      return {
        success: false,
        error: "Error al obtener resumen de movimientos",
      };
    }
  }

  /**
   * Realiza el cierre diario completo (transaccional)
   * 1. Valida que sea posible
   * 2. Guarda el cuadre de caja con detalles
   * 3. Marca el cierre diario como CERRADO
   * 4. Finaliza la jornada si existe una activa
   * 5. Actualiza saldos en la tabla Saldo (opcional, ya que MovimientoSaldo es la fuente de verdad)
   */
  async realizarCierreDiario(datos: DatosCierre): Promise<ResultadoCierre> {
    const { punto_atencion_id, usuario_id, fecha, detalles, observaciones } =
      datos;

    try {
      // 1. Validar que sea posible realizar el cierre
      const validacion = await this.validarCierrePosible(
        punto_atencion_id,
        fecha,
        usuario_id
      );

      if (!validacion.valido) {
        return {
          success: false,
          error: validacion.razon,
          codigo: validacion.codigo,
        };
      }

      // 2. Ejecutar todo en una transacción
      const resultado = await prisma.$transaction(async (tx) => {
        const fechaDate = new Date(
          `${fecha.toISOString().split("T")[0]}T00:00:00.000Z`
        );
        const { gte: fechaInicio } = gyeDayRangeUtcFromDate(fecha);

        // 2.1. Crear o actualizar CuadreCaja
        let cuadre;
        const cuadreExistente = await tx.cuadreCaja.findFirst({
          where: {
            punto_atencion_id,
            fecha: { gte: new Date(fechaInicio) },
            estado: { in: ["ABIERTO", "PARCIAL"] },
          },
        });

        const totalIngresos = detalles.reduce(
          (sum, d) => sum + d.ingresos_periodo,
          0
        );
        const totalEgresos = detalles.reduce(
          (sum, d) => sum + d.egresos_periodo,
          0
        );
        const totalMovimientos = detalles.reduce(
          (sum, d) => sum + d.movimientos_periodo,
          0
        );

        if (cuadreExistente) {
          cuadre = await tx.cuadreCaja.update({
            where: { id: cuadreExistente.id },
            data: {
              estado: "CERRADO",
              fecha_cierre: new Date(),
              observaciones: observaciones || null,
              total_ingresos: totalIngresos,
              total_egresos: totalEgresos,
              total_cambios: totalMovimientos,
              usuario_cierre_parcial: usuario_id,
            },
          });

          // Eliminar detalles anteriores
          await tx.detalleCuadreCaja.deleteMany({
            where: { cuadre_id: cuadre.id },
          });
        } else {
          cuadre = await tx.cuadreCaja.create({
            data: {
              punto_atencion_id,
              usuario_id,
              fecha: new Date(fechaInicio),
              estado: "CERRADO",
              fecha_cierre: new Date(),
              observaciones: observaciones || null,
              total_ingresos: totalIngresos,
              total_egresos: totalEgresos,
              total_cambios: totalMovimientos,
              usuario_cierre_parcial: usuario_id,
            },
          });
        }

        // 2.2. Crear detalles del cuadre
        if (detalles.length > 0) {
          await tx.detalleCuadreCaja.createMany({
            data: detalles.map((d) => ({
              cuadre_id: cuadre.id,
              moneda_id: d.moneda_id,
              saldo_apertura: d.saldo_apertura,
              saldo_cierre: d.saldo_cierre_teorico,
              conteo_fisico: d.conteo_fisico,
              billetes: d.billetes || 0,
              monedas_fisicas: d.monedas_fisicas || 0,
              diferencia: Number(
                (d.conteo_fisico - d.saldo_cierre_teorico).toFixed(2)
              ),
              movimientos_periodo: d.movimientos_periodo,
              observaciones_detalle: d.observaciones_detalle || null,
            })),
          });
        }

        // 2.3. Crear o actualizar CierreDiario
        let cierreDiario;
        const cierreExistente = await tx.cierreDiario.findUnique({
          where: {
            fecha_punto_atencion_id: {
              fecha: fechaDate,
              punto_atencion_id,
            },
          },
        });

        // Preparar diferencias reportadas
        const diferencias = detalles
          .filter((d) => Math.abs(d.diferencia) > 0.01)
          .map((d) => ({
            moneda_id: d.moneda_id,
            moneda_codigo: d.codigo,
            diferencia_sistema: d.saldo_cierre_teorico,
            diferencia_fisica: d.conteo_fisico,
            diferencia: d.diferencia,
            justificacion: d.observaciones_detalle || null,
          }));

        if (cierreExistente) {
          cierreDiario = await tx.cierreDiario.update({
            where: { id: cierreExistente.id },
            data: {
              estado: "CERRADO",
              fecha_cierre: new Date(),
              cerrado_por: usuario_id,
              observaciones: observaciones || cierreExistente.observaciones,
              diferencias_reportadas:
                diferencias.length > 0
                  ? JSON.parse(JSON.stringify(diferencias))
                  : undefined,
              updated_at: new Date(),
            },
          });
        } else {
          cierreDiario = await tx.cierreDiario.create({
            data: {
              fecha: fechaDate,
              punto_atencion_id,
              usuario_id,
              estado: "CERRADO",
              fecha_cierre: new Date(),
              cerrado_por: usuario_id,
              observaciones: observaciones || null,
              diferencias_reportadas:
                diferencias.length > 0
                  ? JSON.parse(JSON.stringify(diferencias))
                  : undefined,
            },
          });
        }

        // 2.4. Finalizar jornada activa si existe
        const jornadaActiva = await tx.jornada.findFirst({
          where: {
            usuario_id,
            punto_atencion_id,
            fecha_salida: null,
            estado: { in: ["ACTIVO", "ALMUERZO"] },
          },
          orderBy: { fecha_inicio: "desc" },
        });

        let jornadaFinalizada = false;
        if (jornadaActiva) {
          await tx.jornada.update({
            where: { id: jornadaActiva.id },
            data: {
              fecha_salida: new Date(),
              estado: "COMPLETADO",
              observaciones:
                "Jornada finalizada automáticamente al completar cierre diario",
            },
          });
          jornadaFinalizada = true;

          logger.info("✅ Jornada finalizada automáticamente", {
            jornada_id: jornadaActiva.id,
            usuario_id,
            punto_atencion_id,
          });
        }

        // 2.5. Actualizar saldos en tabla Saldo (opcional pero recomendado para reportes rápidos)
        for (const detalle of detalles) {
          await tx.saldo.upsert({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id,
                moneda_id: detalle.moneda_id,
              },
            },
            update: {
              cantidad: detalle.conteo_fisico,
              billetes: detalle.billetes || 0,
              monedas_fisicas: detalle.monedas_fisicas || 0,
              updated_at: new Date(),
            },
            create: {
              punto_atencion_id,
              moneda_id: detalle.moneda_id,
              cantidad: detalle.conteo_fisico,
              billetes: detalle.billetes || 0,
              monedas_fisicas: detalle.monedas_fisicas || 0,
            },
          });
        }

        return {
          cuadre,
          cierreDiario,
          jornadaFinalizada,
        };
      });

      logger.info("✅ Cierre diario completado exitosamente", {
        cierre_id: resultado.cierreDiario.id,
        cuadre_id: resultado.cuadre.id,
        usuario_id,
        punto_atencion_id,
        fecha: fecha.toISOString().split("T")[0],
        jornada_finalizada: resultado.jornadaFinalizada,
      });

      const mensaje = resultado.jornadaFinalizada
        ? "Cierre diario completado exitosamente. Su jornada fue finalizada automáticamente."
        : "Cierre diario completado exitosamente.";

      return {
        success: true,
        cierre_id: resultado.cierreDiario.id,
        cuadre_id: resultado.cuadre.id,
        jornada_finalizada: resultado.jornadaFinalizada,
        mensaje,
      };
    } catch (error) {
      logger.error("❌ Error realizando cierre diario", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        punto_atencion_id,
        usuario_id,
        fecha,
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno al realizar el cierre",
        codigo: "ERROR_CIERRE",
      };
    }
  }

  /**
   * Obtiene el estado del cierre de un día específico
   */
  async obtenerEstadoCierre(
    puntoId: string,
    fecha: Date
  ): Promise<{
    existe: boolean;
    estado?: "ABIERTO" | "CERRADO";
    cierre?: any;
  }> {
    try {
      const fechaDate = new Date(
        `${fecha.toISOString().split("T")[0]}T00:00:00.000Z`
      );

      const cierre = await prisma.cierreDiario.findUnique({
        where: {
          fecha_punto_atencion_id: {
            fecha: fechaDate,
            punto_atencion_id: puntoId,
          },
        },
        include: {
          usuario: {
            select: { nombre: true, username: true },
          },
          usuarioCerrador: {
            select: { nombre: true, username: true },
          },
        },
      });

      if (!cierre) {
        return { existe: false };
      }

      return {
        existe: true,
        estado: cierre.estado as "ABIERTO" | "CERRADO",
        cierre,
      };
    } catch (error) {
      logger.error("Error obteniendo estado cierre", { error, puntoId, fecha });
      return { existe: false };
    }
  }
}

export default new CierreService();
