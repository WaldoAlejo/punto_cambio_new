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

/** ==============================
 *  GET /servicios-externos/admin/movimientos
 *  Lista movimientos (admin) opcionalmente filtrando por punto y otros filtros
 *  Roles: ADMIN, SUPER_USUARIO
 *  ============================== */
router.get(
  "/admin/movimientos",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { pointId, servicio, tipo_movimiento, desde, hasta, limit } =
        req.query as {
          pointId?: string;
          servicio?: ServicioExterno;
          tipo_movimiento?: TipoMovimiento;
          desde?: string;
          hasta?: string;
          limit?: string;
        };

      const where: string[] = [];
      const params: any[] = [];
      let i = 1;

      if (pointId && pointId !== "ALL") {
        where.push(`m.punto_atencion_id = $${i++}`);
        params.push(pointId);
      }
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
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY m.fecha DESC
        LIMIT ${limitNum}
      `;

      const { rows } = await client.query(sql, params);

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
      console.error(
        "Error listando movimientos de servicios externos (admin):",
        error
      );
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      client.release();
    }
  }
);

/** ==============================
 *  POST /servicios-externos/cierre/abrir
 *  Abre el cierre diario (crea registro ABIERTO si no existe) — USD only
 *  Roles: OPERADOR (solo su punto), ADMIN, SUPER_USUARIO, ADMINISTRATIVO
 *  ============================== */
router.post(
  "/cierre/abrir",
  authenticateToken,
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const user: any = (req as any).user || {};
      const rol: string = user.rol;
      const isAdmin = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(
        rol
      );

      // Punto a operar
      let pointId: string | undefined = req.body?.pointId;
      if (!isAdmin) {
        pointId = user.punto_atencion_id;
      }
      if (!pointId) {
        res.status(400).json({
          success: false,
          error:
            "Debes tener un punto de atención asignado para abrir el cierre diario.",
        });
        return;
      }

      // Fecha del cierre: día actual GYE
      const { gyeDayRangeUtcFromDate } = await import("../utils/timezone.js");
      const { gte, lt } = gyeDayRangeUtcFromDate(new Date());

      await client.query("BEGIN");

      // Buscar si ya existe cierre del día
      const sel = await client.query(
        `SELECT id, fecha, estado FROM "ServicioExternoCierreDiario"
         WHERE punto_atencion_id = $1 AND fecha >= $2 AND fecha < $3
         LIMIT 1`,
        [pointId, gte, lt]
      );

      if (sel.rows.length > 0) {
        await client.query("COMMIT");
        res.json({ success: true, cierre: sel.rows[0] });
        return;
      }

      const insert = await client.query(
        `INSERT INTO "ServicioExternoCierreDiario"
          (punto_atencion_id, usuario_id, fecha, estado, created_at, updated_at)
         VALUES ($1, $2, CURRENT_DATE, 'ABIERTO', NOW(), NOW())
         RETURNING id, fecha, estado`,
        [pointId, user.id]
      );

      await client.query("COMMIT");
      res.status(201).json({ success: true, cierre: insert.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error abriendo cierre servicios externos:", error);
      res
        .status(500)
        .json({ success: false, error: "No se pudo abrir el cierre" });
    } finally {
      client.release();
    }
  }
);

/** ==============================
 *  GET /servicios-externos/cierre/status
 *  Estado del cierre y resumen de movimientos USD del día
 *  Roles: OPERADOR (solo su punto), ADMIN, SUPER_USUARIO, ADMINISTRATIVO
 *  ============================== */
router.get(
  "/cierre/status",
  authenticateToken,
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const user: any = (req as any).user || {};
      const rol: string = user.rol;
      const isAdmin = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(
        rol
      );

      // Punto/fecha
      const queryPointId = String((req.query as any)?.pointId || "").trim();
      let pointId: string | undefined = queryPointId || undefined;
      if (!isAdmin) pointId = user.punto_atencion_id;
      if (!pointId) {
        res.status(400).json({
          success: false,
          error:
            "Debes tener un punto de atención asignado para consultar el estado de cierre.",
        });
        return;
      }

      const fechaStr = String((req.query as any)?.fecha || "").trim();
      const {
        gyeDayRangeUtcFromDate,
        gyeParseDateOnly,
        gyeDayRangeUtcFromYMD,
      } = await import("../utils/timezone.js");
      let gte: Date, lt: Date;
      if (fechaStr) {
        const { y, m, d } = gyeParseDateOnly(fechaStr);
        ({ gte, lt } = gyeDayRangeUtcFromYMD(y, m, d));
      } else {
        ({ gte, lt } = gyeDayRangeUtcFromDate(new Date()));
      }

      await client.query("BEGIN");

      // Asegurar moneda USD
      const usdId = await (async () => {
        // inline reuse of ensureUsdMonedaId implementation
        const sel = await client.query(
          'SELECT id FROM "Moneda" WHERE codigo = $1 LIMIT 1',
          ["USD"]
        );
        if (sel.rows[0]?.id) return sel.rows[0].id as string;
        await client.query(`
          INSERT INTO "Moneda"(nombre, simbolo, codigo, activo, orden_display, comportamiento_compra, comportamiento_venta)
          SELECT 'Dólar estadounidense', '$', 'USD', true, 0, 'MULTIPLICA', 'DIVIDE'
          WHERE NOT EXISTS (SELECT 1 FROM "Moneda" WHERE codigo = 'USD');
        `);
        const sel2 = await client.query(
          'SELECT id FROM "Moneda" WHERE codigo = $1 LIMIT 1',
          ["USD"]
        );
        if (!sel2.rows[0]?.id) throw new Error("No se pudo obtener USD");
        return sel2.rows[0].id as string;
      })();

      // Cierre del día
      const cierreQ = await client.query(
        `SELECT id, fecha, estado, observaciones, fecha_cierre, cerrado_por
         FROM "ServicioExternoCierreDiario"
         WHERE punto_atencion_id = $1 AND fecha >= $2 AND fecha < $3
         LIMIT 1`,
        [pointId, gte, lt]
      );
      const cierre = cierreQ.rows[0] || null;

      // Detalles (si existe)
      let detalles: any[] = [];
      if (cierre) {
        const detQ = await client.query(
          `SELECT servicio, moneda_id, monto_movimientos, monto_validado, diferencia, observaciones
           FROM "ServicioExternoDetalleCierre"
           WHERE cierre_id = $1
           ORDER BY servicio`,
          [cierre.id]
        );
        detalles = detQ.rows.map((r: any) => ({
          servicio: r.servicio,
          moneda_id: r.moneda_id,
          monto_movimientos: Number(r.monto_movimientos),
          monto_validado: Number(r.monto_validado),
          diferencia: Number(r.diferencia),
          observaciones: r.observaciones,
        }));
      }

      // Resumen de movimientos netos (INGRESO - EGRESO) USD del día por servicio
      const movQ = await client.query(
        `SELECT servicio,
                SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN monto ELSE -monto END) AS neto
         FROM "ServicioExternoMovimiento"
         WHERE punto_atencion_id = $1 AND moneda_id = $2 AND fecha >= $3 AND fecha < $4
         GROUP BY servicio
         ORDER BY servicio`,
        [pointId, usdId, gte, lt]
      );
      const resumen_movimientos = movQ.rows.map((r: any) => ({
        servicio: r.servicio,
        neto: Number(r.neto),
      }));

      await client.query("COMMIT");
      res.json({ success: true, cierre, detalles, resumen_movimientos });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(
        "Error consultando status cierre servicios externos:",
        error
      );
      res
        .status(500)
        .json({ success: false, error: "No se pudo obtener el estado" });
    } finally {
      client.release();
    }
  }
);

/** ==============================
 *  POST /servicios-externos/cierre/cerrar
 *  Cierra el día validando tolerancia ±1.00 USD por servicio
 *  Roles: OPERADOR (solo su punto), ADMIN, SUPER_USUARIO, ADMINISTRATIVO
 *  Body: { detalles: [{ servicio, monto_validado, observaciones? }], observaciones? }
 *  ============================== */
router.post(
  "/cierre/cerrar",
  authenticateToken,
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const user: any = (req as any).user || {};
      const rol: string = user.rol;
      const isAdmin = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(
        rol
      );

      // Punto a operar
      let pointId: string | undefined = req.body?.pointId;
      if (!isAdmin) pointId = user.punto_atencion_id;
      if (!pointId) {
        res.status(400).json({
          success: false,
          error:
            "Debes tener un punto de atención asignado para cerrar el día.",
        });
        return;
      }

      const detallesInput: Array<{
        servicio: string;
        monto_validado: number;
        observaciones?: string;
      }> = Array.isArray(req.body?.detalles) ? req.body.detalles : [];
      const obsGeneral: string | undefined =
        req.body?.observaciones || undefined;

      const { gyeDayRangeUtcFromDate } = await import("../utils/timezone.js");
      const { gte, lt } = gyeDayRangeUtcFromDate(new Date());

      await client.query("BEGIN");

      // Asegurar USD
      const usdId = await (async () => {
        const sel = await client.query(
          'SELECT id FROM "Moneda" WHERE codigo = $1 LIMIT 1',
          ["USD"]
        );
        if (sel.rows[0]?.id) return sel.rows[0].id as string;
        await client.query(`
          INSERT INTO "Moneda"(nombre, simbolo, codigo, activo, orden_display, comportamiento_compra, comportamiento_venta)
          SELECT 'Dólar estadounidense', '$', 'USD', true, 0, 'MULTIPLICA', 'DIVIDE'
          WHERE NOT EXISTS (SELECT 1 FROM "Moneda" WHERE codigo = 'USD');
        `);
        const sel2 = await client.query(
          'SELECT id FROM "Moneda" WHERE codigo = $1 LIMIT 1',
          ["USD"]
        );
        if (!sel2.rows[0]?.id) throw new Error("No se pudo obtener USD");
        return sel2.rows[0].id as string;
      })();

      // Obtener/crear cierre ABIERTO del día
      let cierreId: string | null = null;
      let estadoCierre: string | null = null;
      {
        const sel = await client.query(
          `SELECT id, estado FROM "ServicioExternoCierreDiario"
           WHERE punto_atencion_id = $1 AND fecha >= $2 AND fecha < $3
           LIMIT 1`,
          [pointId, gte, lt]
        );
        if (sel.rows.length === 0) {
          const ins = await client.query(
            `INSERT INTO "ServicioExternoCierreDiario"
              (punto_atencion_id, usuario_id, fecha, estado, created_at, updated_at, observaciones)
             VALUES ($1, $2, CURRENT_DATE, 'ABIERTO', NOW(), NOW(), $3)
             RETURNING id, estado`,
            [pointId, user.id, obsGeneral || null]
          );
          cierreId = ins.rows[0].id;
          estadoCierre = ins.rows[0].estado;
        } else {
          cierreId = sel.rows[0].id;
          estadoCierre = sel.rows[0].estado;
        }
      }

      if (estadoCierre === "CERRADO") {
        await client.query("ROLLBACK");
        res
          .status(400)
          .json({ success: false, error: "El día ya está cerrado" });
        return;
      }

      // Resumen neto movimientos por servicio (USD)
      const movQ = await client.query(
        `SELECT servicio,
                SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN monto ELSE -monto END) AS neto
         FROM "ServicioExternoMovimiento"
         WHERE punto_atencion_id = $1 AND moneda_id = $2 AND fecha >= $3 AND fecha < $4
         GROUP BY servicio`,
        [pointId, usdId, gte, lt]
      );
      const netoByServicio: Record<string, number> = {};
      movQ.rows.forEach(
        (r: any) => (netoByServicio[r.servicio] = Number(r.neto))
      );

      // Unificar servicios (los informados + los que tienen neto)
      const serviciosSet = new Set<string>([
        ...Object.keys(netoByServicio),
        ...detallesInput.map((d) => d.servicio),
      ]);

      // Validar tolerancia y preparar detalles
      const TOL = 1.0;
      const detalles: Array<{
        servicio: string;
        monto_movimientos: number;
        monto_validado: number;
        diferencia: number;
        observaciones?: string;
      }> = [];
      const errores: Array<{ servicio: string; diferencia: number }> = [];

      for (const servicio of serviciosSet) {
        const neto = Number(netoByServicio[servicio] || 0);
        const input = detallesInput.find((d) => d.servicio === servicio);
        const validado = Number(input?.monto_validado || 0);
        const diff = Number((validado - neto).toFixed(2));
        detalles.push({
          servicio,
          monto_movimientos: Number(neto.toFixed(2)),
          monto_validado: Number(validado.toFixed(2)),
          diferencia: diff,
          observaciones: input?.observaciones,
        });
        if (Math.abs(diff) > TOL) {
          errores.push({ servicio, diferencia: diff });
        }
      }

      if (errores.length > 0) {
        await client.query("ROLLBACK");
        res.status(400).json({
          success: false,
          error:
            "Las diferencias por servicio exceden la tolerancia de ±1.00 USD",
          detalles: errores,
        });
        return;
      }

      // Limpiar detalles previos (si hubiese) y reinsertar
      await client.query(
        'DELETE FROM "ServicioExternoDetalleCierre" WHERE cierre_id = $1',
        [cierreId]
      );
      for (const d of detalles) {
        await client.query(
          `INSERT INTO "ServicioExternoDetalleCierre"
            (cierre_id, servicio, moneda_id, monto_movimientos, monto_validado, diferencia, observaciones)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            cierreId,
            d.servicio,
            usdId,
            d.monto_movimientos,
            d.monto_validado,
            d.diferencia,
            d.observaciones || null,
          ]
        );
      }

      // Actualizar cabecera a CERRADO
      await client.query(
        `UPDATE "ServicioExternoCierreDiario"
           SET estado = 'CERRADO', fecha_cierre = NOW(), cerrado_por = $1,
               observaciones = COALESCE($2, observaciones),
               diferencias_reportadas = $3::jsonb,
               updated_at = NOW()
         WHERE id = $4`,
        [
          user.id,
          obsGeneral || null,
          JSON.stringify({
            resumen: detalles.map((d) => ({
              servicio: d.servicio,
              diferencia: d.diferencia,
            })),
          }),
          cierreId,
        ]
      );

      await client.query("COMMIT");
      res.json({ success: true, cierre_id: cierreId });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error cerrando cierre servicios externos:", error);
      res
        .status(500)
        .json({ success: false, error: "No se pudo cerrar el día" });
    } finally {
      client.release();
    }
  }
);

