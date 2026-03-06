/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ENDPOINTS DE DIAGNÓSTICO DE SALDOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Permite a administradores verificar la consistencia de saldos y movimientos.
 */

import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import cuadreCajaService from "../services/cuadreCajaService.js";
import { nowEcuador } from "../utils/timezone.js";

const router = express.Router();

/**
 * GET /api/saldo-diagnostico/:puntoId/:monedaId
 * Obtiene diagnóstico detallado de un saldo específico
 */
router.get(
  "/:puntoId/:monedaId",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { puntoId, monedaId } = req.params;
      const { fecha } = req.query;

      const fechaConsulta = fecha ? new Date(String(fecha)) : new Date(); // UTC - la UI muestra en zona horaria local
      const inicioDia = new Date(fechaConsulta);
      inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date(fechaConsulta);
      finDia.setHours(23, 59, 59, 999);

      // Obtener información de la moneda
      const moneda = await prisma.moneda.findUnique({
        where: { id: monedaId },
        select: { id: true, codigo: true, nombre: true, simbolo: true },
      });

      if (!moneda) {
        return res.status(404).json({
          success: false,
          error: "Moneda no encontrada",
        });
      }

      // Obtener información del punto
      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: puntoId },
        select: { id: true, nombre: true },
      });

      if (!punto) {
        return res.status(404).json({
          success: false,
          error: "Punto de atención no encontrado",
        });
      }

      // Obtener saldo actual
      const saldoActual = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoId,
            moneda_id: monedaId,
          },
        },
      });

      // Obtener saldo de apertura
      const saldoApertura = await cuadreCajaService.calcularSaldoApertura(
        puntoId,
        monedaId,
        inicioDia
      );

      // Obtener movimientos del día
      const movimientos = await cuadreCajaService.obtenerMovimientosPeriodo(
        puntoId,
        monedaId,
        inicioDia,
        finDia
      );

      // Calcular ingresos y egresos
      const { ingresos, egresos } = cuadreCajaService.calcularIngresosEgresos(movimientos);

      // Calcular saldo teórico
      const saldoTeorico = Number((saldoApertura + ingresos - egresos).toFixed(2));
      const saldoFisico = saldoActual ? Number(saldoActual.cantidad) : 0;
      const diferencia = Number((saldoFisico - saldoTeorico).toFixed(2));

      // Validar consistencia del desglose
      const validacion = await cuadreCajaService.validarConsistenciaSaldos(
        puntoId,
        monedaId
      );

      // Obtener últimos movimientos para contexto
      const ultimosMovimientos = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: puntoId,
          moneda_id: monedaId,
        },
        orderBy: { fecha: "desc" },
        take: 10,
        select: {
          id: true,
          fecha: true,
          tipo_movimiento: true,
          monto: true,
          saldo_anterior: true,
          saldo_nuevo: true,
          descripcion: true,
        },
      });

      res.json({
        success: true,
        diagnostico: {
          punto: {
            id: punto.id,
            nombre: punto.nombre,
          },
          moneda: {
            id: moneda.id,
            codigo: moneda.codigo,
            nombre: moneda.nombre,
            simbolo: moneda.simbolo,
          },
          fecha_consulta: fechaConsulta.toISOString(),
          saldos: {
            apertura: saldoApertura,
            teorico: saldoTeorico,
            fisico: saldoFisico,
            diferencia,
            tolerancia: moneda.codigo === "USD" ? 1.0 : 0.01,
            cuadrado: Math.abs(diferencia) <= (moneda.codigo === "USD" ? 1.0 : 0.01),
          },
          desglose_fisico: saldoActual
            ? {
                cantidad: Number(saldoActual.cantidad),
                billetes: Number(saldoActual.billetes),
                monedas_fisicas: Number(saldoActual.monedas_fisicas),
                bancos: Number(saldoActual.bancos),
                suma_billetes_monedas: Number(saldoActual.billetes) + Number(saldoActual.monedas_fisicas),
                consistente: validacion.consistente,
              }
            : null,
          movimientos_hoy: {
            total: movimientos.length,
            ingresos,
            egresos,
            detalle: movimientos.map((m) => ({
              id: m.id,
              fecha: m.fecha,
              tipo: m.tipo_movimiento,
              monto: Number(m.monto),
              descripcion: m.descripcion,
            })),
          },
          validacion: {
            consistente: validacion.consistente,
            errores: validacion.errores,
          },
          ultimos_movimientos: ultimosMovimientos.map((m) => ({
            id: m.id,
            fecha: m.fecha,
            tipo: m.tipo_movimiento,
            monto: Number(m.monto),
            saldo_anterior: Number(m.saldo_anterior),
            saldo_nuevo: Number(m.saldo_nuevo),
            descripcion: m.descripcion,
          })),
        },
      });
    } catch (error) {
      logger.error("Error en diagnóstico de saldo", {
        error: error instanceof Error ? error.message : String(error),
        params: req.params,
      });
      res.status(500).json({
        success: false,
        error: "Error al generar diagnóstico",
      });
    }
  }
);

/**
 * GET /api/saldo-diagnostico/punto/:puntoId
 * Diagnóstico completo de todos los saldos de un punto
 */
