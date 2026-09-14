// Local browser smoke-test fixture. Never proxies requests to a real backend.
// First build with envDir:false and VITE_API_URL=http://127.0.0.1:4173/api,
// outDir=node_modules/.cache/frontend-check. Then run this file with Node.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../node_modules/.cache/frontend-check');
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Build the isolated frontend first');
const point = { id: 'test-point', nombre: 'Punto de prueba local', direccion: 'Prueba',
  ciudad: 'Quito', provincia: 'Pichincha', activo: true, es_principal: true };
const user = { id: 'test-user', username: 'prueba', nombre: 'Administrador de prueba',
  rol: 'ADMIN', activo: true, punto_atencion_id: point.id,
  created_at: '2026-09-13T05:00:00Z', updated_at: '2026-09-13T05:00:00Z' };
let summaryRequests = 0;
const dates = [];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4173');
  res.setHeader('Content-Security-Policy', "connect-src 'self'");
  res.setHeader('Cache-Control', 'no-store');
  function json(data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
  if (url.pathname === '/__test/status') return json({ summaryRequests, dates });
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      req.resume();
      return json({ success: true, user, token: 'local-fixture-only' });
    }
    if (req.method !== 'GET') return json({ success: false, error: 'Fixture: escritura no admitida' }, 405);
    if (url.pathname === '/api/auth/verify') return json({ user, valid: true });
    if (url.pathname === '/api/points' || url.pathname === '/api/points/all') return json({ success: true, points: [point] });
    if (url.pathname === '/api/cierres-diarios/resumen-por-fecha') {
      dates.push(url.searchParams.get('fecha'));
      summaryRequests++;
      if (summaryRequests === 1) return json({ success: false, error: 'Fallo simulado para probar Reintentar' }, 503);
      return json({ success: true, data: { fecha_consultada: dates.at(-1),
        estadisticas: { total_puntos: 1, puntos_con_cierre: 0, puntos_sin_cierre: 1, porcentaje_cumplimiento: 0 },
        monedas_disponibles: [{ codigo: 'USD', nombre: 'Dolar' }],
        resumen_por_punto: [{ punto_id: point.id, punto_nombre: point.nombre, tiene_cierre: false, saldos_por_divisa: [] }] } });
    }
    return json({ success: false, error: 'Endpoint fuera de esta prueba local' }, 404);
  }
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) {
    if (url.pathname !== '/') return json({ error: 'Invalid path' }, 400);
  }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('Fixture local: http://127.0.0.1:4173 (sin base de datos)'));