/** ==============================
 *  GET /servicios-externos/movimientos
 *  Lista movimientos con filtros para administración
 *  Roles: ADMIN, SUPER_USUARIO, ADMINISTRATIVO
 *  ============================== */
router.get(
  "/movimientos",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { punto_id, servicio, fecha_desde, fecha_hasta } = req.query;

      let whereClause = "WHERE 1=1";
      const params: any[] = [];
      let paramCount = 0;

      if (punto_id && punto_id !== "todos") {
        whereClause += ` AND sem.punto_atencion_id = $${++paramCount}`;
        params.push(punto_id);
      }

      if (servicio && servicio !== "todos") {
        whereClause += ` AND sem.servicio = $${++paramCount}`;
        params.push(servicio);
      }

      if (fecha_desde) {
        whereClause += ` AND sem.fecha >= $${++paramCount}`;
        params.push(fecha_desde);
      }

      if (fecha_hasta) {
        whereClause += ` AND sem.fecha <= $${++paramCount}`;
        params.push(fecha_hasta);
      }

      const query = `
        SELECT 
          sem.id,
          sem.servicio,
          sem.tipo_movimiento as tipo,
          sem.monto,
          sem.descripcion,
          sem.fecha as creado_en,
          pa.nombre as punto_atencion_nombre,
          u.nombre as creado_por
        FROM "ServicioExternoMovimiento" sem
        JOIN "PuntoAtencion" pa ON sem.punto_atencion_id = pa.id
        JOIN "Usuario" u ON sem.usuario_id = u.id
        ${whereClause}
        ORDER BY sem.fecha DESC
        LIMIT 500
      `;

      const result = await client.query(query, params);

      res.json({
        success: true,
        movimientos: result.rows,
      });
    } catch (error) {
      console.error("Error al obtener movimientos:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    } finally {
      client.release();
    }
  }
);