router.get(
  "/punto/:puntoId",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { puntoId } = req.params;
      const { fecha } = req.query;

      const fechaConsulta = fecha ? new Date(String(fecha)) : new Date(); // UTC - la UI muestra en zona horaria local
      const inicioDia = new Date(fechaConsulta);
      inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date(fechaConsulta);
      finDia.setHours(23, 59, 59, 999);

      // Obtener punto
      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: puntoId },
        select: { id: true, nombre: true },
      });

      if (!punto) {
        return res.status(404).json({
          success: false,
          error: "Punto de atención no encontrado",
        });
      }

      // Obtener todas las monedas con saldo
      const saldos = await prisma.saldo.findMany({
        where: { punto_atencion_id: puntoId },
        include: { moneda: true },
      });

      const resultados = [];
      const inconsistencias = [];

      for (const saldo of saldos) {
        try {
          const saldoApertura = await cuadreCajaService.calcularSaldoApertura(
            puntoId,
            saldo.moneda_id,
            inicioDia
          );

          const movimientos = await cuadreCajaService.obtenerMovimientosPeriodo(
            puntoId,
            saldo.moneda_id,
            inicioDia,
            finDia
          );

          const { ingresos, egresos } = cuadreCajaService.calcularIngresosEgresos(movimientos);
          const saldoTeorico = Number((saldoApertura + ingresos - egresos).toFixed(2));
          const saldoFisico = Number(saldo.cantidad);
          const diferencia = Number((saldoFisico - saldoTeorico).toFixed(2));

          const tolerancia = saldo.moneda.codigo === "USD" ? 1.0 : 0.01;
          const cuadrado = Math.abs(diferencia) <= tolerancia;

          const desgloseSuma = Number(saldo.billetes) + Number(saldo.monedas_fisicas);
          const desgloseConsistente = Math.abs(desgloseSuma - saldoFisico) <= 0.01;

          const resultado = {
            moneda_id: saldo.moneda_id,
            codigo: saldo.moneda.codigo,
            nombre: saldo.moneda.nombre,
            saldo_apertura: saldoApertura,
            ingresos,
            egresos,
            saldo_teorico: saldoTeorico,
            saldo_fisico: saldoFisico,
            diferencia,
            cuadrado,
            desglose_consistente: desgloseConsistente,
            movimientos_count: movimientos.length,
          };

          resultados.push(resultado);

          if (!cuadrado || !desgloseConsistente) {
            inconsistencias.push({
              ...resultado,
              problema: !cuadrado
                ? "Diferencia entre teórico y físico"
                : "Desglose inconsistente",
            });
          }
        } catch (error) {
          logger.error(`Error procesando saldo ${saldo.moneda_id}`, { error });
        }
      }

      res.json({
        success: true,
        diagnostico: {
          punto: {
            id: punto.id,
            nombre: punto.nombre,
          },
          fecha_consulta: fechaConsulta.toISOString(),
          resumen: {
            total_monedas: resultados.length,
            cuadradas: resultados.filter((r) => r.cuadrado).length,
            con_diferencias: inconsistencias.length,
          },
          resultados,
          inconsistencias,
        },
      });
    } catch (error) {
      logger.error("Error en diagnóstico de punto", {
        error: error instanceof Error ? error.message : String(error),
        puntoId: req.params.puntoId,
      });
      res.status(500).json({
        success: false,
        error: "Error al generar diagnóstico",
      });
    }
  }
);

/**
 * POST /api/saldo-diagnostico/corregir-desglose
 * Corrige el desglose de billetes/monedas para que coincida con cantidad
 */
router.post(
  "/corregir-desglose",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { punto_id, moneda_id } = req.body;

      if (!punto_id || !moneda_id) {
        return res.status(400).json({
          success: false,
          error: "Se requieren punto_id y moneda_id",
        });
      }

      const saldo = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto_id,
            moneda_id: moneda_id,
          },
        },
      });

      if (!saldo) {
        return res.status(404).json({
          success: false,
          error: "Saldo no encontrado",
        });
      }

      const cantidad = Number(saldo.cantidad);
      const billetes = Number(saldo.billetes);
      const monedas = Number(saldo.monedas_fisicas);
      const suma = billetes + monedas;

      // Si ya está cuadrado, no hacer nada
      if (Math.abs(suma - cantidad) <= 0.01) {
        return res.json({
          success: true,
          message: "El desglose ya está correcto",
          antes: { cantidad, billetes, monedas, suma },
          despues: { cantidad, billetes, monedas, suma },
        });
      }

      // Ajustar: poner todo en billetes por defecto
      const nuevoBilletes = cantidad;
      const nuevoMonedas = 0;

      await prisma.saldo.update({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto_id,
            moneda_id: moneda_id,
          },
        },
        data: {
          billetes: nuevoBilletes,
          monedas_fisicas: nuevoMonedas,
          updated_at: new Date(), // UTC - la UI muestra en zona horaria local
        },
      });

      logger.info("Desglose corregido", {
        punto_id,
        moneda_id,
        antes: { cantidad, billetes, monedas },
        despues: { cantidad, billetes: nuevoBilletes, monedas: nuevoMonedas },
        usuario: req.user?.id,
      });

      res.json({
        success: true,
        message: "Desglose corregido correctamente",
        antes: { cantidad, billetes, monedas, suma },
        despues: {
          cantidad,
          billetes: nuevoBilletes,
          monedas: nuevoMonedas,
          suma: nuevoBilletes + nuevoMonedas,
        },
      });
    } catch (error) {
      logger.error("Error corrigiendo desglose", {
        error: error instanceof Error ? error.message : String(error),
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: "Error al corregir desglose",
      });
    }
  }
);

export default router;
