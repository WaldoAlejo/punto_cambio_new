/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INICIO DE JORNADA CON VALIDACIÓN DE APERTURA DE CAJA OBLIGATORIA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este endpoint maneja el flujo completo de inicio de jornada:
 * 1. Crear jornada
 * 2. Validar que se complete apertura de caja
 * 3. USD y EUR son obligatorios
 * 4. Si no cuadra, registrar novedad y notificar admin
 * 5. No permitir operar sin apertura validada
 */

import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate, nowEcuador } from "../utils/timezone.js";
import { EstadoApertura, EstadoJornada } from "@prisma/client";

const router = express.Router();

/**
 * Calcula el saldo real de una moneda en un punto desde MovimientoSaldo
 * Igual que lo hace la contabilidad general
 */
async function calcularSaldoDesdeMovimientos(
  puntoAtencionId: string,
  monedaId: string
): Promise<number> {
  try {
    // 1. Obtener SaldoInicial activo
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
        activo: true,
      },
      select: { cantidad_inicial: true },
    });

    let saldoCalculado = Number(saldoInicial?.cantidad_inicial || 0);

    // 2. Obtener movimientos EXCLUYENDO SALDO_INICIAL
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
        tipo_movimiento: { not: "SALDO_INICIAL" },
      },
      select: { monto: true },
    });

    // 3. Sumar movimientos
    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      if (!isNaN(monto) && isFinite(monto)) {
        saldoCalculado += monto;
      }
    }

    return Number(saldoCalculado.toFixed(2));
  } catch (error) {
    logger.error("Error calculando saldo desde movimientos", {
      error: error instanceof Error ? error.message : String(error),
      puntoAtencionId,
      monedaId,
    });
    // Fallback a 0 si hay error
    return 0;
  }
}

async function obtenerSaldoActualParaConteo(
  puntoAtencionId: string,
  monedaId: string
): Promise<{ cantidad: number; billetes: number; monedas: number }> {
  const saldoActual = await prisma.saldo.findUnique({
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
    },
  });

  if (saldoActual) {
    return {
      cantidad: Number(saldoActual.cantidad),
      billetes: Number(saldoActual.billetes),
      monedas: Number(saldoActual.monedas_fisicas),
    };
  }

  const cantidadCalculada = await calcularSaldoDesdeMovimientos(
    puntoAtencionId,
    monedaId
  );

  return {
    cantidad: cantidadCalculada,
    billetes: cantidadCalculada,
    monedas: 0,
  };
}

// Tolerancias para validación
const TOLERANCIA_USD = 1.0;
const TOLERANCIA_OTRAS = 0.01;

interface ConteoMoneda {
  moneda_id: string;
  codigo: string;
  billetes: { denominacion: number; cantidad: number }[];
  monedas: { denominacion: number; cantidad: number }[];
  total: number;
}

/**
 * POST /inicio-jornada-validado/iniciar
 * 
 * Crea la jornada y verifica si ya existe apertura de caja para el día.
 * Si no existe, devuelve los saldos esperados para que el operador haga el conteo.
 */