/** ==============================
 *  GET /servicios-externos/saldos
 *  Obtiene saldos actuales por servicio
 *  Roles: ADMIN, SUPER_USUARIO, ADMINISTRATIVO
 *  ============================== */
router.get(
  "/saldos",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      // Obtener saldos netos por servicio
      const query = `
        SELECT 
          servicio,
          SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN monto ELSE -monto END) as saldo_actual,
          MAX(fecha) as ultimo_movimiento
        FROM "ServicioExternoMovimiento"
        GROUP BY servicio
        ORDER BY servicio
      `;

      const result = await client.query(query);

      res.json({
        success: true,
        saldos: result.rows.map((row) => ({
          servicio: row.servicio,
          saldo_actual: Number(row.saldo_actual || 0),
          ultimo_movimiento: row.ultimo_movimiento,
        })),
      });
    } catch (error) {
      console.error("Error al obtener saldos:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    } finally {
      client.release();
    }
  }
);

/** ==============================
 *  POST /servicios-externos/asignar-saldo
 *  Asigna saldo específico de un servicio a un punto de atención (solo ADMIN/SUPER_USUARIO)
 *  ============================== */
router.post(
  "/asignar-saldo",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const {
        punto_atencion_id,
        servicio,
        monto_asignado,
        creado_por,
        tipo_asignacion,
        observaciones,
      } = req.body as {
        punto_atencion_id?: string;
        servicio?: ServicioExterno;
        monto_asignado?: number;
        creado_por?: string;
        tipo_asignacion?: string;
        observaciones?: string;
      };

      // Validaciones
      if (!punto_atencion_id || !servicio || !monto_asignado || !creado_por) {
        res.status(400).json({
          success: false,
          error:
            "Todos los campos son obligatorios: punto_atencion_id, servicio, monto_asignado, creado_por",
        });
        return;
      }

      if (!SERVICIOS_VALIDOS.includes(servicio)) {
        res.status(400).json({
          success: false,
          error: "Servicio no válido",
        });
        return;
      }

      if (monto_asignado <= 0) {
        res.status(400).json({
          success: false,
          error: "El monto debe ser mayor a 0",
        });
        return;
      }

      await client.query("BEGIN");

      // Verificar que el punto de atención existe
      const puntoCheck = await client.query(
        'SELECT id, nombre FROM "PuntoAtencion" WHERE id = $1',
        [punto_atencion_id]
      );

      if (puntoCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: "Punto de atención no encontrado",
        });
        return;
      }

      const puntoNombre = puntoCheck.rows[0].nombre;

      // Obtener moneda USD (asumimos USD por defecto)
      const usdId = await ensureUsdMonedaId(client);

      // Crear registro de asignación en historial
      const asignacionId = randomUUID();
      await client.query(
        `INSERT INTO "ServicioExternoAsignacion" 
         (id, punto_atencion_id, servicio, moneda_id, monto, tipo, observaciones, asignado_por, fecha)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          asignacionId,
          punto_atencion_id,
          servicio,
          usdId,
          monto_asignado,
          tipo_asignacion || "INICIAL",
          observaciones || null,
          creado_por,
        ]
      );

      // Actualizar o crear saldo del servicio para el punto
      const saldoCheck = await client.query(
        `SELECT id, cantidad FROM "ServicioExternoSaldo" 
         WHERE punto_atencion_id = $1 AND servicio = $2 AND moneda_id = $3`,
        [punto_atencion_id, servicio, usdId]
      );

      if (saldoCheck.rows.length > 0) {
        // Actualizar saldo existente
        const nuevoSaldo = Number(saldoCheck.rows[0].cantidad) + monto_asignado;
        await client.query(
          `UPDATE "ServicioExternoSaldo" 
           SET cantidad = $1, updated_at = NOW() 
           WHERE id = $2`,
          [nuevoSaldo, saldoCheck.rows[0].id]
        );
      } else {
        // Crear nuevo saldo
        const saldoId = randomUUID();
        await client.query(
          `INSERT INTO "ServicioExternoSaldo" 
           (id, punto_atencion_id, servicio, moneda_id, cantidad, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [saldoId, punto_atencion_id, servicio, usdId, monto_asignado]
        );
      }

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message: `Saldo de $${monto_asignado.toFixed(
          2
        )} asignado correctamente para ${servicio} en ${puntoNombre}`,
        asignacion: {
          id: asignacionId,
          punto_atencion_id,
          punto_atencion_nombre: puntoNombre,
          servicio,
          monto_asignado,
          creado_por,
          creado_en: new Date().toISOString(),
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error al asignar saldo:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    } finally {
      client.release();
    }
  }
);

