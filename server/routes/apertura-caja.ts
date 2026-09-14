import { openingCurrencies, requiredOpeningCurrencies } from "../utils/stagedOpening.js";
import { lockTransferBalance } from "../utils/transferBalance.js";
import { OperationalConflict } from "../utils/operationalConflict.js";
import express, { Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { Prisma, EstadoApertura, ServicioExterno } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { todayGyeDateOnly, nowEcuador, gyeDayRangeUtcFromDateOnly } from "../utils/timezone.js";
import {
  buildObservacionesApertura,
  MONEDAS_APERTURA_OBLIGATORIAS,
  getEstadoMonedasObligatorias,
  obtenerEstadoAperturaOperativa,
  parseObservacionesApertura,
  type AperturaIncidencia,
} from "../utils/aperturaCajaRequirements.js";

const router = express.Router();

const DENOMINACIONES_DEFAULT = {
  billetes: [100, 50, 20, 10, 5, 1],
  monedas: [1, 0.5, 0.25, 0.1, 0.05, 0.01],
};

const DENOMINACIONES_ESPECIFICAS: Record<string, { billetes: number[]; monedas: number[] }> = {
  USD: {
    billetes: [100, 50, 20, 10, 5, 2, 1],
    monedas: [1, 0.5, 0.25, 0.1, 0.05, 0.01],
  },
  COP: {
    billetes: [100000, 50000, 20000, 10000, 5000, 2000, 1000],
    monedas: [1000, 500, 200, 100, 50],
  },
  EUR: {
    billetes: [500, 200, 100, 50, 20, 10, 5],
    monedas: [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01],
  },
  CHF: {
    billetes: [1000, 200, 100, 50, 20, 10],
    monedas: [0.5, 0.2, 0.1, 0.05],
  },
  PEN: {
    billetes: [200, 100, 50, 20, 10],
    monedas: [5, 2, 1, 0.5, 0.2, 0.1],
  },
  CLP: {
    billetes: [20000, 10000, 5000, 1000],
    monedas: [500, 100, 50, 10],
  },
  ARS: {
    billetes: [10000, 2000, 1000, 500, 200, 100, 50, 20, 10],
    monedas: [50, 10, 5, 2, 1, 0.5],
  },
  VES: {
    billetes: [100, 50, 20, 10, 5, 2, 1],
    monedas: [1, 0.5, 0.25, 0.1, 0.05],
  },
  MXN: {
    billetes: [1000, 500, 200, 100, 50, 20],
    monedas: [10, 5, 2, 1, 0.5],
  },
};

type MonedaCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  denominaciones: unknown;
};

function normalizarIncidenciaApertura(
  incidencia: unknown,
  monedasAfectadasDefault: string[] = []
): AperturaIncidencia | null {
  if (!incidencia || typeof incidencia !== "object") {
    return null;
  }

  const payload = incidencia as {
    motivo?: unknown;
    detalle?: unknown;
    monedas_afectadas?: unknown;
  };

  const motivo = String(payload.motivo || "").trim();
  const detalle = String(payload.detalle || "").trim();
  const monedas_afectadas = Array.isArray(payload.monedas_afectadas)
    ? payload.monedas_afectadas
        .map((item) => String(item || "").toUpperCase())
        .filter(Boolean)
    : monedasAfectadasDefault;

  if (!motivo || !detalle) {
    return null;
  }

  return {
    motivo,
    detalle,
    monedas_afectadas,
    registrada_en: nowEcuador().toISOString(),
  };
}

function resolveDenominaciones(moneda: MonedaCatalogo) {
  // Siempre usar denominaciones hardcoded para garantizar consistencia
  // Ignorar las denominaciones almacenadas en la base de datos
  return DENOMINACIONES_ESPECIFICAS[moneda.codigo] || DENOMINACIONES_DEFAULT;
}

async function buildSaldoEsperadoMoneda(moneda: MonedaCatalogo, puntoAtencionId: string) {
  const saldoActual = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: moneda.id,
      },
    },
    select: {
      cantidad: true,
      billetes: true,
      monedas_fisicas: true,
    },
  });

  // 🔒 FIX: Siempre calcular el saldo teórico desde el ledger (MovimientoSaldo).
  // Saldo.cantidad puede haber sido pisada por conteos físicos intermedios
  // (cuadre-caja-conteo) o quedar desactualizada. El ledger es la fuente de verdad.
  const cantidadCalculada = await calcularSaldoDesdeMovimientos(puntoAtencionId, moneda.id);
  const billetes = saldoActual ? Number(saldoActual.billetes) : cantidadCalculada;
  const monedas = saldoActual ? Number(saldoActual.monedas_fisicas) : 0;

  return {
    moneda_id: moneda.id,
    codigo: moneda.codigo,
    nombre: moneda.nombre,
    simbolo: moneda.simbolo,
    cantidad: cantidadCalculada,
    billetes,
    monedas,
    denominaciones: resolveDenominaciones(moneda),
  };
}

