import express from "express";
import type { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import saldoValidation from "../middleware/saldoValidation.js";
import prisma from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import {
  todayGyeDateOnly,
  gyeDayRangeUtcFromDateOnly,
} from "../utils/timezone.js";
import {
  registrarMovimientoSaldo,
  TipoMovimiento,
  TipoReferencia,
} from "../services/movimientoSaldoService.js";

const router = express.Router();

/** Utils numéricos */
const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return Number(v);
  const raw = v.trim();
  if (!raw) return NaN;
  // 1.234,56 -> 1234.56
  if (/^\d{1,3}(\.\d{3})+,\d{1,6}$/.test(raw))
    return Number(raw.replace(/\./g, "").replace(",", "."));
  // 1,234.56 -> 1234.56
  if (/^\d{1,3}(,\d{3})+\.\d{1,6}$/.test(raw))
    return Number(raw.replace(/,/g, ""));
  // 1234,56 -> 1234.56
  if (/^\d+(,\d{1,6})$/.test(raw)) return Number(raw.replace(",", "."));
  return Number(raw.replace(",", "."));
};
// Redondeo seguro con EPSILON para evitar problemas de punto flotante
const n2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ============================================================================
   GET /:pointId
   Historial de movimientos contables (MovimientoSaldo) por punto
   Soporta: ?date=YYYY-MM-DD o ?from=YYYY-MM-DD&to=YYYY-MM-DD
            &moneda_id=<uuid> &limit=50
