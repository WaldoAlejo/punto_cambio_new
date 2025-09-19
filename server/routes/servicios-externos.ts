import express, { Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { pool } from "../lib/database.js";
import { randomUUID } from "crypto";

const router = express.Router();

/** === Tipos auxiliares para afinar TS (evita TS18048) === */
type RolUsuario =
  | "OPERADOR"
  | "ADMIN"
  | "SUPER_USUARIO"
  | "ADMINISTRATIVO"
  | "CONCESION";
interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  punto_atencion_id: string | null;
}
type AuthedRequest = Request & { user: AuthenticatedUser };

/** Type guard: asegura que req.user existe y es OPERADOR */
function isOperador(
  req: Request
): req is AuthedRequest & { user: AuthenticatedUser & { rol: "OPERADOR" } } {
  return !!(req as any).user && (req as any).user.rol === "OPERADOR";
}

/** Servicios válidos (recuerda actualizar enum ServicioExterno en Prisma si agregas nuevos) */
const SERVICIOS_VALIDOS = [
  "YAGANASTE",
  "BANCO_GUAYAQUIL",
  "WESTERN",
  "PRODUBANCO",
  "BANCO_PACIFICO",
  // Categorías de insumos y misceláneos
  "INSUMOS_OFICINA",
  "INSUMOS_LIMPIEZA",
  "OTROS", // <- "OTROS" ahora permite INGRESO y EGRESO
] as const;
type ServicioExterno = (typeof SERVICIOS_VALIDOS)[number];

const TIPOS_VALIDOS = ["INGRESO", "EGRESO"] as const;
type TipoMovimiento = (typeof TIPOS_VALIDOS)[number];

/** Utilidad: asegurar ID de moneda USD (autocuración si no existe, sin depender de UNIQUE) */
async function ensureUsdMonedaId(client: any): Promise<string> {
  // 1) intentar obtener USD
  const sel = await client.query(
    'SELECT id FROM "Moneda" WHERE codigo = $1 LIMIT 1',
    ["USD"]
  );
  if (sel.rows[0]?.id) return sel.rows[0].id as string;

  // 2) crear USD si no existe
  await client.query(`
    INSERT INTO "Moneda"(nombre, simbolo, codigo, activo, orden_display, comportamiento_compra, comportamiento_venta)
    SELECT 'Dólar estadounidense', '$', 'USD', true, 0, 'MULTIPLICA', 'DIVIDE'
    WHERE NOT EXISTS (SELECT 1 FROM "Moneda" WHERE codigo = 'USD');
  `);

  // 3) reintentar obtener USD
  const sel2 = await client.query(
    'SELECT id FROM "Moneda" WHERE codigo = $1 LIMIT 1',
    ["USD"]
  );
  if (!sel2.rows[0]?.id) {
    throw new Error("No se pudo crear/obtener la moneda USD");
  }
  return sel2.rows[0].id as string;
}

/** ==============================
 *  POST /servicios-externos/movimientos
 *  Crea un movimiento de servicio externo (solo OPERADOR)
 *  ============================== */