/** ==============================
 *  GET /servicios-externos/saldos-por-punto
 *  Obtiene saldos de servicios externos por punto de atención (solo ADMIN/SUPER_USUARIO)
 *  ============================== */
router.get(
  "/saldos-por-punto",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          s.punto_atencion_id,
          p.nombre as punto_atencion_nombre,
          s.servicio,
          s.cantidad as saldo_actual
        FROM "ServicioExternoSaldo" s
        JOIN "PuntoAtencion" p ON p.id = s.punto_atencion_id
        ORDER BY p.nombre, s.servicio
      `;

      const result = await client.query(query);

      res.json({
        success: true,
        saldos: result.rows.map((row) => ({
          punto_atencion_id: row.punto_atencion_id,
          punto_atencion_nombre: row.punto_atencion_nombre,
          servicio: row.servicio,
          saldo_actual: Number(row.saldo_actual || 0),
        })),
      });
    } catch (error) {
      console.error("Error al obtener saldos por punto:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    } finally {
      client.release();
    }
  }
);

/** ==============================
 *  GET /servicios-externos/historial-asignaciones
 *  Obtiene historial de asignaciones de saldos (solo ADMIN/SUPER_USUARIO)
 *  ============================== */
router.get(
  "/historial-asignaciones",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          a.id,
          p.nombre as punto_atencion_nombre,
          a.servicio,
          a.monto as monto_asignado,
          u.nombre as creado_por,
          a.fecha as creado_en,
          a.tipo,
          a.observaciones
        FROM "ServicioExternoAsignacion" a
        JOIN "PuntoAtencion" p ON p.id = a.punto_atencion_id
        JOIN "Usuario" u ON u.id = a.asignado_por
        ORDER BY a.fecha DESC
        LIMIT 100
      `;

      const result = await client.query(query);

      res.json({
        success: true,
        historial: result.rows.map((row) => ({
          id: row.id,
          punto_atencion_nombre: row.punto_atencion_nombre,
          servicio: row.servicio,
          monto_asignado: Number(row.monto_asignado),
          creado_por: row.creado_por,
          creado_en: row.creado_en,
          tipo: row.tipo,
          observaciones: row.observaciones,
        })),
      });
    } catch (error) {
      console.error("Error al obtener historial de asignaciones:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    } finally {
      client.release();
    }
  }
);

