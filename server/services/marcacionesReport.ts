import { Prisma } from '@prisma/client';
import { z } from 'zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Fecha inválida');

export const marcacionesQuery = z.object({
  from: day,
  to: day,
  usuario_id: z.string().uuid().optional(),
  punto_atencion_id: z.string().uuid().optional(),
  tipo: z.enum(['ENTRADA', 'ALMUERZO', 'REGRESO', 'SALIDA', 'SALIDA_ESPONTANEA', 'REGRESO_ESPONTANEO']).optional(),
  ubicacion: z.enum(['todas', 'con', 'sin']).default('todas'),
  page: z.coerce.number().int().min(1).max(50001).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).superRefine((value, context) => {
  const days = (Date.parse(value.to) - Date.parse(value.from)) / 86400000;
  if (days < 0 || days > 92) context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'Seleccione un período de 1 a 93 días, con inicio anterior al fin.' });
});

export type MarcacionesQuery = z.infer<typeof marcacionesQuery>;
export interface MarcacionRow {
  registro_id: string;
  usuario_id: string;
  punto_atencion_id: string;
  origen: string;
  tipo: string;
  fecha: Date;
  estado: string;
  ubicacion: unknown;
  observaciones: string | null;
  nombre: string;
  username: string;
  punto: string;
  direccion_punto: string;
}

/** Boundaries are explicit UTC instants, independent of the server/session timezone. */
export function reportSql(query: MarcacionesQuery) {
  const start = new Date(`${query.from}T00:00:00-05:00`);
  const end = new Date(new Date(`${query.to}T00:00:00-05:00`).getTime() + 86400000);
  const user = query.usuario_id ? Prisma.sql`AND r.usuario_id = ${query.usuario_id}` : Prisma.empty;
  const point = query.punto_atencion_id ? Prisma.sql`AND r.punto_atencion_id = ${query.punto_atencion_id}` : Prisma.empty;
  const type = query.tipo ? Prisma.sql`AND e.tipo = ${query.tipo}` : Prisma.empty;
  return Prisma.sql`
    WITH eventos AS (
      SELECT r.id AS registro_id, r.usuario_id, r.punto_atencion_id, 'Jornada' AS origen,
        r.estado::text, r.observaciones, e.tipo, e.fecha, e.ubicacion
      FROM "Jornada" r
      CROSS JOIN LATERAL (VALUES
        ('ENTRADA', r.fecha_inicio, r.ubicacion_inicio),
        ('ALMUERZO', r.fecha_almuerzo, NULL),
        ('REGRESO', r.fecha_regreso, NULL),
        ('SALIDA', r.fecha_salida, r.ubicacion_salida)
      ) e(tipo, fecha, ubicacion)
      WHERE e.fecha >= (${start.toISOString()}::timestamptz AT TIME ZONE 'UTC') AND e.fecha < (${end.toISOString()}::timestamptz AT TIME ZONE 'UTC') ${user} ${point} ${type}
      UNION ALL
      SELECT r.id, r.usuario_id, r.punto_atencion_id, 'Salida espontánea',
        r.estado::text, r.descripcion, e.tipo, e.fecha, e.ubicacion
      FROM "SalidaEspontanea" r
      CROSS JOIN LATERAL (VALUES
        ('SALIDA_ESPONTANEA', r.fecha_salida, r.ubicacion_salida),
        ('REGRESO_ESPONTANEO', r.fecha_regreso, r.ubicacion_regreso)
      ) e(tipo, fecha, ubicacion)
      WHERE e.fecha >= (${start.toISOString()}::timestamptz AT TIME ZONE 'UTC') AND e.fecha < (${end.toISOString()}::timestamptz AT TIME ZONE 'UTC') ${user} ${point} ${type}
    )
    SELECT e.*, u.nombre, u.username, p.nombre AS punto, p.direccion AS direccion_punto
    FROM eventos e JOIN "Usuario" u ON u.id = e.usuario_id
      JOIN "PuntoAtencion" p ON p.id = e.punto_atencion_id
    ORDER BY e.fecha DESC, e.origen, e.registro_id, e.tipo
    LIMIT 50001
  `;
}

export function normalizeMarcacion(row: MarcacionRow) {
  const location = row.ubicacion && typeof row.ubicacion === 'object' && !Array.isArray(row.ubicacion)
    ? row.ubicacion as Record<string, unknown> : {};
  const text = (v: unknown) => typeof v === 'string' && v.trim() ? v : null;
  const { lat, lng, accuracy } = location;
  // Historical clients use 0,0 (and nearby values) as a placeholder when GPS fails.
  const valid = !location.sin_gps && typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01);
  return {
    id: `${row.origen}:${row.registro_id}:${row.tipo}`,
    registroId: row.registro_id, origen: row.origen, usuarioId: row.usuario_id,
    nombre: row.nombre, username: row.username, puntoId: row.punto_atencion_id,
    punto: row.punto, direccionPunto: row.direccion_punto, tipo: row.tipo,
    fecha: row.fecha.toISOString(), estado: row.estado,
    ubicacion: valid ? { lat, lng, accuracy: typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null, direccion: text(location.direccion) } : null,
    dispositivo: text(location.dispositivo),
    motivoSinGps: valid ? null : text(location.motivo_sin_gps),
    observaciones: row.observaciones,
  };
}

export function buildMarcacionesReport(rows: MarcacionRow[], query: MarcacionesQuery) {
  const events = rows.map(normalizeMarcacion).filter(event => query.ubicacion === 'todas'
    || (query.ubicacion === 'con' ? event.ubicacion !== null : event.ubicacion === null));
  const located = events.filter(event => event.ubicacion !== null);
  const total = events.length;
  return {
    events: events.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
    total, page: query.page, pageSize: query.pageSize,
    summary: { total, conUbicacion: located.length, sinUbicacion: total - located.length, usuarios: new Set(events.map(e => e.usuarioId)).size },
    markers: located.slice(0, 1000), markersTotal: located.length, markersLimit: 1000,
    from: query.from, to: query.to,
  };
}