router.post(
  "/movimientos",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!isOperador(req)) {
        res.status(403).json({
          success: false,
          message: "Permisos insuficientes (solo OPERADOR)",
        });
        return;
      }

      const {
        servicio,
        tipo_movimiento,
        monto,
        descripcion,
        numero_referencia,
        comprobante_url,
      } = req.body as {
        servicio?: ServicioExterno;
        tipo_movimiento?: TipoMovimiento;
        monto?: number | string;
        descripcion?: string;
        numero_referencia?: string;
        comprobante_url?: string;
      };

      const puntoId = (req as any).user?.punto_atencion_id as
        | string
        | null
        | undefined;

      if (!puntoId) {
        res.status(400).json({
          success: false,
          message:
            "Debes iniciar una jornada y tener un punto de atención asignado para registrar movimientos.",
        });
        return;
      }

      if (!servicio || !SERVICIOS_VALIDOS.includes(servicio)) {
        res.status(400).json({ success: false, message: "servicio inválido" });
        return;
      }
      if (!tipo_movimiento || !TIPOS_VALIDOS.includes(tipo_movimiento)) {
        res
          .status(400)
          .json({ success: false, message: "tipo_movimiento inválido" });
        return;
      }
      const montoNum =
        typeof monto === "string" ? parseFloat(monto) : Number(monto);
      if (!isFinite(montoNum) || montoNum <= 0) {
        res
          .status(400)
          .json({ success: false, message: "monto debe ser un número > 0" });
        return;
      }

      // Forzar EGRESO **solo** para Insumos (OTROS ya NO se fuerza)
      const esInsumo = ["INSUMOS_OFICINA", "INSUMOS_LIMPIEZA"].includes(
        servicio
      );
      if (esInsumo && tipo_movimiento !== "EGRESO") {
        res.status(400).json({
          success: false,
          message:
            "Los movimientos de Insumos (Oficina/Limpieza) deben registrarse como EGRESO.",
        });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Asegura la moneda USD disponible
        const usdId = await ensureUsdMonedaId(client);

        // Obtener saldo actual USD del punto (lock row)
        const saldoQ = await client.query(
          'SELECT id, cantidad FROM "Saldo" WHERE punto_atencion_id = $1 AND moneda_id = $2 FOR UPDATE',
          [puntoId, usdId]
        );
        const saldoAnterior = saldoQ.rows.length
          ? parseFloat(saldoQ.rows[0].cantidad)
          : 0;

        // Calcular saldo nuevo (INGRESO suma, EGRESO resta)
        const delta = tipo_movimiento === "INGRESO" ? montoNum : -montoNum;
        const saldoNuevo = saldoAnterior + delta;

        // Upsert saldo (con id generado por si la tabla no tiene default)
        if (saldoQ.rows.length) {
          await client.query(
            'UPDATE "Saldo" SET cantidad = $1, updated_at = NOW() WHERE id = $2',
            [saldoNuevo, saldoQ.rows[0].id]
          );
        } else {
          const saldoId = randomUUID();
          await client.query(
            'INSERT INTO "Saldo"(id, punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas, updated_at) VALUES($1,$2,$3,$4,0,0,NOW())',
            [saldoId, puntoId, usdId, saldoNuevo]
          );
        }

        // Insert movimiento de servicio externo (con id generado)
        const servicioMovimientoId = randomUUID();
        await client.query(
          `INSERT INTO "ServicioExternoMovimiento"
            (id, punto_atencion_id, servicio, tipo_movimiento, moneda_id, monto, usuario_id, fecha, descripcion, numero_referencia, comprobante_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10)`,
          [
            servicioMovimientoId,
            puntoId,
            servicio,
            tipo_movimiento,
            usdId,
            montoNum,
            (req as any).user.id,
            descripcion || null,
            numero_referencia || null,
            comprobante_url || null,
          ]
        );

        // Insert movimiento de saldo (trazabilidad) con id generado
        const movSaldoId = randomUUID();
        await client.query(
          `INSERT INTO "MovimientoSaldo"
            (id, punto_atencion_id, moneda_id, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, usuario_id, referencia_id, tipo_referencia, descripcion, fecha, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SERVICIO_EXTERNO',$10,NOW(),NOW())`,
          [
            movSaldoId,
            puntoId,
            usdId,
            tipo_movimiento, // guardamos literal
            montoNum,
            saldoAnterior,
            saldoNuevo,
            (req as any).user.id,
            servicioMovimientoId,
            descripcion || null,
          ]
        );

        await client.query("COMMIT");

        res.status(201).json({
          success: true,
          movimiento: {
            id: servicioMovimientoId,
            punto_atencion_id: puntoId,
            servicio,
            tipo_movimiento,
            moneda_id: usdId,
            monto: montoNum,
            usuario_id: (req as any).user.id,
            usuario: {
              id: (req as any).user.id,
              nombre: (req as any).user.nombre,
            },
            fecha: new Date().toISOString(),
            descripcion: descripcion || null,
            numero_referencia: numero_referencia || null,
            comprobante_url: comprobante_url || null,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: saldoNuevo,
          },
        });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error creando movimiento de servicios externos:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/** ==============================
 *  GET /servicios-externos/movimientos/:pointId
 *  Lista movimientos del punto (solo OPERADOR del punto asignado)
 *  Filtros: ?servicio=...&tipo_movimiento=...&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&limit=100
 *  ============================== */
router.get(
  "/movimientos/:pointId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!isOperador(req)) {
        res.status(403).json({
          success: false,
          message: "Permisos insuficientes (solo OPERADOR)",
        });
        return;
      }

      const puntoAsignado = (req as any).user?.punto_atencion_id as
        | string
        | null
        | undefined;
      if (!puntoAsignado) {
        res.status(400).json({
          success: false,
          message:
            "Debes iniciar una jornada y tener un punto de atención asignado para consultar movimientos.",
        });
        return;
      }

      const { pointId } = req.params;
      if (pointId !== puntoAsignado) {
        res.status(403).json({
          success: false,
          message:
            "Solo puedes consultar movimientos del punto de atención asignado.",
        });
        return;
      }

      const { servicio, tipo_movimiento, desde, hasta, limit } = req.query as {
        servicio?: ServicioExterno;
        tipo_movimiento?: TipoMovimiento;
        desde?: string;
        hasta?: string;
        limit?: string;
      };

      const where: string[] = [`m.punto_atencion_id = $1`];
      const params: any[] = [pointId];
      let i = 2;

      if (servicio && SERVICIOS_VALIDOS.includes(servicio)) {
        where.push(`m.servicio = $${i++}`);
        params.push(servicio);
      }
      if (tipo_movimiento && TIPOS_VALIDOS.includes(tipo_movimiento)) {
        where.push(`m.tipo_movimiento = $${i++}`);
        params.push(tipo_movimiento);
      }
      if (desde) {
        where.push(`m.fecha >= $${i++}`);
        params.push(new Date(`${desde}T00:00:00.000Z`));
      }
      if (hasta) {
        where.push(`m.fecha <= $${i++}`);
        params.push(new Date(`${hasta}T23:59:59.999Z`));
      }

      const limitNum = Math.min(Math.max(parseInt(limit || "100", 10), 1), 500);

      const sql = `
        SELECT
          m.id, m.punto_atencion_id, m.servicio, m.tipo_movimiento, m.moneda_id, m.monto,
          m.usuario_id, m.fecha, m.descripcion, m.numero_referencia, m.comprobante_url,
          u.nombre AS usuario_nombre
        FROM "ServicioExternoMovimiento" m
        JOIN "Usuario" u ON u.id = m.usuario_id
        WHERE ${where.join(" AND ")}
        ORDER BY m.fecha DESC
        LIMIT ${limitNum}
      `;

      const client = await pool.connect();
      const { rows } = await client.query(sql, params);
      client.release();

      const movimientos = rows.map((row: any) => ({
        id: row.id,
        punto_atencion_id: row.punto_atencion_id,
        servicio: row.servicio,
        tipo_movimiento: row.tipo_movimiento,
        moneda_id: row.moneda_id,
        monto: Number(row.monto),
        usuario_id: row.usuario_id,
        fecha: new Date(row.fecha).toISOString(),
        descripcion: row.descripcion,
        numero_referencia: row.numero_referencia,
        comprobante_url: row.comprobante_url,
        usuario: { id: row.usuario_id, nombre: row.usuario_nombre },
      }));

      res.json({ success: true, movimientos });
    } catch (error) {
      console.error("Error listando movimientos de servicios externos:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/** ==============================
 *  DELETE /servicios-externos/movimientos/:id
 *  Elimina un movimiento de servicio externo (solo ADMIN/SUPER_USUARIO)
 *  - Revierte el saldo con un ajuste inverso
 *  ============================== */
router.delete(
  "/movimientos/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      await client.query("BEGIN");

      // Obtener movimiento y datos necesarios
      const sel = await client.query(
        `SELECT id, punto_atencion_id, moneda_id, monto, tipo_movimiento, usuario_id, fecha
         FROM "ServicioExternoMovimiento" WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (sel.rows.length === 0) {
        await client.query("ROLLBACK");
        res
          .status(404)
          .json({ success: false, error: "Movimiento no encontrado" });
        return;
      }
      const mov = sel.rows[0];

      // Restringir a movimientos del mismo día (zona GYE)
      try {
        const { gyeDayRangeUtcFromDate } = await import("../utils/timezone.js");
        const { gte, lt } = gyeDayRangeUtcFromDate(new Date());
        const fecha = new Date(mov.fecha);
        if (!(fecha >= gte && fecha < lt)) {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            error: "Solo se pueden eliminar movimientos del día actual",
          });
          return;
        }
      } catch (e) {
        await client.query("ROLLBACK");
        res.status(400).json({
          success: false,
          error: "Restricción de día no disponible. Intente más tarde.",
        });
        return;
      }

      // Obtener saldo actual
      const saldoQ = await client.query(
        'SELECT id, cantidad FROM "Saldo" WHERE punto_atencion_id = $1 AND moneda_id = $2 FOR UPDATE',
        [mov.punto_atencion_id, mov.moneda_id]
      );
      const saldoAnterior = saldoQ.rows.length
        ? parseFloat(saldoQ.rows[0].cantidad)
        : 0;

      // Calcular ajuste inverso: si fue INGRESO, ahora restamos; si fue EGRESO, ahora sumamos
      const delta =
        mov.tipo_movimiento === "INGRESO"
          ? -Number(mov.monto)
          : Number(mov.monto);
      const saldoNuevo = Math.max(0, saldoAnterior + delta);

      if (saldoQ.rows.length) {
        await client.query(
          'UPDATE "Saldo" SET cantidad = $1, updated_at = NOW() WHERE id = $2',
          [saldoNuevo, saldoQ.rows[0].id]
        );
      } else {
        const saldoId = randomUUID();
        await client.query(
          'INSERT INTO "Saldo"(id, punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas, updated_at) VALUES($1,$2,$3,$4,0,0,NOW())',
          [saldoId, mov.punto_atencion_id, mov.moneda_id, saldoNuevo]
        );
      }

      // Registrar ajuste en MovimientoSaldo
      const movSaldoId = randomUUID();
      await client.query(
        `INSERT INTO "MovimientoSaldo"
          (id, punto_atencion_id, moneda_id, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, usuario_id, referencia_id, tipo_referencia, descripcion, fecha, created_at)
         VALUES ($1,$2,$3,'AJUSTE',$4,$5,$6,$7,$8,'SERVICIO_EXTERNO',$9,NOW(),NOW())`,
        [
          movSaldoId,
          mov.punto_atencion_id,
          mov.moneda_id,
          delta,
          saldoAnterior,
          saldoNuevo,
          (req as any).user.id,
          mov.id,
          `Reverso eliminación servicio externo ${mov.tipo_movimiento}`,
        ]
      );

      // Eliminar movimiento
      await client.query(
        'DELETE FROM "ServicioExternoMovimiento" WHERE id = $1',
        [id]
      );

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(
        "Error eliminando movimiento de servicios externos:",
        error
      );
      res
        .status(500)
        .json({ success: false, error: "No se pudo eliminar el movimiento" });
    } finally {
      client.release();
    }
  }
);

export default router;