async function ensureMonedasObligatoriasEnSaldoEsperado(
  saldoEsperado: any[],
  monedas: MonedaCatalogo[],
  puntoAtencionId: string
) {
  const codigosActuales = new Set(
    saldoEsperado.map((item) => String(item.codigo || "").toUpperCase()).filter(Boolean)
  );

  const faltantes = MONEDAS_APERTURA_OBLIGATORIAS.filter((codigo) => !codigosActuales.has(codigo));
  if (faltantes.length === 0) {
    return { saldoEsperado, monedasAgregadas: [] as string[] };
  }

  const adicionales = await Promise.all(
    monedas
      .filter((moneda) => faltantes.includes(moneda.codigo.toUpperCase() as (typeof MONEDAS_APERTURA_OBLIGATORIAS)[number]))
      .map((moneda) => buildSaldoEsperadoMoneda(moneda, puntoAtencionId))
  );

  return {
    saldoEsperado: [...saldoEsperado, ...adicionales],
    monedasAgregadas: adicionales.map((item) => item.codigo),
  };
}

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
      select: { monto: true, descripcion: true },
    });

    // 3. Sumar movimientos de CAJA únicamente (excluir bancos)
    //    Debe ser consistente con calcularSaldoReal() en saldoReconciliationService.ts
    for (const mov of movimientos) {
      const desc = (mov.descripcion ?? "").toString().toLowerCase();
      const hasBancoWord = /\bbancos?\b/i.test(desc);
      if (hasBancoWord && !desc.includes("(caja)")) {
        continue; // Saltar movimientos bancarios
      }

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

// Tipos
interface ConteoMoneda {
  moneda_id: string;
  billetes: { denominacion: number; cantidad: number }[];
  monedas: { denominacion: number; cantidad: number }[];
  total: number;
}

interface DiferenciaMoneda {
  moneda_id: string;
  codigo: string;
  esperado: number;
  fisico: number;
  diferencia: number;
  fuera_tolerancia: boolean;
}

// Helper para calcular totales del desglose
function calcularTotalDesglose(
  billetes: { denominacion: number; cantidad: number }[],
  monedas: { denominacion: number; cantidad: number }[]
): number {
  const totalBilletes = billetes.reduce(
    (sum, b) => sum + b.denominacion * b.cantidad,
    0
  );
  const totalMonedas = monedas.reduce(
    (sum, m) => sum + m.denominacion * m.cantidad,
    0
  );
  return totalBilletes + totalMonedas;
}

// Helper para validar diferencias
function validarDiferencias(
  saldoEsperado: { moneda_id: string; codigo: string; cantidad: number }[],
  conteoFisico: ConteoMoneda[],
  toleranciaUSD: number = 1.0,
  toleranciaOtras: number = 0.01
): { diferencias: DiferenciaMoneda[]; cuadrado: boolean } {
  const diferencias: DiferenciaMoneda[] = [];
  let cuadrado = true;

  for (const esperado of saldoEsperado) {
    const fisico = conteoFisico.find((c) => c.moneda_id === esperado.moneda_id);
    const totalFisico = fisico ? fisico.total : 0;
    const diferencia = totalFisico - esperado.cantidad;
    const tolerancia = esperado.codigo === "USD" ? toleranciaUSD : toleranciaOtras;
    const fueraTolerancia = Math.abs(diferencia) > tolerancia;

    if (fueraTolerancia) {
      cuadrado = false;
    }

    diferencias.push({
      moneda_id: esperado.moneda_id,
      codigo: esperado.codigo,
      esperado: esperado.cantidad,
      fisico: totalFisico,
      diferencia,
      fuera_tolerancia: fueraTolerancia,
    });
  }

  return { diferencias, cuadrado };
}

// ======================= POST: Iniciar apertura de caja =======================
router.post(
  "/iniciar",
  authenticateToken,
  requireRole(["OPERADOR", "ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    try {
      const { jornada_id } = req.body;
      const usuario_id = req.user?.id;

      if (!jornada_id) {
        return res.status(400).json({
          success: false,
          error: "Se requiere jornada_id",
        });
      }

      // Obtener todas las monedas activas con sus denominaciones
      const monedas = await prisma.moneda.findMany({
        where: { activo: true },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          simbolo: true,
          denominaciones: true,
        },
      });

      // Verificar que la jornada existe y pertenece al usuario
      const jornada = await prisma.jornada.findFirst({
        where: {
          id: jornada_id,
          usuario_id: usuario_id,
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

      // Verificar si ya existe una apertura para esta jornada
      const aperturaExistente = await prisma.aperturaCaja.findUnique({
        where: { jornada_id },
      });

      if (aperturaExistente) {
        const saldoEsperadoExistente = Array.isArray(aperturaExistente.saldo_esperado)
          ? (aperturaExistente.saldo_esperado as any[])
          : [];
        const normalizado = await ensureMonedasObligatoriasEnSaldoEsperado(
          saldoEsperadoExistente,
          monedas,
          jornada.punto_atencion_id
        );

        const aperturaNormalizada =
          normalizado.monedasAgregadas.length > 0
            ? await prisma.aperturaCaja.update({
                where: { id: aperturaExistente.id },
                data: {
                  saldo_esperado: normalizado.saldoEsperado as Prisma.InputJsonValue,
                },
              })
            : aperturaExistente;

        return res.json({
          success: true,
          apertura: {
            ...aperturaNormalizada,
            saldo_esperado:
              normalizado.monedasAgregadas.length > 0
                ? normalizado.saldoEsperado
                : aperturaNormalizada.saldo_esperado,
          },
          message: "Ya existe una apertura para esta jornada",
        });
      }

      // Verificar si existe un arqueo completo previo
      const guards = await prisma.$queryRaw<Array<{ ready: boolean }>>`SELECT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'staged_opening_cash_guard'
          AND tgrelid = '"Saldo"'::regclass AND tgenabled IN ('O', 'A')
          AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'staged_opening_close_guard'
            AND tgrelid = '"Jornada"'::regclass AND tgenabled IN ('O', 'A'))
      ) AS ready`;
      if (!guards[0]?.ready) return res.status(503).json({ success: false,
        error: "Falta instalar la protección de apertura por etapas. Contacta al administrador." });

      // Calcular saldos dinámicamente desde MovimientoSaldo
      let saldoEsperado = await Promise.all(
        monedas.map((moneda) => buildSaldoEsperadoMoneda(moneda, jornada.punto_atencion_id))
      );

      // Freeze the priority list for this opening, using the last completed
      // shift at the point (including movements after it, before this shift).
      const anterior = await prisma.jornada.findFirst({ where: {
        punto_atencion_id: jornada.punto_atencion_id, id: { not: jornada.id },
        fecha_inicio: { lt: jornada.fecha_inicio }, estado: "COMPLETADO",
      }, orderBy: { fecha_inicio: "desc" } });
      const movimientos = await prisma.movimientoSaldo.findMany({ where: {
        punto_atencion_id: jornada.punto_atencion_id,
        fecha: { ...(anterior ? { gte: anterior.fecha_inicio } : {}), lt: jornada.fecha_inicio },
        tipo_movimiento: { not: "SALDO_INICIAL" },
      }, select: { moneda_id: true, descripcion: true } });
      const recientes = new Set(movimientos.filter(m => {
        const desc = m.descripcion || "";
        return !/\bbancos?\b/i.test(desc) || desc.toLowerCase().includes("(caja)");
      }).map(m => m.moneda_id));
      saldoEsperado = saldoEsperado.map(s => ({ ...s, apertura_por_etapas: true,
        obligatoria_inicio: ["USD", "EUR"].includes(s.codigo) || recientes.has(s.moneda_id),
      }));
      const tipoArqueo = "PARCIAL";
      const monedasExcluidas: unknown[] = [];

      // Obtener saldos de servicios externos
      const serviciosExternosSaldos = await prisma.servicioExternoSaldo.findMany({
        where: {
          punto_atencion_id: jornada.punto_atencion_id,
        },
        include: {
          moneda: {
            select: { id: true, codigo: true, nombre: true, simbolo: true },
          },
        },
      });

      // Formatear saldos de servicios externos
      const saldosServiciosExternos = serviciosExternosSaldos.map((s) => ({
        servicio: s.servicio,
        servicio_nombre: s.servicio.replace(/_/g, " "),
        moneda_id: s.moneda_id,
        codigo: s.moneda.codigo,
        nombre: s.moneda.nombre,
        simbolo: s.moneda.simbolo,
        cantidad: Number(s.cantidad),
        billetes: Number(s.billetes),
        monedas: Number(s.monedas_fisicas),
        bancos: Number(s.bancos || 0),
      }));

      // Crear registro de apertura
      const fechaHoy = todayGyeDateOnly();
      const apertura = await prisma.aperturaCaja.create({
        data: {
          jornada_id,
          usuario_id: usuario_id!,
          punto_atencion_id: jornada.punto_atencion_id,
          fecha: new Date(fechaHoy + "T00:00:00.000Z"),
          hora_inicio_conteo: nowEcuador(),
          estado: EstadoApertura.EN_CONTEO,
          saldo_esperado: saldoEsperado as Prisma.InputJsonValue,
          conteo_fisico: [] as Prisma.InputJsonValue,
          tolerancia_usd: 1.0,
          tolerancia_otras: 0.01,
        },
      });

      logger.info("Apertura de caja iniciada", {
        apertura_id: apertura.id,
        jornada_id,
        usuario_id,
        punto_id: jornada.punto_atencion_id,
        tipo_arqueo: tipoArqueo,
        monedas_incluidas: saldoEsperado.length,
        monedas_excluidas: monedasExcluidas.length,
      });

      return res.json({
        success: true,
        apertura: {
          ...apertura,
          saldo_esperado: saldoEsperado,
          saldos_servicios_externos: saldosServiciosExternos,
          tipo_arqueo: tipoArqueo,
          monedas_excluidas: monedasExcluidas,
          requiere_arqueo_completo: false,
        },
        message: "Cuenta primero las divisas obligatorias. Las restantes quedan pendientes hasta su conteo.",
      });
    } catch (error) {
      logger.error("Error al iniciar apertura de caja", {
        error: error instanceof Error ? error.message : "Unknown error",
        user_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// Count a deferred currency without reopening or overwriting verified counts.
router.post("/conteo-pendiente", authenticateToken, requireRole(["OPERADOR", "ADMIN", "SUPER_USUARIO"]), async (req, res) => {
  try {
    const { apertura_id, moneda_id, billetes, monedas, saldo_esperado } = req.body;
    const breakdown = [billetes, monedas];
    if (!apertura_id || !moneda_id || !Number.isFinite(saldo_esperado) || breakdown.some(items =>
      !Array.isArray(items) || items.some(d => !Number.isFinite(d.denominacion) || d.denominacion <= 0 ||
        !Number.isSafeInteger(d.cantidad) || d.cantidad < 0))) {
      return res.status(400).json({ success: false, error: "Conteo o saldo esperado inválido." });
    }
    const apertura = await prisma.$transaction(async tx => {
      const initial = await tx.aperturaCaja.findFirst({ where: { id: apertura_id, usuario_id: req.user!.id } });
      if (!initial) throw new OperationalConflict("Apertura no encontrada.");
      await lockTransferBalance(tx, initial.punto_atencion_id, moneda_id);
      await tx.$queryRaw`SELECT id FROM "AperturaCaja" WHERE id = ${apertura_id} FOR UPDATE`;
      const current = await tx.aperturaCaja.findUniqueOrThrow({ where: { id: apertura_id }, include: { jornada: true } });
      const expected = openingCurrencies(current.saldo_esperado);
      if (current.estado !== "ABIERTA" || current.jornada.fecha_salida || !["ACTIVO", "ALMUERZO"].includes(current.jornada.estado) ||
          !expected.some(c => c.apertura_por_etapas)) throw new OperationalConflict("La apertura no admite conteos pendientes.");
      const item = expected.find(c => c.moneda_id === moneda_id);
      const previous = Array.isArray(current.conteo_fisico) ? current.conteo_fisico as unknown as ConteoMoneda[] : [];
      if (!item || previous.some(c => c.moneda_id === moneda_id)) throw new OperationalConflict("Divisa inexistente o ya contada. Actualiza la pantalla.");
      const saldo = await tx.saldo.findUnique({ where: { punto_atencion_id_moneda_id: {
        punto_atencion_id: current.punto_atencion_id, moneda_id,
      } } });
      const real = Number(saldo?.cantidad ?? 0);
      if (Math.abs(real - saldo_esperado) >= 0.005) throw new OperationalConflict("El saldo cambió. Actualiza el conteo antes de guardarlo.");
      const total = calcularTotalDesglose(billetes, monedas);
      if (!Number.isFinite(total) || Math.abs(total - real) > Number(item.codigo === "USD" ? current.tolerancia_usd : current.tolerancia_otras)) {
        throw new OperationalConflict("El conteo no cuadra con el saldo físico esperado. Revisa el desglose antes de habilitar esta divisa.");
      }
      const count = { moneda_id, billetes, monedas, total, contado_en: new Date().toISOString(), contado_por: req.user!.id };
      const result = await tx.aperturaCaja.update({ where: { id: apertura_id }, data: {
        saldo_esperado: expected.map(c => c.moneda_id === moneda_id ? { ...c, cantidad: real } : c) as Prisma.InputJsonValue,
        conteo_fisico: [...previous, count] as unknown as Prisma.InputJsonValue,
      } });
      const range = gyeDayRangeUtcFromDateOnly(todayGyeDateOnly(current.jornada.fecha_inicio));
      const cuadre = await tx.cuadreCaja.findFirst({ where: { punto_atencion_id: current.punto_atencion_id, fecha: range, estado: "ABIERTO" } });
      if (cuadre) {
        await tx.$queryRaw`SELECT id FROM "CuadreCaja" WHERE id = ${cuadre.id} FOR UPDATE`;
        const stillOpen = await tx.cuadreCaja.findUniqueOrThrow({ where: { id: cuadre.id } });
        if (stillOpen.estado !== "ABIERTO") throw new OperationalConflict("El cuadre ya fue cerrado.");
        const data = { saldo_apertura: total, saldo_cierre: real, conteo_fisico: total, diferencia: total - real,
          billetes: calcularTotalDesglose(billetes, []), monedas_fisicas: calcularTotalDesglose([], monedas) };
        await tx.detalleCuadreCaja.upsert({ where: { cuadre_id_moneda_id: { cuadre_id: cuadre.id, moneda_id } },
          create: { cuadre_id: cuadre.id, moneda_id, ...data }, update: data });
      }
      await tx.arqueoCajaHistorico.create({ data: {
        apertura_id, punto_atencion_id: current.punto_atencion_id, usuario_id: req.user!.id,
        fecha: current.fecha, tipo_arqueo: "PARCIAL", monedas_arqueadas: [{ ...item, cantidad: real }] as Prisma.InputJsonValue,
        conteo_fisico: [count] as Prisma.InputJsonValue, observaciones: "Conteo posterior de divisa pendiente",
      } });
      return result;
    });
    return res.json({ success: true, apertura });
  } catch (error) {
    if (error instanceof OperationalConflict) return res.status(409).json({ success: false, error: error.message });
    logger.error("Error guardando conteo pendiente", { error: String(error) });
    return res.status(500).json({ success: false, error: "No se pudo guardar el conteo pendiente." });
  }
});

// ======================= POST: Guardar conteo físico =======================
router.post(
  "/conteo",
  authenticateToken,
  requireRole(["OPERADOR", "ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    try {
      const {
        apertura_id,
        conteos,
        fotos_urls,
        observaciones,
        servicios_externos,
        incidencia_apertura,
      } = req.body;
      const usuario_id = req.user?.id;

      if (!apertura_id || !conteos || !Array.isArray(conteos)) {
        return res.status(400).json({
          success: false,
          error: "Se requiere apertura_id y conteos",
        });
      }

      // Verificar que la apertura existe y pertenece al usuario
      const apertura = await prisma.aperturaCaja.findFirst({
        where: {
          id: apertura_id,
          usuario_id: usuario_id,
        },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      const estadoActualObligatorias = getEstadoMonedasObligatorias(apertura);
      const aperturaAbiertaBloqueadaPorObligatorias =
        apertura.estado === EstadoApertura.ABIERTA &&
        (estadoActualObligatorias.pendientes_guardado.length > 0 ||
          estadoActualObligatorias.descuadradas.length > 0);

      if (apertura.estado === EstadoApertura.ABIERTA && !aperturaAbiertaBloqueadaPorObligatorias) {
        return res.status(400).json({
          success: false,
          error: "Esta apertura ya fue completada",
        });
      }

      // Parsear saldo esperado
      const saldoEsperado = (apertura.saldo_esperado as any[]) || [];

      if (new Set(conteos.map(c => c.moneda_id)).size !== conteos.length || conteos.some(c =>
        !saldoEsperado.some(s => s.moneda_id === c.moneda_id) ||
        [c.billetes || [], c.monedas || []].some(items => !Array.isArray(items) || items.some(d =>
          !Number.isFinite(d.denominacion) || d.denominacion <= 0 || !Number.isSafeInteger(d.cantidad) || d.cantidad < 0)))) {
        return res.status(400).json({ success: false, error: "Conteos duplicados, divisa desconocida o desglose inválido." });
      }

      // Validar y calcular totales de cada conteo
      const conteosValidados: ConteoMoneda[] = conteos.map((c: ConteoMoneda) => {
        const totalCalculado = calcularTotalDesglose(c.billetes || [], c.monedas || []);
        return {
          ...c,
          total: totalCalculado,
        };
      });

      if (openingCurrencies(apertura.saldo_esperado).some(c => c.apertura_por_etapas) && conteosValidados.some(c => {
        const s = saldoEsperado.find(s => s.moneda_id === c.moneda_id);
        return !s.obligatoria_inicio && Math.abs(c.total - Number(s.cantidad)) > Number(apertura.tolerancia_otras);
      })) return res.status(400).json({ success: false, error: "Las divisas opcionales contadas deben cuadrar; puedes dejarlas pendientes y contarlas después." });

      const estadoObligatorias = getEstadoMonedasObligatorias({
        saldo_esperado: saldoEsperado,
        conteo_fisico: conteosValidados,
        tolerancia_usd: apertura.tolerancia_usd,
        tolerancia_otras: apertura.tolerancia_otras,
      });
      const incidenciaApertura = normalizarIncidenciaApertura(
        incidencia_apertura,
        estadoObligatorias.descuadradas
      );

      if (estadoObligatorias.pendientes_guardado.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Debes guardar el cuadre obligatorio de ${estadoObligatorias.pendientes_guardado.join(" y ")} antes de continuar.`,
          code: "APERTURA_OBLIGATORIA_INCOMPLETA",
          monedas_obligatorias: requiredOpeningCurrencies(apertura.saldo_esperado),
          monedas_obligatorias_guardadas: estadoObligatorias.guardadas,
          monedas_obligatorias_cuadradas: estadoObligatorias.cuadradas,
          monedas_obligatorias_descuadradas: estadoObligatorias.descuadradas,
          monedas_obligatorias_pendientes: estadoObligatorias.pendientes,
        });
      }

      // Calcular diferencias
      const { diferencias, cuadrado } = validarDiferencias(
        saldoEsperado.filter(s => conteosValidados.some(c => c.moneda_id === s.moneda_id)).map((s) => ({
          moneda_id: s.moneda_id,
          codigo: s.codigo,
          cantidad: Number(s.cantidad),
        })),
        conteosValidados,
        Number(apertura.tolerancia_usd),
        Number(apertura.tolerancia_otras)
      );

      // Determinar nuevo estado
      let nuevoEstado: EstadoApertura;
      let requiereAprobacion = false;

      if (cuadrado) {
        nuevoEstado = EstadoApertura.CUADRADO;
      } else {
        nuevoEstado = EstadoApertura.CON_DIFERENCIA;
        requiereAprobacion = true;
      }

      // Preparar datos de servicios externos si existen
      const serviciosData = servicios_externos ? (servicios_externos as unknown as Prisma.InputJsonValue) : Prisma.DbNull;

      // Actualizar apertura
      const aperturaActualizada = await prisma.aperturaCaja.update({
        where: { id: apertura_id },
        data: {
          conteo_fisico: conteosValidados as unknown as Prisma.InputJsonValue,
          diferencias: diferencias as unknown as Prisma.InputJsonValue,
          estado: nuevoEstado,
          hora_fin_conteo: nowEcuador(),
          requiere_aprobacion: requiereAprobacion,
          fotos_urls: fotos_urls ? (fotos_urls as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          observaciones_operador: buildObservacionesApertura(
            observaciones,
            incidenciaApertura
          ),
          conteo_servicios_externos: serviciosData,
        },
      });

      // Registrar arqueo histórico
      const tipoArqueo = saldoEsperado.every(s => conteosValidados.some(c => c.moneda_id === s.moneda_id)) ? "COMPLETO" : "PARCIAL";

      await prisma.arqueoCajaHistorico.create({
        data: {
          apertura_id: apertura_id,
          punto_atencion_id: apertura.punto_atencion_id,
          usuario_id: usuario_id!,
          fecha: apertura.fecha,
          tipo_arqueo: tipoArqueo,
          monedas_arqueadas: saldoEsperado.filter(s => conteosValidados.some(c => c.moneda_id === s.moneda_id)).map((s) => ({
            moneda_id: s.moneda_id,
            codigo: s.codigo,
            nombre: s.nombre,
            cantidad: s.cantidad,
          })) as Prisma.InputJsonValue,
          conteo_fisico: conteosValidados as unknown as Prisma.InputJsonValue,
          diferencias: diferencias as unknown as Prisma.InputJsonValue,
          observaciones: observaciones || null,
        },
      });

      logger.info("Conteo de apertura guardado", {
        apertura_id,
        estado: nuevoEstado,
        cuadrado,
        diferencias_count: diferencias.filter((d) => d.fuera_tolerancia).length,
        servicios_count: servicios_externos?.length || 0,
        tipo_arqueo: tipoArqueo,
        reapertura_correccion: aperturaAbiertaBloqueadaPorObligatorias,
      });

      return res.json({
        success: true,
        apertura: aperturaActualizada,
        diferencias,
        cuadrado,
        puede_abrir:
          estadoObligatorias.descuadradas.length === 0 || Boolean(incidenciaApertura),
        puede_abrir_con_incidencia: Boolean(incidenciaApertura),
        tipo_arqueo: tipoArqueo,
        monedas_obligatorias: requiredOpeningCurrencies(apertura.saldo_esperado),
        monedas_obligatorias_guardadas: estadoObligatorias.guardadas,
        monedas_obligatorias_cuadradas: estadoObligatorias.cuadradas,
        monedas_obligatorias_descuadradas: estadoObligatorias.descuadradas,
        monedas_obligatorias_pendientes: estadoObligatorias.pendientes,
        message:
          estadoObligatorias.descuadradas.length > 0 && incidenciaApertura
            ? `Incidencia registrada para ${estadoObligatorias.descuadradas.join(", ")}. Puedes confirmar la apertura y el administrador deberá revisarla.`
            : estadoObligatorias.descuadradas.length > 0
            ? `Las divisas obligatorias deben quedar cuadradas antes de confirmar la apertura. Descuadradas: ${estadoObligatorias.descuadradas.join(", ")}.`
            : cuadrado
            ? `Todo cuadrado. Arqueo ${tipoArqueo} registrado. Puedes confirmar la apertura.`
            : `Hay diferencias registradas en otras divisas (Arqueo ${tipoArqueo}). USD y EUR ya están cuadrados, puedes confirmar la apertura.`,
      });
    } catch (error) {
      logger.error("Error al guardar conteo de apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
        user_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= POST: Confirmar apertura (cuando cuadra) =======================
router.post(
  "/confirmar",
  authenticateToken,
  requireRole(["OPERADOR", "ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    try {
      const { apertura_id, incidencia_apertura } = req.body;
      const usuario_id = req.user?.id;

      if (!apertura_id) {
        return res.status(400).json({
          success: false,
          error: "Se requiere apertura_id",
        });
      }

      // Verificar que la apertura existe y pertenece al usuario
      const apertura = await prisma.aperturaCaja.findFirst({
        where: {
          id: apertura_id,
          usuario_id: usuario_id,
        },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      const observacionesParseadas = parseObservacionesApertura(
        apertura.observaciones_operador
      );
      const estadoObligatorias = getEstadoMonedasObligatorias(apertura);
      const incidenciaApertura =
        normalizarIncidenciaApertura(
          incidencia_apertura,
          estadoObligatorias.descuadradas
        ) || observacionesParseadas.incidencia;
      if (estadoObligatorias.pendientes_guardado.length > 0) {
        return res.status(400).json({
          success: false,
          error: `No puedes confirmar la apertura sin guardar ${estadoObligatorias.pendientes_guardado.join(" y ")}.`,
          code: "APERTURA_OBLIGATORIA_INCOMPLETA",
          monedas_obligatorias: requiredOpeningCurrencies(apertura.saldo_esperado),
          monedas_obligatorias_guardadas: estadoObligatorias.guardadas,
          monedas_obligatorias_cuadradas: estadoObligatorias.cuadradas,
          monedas_obligatorias_descuadradas: estadoObligatorias.descuadradas,
          monedas_obligatorias_pendientes: estadoObligatorias.pendientes,
        });
      }

      if (estadoObligatorias.descuadradas.length > 0) {
        if (!incidenciaApertura) {
          return res.status(400).json({
            success: false,
            error: `No puedes confirmar la apertura hasta cuadrar ${estadoObligatorias.descuadradas.join(" y ")} o registrar una incidencia de apertura.`,
            code: "APERTURA_OBLIGATORIA_INCOMPLETA",
            monedas_obligatorias: requiredOpeningCurrencies(apertura.saldo_esperado),
            monedas_obligatorias_guardadas: estadoObligatorias.guardadas,
            monedas_obligatorias_cuadradas: estadoObligatorias.cuadradas,
            monedas_obligatorias_descuadradas: estadoObligatorias.descuadradas,
            monedas_obligatorias_pendientes: estadoObligatorias.pendientes,
          });
        }
      }

      if (
        apertura.estado !== EstadoApertura.CUADRADO &&
        apertura.estado !== EstadoApertura.CON_DIFERENCIA
      ) {
        return res.status(400).json({
          success: false,
          error: "La apertura debe estar en estado CUADRADO o CON_DIFERENCIA para confirmar",
        });
      }

      // Determinar método de verificación
      const metodoVerificacion = incidenciaApertura
        ? "INCIDENCIA_OPERADOR"
        : apertura.estado === EstadoApertura.CUADRADO
        ? "AUTOMATICO"
        : "CON_DIFERENCIA_PENDIENTE";

      // ═════════════════════════════════════════════════════════════════
      // CREAR CUADRE DE CAJA PARA EL DÍA
      // ═════════════════════════════════════════════════════════════════
      // Verificar si ya existe un cuadre para hoy
      const fechaHoy = todayGyeDateOnly();
      const rangoCuadre = gyeDayRangeUtcFromDateOnly(fechaHoy);
      const cuadreExistente = await prisma.cuadreCaja.findFirst({
        where: {
          punto_atencion_id: apertura.punto_atencion_id,
          fecha: rangoCuadre,
        },
      });

      let cuadreCaja;
      if (!cuadreExistente) {
        // Crear nuevo cuadre de caja
        cuadreCaja = await prisma.cuadreCaja.create({
          data: {
            estado: "ABIERTO",
            fecha: rangoCuadre.gte,
            punto_atencion_id: apertura.punto_atencion_id,
            usuario_id: usuario_id!,
            observaciones: `Cuadre creado automáticamente desde apertura de caja (${apertura_id})`,
          },
        });

        // Crear detalles del cuadre con el conteo físico de la apertura
        const conteoFisico = (apertura.conteo_fisico as any[]) || [];
        const saldoEsperado = (apertura.saldo_esperado as any[]) || [];

        for (const saldo of saldoEsperado) {
          const conteo = conteoFisico.find((c: any) => c.moneda_id === saldo.moneda_id);
          if (!conteo && openingCurrencies(apertura.saldo_esperado).some(c => c.apertura_por_etapas)) continue;
          const conteoTotal = conteo ? conteo.total : 0;
          const diferencia = Number((conteoTotal - saldo.cantidad).toFixed(2));

          await prisma.detalleCuadreCaja.create({
            data: {
              cuadre_id: cuadreCaja.id,
              moneda_id: saldo.moneda_id,
              saldo_apertura: conteoTotal, // El conteo físico de apertura es el saldo inicial
              saldo_cierre: saldo.cantidad, // Saldo teórico esperado
              conteo_fisico: conteoTotal,
              diferencia: diferencia,
              billetes: conteo ? conteo.billetes.reduce((sum: number, b: any) => sum + b.denominacion * b.cantidad, 0) : 0,
              monedas_fisicas: conteo ? conteo.monedas.reduce((sum: number, m: any) => sum + m.denominacion * m.cantidad, 0) : 0,
              movimientos_periodo: 0,
            },
          });
        }

        logger.info("Cuadre de caja creado desde apertura", {
          cuadre_id: cuadreCaja.id,
          apertura_id,
          punto_id: apertura.punto_atencion_id,
          detalles_creados: saldoEsperado.length,
        });
      } else {
        cuadreCaja = cuadreExistente;
        logger.info("Cuadre de caja ya existente para el día", {
          cuadre_id: cuadreCaja.id,
          apertura_id,
        });
      }

      // Actualizar estado a ABIERTA (incluso con diferencias, queda marcado para revisión)
      const aperturaActualizada = await prisma.aperturaCaja.update({
        where: { id: apertura_id },
        data: {
          estado: EstadoApertura.ABIERTA,
          hora_apertura: nowEcuador(),
          metodo_verificacion: metodoVerificacion,
          // Si hay diferencias, marcar que requiere revisión de admin
          requiere_aprobacion:
            apertura.estado === EstadoApertura.CON_DIFERENCIA || Boolean(incidenciaApertura),
          observaciones_operador: buildObservacionesApertura(
            observacionesParseadas.textoLibre,
            incidenciaApertura
          ),
        },
      });

      logger.info("Apertura de caja confirmada", {
        apertura_id,
        usuario_id,
        con_diferencia: apertura.estado === EstadoApertura.CON_DIFERENCIA,
        apertura_con_incidencia: Boolean(incidenciaApertura),
        monedas_descuadradas: estadoObligatorias.descuadradas,
        razon_incidencia: incidenciaApertura?.motivo || null,
        cuadre_id: cuadreCaja.id,
      });

      const message = incidenciaApertura
        ? "Apertura confirmada con incidencia registrada. Puedes operar mientras el administrador revisa la novedad."
        : apertura.estado === EstadoApertura.CON_DIFERENCIA
        ? "Apertura confirmada con diferencias. La novedad ha sido registrada para revisión del administrador. Puedes iniciar a operar."
        : "Apertura confirmada. Jornada iniciada correctamente.";

      return res.json({
        success: true,
        apertura: aperturaActualizada,
        con_diferencia: apertura.estado === EstadoApertura.CON_DIFERENCIA,
        apertura_abierta_con_incidencia: Boolean(incidenciaApertura),
        message,
      });
    } catch (error) {
      logger.error("Error al confirmar apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
        user_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

router.get("/estado-actual", authenticateToken, requireRole(["OPERADOR", "ADMIN", "SUPER_USUARIO"]), async (req: Request, res: Response) => {
  try {
    const estado = await obtenerEstadoAperturaOperativa(req.user);

    return res.json({
      success: true,
      ...estado,
    });
  } catch (error) {
    logger.error("Error al obtener estado actual de apertura", {
      error: error instanceof Error ? error.message : "Unknown error",
      user_id: req.user?.id,
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// ======================= GET: Obtener apertura por ID =======================
router.get(
  "/:id",
  authenticateToken,
  requireRole(["OPERADOR", "ADMIN", "SUPER_USUARIO"]),
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const usuario_id = req.user?.id;
      const rol = req.user?.rol;

      const whereClause: any = { id };

      // Si no es admin, solo puede ver sus propias aperturas
      if (rol !== "ADMIN" && rol !== "SUPER_USUARIO") {
        whereClause.usuario_id = usuario_id;
      }

      const apertura = await prisma.aperturaCaja.findFirst({
        where: whereClause,
        include: {
          usuario: {
            select: { id: true, nombre: true, username: true },
          },
          puntoAtencion: {
            select: { id: true, nombre: true, direccion: true, ciudad: true },
          },
          aprobador: {
            select: { id: true, nombre: true, username: true },
          },
          jornada: {
            select: { id: true, estado: true, fecha_inicio: true },
          },
        },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      return res.json({
        success: true,
        apertura,
      });
    } catch (error) {
      logger.error("Error al obtener apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
        apertura_id: req.params.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= GET: Listar aperturas pendientes (Admin) =======================
router.get(
  "/pendientes/admin",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    try {
      const { punto_atencion_id, fecha } = req.query;

      const whereClause: any = {
        OR: [
          {
            estado: {
              in: [EstadoApertura.CON_DIFERENCIA, EstadoApertura.EN_CONTEO],
            },
          },
          {
            estado: EstadoApertura.ABIERTA,
            requiere_aprobacion: true,
          },
        ],
      };

      if (punto_atencion_id) {
        whereClause.punto_atencion_id = punto_atencion_id as string;
      }

      if (fecha) {
        whereClause.fecha = new Date(fecha as string);
      }

      const aperturas = await prisma.aperturaCaja.findMany({
        where: whereClause,
        include: {
          usuario: {
            select: { id: true, nombre: true, username: true },
          },
          puntoAtencion: {
            select: { id: true, nombre: true, ciudad: true },
          },
        },
        orderBy: { hora_inicio_conteo: "desc" },
      });

      const aperturasFormateadas = aperturas.map((apertura) => {
        const { incidencia, textoLibre } = parseObservacionesApertura(
          apertura.observaciones_operador
        );

        return {
          ...apertura,
          incidencia_apertura: incidencia,
          observaciones_operador: textoLibre || apertura.observaciones_operador,
        };
      });

      return res.json({
        success: true,
        aperturas: aperturasFormateadas,
        count: aperturasFormateadas.length,
      });
    } catch (error) {
      logger.error("Error al listar aperturas pendientes", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= GET: Mis aperturas (Operador) =======================
router.get(
  "/mis-aperturas/lista",
  authenticateToken,
  requireRole(["OPERADOR", "ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    try {
      const usuario_id = req.user?.id;
      const { estado, fecha } = req.query;

      const whereClause: any = { usuario_id };

      if (estado) {
        whereClause.estado = estado as EstadoApertura;
      }

      if (fecha) {
        whereClause.fecha = new Date(fecha as string);
      }

      const aperturas = await prisma.aperturaCaja.findMany({
        where: whereClause,
        include: {
          puntoAtencion: {
            select: { id: true, nombre: true, ciudad: true },
          },
          aprobador: {
            select: { id: true, nombre: true },
          },
        },
        orderBy: { hora_inicio_conteo: "desc" },
      });

      return res.json({
        success: true,
        aperturas,
      });
    } catch (error) {
      logger.error("Error al listar mis aperturas", {
        error: error instanceof Error ? error.message : "Unknown error",
        user_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= POST: Aprobar apertura con diferencia (Admin) =======================
router.post(
  "/:id/aprobar",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const { observaciones, ajustar_saldos } = req.body;
      const admin_id = req.user?.id;

      const apertura = await prisma.aperturaCaja.findUnique({
        where: { id },
        include: {
          puntoAtencion: true,
        },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      const esIncidenciaAbierta =
        apertura.estado === EstadoApertura.ABIERTA && apertura.requiere_aprobacion;

      if (apertura.estado !== EstadoApertura.CON_DIFERENCIA && !esIncidenciaAbierta) {
        return res.status(400).json({
          success: false,
          error: "Solo se pueden aprobar aperturas con diferencias o incidencias pendientes",
        });
      }

      // Actualizar apertura
      const aperturaActualizada = await prisma.aperturaCaja.update({
        where: { id },
        data: {
          estado: EstadoApertura.ABIERTA,
          aprobado_por: admin_id,
          hora_aprobacion: nowEcuador(),
          hora_apertura: apertura.hora_apertura || nowEcuador(),
          observaciones_admin: observaciones || null,
          metodo_verificacion: esIncidenciaAbierta ? "INCIDENCIA_APROBADA" : "VIDEOCALL",
          requiere_aprobacion: false,
        },
      });

      // Si se solicita ajustar saldos para que coincidan con el físico
      if (ajustar_saldos && apertura.estado === EstadoApertura.CON_DIFERENCIA) {
        const conteoFisico = (apertura.conteo_fisico as any[]) || [];
        
        for (const conteo of conteoFisico) {
          const saldoActual = await prisma.saldo.findUnique({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: apertura.punto_atencion_id,
                moneda_id: conteo.moneda_id,
              },
            },
          });

          if (saldoActual) {
            const diferencia = conteo.total - Number(saldoActual.cantidad);
            
            if (diferencia !== 0) {
              await prisma.saldo.update({
                where: {
                  punto_atencion_id_moneda_id: {
                    punto_atencion_id: apertura.punto_atencion_id,
                    moneda_id: conteo.moneda_id,
                  },
                },
                data: {
                  cantidad: conteo.total,
                  billetes: conteo.billetes.reduce(
                    (sum: number, b: { denominacion: number; cantidad: number }) => sum + b.denominacion * b.cantidad,
                    0
                  ),
                  monedas_fisicas: conteo.monedas.reduce(
                    (sum: number, m: { denominacion: number; cantidad: number }) => sum + m.denominacion * m.cantidad,
                    0
                  ),
                },
              });

              logger.info("Saldo ajustado por apertura con diferencia", {
                apertura_id: id,
                moneda_id: conteo.moneda_id,
                diferencia,
                admin_id,
              });
            }
          }
        }
      }

      logger.info("Apertura con diferencia aprobada por admin", {
        apertura_id: id,
        admin_id,
        ajustar_saldos: !!ajustar_saldos,
        incidencia_abierta: esIncidenciaAbierta,
      });

      return res.json({
        success: true,
        apertura: aperturaActualizada,
        message: esIncidenciaAbierta
          ? "Incidencia de apertura revisada correctamente."
          : "Apertura aprobada correctamente. La jornada puede iniciar.",
      });
    } catch (error) {
      logger.error("Error al aprobar apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
        apertura_id: req.params.id,
        admin_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= POST: Rechazar apertura (Admin) =======================
router.post(
  "/:id/rechazar",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const { observaciones } = req.body;
      const admin_id = req.user?.id;

      const apertura = await prisma.aperturaCaja.findUnique({
        where: { id },
      });

      if (!apertura) {
        return res.status(404).json({
          success: false,
          error: "Apertura no encontrada",
        });
      }

      if (apertura.estado !== EstadoApertura.CON_DIFERENCIA) {
        return res.status(400).json({
          success: false,
          error: "Solo se pueden rechazar aperturas pendientes antes de abrir. Las incidencias de aperturas ya abiertas deben resolverse con observaciones administrativas.",
        });
      }

      const aperturaActualizada = await prisma.aperturaCaja.update({
        where: { id },
        data: {
          estado: EstadoApertura.RECHAZADO,
          aprobado_por: admin_id,
          hora_aprobacion: nowEcuador(),
          observaciones_admin: observaciones || null,
        },
      });

      logger.info("Apertura rechazada por admin", {
        apertura_id: id,
        admin_id,
      });

      return res.json({
        success: true,
        apertura: aperturaActualizada,
        message: "Apertura rechazada. El operador debe realizar un nuevo conteo.",
      });
    } catch (error) {
      logger.error("Error al rechazar apertura", {
        error: error instanceof Error ? error.message : "Unknown error",
        apertura_id: req.params.id,
        admin_id: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= GET: Historial de arqueos (Admin/Auditoría) =======================
router.get(
  "/arqueos/historial",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: Request, res: Response) => {
    try {
      const { punto_atencion_id, fecha_desde, fecha_hasta, tipo_arqueo } = req.query;
      const usuario_id = req.user?.id;
      const rol = req.user?.rol;

      // Construir where clause
      const whereClause: any = {};

      if (punto_atencion_id) {
        whereClause.punto_atencion_id = punto_atencion_id as string;
      }

      // Si no es admin, solo puede ver arqueos de su punto
      if (rol !== "ADMIN" && rol !== "SUPER_USUARIO") {
        const usuario = await prisma.usuario.findUnique({
          where: { id: usuario_id },
          select: { punto_atencion_id: true },
        });
        whereClause.punto_atencion_id = usuario?.punto_atencion_id;
      }

      if (tipo_arqueo) {
        whereClause.tipo_arqueo = tipo_arqueo as string;
      }

      if (fecha_desde || fecha_hasta) {
        whereClause.fecha = {};
        if (fecha_desde) {
          whereClause.fecha.gte = new Date(fecha_desde as string);
        }
        if (fecha_hasta) {
          whereClause.fecha.lte = new Date(fecha_hasta as string);
        }
      }

      const arqueos = await prisma.arqueoCajaHistorico.findMany({
        where: whereClause,
        include: {
          puntoAtencion: {
            select: { id: true, nombre: true, ciudad: true },
          },
          usuario: {
            select: { id: true, nombre: true, username: true },
          },
          apertura: {
            select: { 
              id: true, 
              estado: true,
              hora_apertura: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      });

      // Calcular estadísticas
      const stats = {
        total_arqueos: arqueos.length,
        arqueos_completos: arqueos.filter((a) => a.tipo_arqueo === "COMPLETO").length,
        arqueos_parciales: arqueos.filter((a) => a.tipo_arqueo === "PARCIAL").length,
      };

      return res.json({
        success: true,
        arqueos,
        stats,
      });
    } catch (error) {
      logger.error("Error al obtener historial de arqueos", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= GET: Detalle de un arqueo específico =======================
router.get(
  "/arqueos/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const usuario_id = req.user?.id;
      const rol = req.user?.rol;

      const arqueo = await prisma.arqueoCajaHistorico.findUnique({
        where: { id },
        include: {
          puntoAtencion: {
            select: { id: true, nombre: true, ciudad: true },
          },
          usuario: {
            select: { id: true, nombre: true, username: true },
          },
          apertura: {
            include: {
              jornada: {
                select: { id: true, fecha_inicio: true, fecha_salida: true },
              },
            },
          },
        },
      });

      if (!arqueo) {
        return res.status(404).json({
          success: false,
          error: "Arqueo no encontrado",
        });
      }

      // Verificar permisos
      if (rol !== "ADMIN" && rol !== "SUPER_USUARIO") {
        const usuario = await prisma.usuario.findUnique({
          where: { id: usuario_id },
          select: { punto_atencion_id: true },
        });
        if (arqueo.punto_atencion_id !== usuario?.punto_atencion_id) {
          return res.status(403).json({
            success: false,
            error: "No tienes permiso para ver este arqueo",
          });
        }
      }

      return res.json({
        success: true,
        arqueo,
      });
    } catch (error) {
      logger.error("Error al obtener detalle de arqueo", {
        error: error instanceof Error ? error.message : "Unknown error",
        arqueo_id: req.params.id,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

export default router;