// ============================
// RUTA TEMPORAL PARA MIGRACIÓN
// ============================

/**
 * POST /servicios-externos/migrate-tables
 * Ejecuta la migración para crear las tablas de servicios externos
 * NOTA: Esta es una ruta temporal que se puede eliminar después de ejecutar la migración
 */
router.post(
  "/migrate-tables",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
      console.log("🚀 Iniciando migración de tablas de servicios externos...");

      // Script SQL para crear las tablas
      const sqlScript = `
        DO $$
        BEGIN
            -- Crear tabla ServicioExternoSaldo si no existe
            IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ServicioExternoSaldo') THEN
                CREATE TABLE "ServicioExternoSaldo" (
                    "id" TEXT NOT NULL,
                    "punto_atencion_id" TEXT NOT NULL,
                    "servicio" TEXT NOT NULL,
                    "moneda_id" TEXT NOT NULL,
                    "cantidad" DECIMAL(15,2) NOT NULL DEFAULT 0,
                    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                    CONSTRAINT "ServicioExternoSaldo_pkey" PRIMARY KEY ("id")
                );

                -- Crear índices para ServicioExternoSaldo
                CREATE UNIQUE INDEX "ServicioExternoSaldo_punto_atencion_id_servicio_moneda_id_key" ON "ServicioExternoSaldo"("punto_atencion_id", "servicio", "moneda_id");
                CREATE INDEX "ServicioExternoSaldo_punto_atencion_id_idx" ON "ServicioExternoSaldo"("punto_atencion_id");
                CREATE INDEX "ServicioExternoSaldo_servicio_idx" ON "ServicioExternoSaldo"("servicio");

                -- Agregar foreign keys para ServicioExternoSaldo
                ALTER TABLE "ServicioExternoSaldo" ADD CONSTRAINT "ServicioExternoSaldo_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                ALTER TABLE "ServicioExternoSaldo" ADD CONSTRAINT "ServicioExternoSaldo_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

                RAISE NOTICE 'Tabla ServicioExternoSaldo creada exitosamente';
            ELSE
                RAISE NOTICE 'Tabla ServicioExternoSaldo ya existe';
            END IF;

            -- Crear tabla ServicioExternoAsignacion si no existe
            IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ServicioExternoAsignacion') THEN
                CREATE TABLE "ServicioExternoAsignacion" (
                    "id" TEXT NOT NULL,
                    "punto_atencion_id" TEXT NOT NULL,
                    "servicio" TEXT NOT NULL,
                    "moneda_id" TEXT NOT NULL,
                    "monto" DECIMAL(15,2) NOT NULL,
                    "tipo" TEXT NOT NULL,
                    "observaciones" TEXT,
                    "asignado_por" TEXT NOT NULL,
                    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                    CONSTRAINT "ServicioExternoAsignacion_pkey" PRIMARY KEY ("id")
                );

                -- Crear índices para ServicioExternoAsignacion
                CREATE INDEX "ServicioExternoAsignacion_punto_atencion_id_idx" ON "ServicioExternoAsignacion"("punto_atencion_id");
                CREATE INDEX "ServicioExternoAsignacion_servicio_idx" ON "ServicioExternoAsignacion"("servicio");
                CREATE INDEX "ServicioExternoAsignacion_tipo_idx" ON "ServicioExternoAsignacion"("tipo");

                -- Agregar foreign keys para ServicioExternoAsignacion
                ALTER TABLE "ServicioExternoAsignacion" ADD CONSTRAINT "ServicioExternoAsignacion_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                ALTER TABLE "ServicioExternoAsignacion" ADD CONSTRAINT "ServicioExternoAsignacion_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                ALTER TABLE "ServicioExternoAsignacion" ADD CONSTRAINT "ServicioExternoAsignacion_asignado_por_fkey" FOREIGN KEY ("asignado_por") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

                RAISE NOTICE 'Tabla ServicioExternoAsignacion creada exitosamente';
            ELSE
                RAISE NOTICE 'Tabla ServicioExternoAsignacion ya existe';
            END IF;

            -- Verificar que los enums necesarios existan
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ServicioExterno') THEN
                CREATE TYPE "ServicioExterno" AS ENUM (
                    'YAGANASTE',
                    'BANCO_GUAYAQUIL',
                    'WESTERN',
                    'PRODUBANCO',
                    'BANCO_PACIFICO',
                    'INSUMOS_OFICINA',
                    'INSUMOS_LIMPIEZA',
                    'OTROS'
                );
                RAISE NOTICE 'Enum ServicioExterno creado exitosamente';
            ELSE
                RAISE NOTICE 'Enum ServicioExterno ya existe';
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoAsignacionServicio') THEN
                CREATE TYPE "TipoAsignacionServicio" AS ENUM (
                    'INICIAL',
                    'RECARGA'
                );
                RAISE NOTICE 'Enum TipoAsignacionServicio creado exitosamente';
            ELSE
                RAISE NOTICE 'Enum TipoAsignacionServicio ya existe';
            END IF;

            RAISE NOTICE 'Script de creación de tablas de servicios externos completado exitosamente';
        END
        $$;
      `;

      // Ejecutar el script
      await client.query(sqlScript);

      console.log("✅ Migración completada exitosamente");

      res.json({
        success: true,
        message:
          "Migración de tablas de servicios externos completada exitosamente",
        tables_created: ["ServicioExternoSaldo", "ServicioExternoAsignacion"],
        enums_created: ["ServicioExterno", "TipoAsignacionServicio"],
      });
    } catch (error) {
      console.error("❌ Error durante la migración:", error);
      res.status(500).json({
        success: false,
        error: "Error durante la migración de tablas",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      client.release();
    }
  }
);

export default router;
