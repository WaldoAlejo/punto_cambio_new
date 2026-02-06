// server/routes/contabilidad-diaria.ts
console.log('[CONTABILIDAD_DIARIA] Archivo de rutas cargado');
import express from "express";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  gyeDayRangeUtcFromDateOnly,
  gyeParseDateOnly,
} from "../utils/timezone.js";
import cierreService from "../services/cierreService.js";
import { saldoReconciliationService } from "../services/saldoReconciliationService.js";

const router = express.Router();

type RolUsuario = "ADMIN" | "SUPER_USUARIO" | "OPERADOR" | string;

/**
 * GET /api/contabilidad-diaria/:pointId/:fecha
 * Resumen de movimientos por moneda para el día (zona GYE).
 * Clasificación:
 *  - Ingresos: VENTA, TRANSFERENCIA_ENTRADA/ENTRANTE, SALDO/SALDO_INICIAL/"SALDO EN CAJA", INGRESO/INGRESOS,
 *              AJUSTE (monto > 0), CAMBIO_DIVISA (descripcion inicia con "Ingreso por cambio")
 *  - Egresos:  COMPRA, TRANSFERENCIA_SALIDA/SALIENTE, EGRESO/EGRESOS,
 *              AJUSTE (monto < 0), CAMBIO_DIVISA (descripcion inicia con "Egreso por cambio")
 */
