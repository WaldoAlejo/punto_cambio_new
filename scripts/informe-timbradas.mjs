import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import pg from 'pg';
import ExcelJS from 'exceljs';

// Consulta exclusivamente de lectura. No modifica jornadas ni usuarios.
const { values: args } = parseArgs({ options: {
  env: { type: 'string' }, desde: { type: 'string' }, hasta: { type: 'string' },
  salida: { type: 'string' }, help: { type: 'boolean' },
} });
if (args.help) {
  console.log('node scripts/informe-timbradas.mjs [--env .env.production] [--desde YYYY-MM-DD] [--hasta YYYY-MM-DD] [--salida reports/timbradas.xlsx]\nSin fechas: todo el historial. Incluye usuarios inactivos y salidas espontáneas. Fechas inclusivas en America/Guayaquil. Usa DATABASE_URL del entorno o del archivo indicado.');
  process.exit(0);
}
function fecha(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error('Fecha inválida: use YYYY-MM-DD.');
  }
  return `${value}T00:00:00-05:00`;
}
const desde = fecha(args.desde);
const hasta = fecha(args.hasta);
if (desde && hasta && desde > hasta) throw new Error('Desde debe ser anterior o igual a hasta.');
const config = args.env ? dotenv.parse(fs.readFileSync(args.env)) : {};
const connectionString = config.DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Falta DATABASE_URL. Use --env con el archivo de conexión del servidor.');
const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const local = (d) => d ? formatter.format(new Date(d)) : '';
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 120000 });
try {
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  // Evita que PostgreSQL interprete timestamps de Prisma en la zona del servidor.
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  const { rows: users } = await client.query('SELECT id, nombre, username, rol, activo FROM "Usuario" ORDER BY nombre, id');
  const { rows: events } = await client.query(`
    WITH eventos AS (
      SELECT j.id, j.usuario_id, j.punto_atencion_id, j.estado::text, 'Jornada' AS origen,
        j.observaciones, j.motivo_cambio, e.tipo, e.fecha, e.ubicacion
      FROM "Jornada" j CROSS JOIN LATERAL (VALUES
        ('Entrada', j.fecha_inicio, j.ubicacion_inicio),
        ('Inicio almuerzo', j.fecha_almuerzo, NULL),
        ('Regreso almuerzo', j.fecha_regreso, NULL),
        ('Salida', j.fecha_salida, j.ubicacion_salida)
      ) e(tipo, fecha, ubicacion)
      UNION ALL
      SELECT s.id, s.usuario_id, s.punto_atencion_id, s.estado::text, 'Salida espontánea',
        s.descripcion, s.motivo::text, e.tipo, e.fecha, e.ubicacion
      FROM "SalidaEspontanea" s CROSS JOIN LATERAL (VALUES
        ('Salida espontánea', s.fecha_salida, s.ubicacion_salida),
        ('Regreso espontáneo', s.fecha_regreso, s.ubicacion_regreso)
      ) e(tipo, fecha, ubicacion)
    )
    SELECT e.*, to_char(e.fecha, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fecha_utc,
      p.nombre AS punto, p.direccion AS direccion_punto
    FROM eventos e LEFT JOIN "PuntoAtencion" p ON p.id = e.punto_atencion_id
    WHERE e.fecha IS NOT NULL
      AND ($1::timestamptz IS NULL OR e.fecha >= $1::timestamptz AT TIME ZONE 'UTC')
      AND ($2::timestamptz IS NULL OR e.fecha < ($2::timestamptz + INTERVAL '1 day') AT TIME ZONE 'UTC')
    ORDER BY e.fecha, e.usuario_id, e.origen, e.id, e.tipo
  `, [desde, hasta]);
  await client.query('COMMIT');
  const book = new ExcelJS.Workbook();
  book.creator = 'Punto Cambio';
  book.created = new Date();
  function sheet(name, columns) {
    const s = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    s.columns = columns.map(([header, width]) => ({ header, width }));
    s.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    s.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
    return s;
  }
  const notes = sheet('Alcance y limitaciones', [['Concepto', 30], ['Detalle', 125]]);
  for (const row of [
    ['Generado (Ecuador)', local(new Date())],
    ['Período', `${args.desde || 'Primer registro disponible'} a ${args.hasta || 'Último registro disponible'}`],
    ['Cobertura', 'Todos los usuarios, activos e inactivos; jornadas de todos los estados y salidas espontáneas. Filtro aplicado a la fecha de cada timbrada.'],
    ['Totales', `${users.length} usuarios; ${events.length} timbradas.`],
    ['Zona horaria', 'America/Guayaquil (UTC-05:00). Se incluye también la fecha UTC original.'],
    ['Punto de atención', 'Es el punto asociado actualmente al registro, no una prueba de ubicación física. Una reasignación posterior puede modificarlo.'],
    ['Ubicación', 'Coordenadas declaradas por el navegador. No certifican presencia; su precisión puede variar. No se consultan servicios externos.'],
    ['Sin ubicación', 'Ausencia, coordenadas inválidas, 0,0 o indicador sin_gps se reportan sin ubicación utilizable. No se infiere una ubicación.'],
    ['Dispositivo', 'Se muestra únicamente si existe en el JSON histórico. MOVIL indica detección del navegador, no demuestra que estuviera fuera de la oficina.'],
    ['Limitación del código revisado', 'La validación de /schedules conserva lat, lng y direccion, pero descarta dispositivo, accuracy y sin_gps enviados por la pantalla. No permite reconstruir esos datos históricos.'],
    ['Almuerzo y regreso', 'El modelo Jornada no dispone de campos de ubicación específicos para estas marcaciones. No se reutiliza la ubicación de entrada.'],
    ['IP y navegador', 'No existen campos específicos en Jornada. Los logs HTTP registran IP y userAgent, pero no enlazan directamente estos valores con el ID de jornada; requieren investigación separada.'],
    ['Conclusiones individuales', 'Este informe no determina incumplimientos ni confirma acusaciones contra una persona. Requiere contrastar la evidencia con registros de la oficina.'],
    ['Integridad', 'Consulta de solo lectura en una instantánea consistente. No reconstruye ediciones ni registros eliminados. JSON original incluido para revisión.'],
  ]) notes.addRow(row);
  const detail = sheet('Timbradas', [['ID registro', 38], ['Origen', 23], ['Usuario ID', 38], ['Nombre', 30], ['Usuario', 24], ['Rol actual', 20], ['Estado registro', 20], ['Punto asociado', 28], ['Dirección punto', 45], ['Marcación', 24], ['Fecha Ecuador', 23], ['Fecha UTC', 27], ['Ubicación utilizable', 23], ['Latitud', 16], ['Longitud', 16], ['Dirección registrada', 55], ['Precisión metros', 20], ['Dispositivo registrado', 25], ['Motivo sin GPS', 55], ['Mapa', 55], ['Observaciones', 55], ['Motivo cambio o salida', 35], ['Ubicación JSON original', 90]]);
  const index = new Map(users.map(u => [u.id, { ...u, total: 0, gps: 0, device: 0, mobile: 0, first: null, last: null }]));
  for (const e of events) {
    const u = index.get(e.usuario_id);
    const loc = e.ubicacion && typeof e.ubicacion === 'object' ? e.ubicacion : {};
    const gps = !loc.sin_gps && typeof loc.lat === 'number' && typeof loc.lng === 'number' && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) && Math.abs(loc.lat) <= 90 && Math.abs(loc.lng) <= 180 && !(Math.abs(loc.lat) < 0.01 && Math.abs(loc.lng) < 0.01);
    const device = typeof loc.dispositivo === 'string' ? loc.dispositivo : '';
    if (u) { u.total++; u.gps += Number(gps); u.device += Number(Boolean(device)); u.mobile += Number(device === 'MOVIL'); u.first ||= e.fecha_utc; u.last = e.fecha_utc; }
    const map = gps ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : '';
    detail.addRow([e.id, e.origen, e.usuario_id, u?.nombre || '', u?.username || '', u?.rol || '', e.estado, e.punto, e.direccion_punto, e.tipo, local(e.fecha_utc), e.fecha_utc, gps ? 'Sí' : 'No', loc.lat ?? '', loc.lng ?? '', loc.direccion || '', loc.accuracy ?? '', device || 'No registrado', loc.motivo_sin_gps || '', map ? { text: 'Ver coordenadas registradas', hyperlink: map } : '', e.observaciones || '', e.motivo_cambio || '', e.ubicacion == null ? '' : JSON.stringify(e.ubicacion)]);
  }
  const summary = sheet('Resumen por usuario', [['Usuario ID', 38], ['Nombre', 30], ['Usuario', 24], ['Rol actual', 20], ['Activo actualmente', 22], ['Timbradas', 15], ['Con ubicación', 18], ['Sin ubicación utilizable', 26], ['Con dispositivo', 20], ['Sin dispositivo', 20], ['MOVIL registrado', 22], ['Primera (Ecuador)', 23], ['Última (Ecuador)', 23]]);
  for (const u of index.values()) summary.addRow([u.id, u.nombre, u.username, u.rol, u.activo ? 'Sí' : 'No', u.total, u.gps, u.total - u.gps, u.device, u.total - u.device, u.mobile, local(u.first), local(u.last)]);
  for (const s of [detail, summary]) s.autoFilter = { from: { row: 1, column: 1 }, to: { row: s.rowCount, column: s.columnCount } };
  const output = path.resolve(args.salida || `reports/informe-timbradas-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (fs.existsSync(output)) throw new Error('El archivo de salida ya existe; indique otro nombre.');
  await book.xlsx.writeFile(output);
  console.log(JSON.stringify({ archivo: output, usuarios: users.length, timbradas: events.length, conUbicacion: [...index.values()].reduce((n, u) => n + u.gps, 0) }));
} catch (error) {
  console.error(`No se pudo generar el informe (${error.code || error.name}). ${['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code) ? 'La base de datos no está accesible desde este equipo.' : 'Revise la conexión, el esquema y el destino de salida.'}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