============================================================================ */
router.get(
  "/:pointId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { pointId } = req.params;
      const { limit = 50, moneda_id } = req.query as {
        limit?: string;
        moneda_id?: string;
        date?: string;
        from?: string;
        to?: string;
      };

      // Rango de fechas (zona GYE) por día específico o rango
      let gte: Date;
      let lt: Date;
      const date = (req.query as any).date as string | undefined;
      const from = (req.query as any).from as string | undefined;
      const to = (req.query as any).to as string | undefined;

      if (from || to) {
        const fromStr = (from || (to as string)) as string;
        const toStr = (to || (from as string)) as string;
        ({ gte } = gyeDayRangeUtcFromDateOnly(fromStr));
        ({ lt } = gyeDayRangeUtcFromDateOnly(toStr));
      } else {
        const d = date || todayGyeDateOnly();
        ({ gte, lt } = gyeDayRangeUtcFromDateOnly(d));
      }

      const take = Math.min(
        Math.max(parseInt(String(limit), 10) || 50, 1),
        500
      );

      const movimientos = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: pointId,
          fecha: { gte, lt },
          ...(moneda_id ? { moneda_id } : {}),
        },
        orderBy: { fecha: "desc" },
        take,
        include: {
          moneda: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          usuario: { select: { id: true, nombre: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
        },
      });

      const payload = movimientos.map((ms) => ({
        id: ms.id,
        tipo_movimiento: ms.tipo_movimiento,
        monto: parseFloat(ms.monto.toString()),
        saldo_anterior: parseFloat(ms.saldo_anterior.toString()),
        saldo_nuevo: parseFloat(ms.saldo_nuevo.toString()),
        descripcion: ms.descripcion ?? undefined,
        fecha: ms.fecha, // si prefieres ISO: ms.fecha.toISOString()
        moneda_id: ms.moneda_id,
        usuario_id: ms.usuario_id,
        punto_atencion_id: ms.punto_atencion_id,
        referencia_id: ms.referencia_id ?? undefined,
        tipo_referencia: ms.tipo_referencia ?? undefined,
        moneda_codigo: ms.moneda.codigo,
        moneda: {
          id: ms.moneda.id,
          nombre: ms.moneda.nombre,
          codigo: ms.moneda.codigo,
          simbolo: ms.moneda.simbolo,
        },
        usuario: {
          id: ms.usuario.id,
          nombre: ms.usuario.nombre,
        },
        puntoAtencion: {
          id: ms.puntoAtencion.id,
          nombre: ms.puntoAtencion.nombre,
        },
      }));

      res.json({ success: true, movimientos: payload });
    } catch (error) {
      console.error("Error al obtener movimientos contables (Prisma):", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/* ============================================================================
   POST /validar-saldo
   Body: { punto_atencion_id, moneda_id, monto_requerido }
============================================================================ */
router.post(
  "/validar-saldo",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { punto_atencion_id, moneda_id, monto_requerido } = req.body ?? {};

      if (
        !punto_atencion_id ||
        !moneda_id ||
        monto_requerido === undefined ||
        monto_requerido === null
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Faltan parámetros requeridos" });
      }

      const montoReq = toNumber(monto_requerido);
      if (!Number.isFinite(montoReq) || montoReq < 0) {
        return res
          .status(400)
          .json({ success: false, message: "monto_requerido inválido" });
      }

      // @@unique([punto_atencion_id, moneda_id]) -> clave compuesta
      const saldo = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: { punto_atencion_id, moneda_id },
        },
        select: { cantidad: true },
      });

      const saldo_actual = saldo ? parseFloat(saldo.cantidad.toString()) : 0;
      const valido = saldo_actual >= montoReq;

      res.json({
        success: true,
        valido,
        saldo_actual,
        mensaje: valido
          ? "Saldo suficiente"
          : `Saldo insuficiente. Disponible: ${saldo_actual}, Requerido: ${montoReq}`,
      });
    } catch (error) {
      console.error("Error al validar saldo (Prisma):", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/* ============================================================================
   POST /procesar-cambio
   Body: {
     cambio_id: string,
     movimientos: Array<{
       punto_atencion_id: string,
       moneda_id: string,
       tipo_movimiento: 'INGRESO' | 'EGRESO',
       monto: number|string,
       usuario_id: string,
       referencia_id?: string|null,
       tipo_referencia?: string|null,
       descripcion?: string|null
     }>
   }
   - Transaccional
   - Registra MovimientoSaldo
   - Actualiza Saldo (cantidad, billetes, monedas_fisicas)
   - Valida no dejar saldos negativos (cantidad y conteo físico en EGRESO)
============================================================================ */
router.post(
  "/procesar-cambio",
  authenticateToken,
  saldoValidation.validarSaldoSuficiente,
  async (req: Request, res: Response) => {
    try {
      const { cambio_id, movimientos } = req.body ?? {};

      if (
        !cambio_id ||
        !Array.isArray(movimientos) ||
        movimientos.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Faltan parámetros requeridos o formato inválido",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Traer info de CambioDivisa necesaria para los ajustes físicos
        const cambio = await tx.cambioDivisa.findUnique({
          where: { id: String(cambio_id) },
          select: {
            id: true,
            moneda_origen_id: true,
            moneda_destino_id: true,
            divisas_entregadas_billetes: true,
            divisas_entregadas_monedas: true,
            divisas_recibidas_billetes: true,
            divisas_recibidas_monedas: true,
          },
        });

        if (!cambio) {
          throw new Error(
            "Cambio no encontrado para procesar movimientos contables"
          );
        }

        const saldos_actualizados: Array<{
          moneda_id: string;
          saldo_anterior: number;
          saldo_nuevo: number;
          tipo_movimiento: string;
          monto: number;
        }> = [];

        for (const mov of movimientos as Array<{
          punto_atencion_id: string;
          moneda_id: string;
          tipo_movimiento: "INGRESO" | "EGRESO";
          monto: number | string;
          usuario_id: string;
          referencia_id?: string | null;
          tipo_referencia?: string | null;
          descripcion?: string | null;
        }>) {
          const punto_atencion_id = String(mov.punto_atencion_id);
          const moneda_id = String(mov.moneda_id);
          const tipo_movimiento = mov.tipo_movimiento;
          const montoNum = n2(toNumber(mov.monto));
          const usuario_id = String(mov.usuario_id);
          const referencia_id = mov.referencia_id ?? null;
          const tipo_referencia = mov.tipo_referencia ?? null;
          const descripcion = mov.descripcion ?? null;

          if (!Number.isFinite(montoNum) || montoNum <= 0) {
            throw new Error("Monto inválido en movimiento");
          }

          // Leer saldo actual
          const saldoActual = await tx.saldo.findUnique({
            where: {
              punto_atencion_id_moneda_id: { punto_atencion_id, moneda_id },
            },
            select: {
              id: true,
              cantidad: true,
              billetes: true,
              monedas_fisicas: true,
            },
          });

          const cantidadActual = new Prisma.Decimal(saldoActual?.cantidad ?? 0);
          const billetesActual = new Prisma.Decimal(saldoActual?.billetes ?? 0);
          const monedasActual = new Prisma.Decimal(
            saldoActual?.monedas_fisicas ?? 0
          );

          const deltaCantidad =
            tipo_movimiento === "INGRESO" ? montoNum : -montoNum;

          // Ajustes físicos según moneda vs cambio
          let deltaBilletes = 0;
          let deltaMonedasFisicas = 0;

          if (moneda_id === cambio.moneda_destino_id) {
            // Moneda que sale al cliente (egreso físico)
            deltaBilletes = -Number(cambio.divisas_recibidas_billetes || 0);
            deltaMonedasFisicas = -Number(
              cambio.divisas_recibidas_monedas || 0
            );
          } else if (moneda_id === cambio.moneda_origen_id) {
            // Moneda que entra desde el cliente (ingreso físico)
            deltaBilletes = Number(cambio.divisas_entregadas_billetes || 0);
            deltaMonedasFisicas = Number(
              cambio.divisas_entregadas_monedas || 0
            );
          }

          // Nuevos valores calculados
          const nuevaCantidad = cantidadActual.add(
            new Prisma.Decimal(deltaCantidad)
          );
          const nuevosBilletes = billetesActual.add(
            new Prisma.Decimal(deltaBilletes)
          );
          const nuevasMonedas = monedasActual.add(
            new Prisma.Decimal(deltaMonedasFisicas)
          );

          // Validaciones: evitar negativos
          if (tipo_movimiento === "EGRESO") {
            if (nuevaCantidad.lessThan(0)) {
              throw new Error(
                `Saldo insuficiente. Disponible: ${cantidadActual.toFixed(
                  2
                )}, Requerido: ${montoNum.toFixed(2)}`
              );
            }
            if (nuevosBilletes.lessThan(0) || nuevasMonedas.lessThan(0)) {
              throw new Error(
                "Saldo físico insuficiente (billetes/monedas) para realizar el egreso"
              );
            }
          }

          // Registrar MovimientoSaldo usando servicio centralizado
          const tipoMov =
            tipo_movimiento === "INGRESO"
              ? TipoMovimiento.INGRESO
              : tipo_movimiento === "EGRESO"
              ? TipoMovimiento.EGRESO
              : TipoMovimiento.AJUSTE;

          const tipoRef =
            tipo_referencia === "EXCHANGE"
              ? TipoReferencia.EXCHANGE
              : tipo_referencia === "TRANSFER"
              ? TipoReferencia.TRANSFER
              : tipo_referencia === "SERVICIO_EXTERNO"
              ? TipoReferencia.SERVICIO_EXTERNO
              : TipoReferencia.AJUSTE_MANUAL;

          await registrarMovimientoSaldo(
            {
              puntoAtencionId: punto_atencion_id,
              monedaId: moneda_id,
              tipoMovimiento: tipoMov,
              monto: montoNum, // ⚠️ Pasar monto POSITIVO, el servicio aplica el signo
              saldoAnterior: cantidadActual,
              saldoNuevo: nuevaCantidad,
              tipoReferencia: tipoRef,
              referenciaId: referencia_id || undefined,
              descripcion: descripcion || undefined,
              usuarioId: usuario_id,
            },
            tx
          ); // ⚠️ Pasar el cliente de transacción para atomicidad

          // Upsert de Saldo
          if (saldoActual?.id) {
            await tx.saldo.update({
              where: { id: saldoActual.id },
              data: {
                cantidad: nuevaCantidad,
                billetes: nuevosBilletes,
                monedas_fisicas: nuevasMonedas,
              },
            });
          } else {
            await tx.saldo.create({
              data: {
                punto_atencion_id,
                moneda_id,
                cantidad: nuevaCantidad,
                billetes: nuevosBilletes,
                monedas_fisicas: nuevasMonedas,
              },
            });
          }

          saldos_actualizados.push({
            moneda_id,
            saldo_anterior: parseFloat(cantidadActual.toString()),
            saldo_nuevo: parseFloat(nuevaCantidad.toString()),
            tipo_movimiento,
            monto: montoNum,
          });
        }

        return saldos_actualizados;
      });

      res.json({
        success: true,
        saldos_actualizados: result,
        message: "Movimientos contables procesados exitosamente",
      });
    } catch (error) {
      console.error("Error al procesar movimientos contables (Prisma):", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

export default router;