router.get("/:pointId/:fecha", authenticateToken, async (req, res) => {
  try {
    const { pointId, fecha } = req.params;
    const usuario = req.user as
      | {
          id: string;
          punto_atencion_id?: string;
          rol?: RolUsuario;
        }
      | undefined;

    if (!pointId) {
      return res.status(400).json({ success: false, error: "Falta pointId" });
    }

    // Seguridad: operadores solo pueden consultar su propio punto
    const esAdmin =
      (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
    if (
      !esAdmin &&
      usuario?.punto_atencion_id &&
      usuario.punto_atencion_id !== pointId
    ) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otro punto de atención",
      });
    }

    // Valida YYYY-MM-DD (lanza si no cumple)
    gyeParseDateOnly(fecha);

    // Rango UTC que cubre el día en GYE
    const { gte, lt } = gyeDayRangeUtcFromDateOnly(fecha);

    // === Agregaciones ===
    const ingresosEtiquetas = [
      "VENTA",
      "TRANSFERENCIA_ENTRADA",
      "TRANSFERENCIA_ENTRANTE",
      "SALDO_INICIAL",
      "SALDO",
      "SALDO EN CAJA",
      "INGRESO",
      "INGRESOS",
    ];

    const egresosEtiquetas = [
      "COMPRA",
      "TRANSFERENCIA_SALIDA",
      "TRANSFERENCIA_SALIENTE",
      "EGRESO",
      "EGRESOS",
    ];

    // Ingresos base (etiquetas ampliadas)
    const ingresosBase = await prisma.movimientoSaldo.groupBy({
      by: ["moneda_id"],
      where: {
        punto_atencion_id: pointId,
        fecha: { gte, lt },
        tipo_movimiento: { in: ingresosEtiquetas },
      },
      _sum: { monto: true },
    });

    // Ingresos por AJUSTE (monto > 0)
    const ingresosAjustePos = await prisma.movimientoSaldo.groupBy({
      by: ["moneda_id"],
      where: {
        punto_atencion_id: pointId,
        fecha: { gte, lt },
        tipo_movimiento: "AJUSTE",
        monto: { gt: 0 },
      },
      _sum: { monto: true },
    });

    // Ingresos por CAMBIO_DIVISA (descripcion inicia con “Ingreso por cambio”)
    const ingresosCambio = await prisma.movimientoSaldo.groupBy({
      by: ["moneda_id"],
      where: {
        punto_atencion_id: pointId,
        fecha: { gte, lt },
        tipo_movimiento: "CAMBIO_DIVISA",
        descripcion: {
          startsWith: "Ingreso por cambio",
          mode: "insensitive",
        },
      },
      _sum: { monto: true },
    });

    // Egresos base (etiquetas ampliadas)
    const egresosBase = await prisma.movimientoSaldo.groupBy({
      by: ["moneda_id"],
      where: {
        punto_atencion_id: pointId,
        fecha: { gte, lt },
        tipo_movimiento: { in: egresosEtiquetas },
      },
      _sum: { monto: true },
    });

    // Egresos por AJUSTE (monto < 0) — luego tomamos ABS
    const egresosAjusteNeg = await prisma.movimientoSaldo.groupBy({
      by: ["moneda_id"],
      where: {
        punto_atencion_id: pointId,
        fecha: { gte, lt },
        tipo_movimiento: "AJUSTE",
        monto: { lt: 0 },
      },
      _sum: { monto: true },
    });

    // Egresos por CAMBIO_DIVISA (descripcion inicia con “Egreso por cambio”)
    const egresosCambio = await prisma.movimientoSaldo.groupBy({
      by: ["moneda_id"],
      where: {
        punto_atencion_id: pointId,
        fecha: { gte, lt },
        tipo_movimiento: "CAMBIO_DIVISA",
        descripcion: {
          startsWith: "Egreso por cambio",
          mode: "insensitive",
        },
      },
      _sum: { monto: true },
    });

    // Conteo de movimientos por moneda
    const counts = await prisma.movimientoSaldo.groupBy({
      by: ["moneda_id"],
      where: { punto_atencion_id: pointId, fecha: { gte, lt } },
      _count: { _all: true },
    });

    // === Combinar resultados ===
    type NumMap = Record<string, number>;
    const toNum = (v: any) => (v ? Number(v) : 0);

    const mapIngresos: NumMap = {};
    for (const r of ingresosBase) {
      mapIngresos[r.moneda_id] =
        (mapIngresos[r.moneda_id] || 0) + toNum(r._sum.monto);
    }
    for (const r of ingresosAjustePos) {
      mapIngresos[r.moneda_id] =
        (mapIngresos[r.moneda_id] || 0) + toNum(r._sum.monto);
    }
    for (const r of ingresosCambio) {
      mapIngresos[r.moneda_id] =
        (mapIngresos[r.moneda_id] || 0) + toNum(r._sum.monto);
    }

    const mapEgresos: NumMap = {};
    for (const r of egresosBase) {
      mapEgresos[r.moneda_id] =
        (mapEgresos[r.moneda_id] || 0) + Math.abs(toNum(r._sum.monto));
    }
    for (const r of egresosAjusteNeg) {
      mapEgresos[r.moneda_id] =
        (mapEgresos[r.moneda_id] || 0) + Math.abs(toNum(r._sum.monto));
    }
    for (const r of egresosCambio) {
      mapEgresos[r.moneda_id] =
        (mapEgresos[r.moneda_id] || 0) + Math.abs(toNum(r._sum.monto));
    }

    const mapCounts: Record<string, number> = {};
    for (const r of counts) mapCounts[r.moneda_id] = r._count._all;

    // Unificar moneda_ids
    const monedaIds = Array.from(
      new Set([
        ...Object.keys(mapIngresos),
        ...Object.keys(mapEgresos),
        ...Object.keys(mapCounts),
      ])
    ).sort();

    // Info de moneda (enriquecer respuesta)
    const monedas = monedaIds.length
      ? await prisma.moneda.findMany({
          where: { id: { in: monedaIds } },
          select: { id: true, codigo: true, nombre: true, simbolo: true },
        })
      : [];
    const monedaInfo = new Map(monedas.map((m) => [m.id, m]));

    const resumen = monedaIds.map((mid) => ({
      moneda_id: mid,
      ingresos: mapIngresos[mid] || 0,
      egresos: mapEgresos[mid] || 0,
      movimientos: mapCounts[mid] || 0,
      moneda: monedaInfo.get(mid) || null,
    }));

    return res.json({
      success: true,
      fecha,
      rango_utc: { gte, lt },
      pointId,
      resumen,
    });
  } catch (error) {
    logger.error("Error en GET /contabilidad-diaria/:pointId/:fecha", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * GET /api/contabilidad-diaria/cierre/:pointId/:fecha
 * Verifica si existe un cierre para el día especificado
 */
router.get("/cierre/:pointId/:fecha", authenticateToken, async (req, res) => {
  try {
    const { pointId, fecha } = req.params;
    const usuario = req.user as
      | {
          id: string;
          punto_atencion_id?: string;
          rol?: RolUsuario;
        }
      | undefined;

    if (!pointId) {
      return res.status(400).json({ success: false, error: "Falta pointId" });
    }

    // Seguridad: operadores solo pueden consultar su propio punto
    const esAdmin =
      (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
    if (
      !esAdmin &&
      usuario?.punto_atencion_id &&
      usuario.punto_atencion_id !== pointId
    ) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otro punto de atención",
      });
    }

    // Valida YYYY-MM-DD (lanza si no cumple)
    gyeParseDateOnly(fecha);

    // Prisma usa Date para @db.Date (sin hora).
    // Usamos medianoche UTC de esa fecha
    const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

    // Buscar cierre por clave compuesta
    const cierre = await prisma.cierreDiario.findUnique({
      where: {
        fecha_punto_atencion_id: {
          fecha: fechaDate,
          punto_atencion_id: pointId,
        },
      },
      include: {
        usuario: {
          select: { nombre: true, username: true },
        },
      },
    });

    return res.json({
      success: true,
      cierre: cierre || null,
    });
  } catch (error) {
    logger.error("Error en GET /contabilidad-diaria/cierre/:pointId/:fecha", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * GET /api/contabilidad-diaria/validar-cierres/:pointId/:fecha
 * Valida qué cierres son necesarios antes de permitir el cierre diario
 */
router.get(
  "/validar-cierres/:pointId/:fecha",
  authenticateToken,
  async (req, res) => {
    try {
      const { pointId, fecha } = req.params;
      const usuario = req.user as
        | {
            id: string;
            punto_atencion_id?: string;
            rol?: string;
          }
        | undefined;

      // Log de auditoría para depuración de errores 403
      console.log("[VALIDAR_CIERRES]", {
        usuario_id: usuario?.id,
        usuario_rol: usuario?.rol,
        usuario_punto_atencion_id: usuario?.punto_atencion_id,
        requested_point_id: pointId,
        fecha,
      });

      if (!pointId) {
        return res.status(400).json({ success: false, error: "Falta pointId" });
      }

      // Seguridad: operadores solo pueden consultar su propio punto
      const esAdmin =
        (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
      
      // Si es operador, debe tener acceso al punto
      if (!esAdmin) {
        // Si no es admin, verificar que sea operador del punto
        if (!usuario?.punto_atencion_id || usuario.punto_atencion_id !== pointId) {
          return res.status(403).json({
            success: false,
            error: "No autorizado para consultar otro punto de atención",
          });
        }
      }

      // Valida YYYY-MM-DD (lanza si no cumple)
      gyeParseDateOnly(fecha);

      // Rango UTC que cubre el día en GYE
      const { gte, lt } = gyeDayRangeUtcFromDateOnly(fecha);
      const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

      // 1. Verificar si hay cambios de divisas del día
      const cambiosDivisas = await prisma.cambioDivisa.count({
        where: {
          punto_atencion_id: pointId,
          fecha: { gte, lt },
        },
      });

      // 2. Verificar si hay movimientos de servicios externos del día
      const serviciosExternos = await prisma.servicioExternoMovimiento.count({
        where: {
          punto_atencion_id: pointId,
          fecha: { gte, lt },
        },
      });

      // 3. Verificar estado de cierre diario
      const cierreDiario = await prisma.cierreDiario.findUnique({
        where: {
          fecha_punto_atencion_id: {
            fecha: fechaDate,
            punto_atencion_id: pointId,
          },
        },
      });

      // Determinar qué cierres son requeridos
      // NOTA: Los servicios externos ya NO requieren cierre separado
      // Se incluyen automáticamente en el cierre diario
      const cierresRequeridos = {
        servicios_externos: false, // Ya no se requiere cierre separado
        cambios_divisas: cambiosDivisas > 0,
        cierre_diario: true, // Siempre requerido
      };

      // Estado actual de los cierres
      const estadoCierres = {
        servicios_externos: true, // Siempre true porque ya no se requiere cierre separado
        cambios_divisas: true, // Los cambios de divisas no tienen cierre separado, se incluyen en el cierre diario
        cierre_diario: cierreDiario?.estado === "CERRADO",
      };

      // Verificar si todos los cierres requeridos están completos
      const cierresCompletos = estadoCierres.cierre_diario;

      return res.json({
        success: true,
        cierres_requeridos: cierresRequeridos,
        estado_cierres: estadoCierres,
        cierres_completos: cierresCompletos,
        conteos: {
          cambios_divisas: cambiosDivisas,
          servicios_externos: serviciosExternos,
        },
      });
    } catch (error) {
      logger.error(
        "Error en GET /contabilidad-diaria/validar-cierres/:pointId/:fecha",
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

/**
 * GET /api/contabilidad-diaria/:pointId/:fecha/resumen-cierre
 * Obtiene el resumen de saldos antes de confirmar el cierre
 * Muestra: saldos principales (USD y divisas movidas), servicios externos
 */
router.get(
  "/:pointId/:fecha/resumen-cierre",
  authenticateToken,
  async (req, res) => {
    try {
      const { pointId, fecha } = req.params;
      const usuario = req.user as
        | {
            id: string;
            punto_atencion_id?: string;
            rol?: RolUsuario;
          }
        | undefined;

      if (!pointId) {
        return res.status(400).json({ success: false, error: "Falta pointId" });
      }

      // Seguridad: operadores solo pueden consultar su propio punto
      const esAdmin =
        (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
      if (
        !esAdmin &&
        usuario?.punto_atencion_id &&
        usuario.punto_atencion_id !== pointId
      ) {
        return res.status(403).json({
          success: false,
          error: "No autorizado para consultar otro punto de atención",
        });
      }

      // Valida YYYY-MM-DD
      gyeParseDateOnly(fecha);
      const { gte, lt } = gyeDayRangeUtcFromDateOnly(fecha);

      // 1. Obtener saldos finales de monedas con movimientos en el día
      const saldosMonedas = await prisma.saldo.findMany({
        where: {
          punto_atencion_id: pointId,
        },
        include: {
          moneda: {
            select: {
              codigo: true,
              nombre: true,
              simbolo: true,
            },
          },
        },
      });

      // 2. Obtener cuáles monedas tuvieron movimientos en el día
      const monedasConMovimientos = await prisma.movimientoSaldo.groupBy({
        by: ["moneda_id"],
        where: {
          punto_atencion_id: pointId,
          fecha: { gte, lt },
        },
        _count: { id: true },
      });

      const idsConMovimientos = new Set(
        monedasConMovimientos.map((m) => m.moneda_id)
      );

      // 3. Filtrar saldos: USD siempre, y divisas que tuvieron movimientos
      const saldosPrincipalesBase = saldosMonedas
        .filter(
          (s) => s.moneda.codigo === "USD" || idsConMovimientos.has(s.moneda_id)
        )
        .map((s) => ({
          moneda_id: s.moneda_id,
          moneda_codigo: s.moneda.codigo,
          moneda_nombre: s.moneda.nombre,
          moneda_simbolo: s.moneda.simbolo,
          saldo_registrado: s.cantidad,
          tuvo_movimientos: idsConMovimientos.has(s.moneda_id),
        }))
        .sort((a, b) => {
          // USD primero, luego alfabético
          if (a.moneda_codigo === "USD") return -1;
          if (b.moneda_codigo === "USD") return 1;
          return a.moneda_codigo.localeCompare(b.moneda_codigo);
        });

      // 3.1 Reconciliar saldos (fuente de verdad: saldoInicial + MovimientoSaldo)
      const saldosPrincipalesReconciliados = await Promise.all(
        saldosPrincipalesBase.map(async (s) => {
          const saldoCalculado = await saldoReconciliationService.calcularSaldoReal(
            pointId,
            s.moneda_id
          );

          return {
            moneda_codigo: s.moneda_codigo,
            moneda_nombre: s.moneda_nombre,
            moneda_simbolo: s.moneda_simbolo,
            saldo_final: saldoCalculado,
            tuvo_movimientos: s.tuvo_movimientos,
          };
        })
      );

      // 4. Obtener saldos de servicios externos
      const serviciosExternos = await prisma.servicioExternoSaldo.findMany({
        where: {
          punto_atencion_id: pointId,
        },
        include: {
          moneda: {
            select: {
              codigo: true,
              simbolo: true,
            },
          },
        },
      });

      // Agrupar por servicio externo
      const saldosServicios = serviciosExternos.reduce((acc, s) => {
        const key = s.servicio;
        if (!acc[key]) {
          acc[key] = {
            servicio_nombre: s.servicio,
            servicio_tipo: s.servicio,
            saldos: [],
          };
        }
        acc[key].saldos.push({
          moneda_codigo: s.moneda.codigo,
          moneda_simbolo: s.moneda.simbolo,
          saldo: s.cantidad,
        });
        return acc;
      }, {} as Record<string, any>);

      // 5. Obtener total de transacciones del día
      const totalTransacciones = await prisma.movimientoSaldo.count({
        where: {
          punto_atencion_id: pointId,
          fecha: { gte, lt },
        },
      });

      // 6. Listado de transacciones del día (para auditoría previa al cierre)
      // Nota: puede crecer; mantenemos payload compacto y ordenado por fecha.
      const limit = Math.min(
        Math.max(Number(req.query.limit ?? 5000), 0),
        20000
      );

      const cambiosDivisas = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: pointId,
          fecha: { gte, lt },
        },
        orderBy: { fecha: "asc" },
        take: limit,
        select: {
          id: true,
          fecha: true,
          numero_recibo: true,
          tipo_operacion: true,
          estado: true,
          monto_origen: true,
          monto_destino: true,
          tasa_cambio_billetes: true,
          tasa_cambio_monedas: true,
          metodo_entrega: true,
          metodo_pago_origen: true,
          transferencia_banco: true,
          transferencia_numero: true,
          observacion: true,
          monedaOrigen: { select: { codigo: true, nombre: true, simbolo: true } },
          monedaDestino: { select: { codigo: true, nombre: true, simbolo: true } },
          usuario: { select: { id: true, nombre: true, username: true } },
        },
      });

      const movimientosServiciosExternos =
        await prisma.servicioExternoMovimiento.findMany({
          where: {
            punto_atencion_id: pointId,
            fecha: { gte, lt },
          },
          orderBy: { fecha: "asc" },
          take: limit,
          select: {
            id: true,
            fecha: true,
            servicio: true,
            tipo_movimiento: true,
            monto: true,
            metodo_ingreso: true,
            numero_referencia: true,
            descripcion: true,
            comprobante_url: true,
            billetes: true,
            monedas_fisicas: true,
            bancos: true,
            moneda: { select: { codigo: true, simbolo: true } },
            usuario: { select: { id: true, nombre: true, username: true } },
          },
        });

      const toNumber = (v: any) =>
        typeof v === "number" ? v : v?.toNumber ? v.toNumber() : Number(v);

      const upsertBalance = (
        map: Map<
          string,
          {
            codigo: string;
            nombre?: string;
            simbolo?: string;
            ingresos: number;
            egresos: number;
          }
        >,
        moneda:
          | { codigo: string; nombre?: string | null; simbolo?: string | null }
          | null
          | undefined,
        ingreso: number,
        egreso: number
      ) => {
        if (!moneda?.codigo) return;
        const codigo = moneda.codigo;
        const prev = map.get(codigo);
        if (!prev) {
          map.set(codigo, {
            codigo,
            nombre: moneda.nombre ?? undefined,
            simbolo: moneda.simbolo ?? undefined,
            ingresos: ingreso,
            egresos: egreso,
          });
          return;
        }
        prev.ingresos += ingreso;
        prev.egresos += egreso;
      };

      // 7. Balance (ingresos/egresos) por tipo y moneda, para cuadre rápido
      const balanceCambiosMap = new Map<
        string,
        {
          codigo: string;
          nombre?: string;
          simbolo?: string;
          ingresos: number;
          egresos: number;
        }
      >();

      for (const c of cambiosDivisas) {
        upsertBalance(
          balanceCambiosMap,
          c.monedaOrigen,
          toNumber(c.monto_origen || 0),
          0
        );
        upsertBalance(
          balanceCambiosMap,
          c.monedaDestino,
          0,
          toNumber(c.monto_destino || 0)
        );
      }

      const balanceServiciosMap = new Map<
        string,
        {
          codigo: string;
          nombre?: string;
          simbolo?: string;
          ingresos: number;
          egresos: number;
        }
      >();

      for (const m of movimientosServiciosExternos) {
        const codigo = m.moneda?.codigo;
        if (!codigo) continue;
        const tipo = String(m.tipo_movimiento);
        const monto = toNumber(m.monto || 0);

        const esIngreso =
          tipo === "INGRESO" ||
          tipo === "TRANSFERENCIA_ENTRANTE" ||
          tipo === "TRANSFERENCIA_DEVOLUCION";
        const esEgreso = tipo === "EGRESO" || tipo === "TRANSFERENCIA_SALIENTE";

        upsertBalance(
          balanceServiciosMap,
          { codigo, simbolo: m.moneda?.simbolo },
          esIngreso ? monto : 0,
          esEgreso ? monto : 0
        );
      }

      const sortBalanceRows = (a: any, b: any) => {
        if (a.moneda.codigo === "USD") return -1;
        if (b.moneda.codigo === "USD") return 1;
        return String(a.moneda.codigo).localeCompare(String(b.moneda.codigo));
      };

      const balanceCambios = Array.from(balanceCambiosMap.values())
        .map((r) => ({
          moneda: {
            codigo: r.codigo,
            nombre: r.nombre,
            simbolo: r.simbolo,
          },
          ingresos: r.ingresos,
          egresos: r.egresos,
          neto: r.ingresos - r.egresos,
        }))
        .sort(sortBalanceRows);

      const balanceServicios = Array.from(balanceServiciosMap.values())
        .map((r) => ({
          moneda: {
            codigo: r.codigo,
            nombre: r.nombre,
            simbolo: r.simbolo,
          },
          ingresos: r.ingresos,
          egresos: r.egresos,
          neto: r.ingresos - r.egresos,
        }))
        .sort(sortBalanceRows);

      return res.json({
        success: true,
        resumen: {
          fecha,
          punto_atencion_id: pointId,
          saldos_principales: saldosPrincipalesReconciliados,
          servicios_externos: Object.values(saldosServicios),
          total_transacciones: totalTransacciones,
          transacciones: {
            cambios_divisas: cambiosDivisas.map((c) => ({
              id: c.id,
              fecha: c.fecha,
              numero_recibo: c.numero_recibo,
              tipo_operacion: c.tipo_operacion,
              estado: c.estado,
              // En la UI: ORIGEN = lo que entrega el cliente; DESTINO = lo que recibe el cliente (sale del punto)
              moneda_origen: c.monedaOrigen
                ? {
                    codigo: c.monedaOrigen.codigo,
                    nombre: c.monedaOrigen.nombre,
                    simbolo: c.monedaOrigen.simbolo,
                  }
                : null,
              moneda_destino: c.monedaDestino
                ? {
                    codigo: c.monedaDestino.codigo,
                    nombre: c.monedaDestino.nombre,
                    simbolo: c.monedaDestino.simbolo,
                  }
                : null,
              monto_origen: toNumber(c.monto_origen),
              monto_destino: toNumber(c.monto_destino),
              tasa_cambio_billetes: toNumber(c.tasa_cambio_billetes),
              tasa_cambio_monedas: toNumber(c.tasa_cambio_monedas),
              metodo_entrega: c.metodo_entrega,
              metodo_pago_origen: c.metodo_pago_origen,
              transferencia_banco: c.transferencia_banco,
              transferencia_numero: c.transferencia_numero,
              observacion: c.observacion,
              usuario: c.usuario,
            })),
            servicios_externos: movimientosServiciosExternos.map((m) => ({
              id: m.id,
              fecha: m.fecha,
              servicio: m.servicio,
              tipo_movimiento: m.tipo_movimiento,
              moneda: m.moneda?.codigo,
              monto: toNumber(m.monto),
              metodo_ingreso: m.metodo_ingreso,
              numero_referencia: m.numero_referencia,
              descripcion: m.descripcion,
              comprobante_url: m.comprobante_url,
              billetes: m.billetes != null ? toNumber(m.billetes) : null,
              monedas_fisicas:
                m.monedas_fisicas != null ? toNumber(m.monedas_fisicas) : null,
              bancos: m.bancos != null ? toNumber(m.bancos) : null,
              usuario: m.usuario,
            })),
            limit,
          },
          balance: {
            cambios_divisas: {
              por_moneda: balanceCambios,
            },
            servicios_externos: {
              por_moneda: balanceServicios,
            },
          },
        },
      });
    } catch (error) {
      logger.error(
        "Error en GET /contabilidad-diaria/:pointId/:fecha/resumen-cierre",
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

/**
 * POST /api/contabilidad-diaria/:pointId/:fecha/cerrar
 * Marca el cierre del día como CERRADO usando el servicio unificado
 * Este endpoint ahora delega al servicio cierreService para garantizar
 * consistencia transaccional entre CuadreCaja y CierreDiario
 */
router.post(
  "/:pointId/:fecha/cerrar",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { pointId, fecha } = req.params;
      const { observaciones, diferencias_reportadas, detalles } =
        req.body || {};
      const usuario = req.user as
        | {
            id: string;
            punto_atencion_id?: string;
            rol?: RolUsuario;
          }
        | undefined;

      if (!usuario?.id) {
        return res
          .status(401)
          .json({ success: false, error: "No autenticado" });
      }
      if (!pointId) {
        return res.status(400).json({ success: false, error: "Falta pointId" });
      }

      // Seguridad: operadores solo pueden cerrar su propio punto
      const esAdmin =
        (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
      if (
        !esAdmin &&
        usuario?.punto_atencion_id &&
        usuario.punto_atencion_id !== pointId
      ) {
        return res.status(403).json({
          success: false,
          error: "No autorizado para cerrar otro punto de atención",
        });
      }

      // Valida YYYY-MM-DD (lanza si es inválida)
      gyeParseDateOnly(fecha);
      const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

      // Verificar si ya está cerrado (idempotencia)
      const estado = await cierreService.obtenerEstadoCierre(
        pointId,
        fechaDate
      );

      if (estado.existe && estado.estado === "CERRADO") {
        return res.status(200).json({
          success: true,
          info: "ya_cerrado",
          cierre: estado.cierre,
          mensaje: "El cierre de este día ya fue completado",
        });
      }

      // Si se proporcionan detalles, realizar cierre completo
      if (detalles && Array.isArray(detalles) && detalles.length > 0) {
        logger.info("🔄 Realizando cierre con detalles proporcionados", {
          punto: pointId,
          fecha,
          usuario: usuario.id,
          num_detalles: detalles.length,
        });

        const resultado = await cierreService.realizarCierreDiario({
          punto_atencion_id: pointId,
          usuario_id: usuario.id,
          fecha: fechaDate,
          detalles,
          observaciones,
          diferencias_reportadas,
        });

        if (!resultado.success) {
          return res.status(400).json(resultado);
        }

        return res.status(200).json({
          success: true,
          cierre: { id: resultado.cierre_id },
          cuadre_id: resultado.cuadre_id,
          jornada_finalizada: resultado.jornada_finalizada,
          mensaje: resultado.mensaje,
        });
      }

      // Si no se proporcionan detalles, usar el método antiguo (compatibilidad)
      // Este camino se mantiene para no romper integraciones existentes
      logger.info("🔄 Realizando cierre sin detalles (modo compatibilidad)", {
        punto: pointId,
        fecha,
        usuario: usuario.id,
      });

      // NOTA: La validación de servicios externos fue eliminada.
      // Los servicios externos ahora se incluyen automáticamente en el cierre diario
      // a través del endpoint /cuadre-caja que consolida todos los movimientos.

      // Crear o actualizar a CERRADO y verificar si se puede finalizar jornada
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.cierreDiario.findUnique({
          where: {
            fecha_punto_atencion_id: {
              fecha: fechaDate,
              punto_atencion_id: pointId,
            },
          },
        });

        let cierre;
        if (!existing) {
          cierre = await tx.cierreDiario.create({
            data: {
              punto_atencion_id: pointId,
              fecha: fechaDate,
              usuario_id: usuario.id,
              observaciones: observaciones ?? null,
              estado: "CERRADO",
              fecha_cierre: new Date(),
              cerrado_por: usuario.id,
              diferencias_reportadas: diferencias_reportadas ?? null,
            },
          });
        } else {
          // existe pero no está cerrado -> actualizar
          cierre = await tx.cierreDiario.update({
            where: {
              fecha_punto_atencion_id: {
                fecha: fechaDate,
                punto_atencion_id: pointId,
              },
            },
            data: {
              estado: "CERRADO",
              fecha_cierre: new Date(),
              cerrado_por: usuario.id,
              observaciones: observaciones ?? existing.observaciones,
              diferencias_reportadas:
                diferencias_reportadas ?? existing.diferencias_reportadas,
              updated_at: new Date(),
            },
          });
        }

        // Verificar si hay jornada activa para finalizar automáticamente
        logger.info("🔍 Buscando jornada activa para finalizar", {
          usuario_id: usuario.id,
          punto_atencion_id: pointId,
        });

        const jornadaActiva = await tx.jornada.findFirst({
          where: {
            usuario_id: usuario.id,
            punto_atencion_id: pointId,
            fecha_salida: null, // Jornada activa
          },
          orderBy: { fecha_inicio: "desc" },
        });

        logger.info("📋 Resultado búsqueda jornada", {
          jornadaEncontrada: !!jornadaActiva,
          jornadaId: jornadaActiva?.id,
          fechaInicio: jornadaActiva?.fecha_inicio,
        });

        let jornadaFinalizada = null;
        if (jornadaActiva) {
          // Finalizar la jornada automáticamente
          jornadaFinalizada = await tx.jornada.update({
            where: { id: jornadaActiva.id },
            data: {
              fecha_salida: new Date(),
              estado: "COMPLETADO",
              observaciones:
                "Jornada finalizada automáticamente tras completar cierre diario",
            },
          });

          logger.info("🎯 JORNADA_FINALIZADA_AUTOMATICAMENTE", {
            usuario: usuario.id,
            punto: pointId,
            jornada_id: jornadaActiva.id,
            cierre_id: cierre.id,
          });
        } else {
          logger.warn("⚠️ NO SE ENCONTRÓ JORNADA ACTIVA PARA FINALIZAR", {
            usuario_id: usuario.id,
            punto_atencion_id: pointId,
          });
        }

        return { cierre, jornadaFinalizada };
      });

      return res.status(200).json({
        success: true,
        cierre: result.cierre,
        jornada_finalizada: !!result.jornadaFinalizada,
        mensaje: result.jornadaFinalizada
          ? "Cierre diario completado y jornada finalizada automáticamente"
          : "Cierre diario completado",
      });
    } catch (error) {
      logger.error(
        "Error en POST /contabilidad-diaria/:pointId/:fecha/cerrar",
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

/**
 * POST /api/contabilidad-diaria/:pointId/:fecha/cerrar-completo
 * Nuevo endpoint optimizado que usa el servicio unificado de cierre
 * Espera recibir los detalles del cuadre ya validados por el frontend
 */
router.post(
  "/:pointId/:fecha/cerrar-completo",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { pointId, fecha } = req.params;
      const { detalles, observaciones } = req.body || {};
      const usuario = req.user as
        | {
            id: string;
            punto_atencion_id?: string;
            rol?: RolUsuario;
          }
        | undefined;

      if (!usuario?.id) {
        return res
          .status(401)
          .json({ success: false, error: "No autenticado" });
      }

      if (!pointId) {
        return res.status(400).json({ success: false, error: "Falta pointId" });
      }

      if (!detalles || !Array.isArray(detalles)) {
        return res.status(400).json({
          success: false,
          error: "Se requieren los detalles del cuadre",
        });
      }

      // Seguridad: operadores solo pueden cerrar su propio punto
      const esAdmin =
        (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
      if (
        !esAdmin &&
        usuario?.punto_atencion_id &&
        usuario.punto_atencion_id !== pointId
      ) {
        return res.status(403).json({
          success: false,
          error: "No autorizado para cerrar otro punto de atención",
        });
      }

      // Validar fecha
      gyeParseDateOnly(fecha);
      const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

      logger.info("🔄 Iniciando cierre completo", {
        punto: pointId,
        fecha,
        usuario: usuario.id,
        num_detalles: detalles.length,
      });

      // Realizar cierre usando el servicio unificado
      const resultado = await cierreService.realizarCierreDiario({
        punto_atencion_id: pointId,
        usuario_id: usuario.id,
        fecha: fechaDate,
        detalles,
        observaciones,
      });

      if (!resultado.success) {
        logger.warn("⚠️ Cierre rechazado", {
          punto: pointId,
          fecha,
          error: resultado.error,
          codigo: resultado.codigo,
        });
        return res.status(400).json(resultado);
      }

      logger.info("✅ Cierre completado exitosamente", {
        cierre_id: resultado.cierre_id,
        cuadre_id: resultado.cuadre_id,
        punto: pointId,
        fecha,
        jornada_finalizada: resultado.jornada_finalizada,
      });

      return res.status(200).json(resultado);
    } catch (error) {
      logger.error("Error en POST /contabilidad-diaria/cerrar-completo", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

/**
 * GET /api/contabilidad-diaria/:pointId/:fecha/resumen-cierre
 * Obtiene el resumen de movimientos preparado para el cierre
 */
router.get(
  "/:pointId/:fecha/resumen-cierre",
  authenticateToken,
  async (req, res) => {
    try {
      const { pointId, fecha } = req.params;
      const usuario = req.user as
        | {
            id: string;
            punto_atencion_id?: string;
            rol?: RolUsuario;
          }
        | undefined;

      if (!usuario?.id) {
        return res
          .status(401)
          .json({ success: false, error: "No autenticado" });
      }

      if (!pointId) {
        return res.status(400).json({ success: false, error: "Falta pointId" });
      }

      // Seguridad: operadores solo pueden consultar su propio punto
      const esAdmin =
        (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
      
      // Si es operador, debe tener acceso al punto
      if (!esAdmin) {
        // Si no es admin, verificar que sea operador del punto
        if (!usuario?.punto_atencion_id || usuario.punto_atencion_id !== pointId) {
          return res.status(403).json({
            success: false,
            error: "No autorizado para consultar otro punto de atención",
          });
        }
      }

      // Validar fecha
      gyeParseDateOnly(fecha);
      const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

      // Verificar si ya existe un cierre
      const estadoCierre = await cierreService.obtenerEstadoCierre(
        pointId,
        fechaDate
      );

      if (estadoCierre.existe && estadoCierre.estado === "CERRADO") {
        return res.status(200).json({
          success: true,
          cerrado: true,
          mensaje: "El cierre de este día ya fue completado",
          cierre: estadoCierre.cierre,
        });
      }

      // Obtener resumen de movimientos
      const resumen = await cierreService.obtenerResumenMovimientos(
        pointId,
        fechaDate,
        usuario.id
      );

      if (!resumen.success) {
        return res.status(500).json(resumen);
      }

      return res.status(200).json({
        ...resumen,
        cerrado: false,
      });
    } catch (error) {
      logger.error("Error en GET /contabilidad-diaria/resumen-cierre", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

/**
 * POST /api/contabilidad-diaria/:pointId/:fecha/cerrar-completo
 * Realiza el cierre diario completo del punto de atención
 */
router.post(
  "/:pointId/:fecha/cerrar-completo",
  authenticateToken,
  async (req, res) => {
    try {
      const { pointId, fecha } = req.params;
      const { detalles, observaciones } = req.body;
      const usuario = req.user as
        | {
            id: string;
            punto_atencion_id?: string;
            rol?: string;
          }
        | undefined;

      if (!pointId || !fecha) {
        return res.status(400).json({
          success: false,
          error: "Falta pointId o fecha",
        });
      }

      if (!Array.isArray(detalles) || detalles.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Debe proporcionar detalles del cuadre",
        });
      }

      // Validar permisos
      const esAdmin =
        (usuario?.rol === "ADMIN" || usuario?.rol === "SUPER_USUARIO") ?? false;
      if (
        !esAdmin &&
        usuario?.punto_atencion_id &&
        usuario.punto_atencion_id !== pointId
      ) {
        return res.status(403).json({
          success: false,
          error: "No autorizado para cerrar otro punto de atención",
        });
      }

      // Validar YYYY-MM-DD
      gyeParseDateOnly(fecha);
      const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

      // Buscar cuadre abierto del día
      const cuadreAbierto = await prisma.cuadreCaja.findFirst({
        where: {
          punto_atencion_id: pointId,
          fecha: { gte: new Date(fecha + "T00:00:00.000Z") },
          estado: "ABIERTO",
        },
      });

      if (!cuadreAbierto) {
        return res.status(400).json({
          success: false,
          error: "No hay cuadre abierto para esta fecha",
        });
      }

      // Actualizar cuadre a CERRADO
      const cuadreCerrado = await prisma.cuadreCaja.update({
        where: { id: cuadreAbierto.id },
        data: {
          estado: "CERRADO",
          fecha_cierre: new Date(),
          observaciones: observaciones || "",
        },
      });

      // Actualizar o crear detalles del cuadre
      for (const detalle of detalles) {
        const detalleExistente = await prisma.detalleCuadreCaja.findFirst({
          where: {
            cuadre_id: cuadreAbierto.id,
            moneda_id: detalle.moneda_id,
          },
        });

        if (detalleExistente) {
          await prisma.detalleCuadreCaja.update({
            where: { id: detalleExistente.id },
            data: {
              conteo_fisico: detalle.conteo_fisico,
              billetes: detalle.billetes || 0,
              monedas_fisicas: detalle.monedas_fisicas || 0,
              diferencia:
                detalle.conteo_fisico - detalle.saldo_cierre_teorico || 0,
              observaciones_detalle: detalle.observaciones_detalle || "",
            },
          });
        } else {
          // Crear nuevo detalle si no existe
          await prisma.detalleCuadreCaja.create({
            data: {
              cuadre_id: cuadreAbierto.id,
              moneda_id: detalle.moneda_id,
              saldo_apertura: detalle.saldo_apertura || 0,
              saldo_cierre: detalle.saldo_cierre_teorico || 0,
              conteo_fisico: detalle.conteo_fisico,
              billetes: detalle.billetes || 0,
              monedas_fisicas: detalle.monedas_fisicas || 0,
              diferencia:
                detalle.conteo_fisico - (detalle.saldo_cierre_teorico || 0),
              observaciones_detalle: detalle.observaciones_detalle || "",
            },
          });
        }
      }

      logger.info("✅ Cierre diario completado", {
        cuadre_id: cuadreCerrado.id,
        punto_atencion_id: pointId,
        usuario_id: usuario?.id,
        fecha,
      });

      return res.status(200).json({
        success: true,
        cierre_id: cuadreCerrado.id,
        cuadre_id: cuadreCerrado.id,
        mensaje: "Cierre diario completado exitosamente",
        jornada_finalizada: true,
      });
    } catch (error) {
      logger.error("Error en POST /contabilidad-diaria/cerrar-completo", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

export default router;
