// server/services/cierreService.ts
/**
 * Servicio unificado para el proceso de cierre diario
 * Consolida la lógica de cierre de caja y cierre contable
 */

import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import {
  registrarMovimientoSaldo,
  TipoMovimiento as MovimientoTipoMovimiento,
  TipoReferencia as MovimientoTipoReferencia,
} from "./movimientoSaldoService.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";
import saldoReconciliationService from "./saldoReconciliationService.js";

interface DetalleMoneda {
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  saldo_apertura: number;
  saldo_cierre_teorico: number;
  bancos_teorico?: number;
  conteo_fisico: number;
  conteo_bancos?: number;
  billetes: number;
  monedas_fisicas: number;
  diferencia: number;
  diferencia_bancos?: number;
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
  detalles?: unknown;
}

interface DatosCierre {
  punto_atencion_id: string;
  usuario_id: string;
  fecha: Date;
  detalles: DetalleMoneda[];
  observaciones?: string;
  diferencias_reportadas?: unknown;
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
   * Calcula el saldo de apertura para un punto y moneda
   * Busca el último cierre CERRADO con conteo físico
   *
   * ⚠️ IMPORTANTE: El saldo de apertura del día debe ser igual al saldo de cierre del día anterior (conteo_fisico)
   * Si no hay cierre anterior, el saldo será 0 (caso post-limpieza o primer día de operación)
   */
  private async calcularSaldoApertura(
    puntoId: string,
    monedaId: string,
    fechaInicio: Date
  ): Promise<number> {
    try {
      // CRÍTICO: Solo buscar cierres CERRADOS (no PARCIAL)
      // El conteo_fisico del último cierre es el dinero real con el que inicia el día
      const ultimoCierre = await prisma.cuadreCaja.findFirst({
        where: {
          punto_atencion_id: puntoId,
          estado: "CERRADO",
          fecha: {
            lt: fechaInicio,
          },
        },
        orderBy: [{ fecha: "desc" }, { fecha_cierre: "desc" }],
        include: {
          detalles: {
            where: {
              moneda_id: monedaId,
            },
            select: {
              conteo_fisico: true,
            },
          },
        },
      });

      if (ultimoCierre?.detalles?.[0]) {
        const conteoFisico = Number(ultimoCierre.detalles[0].conteo_fisico);
        logger.info("✅ Saldo de apertura del último cierre", {
          puntoId,
          monedaId,
          conteoFisico,
          fechaCierre: ultimoCierre.fecha,
        });
        return conteoFisico;
      }

      // Si no hay cierre anterior, el saldo de apertura es 0
      // Esto es correcto después de clean-database.ts o en el primer día
      logger.info("⚠️ No hay cierre anterior, saldo de apertura = 0", {
        puntoId,
        monedaId,
        fechaInicio,
      });
      return 0;
    } catch (error) {
      logger.error("❌ Error calculando saldo apertura", {
        error: error instanceof Error ? error.message : String(error),
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
    _usuarioId: string
  ): Promise<{
    success: boolean;
    detalles?: DetalleMoneda[];
    totales?: unknown;
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
   *
   * REGLAS DE NEGOCIO:
   * ══════════════════════════════════════════════════════════════════════════
   * 1. El saldo CUADRADO al cierre se convierte en el saldo inicial del siguiente día
   * 2. Si el administrador hace una asignación nueva, se suma al saldo inicial existente
   * 3. El operador inicia el siguiente día con el saldo que cuadró el día anterior
   * 4. Proceso:
   *    a) Validar que sea posible realizar el cierre
   *    b) Guardar el cuadre de caja con detalles (conteo físico vs teórico)
   *    c) Marcar el cierre diario como CERRADO
   *    d) Finalizar la jornada activa si existe
   *    e) Actualizar saldos en tabla Saldo con el CONTEO FÍSICO (saldo cuadrado)
   *    f) Este saldo cuadrado será el punto de partida del siguiente día
   * ══════════════════════════════════════════════════════════════════════════
   */
  async realizarCierreDiario(datos: DatosCierre): Promise<ResultadoCierre> {
    const { punto_atencion_id, usuario_id, fecha, detalles, observaciones } =
      datos;

    try {
      logger.info("🔄 Iniciando realizarCierreDiario", {
        punto_atencion_id,
        usuario_id,
        fecha: fecha.toISOString(),
        num_detalles: detalles?.length || 0,
      });

      // 1. Validar que sea posible realizar el cierre
      logger.info("📋 Validando cierre posible...");
      const validacion = await this.validarCierrePosible(
        punto_atencion_id,
        fecha,
        usuario_id
      );

      if (!validacion.valido) {
        logger.warn("❌ Validación de cierre falló", {
          razon: validacion.razon,
          codigo: validacion.codigo,
        });
        return {
          success: false,
          error: validacion.razon,
          codigo: validacion.codigo,
        };
      }

      logger.info("✅ Validación exitosa, iniciando transacción...");

      // 2. Ejecutar todo en una transacción con timeout de 30 segundos
      const resultado = await prisma.$transaction(
        async (tx) => {
          logger.info("🔧 Dentro de la transacción");
          const fechaDate = new Date(
            `${fecha.toISOString().split("T")[0]}T00:00:00.000Z`
          );
          const { gte: fechaInicio } = gyeDayRangeUtcFromDate(fecha);

          // 2.1. Crear o actualizar CuadreCaja
          logger.info("📦 Buscando cuadre existente...");
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

        logger.info("✅ Cuadre creado/actualizado", { cuadre_id: cuadre.id });

        // 2.2. Crear detalles del cuadre (solo si hay detalles)
        if (detalles.length > 0) {
          await tx.detalleCuadreCaja.createMany({
            data: detalles.map((d) => ({
              cuadre_id: cuadre.id,
              moneda_id: d.moneda_id,
              saldo_apertura: d.saldo_apertura,
              saldo_cierre: d.saldo_cierre_teorico,
              conteo_fisico: d.conteo_fisico,
              bancos_teorico: Number(d.bancos_teorico ?? 0),
              conteo_bancos: Number(d.conteo_bancos ?? 0),
              diferencia_bancos: Number(
                ((Number(d.conteo_bancos ?? 0) - Number(d.bancos_teorico ?? 0)) || 0).toFixed(2)
              ),
              billetes: d.billetes || 0,
              monedas_fisicas: d.monedas_fisicas || 0,
              diferencia: Number(
                (d.conteo_fisico - d.saldo_cierre_teorico).toFixed(2)
              ),
              movimientos_periodo: d.movimientos_periodo,
              observaciones_detalle: d.observaciones_detalle || null,
            })),
          });

          logger.info("✅ Detalles del cuadre creados", {
            cuadre_id: cuadre.id,
            num_detalles: detalles.length,
          });
        } else {
          logger.info(
            "ℹ️ Cierre sin detalles de divisas (no hubo movimientos)",
            {
              cuadre_id: cuadre.id,
            }
          );
        }

        // 2.3. Crear o actualizar CierreDiario
        logger.info("🔍 Buscando cierre diario existente...");
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
          .filter(
            (d) =>
              Math.abs(d.diferencia) > 0.01 ||
              Math.abs(Number(d.diferencia_bancos ?? 0)) > 0.01
          )
          .map((d) => ({
            moneda_id: d.moneda_id,
            moneda_codigo: d.codigo,
            diferencia_sistema: d.saldo_cierre_teorico,
            diferencia_fisica: d.conteo_fisico,
            diferencia: d.diferencia,
            bancos_teorico: Number(d.bancos_teorico ?? 0),
            bancos_conteo: Number(d.conteo_bancos ?? 0),
            diferencia_bancos: Number(d.diferencia_bancos ?? 0),
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

        logger.info("✅ Cierre diario creado/actualizado", { cierre_id: cierreDiario.id });

        // 2.4. Finalizar jornada activa si existe
        logger.info("🔍 Buscando jornada activa...");
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

        // 2.5. Actualizar saldos en tabla Saldo con CONTEO FÍSICO
        // ═══════════════════════════════════════════════════════════════════
        // CRÍTICO: El saldo al cierre (conteo físico) es el saldo inicial
        // del siguiente día. Este es el dinero real que tiene el punto.
        // ═══════════════════════════════════════════════════════════════════
        logger.info("💰 Actualizando saldos para siguiente día...", {
          num_detalles: detalles.length,
        });
        if (detalles.length > 0) {
          for (const detalle of detalles) {
            const conteoBancos =
              detalle.conteo_bancos === null || detalle.conteo_bancos === undefined
                ? null
                : Number(detalle.conteo_bancos);

            // Normalizar desglose de efectivo para que billetes+monedas == conteo_fisico
            // (evita valores duplicados/inconsistentes que bloquean cierres posteriores)
            const conteoFisico = Number(detalle.conteo_fisico ?? 0);
            let billetes = Number(detalle.billetes ?? 0);
            let monedas = Number(detalle.monedas_fisicas ?? 0);
            if (!Number.isFinite(conteoFisico)) {
              throw new Error(
                `conteo_fisico inválido para moneda_id=${detalle.moneda_id}`
              );
            }
            if (!Number.isFinite(billetes)) billetes = 0;
            if (!Number.isFinite(monedas)) monedas = 0;

            const round2 = (n: number) => Math.round(n * 100) / 100;
            const clamp0 = (n: number) => (n < 0 ? 0 : n);

            billetes = round2(clamp0(billetes));
            monedas = round2(clamp0(monedas));
            const sumEf = round2(billetes + monedas);
            if (Math.abs(sumEf - conteoFisico) > 0.02) {
              if (sumEf > 0) {
                const scale = conteoFisico / sumEf;
                billetes = round2(clamp0(billetes * scale));
                monedas = round2(clamp0(monedas * scale));
                const sumScaled = round2(billetes + monedas);
                const diff = round2(conteoFisico - sumScaled);
                if (Math.abs(diff) > 0.01) {
                  billetes = round2(clamp0(billetes + diff));
                }
              } else {
                billetes = round2(clamp0(conteoFisico));
                monedas = 0;
              }
            }

            await tx.saldo.upsert({
              where: {
                punto_atencion_id_moneda_id: {
                  punto_atencion_id,
                  moneda_id: detalle.moneda_id,
                },
              },
              update: {
                cantidad: conteoFisico, // ✅ SALDO CUADRADO = SALDO INICIAL del siguiente día
                billetes,
                monedas_fisicas: monedas,
                ...(conteoBancos === null || !Number.isFinite(conteoBancos)
                  ? {}
                  : { bancos: conteoBancos }),
                updated_at: new Date(),
              },
              create: {
                punto_atencion_id,
                moneda_id: detalle.moneda_id,
                cantidad: conteoFisico,
                billetes,
                monedas_fisicas: monedas,
                bancos:
                  conteoBancos === null || !Number.isFinite(conteoBancos)
                    ? 0
                    : conteoBancos,
              },
            });

            // Registrar un movimiento de ajuste para que la reconciliación (vista-saldos-puntos?reconciliar=true)
            // refleje el conteo físico cuadrado tras el cierre.
            const saldoCierre = Number((detalle as { saldo_cierre?: unknown }).saldo_cierre);
            const diff = Number((conteoFisico - saldoCierre).toFixed(2));
            if (Number.isFinite(saldoCierre) && Math.abs(diff) >= 0.01) {
              const already = await tx.movimientoSaldo.findFirst({
                where: {
                  punto_atencion_id: String(punto_atencion_id),
                  moneda_id: String(detalle.moneda_id),
                  tipo_referencia: MovimientoTipoReferencia.CIERRE_DIARIO,
                  referencia_id: String(cierreDiario.id),
                  descripcion: {
                    contains: "AJUSTE CIERRE",
                    mode: "insensitive",
                  },
                },
                select: { id: true },
              });

              if (!already) {
                await registrarMovimientoSaldo(
                  {
                    puntoAtencionId: punto_atencion_id,
                    monedaId: detalle.moneda_id,
                    tipoMovimiento:
                      diff > 0
                        ? MovimientoTipoMovimiento.INGRESO
                        : MovimientoTipoMovimiento.EGRESO,
                    monto: Math.abs(diff),
                    saldoAnterior: saldoCierre,
                    saldoNuevo: conteoFisico,
                    tipoReferencia: MovimientoTipoReferencia.CIERRE_DIARIO,
                    referenciaId: cierreDiario.id,
                    descripcion: `AJUSTE CIERRE ${fecha.toISOString().slice(0, 10)}`,
                    usuarioId: usuario_id,
                    saldoBucket: "CAJA",
                  },
                  tx
                );
              }
            }

            logger.info("✅ Saldo actualizado para siguiente día", {
              punto_atencion_id,
              moneda_id: detalle.moneda_id,
              saldo_nuevo_inicial: detalle.conteo_fisico,
              billetes: detalle.billetes || 0,
              monedas: detalle.monedas_fisicas || 0,
            });
          }
        } else {
          logger.info(
            "ℹ️ No hay detalles para actualizar saldos (cierre sin movimientos de divisas)",
            {
              punto_atencion_id,
            }
          );
        }

        return {
          cuadre,
          cierreDiario,
          jornadaFinalizada,
        };
      },
      {
        maxWait: 30000, // Espera máxima de 30 segundos para adquirir lock
        timeout: 45000, // Timeout total de 45 segundos para toda la transacción
      }
      );

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
    cierre?: unknown;
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