router.post("/iniciar", authenticateToken, async (req, res) => {
  try {
    const { punto_atencion_id } = req.body;
    const usuario_id = req.user?.id;

    if (!punto_atencion_id) {
      return res.status(400).json({
        success: false,
        error: "Se requiere punto_atencion_id",
      });
    }

    // Verificar si el punto existe
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: punto_atencion_id },
    });

    if (!punto) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    // Verificar si ya existe jornada activa para este usuario hoy
    const { gte: hoyGte, lt: hoyLt } = gyeDayRangeUtcFromDate(new Date());
    
    const jornadaExistente = await prisma.jornada.findFirst({
      where: {
        usuario_id,
        fecha_inicio: { gte: hoyGte, lt: hoyLt },
        OR: [
          { estado: EstadoJornada.ACTIVO },
          { estado: EstadoJornada.ALMUERZO },
        ],
      },
    });

    if (jornadaExistente) {
      // Verificar si ya tiene apertura completada
      const apertura = await prisma.aperturaCaja.findUnique({
        where: { jornada_id: jornadaExistente.id },
      });

      if (apertura && apertura.estado === EstadoApertura.ABIERTA) {
        return res.json({
          success: true,
          jornada: jornadaExistente,
          apertura: {
            id: apertura.id,
            estado: apertura.estado,
          },
          requiere_apertura: false,
          message: "Jornada activa con apertura completada",
        });
      }

      // Tiene jornada pero sin apertura completada
      return res.json({
        success: true,
        jornada: jornadaExistente,
        requiere_apertura: true,
        message: "Debe completar la apertura de caja para continuar",
      });
    }

    // Crear nueva jornada
    const jornada = await prisma.jornada.create({
      data: {
        usuario_id: usuario_id!,
        punto_atencion_id,
        fecha_inicio: new Date(),
        estado: EstadoJornada.ACTIVO,
      },
    });

    logger.info("Jornada creada", {
      jornada_id: jornada.id,
      usuario_id,
      punto_id: punto_atencion_id,
    });

    // Obtener todas las monedas activas
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true, simbolo: true },
    });

    // Tomar saldo actual de caja como referencia principal para el conteo.
    const saldosCalculados = await Promise.all(
      monedas.map(async (moneda) => {
        const saldoActual = await obtenerSaldoActualParaConteo(
          punto_atencion_id,
          moneda.id
        );
        return {
          moneda_id: moneda.id,
          codigo: moneda.codigo,
          nombre: moneda.nombre,
          simbolo: moneda.simbolo,
          cantidad: saldoActual.cantidad,
          billetes: saldoActual.billetes,
          monedas: saldoActual.monedas,
          es_obligatoria: ["USD", "EUR"].includes(moneda.codigo),
        };
      })
    );

    // Identificar USD y EUR
    const monedaUSD = saldosCalculados.find(s => s.codigo === "USD");
    const monedaEUR = saldosCalculados.find(s => s.codigo === "EUR");

    if (!monedaUSD || !monedaEUR) {
      logger.error("No se encontraron USD o EUR en los saldos del punto", {
        punto_id: punto_atencion_id,
        tieneUSD: !!monedaUSD,
        tieneEUR: !!monedaEUR,
      });
    }

    return res.json({
      success: true,
      jornada,
      requiere_apertura: true,
      saldos_esperados: saldosCalculados,
      monedas_obligatorias: ["USD", "EUR"],
      message: "Jornada creada. Debe completar la apertura de caja obligatoriamente.",
    });

  } catch (error) {
    logger.error("Error al iniciar jornada", {
      error: error instanceof Error ? error.message : String(error),
      usuario_id: req.user?.id,
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * POST /inicio-jornada-validado/validar-apertura
 * 
 * Valida el conteo de apertura:
 * 1. USD y EUR deben estar presentes y ser > 0
 * 2. Si hay diferencias, registrar novedad
 * 3. Notificar al administrador si hay diferencias o si no se ingresó información
 */
router.post("/validar-apertura", authenticateToken, async (req, res) => {
  try {
    const { jornada_id, conteos } = req.body as {
      jornada_id: string;
      conteos: ConteoMoneda[];
    };
    const usuario_id = req.user?.id;

    if (!jornada_id || !conteos || !Array.isArray(conteos)) {
      return res.status(400).json({
        success: false,
        error: "Se requiere jornada_id y conteos",
      });
    }

    // Verificar jornada
    const jornada = await prisma.jornada.findFirst({
      where: {
        id: jornada_id,
        usuario_id,
      },
      include: {
        puntoAtencion: true,
      },
    });

    if (!jornada) {
      return res.status(404).json({
        success: false,
        error: "Jornada no encontrada",
      });
    }

    // Obtener todas las monedas activas
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true, simbolo: true },
    });

    // Tomar saldo actual de caja como referencia principal para el conteo.
    const saldosCalculados = await Promise.all(
      monedas.map(async (moneda) => {
        const saldoActual = await obtenerSaldoActualParaConteo(
          jornada.punto_atencion_id,
          moneda.id
        );
        return {
          moneda_id: moneda.id,
          codigo: moneda.codigo,
          nombre: moneda.nombre,
          simbolo: moneda.simbolo,
          cantidad: saldoActual.cantidad,
          billetes: saldoActual.billetes,
          monedas: saldoActual.monedas,
        };
      })
    );

    // Validar que USD y EUR estén presentes y sean > 0
    const conteoUSD = conteos.find(c => {
      const moneda = saldosCalculados.find(s => s.moneda_id === c.moneda_id);
      return moneda?.codigo === "USD";
    });
    
    const conteoEUR = conteos.find(c => {
      const moneda = saldosCalculados.find(s => s.moneda_id === c.moneda_id);
      return moneda?.codigo === "EUR";
    });

    const errores: string[] = [];

    if (!conteoUSD || conteoUSD.total <= 0) {
      errores.push("Debe ingresar el conteo de USD (Dólares) obligatoriamente");
    }

    if (!conteoEUR || conteoEUR.total <= 0) {
      errores.push("Debe ingresar el conteo de EUR (Euros) obligatoriamente");
    }

    if (errores.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validación fallida",
        detalles: errores,
      });
    }

    // Calcular diferencias
    const diferencias: Array<{
      moneda_id: string;
      codigo: string;
      esperado: number;
      fisico: number;
      diferencia: number;
      fuera_tolerancia: boolean;
    }> = [];

    let hayDiferenciasFueraTolerancia = false;

    for (const saldo of saldosCalculados) {
      const monedaCodigo = saldo.codigo;
      const conteo = conteos.find(c => c.moneda_id === saldo.moneda_id);
      const fisico = conteo ? conteo.total : 0;
      const esperado = Number(saldo.cantidad);
      const diferencia = fisico - esperado;
      
      const tolerancia = monedaCodigo === "USD" ? TOLERANCIA_USD : TOLERANCIA_OTRAS;
      const fueraTolerancia = Math.abs(diferencia) > tolerancia;

      if (fueraTolerancia) {
        hayDiferenciasFueraTolerancia = true;
      }

      diferencias.push({
        moneda_id: saldo.moneda_id,
        codigo: monedaCodigo,
        esperado,
        fisico,
        diferencia,
        fuera_tolerancia: fueraTolerancia,
      });
    }

    // Si hay diferencias fuera de tolerancia, preparar observaciones de alerta
    let observacionesAlerta = "";
    if (hayDiferenciasFueraTolerancia) {
      const diferenciasCriticas = diferencias.filter(d => d.fuera_tolerancia);
      
      observacionesAlerta = `ALERTA - Diferencias en conteo de apertura: ${diferenciasCriticas.map(d => 
        `${d.codigo}: Esperado $${d.esperado}, Físico $${d.fisico}, Dif: $${d.diferencia}`
      ).join("; ")}`;

      logger.warn("Diferencias en apertura de caja", {
        jornada_id,
        usuario_id,
        punto: jornada.puntoAtencion?.nombre,
        diferencias: diferenciasCriticas,
      });

      // TODO: Integrar con sistema de notificaciones para alertar al admin
      // Por ahora se registra en logs y en las observaciones de la apertura
    }

    // Crear o actualizar apertura de caja
    const aperturaExistente = await prisma.aperturaCaja.findUnique({
      where: { jornada_id },
    });

    let apertura;
    const fechaHoy = new Date().toISOString().split("T")[0];

    if (aperturaExistente) {
      apertura = await prisma.aperturaCaja.update({
        where: { id: aperturaExistente.id },
        data: {
          conteo_fisico: conteos as any,
          diferencias: diferencias as any,
          estado: hayDiferenciasFueraTolerancia ? EstadoApertura.CON_DIFERENCIA : EstadoApertura.CUADRADO,
          requiere_aprobacion: hayDiferenciasFueraTolerancia,
          hora_fin_conteo: nowEcuador(),
        },
      });
    } else {
      apertura = await prisma.aperturaCaja.create({
        data: {
          jornada_id,
          usuario_id: usuario_id!,
          punto_atencion_id: jornada.punto_atencion_id,
          fecha: new Date(fechaHoy + "T00:00:00.000Z"),
          hora_inicio_conteo: nowEcuador(),
          hora_fin_conteo: nowEcuador(),
          estado: hayDiferenciasFueraTolerancia ? EstadoApertura.CON_DIFERENCIA : EstadoApertura.CUADRADO,
          saldo_esperado: saldosCalculados.map(s => ({
            moneda_id: s.moneda_id,
            codigo: s.codigo,
            nombre: s.nombre,
            cantidad: Number(s.cantidad),
          })) as any,
          conteo_fisico: conteos as any,
          diferencias: diferencias as any,
          requiere_aprobacion: hayDiferenciasFueraTolerancia,
          observaciones_operador: observacionesAlerta || null,
          tolerancia_usd: TOLERANCIA_USD,
          tolerancia_otras: TOLERANCIA_OTRAS,
        },
      });
    }

    // Si hay diferencias, PERMITIR operar pero marcar para revisión del admin
    if (hayDiferenciasFueraTolerancia) {
      // Crear cuadre de caja automáticamente aunque haya diferencias
      const cuadreExistente = await prisma.cuadreCaja.findFirst({
        where: {
          punto_atencion_id: jornada.punto_atencion_id,
          fecha: {
            gte: new Date(fechaHoy + "T00:00:00.000Z"),
            lt: new Date(fechaHoy + "T23:59:59.999Z"),
          },
        },
      });

      if (!cuadreExistente) {
        const cuadre = await prisma.cuadreCaja.create({
          data: {
            estado: "ABIERTO",
            fecha: new Date(fechaHoy + "T00:00:00.000Z"),
            punto_atencion_id: jornada.punto_atencion_id,
            usuario_id: usuario_id!,
            observaciones: `Cuadre creado con diferencias en apertura (${apertura.id}). Revisión pendiente.`,
          },
        });

        // Crear detalles del cuadre con las diferencias registradas
        for (const saldo of saldosCalculados) {
          const conteo = conteos.find(c => c.moneda_id === saldo.moneda_id);
          const conteoTotal = conteo ? conteo.total : 0;
          
          await prisma.detalleCuadreCaja.create({
            data: {
              cuadre_id: cuadre.id,
              moneda_id: saldo.moneda_id,
              saldo_apertura: conteoTotal,
              saldo_cierre: Number(saldo.cantidad),
              conteo_fisico: conteoTotal,
              diferencia: conteoTotal - Number(saldo.cantidad),
              billetes: conteo ? conteo.billetes.reduce((sum, b) => sum + b.denominacion * b.cantidad, 0) : 0,
              monedas_fisicas: conteo ? conteo.monedas.reduce((sum, m) => sum + m.denominacion * m.cantidad, 0) : 0,
              movimientos_periodo: 0,
            },
          });
        }

        logger.info("Cuadre creado con diferencias en apertura", {
          cuadre_id: cuadre.id,
          apertura_id: apertura.id,
          jornada_id,
          diferencias: diferencias.filter(d => d.fuera_tolerancia),
        });
      }

      return res.json({
        success: true,
        apertura: {
          id: apertura.id,
          estado: apertura.estado,
        },
        diferencias: diferencias.filter(d => d.fuera_tolerancia),
        alerta_admin: observacionesAlerta,
        puede_operar: true,  // <-- AHORA PERMITE OPERAR
        requiere_aprobacion_admin: true,  // <-- Pero marca para revisión
        message: "Apertura registrada con diferencias. Puede operar - el administrador revisará las diferencias.",
      });
    }

    // Todo cuadrado - crear cuadre de caja automáticamente
    const cuadreExistente = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: jornada.punto_atencion_id,
        fecha: {
          gte: new Date(fechaHoy + "T00:00:00.000Z"),
          lt: new Date(fechaHoy + "T23:59:59.999Z"),
        },
      },
    });

    if (!cuadreExistente) {
      const cuadre = await prisma.cuadreCaja.create({
        data: {
          estado: "ABIERTO",
          fecha: new Date(fechaHoy + "T00:00:00.000Z"),
          punto_atencion_id: jornada.punto_atencion_id,
          usuario_id: usuario_id!,
          observaciones: `Cuadre creado desde apertura validada (${apertura.id})`,
        },
      });

      // Crear detalles del cuadre
      for (const saldo of saldosCalculados) {
        const conteo = conteos.find(c => c.moneda_id === saldo.moneda_id);
        const conteoTotal = conteo ? conteo.total : 0;
        
        await prisma.detalleCuadreCaja.create({
          data: {
            cuadre_id: cuadre.id,
            moneda_id: saldo.moneda_id,
            saldo_apertura: conteoTotal,
            saldo_cierre: Number(saldo.cantidad),
            conteo_fisico: conteoTotal,
            diferencia: conteoTotal - Number(saldo.cantidad),
            billetes: conteo ? conteo.billetes.reduce((sum, b) => sum + b.denominacion * b.cantidad, 0) : 0,
            monedas_fisicas: conteo ? conteo.monedas.reduce((sum, m) => sum + m.denominacion * m.cantidad, 0) : 0,
            movimientos_periodo: 0,
          },
        });
      }

      logger.info("Cuadre creado desde apertura validada", {
        cuadre_id: cuadre.id,
        apertura_id: apertura.id,
        jornada_id,
      });
    }

    // Actualizar apertura a ABIERTA
    await prisma.aperturaCaja.update({
      where: { id: apertura.id },
      data: {
        estado: EstadoApertura.ABIERTA,
        hora_apertura: nowEcuador(),
      },
    });

    return res.json({
      success: true,
      apertura: {
        id: apertura.id,
        estado: EstadoApertura.ABIERTA,
      },
      diferencias: [],
      puede_operar: true,
      requiere_aprobacion_admin: false,
      message: "Apertura validada correctamente. Puede iniciar operaciones.",
    });

  } catch (error) {
    logger.error("Error al validar apertura", {
      error: error instanceof Error ? error.message : String(error),
      usuario_id: req.user?.id,
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * GET /inicio-jornada-validado/estado/:jornada_id
 * 
 * Verifica el estado de la jornada y si puede operar
 */
router.get("/estado/:jornada_id", authenticateToken, async (req, res) => {
  try {
    const { jornada_id } = req.params;
    const usuario_id = req.user?.id;

    const jornada = await prisma.jornada.findFirst({
      where: {
        id: jornada_id,
        usuario_id,
      },
      include: {
        puntoAtencion: { select: { id: true, nombre: true } },
      },
    });

    if (!jornada) {
      return res.status(404).json({
        success: false,
        error: "Jornada no encontrada",
      });
    }

    const apertura = await prisma.aperturaCaja.findUnique({
      where: { jornada_id },
    });

    // PERMITIR operar con ABIERTA o CON_DIFERENCIA
    const puedeOperar = apertura?.estado === EstadoApertura.ABIERTA || apertura?.estado === EstadoApertura.CON_DIFERENCIA;
    const requiereApertura = !apertura || (apertura.estado !== EstadoApertura.ABIERTA && apertura.estado !== EstadoApertura.CON_DIFERENCIA);

    return res.json({
      success: true,
      jornada: {
        id: jornada.id,
        estado: jornada.estado,
        punto: jornada.puntoAtencion,
      },
      apertura: apertura ? {
        id: apertura.id,
        estado: apertura.estado,
        requiere_aprobacion: apertura.requiere_aprobacion,
      } : null,
      puede_operar: puedeOperar,
      requiere_apertura: requiereApertura,
    });

  } catch (error) {
    logger.error("Error al obtener estado", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
