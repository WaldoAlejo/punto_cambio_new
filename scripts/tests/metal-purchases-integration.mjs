import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

export async function testMetalPurchases({ prisma, pool, base, post, ok, check, usd, eur, bcrypt, browserMode }) {
  await check('Metales: migración aditiva produce el mismo esquema que Prisma', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE SCHEMA metals_migration_test');
      await client.query('SET LOCAL search_path TO metals_migration_test');
      for (const table of ['Usuario', 'PuntoAtencion', 'Moneda', 'Jornada']) await client.query(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY)`);
      for (const file of ['2026-09-14-metal-purchases.sql', '2026-09-14-metal-purchases-checks.sql']) await client.query(await fs.readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
      const tables = ['ConfiguracionCompraMetal', 'CompraMetal', 'DetalleCompraMetal', 'EventoCompraMetal'];
      const query = 'SELECT table_name, column_name, data_type, is_nullable, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema=$1 AND table_name=ANY($2::text[]) ORDER BY table_name, ordinal_position';
      assert.deepEqual((await client.query(query, ['metals_migration_test', tables])).rows, (await client.query(query, ['public', tables])).rows);
      await client.query('ROLLBACK');
    } finally { await client.query('ROLLBACK').catch(() => {}); client.release(); }
  });
  const password = await bcrypt.hash('PruebaLocal_123!', 10);
  const principal = await prisma.puntoAtencion.create({ data: { nombre: 'METALES ADMIN LOCAL', direccion: 'Local ficticio', ciudad: 'Quito', provincia: 'Pichincha', es_principal: true } });
  const admin = await prisma.usuario.create({ data: { username: 'metales_admin', nombre: 'Admin metales ficticio', password, rol: 'ADMIN', punto_atencion_id: principal.id } });
  const adminLogin = await post('/auth/login', { username: admin.username, password: 'PruebaLocal_123!' }); ok(adminLogin);
  const adminToken = adminLogin.body.token;
  const req = async (route, method, body, token) => {
    const res = await fetch(base + route, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
    return { status: res.status, body: await res.json() };
  };
  async function fixture(name, cash = 1000, counted = true) {
    const point = await prisma.puntoAtencion.create({ data: { nombre: name, direccion: 'Solo prueba aislada', ciudad: 'Quito', provincia: 'Pichincha' } });
    const user = await prisma.usuario.create({ data: { username: `metal_${randomUUID().slice(0, 8)}`, nombre: name, password, rol: 'OPERADOR' } });
    for (const m of [usd, eur]) {
      await prisma.saldo.create({ data: { punto_atencion_id: point.id, moneda_id: m.id, cantidad: cash, billetes: cash, bancos: 0 } });
      await prisma.saldoInicial.create({ data: { punto_atencion_id: point.id, moneda_id: m.id, cantidad_inicial: cash, asignado_por: user.id } });
    }
    const login = await post('/auth/login', { username: user.username, password: 'PruebaLocal_123!' }); ok(login);
    const token = login.body.token;
    ok(await post('/schedules', { usuario_id: user.id, punto_atencion_id: point.id, fecha_inicio: new Date().toISOString() }, undefined, token));
    const jornada = await prisma.jornada.findFirstOrThrow({ where: { usuario_id: user.id, estado: 'ACTIVO' } });
    const start = await post('/apertura-caja/iniciar', { jornada_id: jornada.id }, undefined, token); ok(start);
    if (counted) {
      ok(await post('/apertura-caja/conteo', { apertura_id: start.body.apertura.id, conteos: [usd, eur].map(m => ({ moneda_id: m.id, billetes: cash ? [{ denominacion: 100, cantidad: cash / 100 }] : [], monedas: [] })) }, undefined, token));
      ok(await post('/apertura-caja/confirmar', { apertura_id: start.body.apertura.id }, undefined, token));
    }
    return { point, user, token, jornada, apertura: start.body.apertura };
  }
  const f = await fixture('METALES PRUEBA CAJA');
  const g = await fixture('METALES PRUEBA BANCOS', 0);
  const pending = await fixture('METALES APERTURA PENDIENTE', 1000, false);
  const line = { metal: 'ORO', descripcion: 'Anillo ficticio', piezas: 1, peso_bruto: '10', deducciones: '0', pureza_declarada: '18 K', pureza: '750', metodo: 'ACIDO', observaciones: 'Ensayo ficticio local', resultado_concluyente: true, precio_gramo: '60' };
  const payload = { moneda_id: usd.id, vendedor: { nombre: 'Vendedor ficticio', documento: 'PRUEBA-000', telefono: '0000000000', procedencia: 'Pieza de prueba sin valor comercial' }, detalles: [line], medio_pago: 'EFECTIVO', billetes: '600', monedas: '0' };
  const bankPayload = { moneda_id: usd.id, vendedor: payload.vendedor, detalles: [line], medio_pago: 'TRANSFERENCIA', banco: 'Banco ficticio', referencia: 'REF-SOLO-LOCAL' };
  const balance = fixture => prisma.saldo.findUniqueOrThrow({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: fixture.point.id, moneda_id: usd.id } } });
  const enable = fixture => req(`/metal-purchases/configuracion/${fixture.point.id}`, 'PUT', { habilitado: true, motivo: 'Habilitación de prueba local' }, adminToken);
  await check('Metales: revisión del formulario valida pago sin registrar compra', async () => {
    const result = await post('/metal-purchases/preparar', payload, undefined, f.token); ok(result);
    assert.equal(result.body.total, '600.00');
    assert.equal((await post('/metal-purchases/preparar', { ...payload, billetes: '599.99' }, undefined, f.token)).status, 400);
    assert.equal(await prisma.compraMetal.count(), 0);
  });
  await check('Metales: cálculo por gramo no descuenta pureza dos veces', async () => {
    const r = await post('/metal-purchases/cotizar', { detalles: [line] }, undefined, f.token); ok(r);
    assert.equal(r.body.total, '600.00'); assert.equal(r.body.detalles[0].gramos_finos, '7.500000');
  });
  await check('Metales: redondeo por línea y precisión de peso/precio', async () => {
    const r = await post('/metal-purchases/cotizar', { detalles: [{ ...line, peso_bruto: '0.001', precio_gramo: '5' }, { ...line, metal: 'PLATA', pureza: '925', peso_bruto: '1.001', deducciones: '0.001', precio_gramo: '0.005' }] }, undefined, f.token); ok(r);
    assert.equal(r.body.total, '0.02'); assert.equal(r.body.detalles[1].peso_neto, '1.000');
  });
  for (const [label, change] of [['peso neto cero', { deducciones: '10' }], ['pureza fuera de rango', { pureza: '1001' }], ['resultado inconcluso', { resultado_concluyente: false }], ['precio cero', { precio_gramo: '0' }], ['precio negativo', { precio_gramo: '-1' }], ['precisión excedida', { peso_bruto: '1.0001' }], ['valor exponencial', { precio_gramo: '1e2' }]]) {
    await check(`Metales rechaza ${label}`, async () => assert.equal((await post('/metal-purchases/cotizar', { detalles: [{ ...line, ...change }] }, undefined, f.token)).status, 400));
  }
  await check('Metales: punto deshabilitado por defecto y operador no puede habilitarlo', async () => {
    assert.equal((await post('/metal-purchases', payload, randomUUID(), f.token)).status, 403);
    assert.equal((await req(`/metal-purchases/configuracion/${f.point.id}`, 'PUT', { habilitado: true, motivo: 'Intento prohibido' }, f.token)).status, 403);
    ok(await enable(f)); ok(await enable(g)); ok(await enable(pending));
    assert.equal(await prisma.eventoCompraMetal.count({ where: { accion: 'CONFIGURACION' } }), 3);
  });
  await check('Metales: apertura incompleta bloquea ambos medios', async () => {
    for (const body of [payload, bankPayload]) assert.equal((await post('/metal-purchases', body, randomUUID(), pending.token)).status, 409);
    assert.equal(await prisma.compraMetal.count(), 0);
  });
  for (const [label, body] of [['falta banco', { ...bankPayload, banco: undefined }], ['falta referencia', { ...bankPayload, referencia: undefined }], ['banco y efectivo mezclados', { ...bankPayload, billetes: '600' }], ['desglose incorrecto', { ...payload, billetes: '599' }], ['datos bancarios en efectivo', { ...payload, banco: 'No permitido' }]]) {
    await check(`Metales pago: ${label}`, async () => assert.equal((await post('/metal-purchases', body, randomUUID(), f.token)).status, 400));
  }
  let purchase;
  const key = randomUUID();
  await check('Metales: doble confirmación concurrente genera un egreso, recibo y pieza', async () => {
    const results = await Promise.all([post('/metal-purchases', payload, key, f.token), post('/metal-purchases', payload, key, f.token)]);
    results.forEach(ok); purchase = results[0].body.compra; assert.equal(results[1].body.compra.id, purchase.id);
    const b = await balance(f); assert.equal(b.cantidad.toString(), '400'); assert.equal(b.billetes.toString(), '400'); assert.equal(b.bancos.toString(), '0');
    assert.equal(await prisma.compraMetal.count({ where: { punto_atencion_id: f.point.id } }), 1);
    assert.equal(await prisma.movimientoSaldo.count({ where: { referencia_id: purchase.id } }), 1);
    assert.equal(await prisma.recibo.count({ where: { referencia_id: purchase.id } }), 1);
    assert.equal(purchase.detalles[0].subtotal, '600'); assert.ok(purchase.detalles[0].codigo_pieza);
  });
  await check('Metales: misma clave con datos distintos es conflicto, consulta del intento recupera recibo', async () => {
    assert.equal((await post('/metal-purchases', { ...payload, vendedor: { ...payload.vendedor, nombre: 'Otro' } }, key, f.token)).status, 409);
    const r = await req(`/metal-purchases/intento/${key}`, 'GET', null, f.token); ok(r); assert.equal(r.body.compra.id, purchase.id);
    const absent = await req(`/metal-purchases/intento/${randomUUID()}`, 'GET', null, f.token); ok(absent); assert.equal(absent.body.compra, null);
  });
  await check('Metales: insuficiencia de caja no deja piezas ni pagos', async () => {
    const before = await balance(f);
    assert.equal((await post('/metal-purchases', payload, randomUUID(), f.token)).status, 409);
    assert.deepEqual(await balance(f), before); assert.equal(await prisma.compraMetal.count({ where: { punto_atencion_id: f.point.id } }), 1);
  });
  await check('Metales: compras distintas concurrentes no sobregiran caja', async () => {
    const small = { ...payload, detalles: [{ ...line, peso_bruto: '5' }], billetes: '300' };
    const responses = await Promise.all([1, 2].map(() => post('/metal-purchases', small, randomUUID(), f.token)));
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
    assert.equal((await balance(f)).cantidad.toString(), '100');
    const created = responses.find(r => r.status === 201).body.compra;
    // Restore the fixture through the real, documented reversal route.
    ok(await post(`/metal-purchases/${created.id}/reversar`, { motivo: 'Restablecer prueba concurrente', piezas_devueltas: true, evidencia_devolucion: 'Pieza de prueba devuelta al vendedor', evidencia_dinero: 'Recuperados trescientos ficticios', billetes: '300', monedas: '0' }, undefined, adminToken));
  });
  let bankPurchase;
  await check('Metales: transferencia sin efectivo permite bancos negativos, mantiene caja', async () => {
    const before = await balance(g);
    const r = await post('/metal-purchases', bankPayload, randomUUID(), g.token); ok(r); bankPurchase = r.body.compra;
    const after = await balance(g);
    assert.equal(after.bancos.toString(), '-600'); for (const col of ['cantidad', 'billetes', 'monedas_fisicas']) assert.equal(after[col].toString(), before[col].toString());
    const move = await prisma.movimientoSaldo.findFirstOrThrow({ where: { referencia_id: bankPurchase.id } });
    assert.equal(move.monto.toString(), '-600'); assert.match(move.descripcion, /BANCOS/);
  });
  await check('Metales: reportes y conciliación distinguen caja de bancos', async () => {
    const { saldoReconciliationService } = await import('../../server/services/saldoReconciliationService.ts');
    assert.equal(await saldoReconciliationService.calcularSaldoReal(f.point.id, usd.id), 400);
    assert.equal(await saldoReconciliationService.calcularSaldoReal(g.point.id, usd.id), 0);
    const r = await req('/metal-purchases', 'GET', null, f.token); ok(r); assert.equal(r.body.cantidad, 2); assert.equal(r.body.totales.find(t => t.estado === 'PAGADA')._sum.total, '600');
    assert.equal(r.body.metales[0]._sum.peso_neto, '10');
    assert.equal((await req('/metal-purchases?desde=2026-02-30', 'GET', null, f.token)).status, 400);
    assert.equal((await req('/metal-purchases?desde=2026-09-15&hasta=2026-09-14', 'GET', null, f.token)).status, 400);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
    const report = await req(`/contabilidad-diaria/${f.point.id}/${date}`, 'GET', null, f.token); ok(report);
    const summary = report.body.resumen.find(row => row.moneda_id === usd.id);
    assert.equal(summary.egresos, 900); assert.equal(summary.ingresos, 300);
  });
  await check('Metales: permisos impiden detalle ajeno y creación administrativa', async () => {
    assert.equal((await req(`/metal-purchases/${purchase.id}`, 'GET', null, g.token)).status, 404);
    assert.equal((await post('/metal-purchases', payload, randomUUID(), adminToken)).status, 403);
  });
  await check('Metales: fallo al guardar recibo revierte compra, piezas, evento y saldo', async () => {
    await pool.query(`CREATE FUNCTION fail_metal_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.numero_recibo LIKE 'MET-%' THEN RAISE EXCEPTION 'synthetic receipt failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_metal_receipt BEFORE INSERT ON "Recibo" FOR EACH ROW EXECUTE FUNCTION fail_metal_receipt();`);
    const before = await balance(g), count = await prisma.compraMetal.count();
    try { assert.equal((await post('/metal-purchases', bankPayload, randomUUID(), g.token)).status, 500); assert.deepEqual(await balance(g), before); assert.equal(await prisma.compraMetal.count(), count); }
    finally { await pool.query('DROP TRIGGER fail_metal_receipt ON "Recibo"; DROP FUNCTION fail_metal_receipt();'); }
  });
  const evidence = { motivo: 'Devolución ficticia documentada', piezas_devueltas: true, evidencia_devolucion: 'Todas las piezas identificadas entregadas al vendedor ficticio', evidencia_dinero: 'Importe recuperado íntegramente en esta prueba' };
  await check('Metales: reverso requiere administrador y evidencia completa', async () => {
    assert.equal((await post(`/metal-purchases/${purchase.id}/reversar`, { ...evidence, billetes: '600', monedas: '0' }, undefined, f.token)).status, 403);
    assert.equal((await post(`/metal-purchases/${purchase.id}/reversar`, { ...evidence, piezas_devueltas: false }, undefined, adminToken)).status, 400);
    assert.equal((await post(`/metal-purchases/${purchase.id}/reversar`, { ...evidence, billetes: '599', monedas: '0' }, undefined, adminToken)).status, 400);
  });
  await check('Metales: reverso concurrente devuelve una sola vez y conserva historial', async () => {
    const results = await Promise.all([1, 2].map(() => post(`/metal-purchases/${purchase.id}/reversar`, { ...evidence, billetes: '590', monedas: '10' }, undefined, adminToken)));
    results.forEach(ok); const b = await balance(f); assert.equal(b.cantidad.toString(), '1000'); assert.equal(b.billetes.toString(), '990'); assert.equal(b.monedas_fisicas.toString(), '10');
    assert.equal(await prisma.movimientoSaldo.count({ where: { referencia_id: purchase.id } }), 2);
    assert.equal(await prisma.eventoCompraMetal.count({ where: { compra_id: purchase.id, accion: 'REVERSO' } }), 1);
    assert.equal((await prisma.compraMetal.findUniqueOrThrow({ where: { id: purchase.id } })).estado, 'REVERSADA');
  });
  await check('Metales: reverso bancario recupera bancos y no caja', async () => {
    ok(await post(`/metal-purchases/${bankPurchase.id}/reversar`, evidence, undefined, adminToken));
    const b = await balance(g); assert.equal(b.bancos.toString(), '0'); assert.equal(b.cantidad.toString(), '0');
  });
  await check('Metales: jornada en almuerzo bloquea compra', async () => {
    await prisma.jornada.update({ where: { id: g.jornada.id }, data: { estado: 'ALMUERZO' } });
    try { assert.equal((await post('/metal-purchases', bankPayload, randomUUID(), g.token)).status, 409); }
    finally { await prisma.jornada.update({ where: { id: g.jornada.id }, data: { estado: 'ACTIVO' } }); }
  });
  await check('Metales: moneda pendiente bloquea caja y permite registro bancario', async () => {
    const currency = await prisma.moneda.create({ data: { codigo: 'XMT', nombre: 'Moneda ficticia de prueba', simbolo: 'XMT' } });
    // Bank-only first balance is allowed even when this currency was not in the opening.
    const r = await post('/metal-purchases', { ...bankPayload, moneda_id: currency.id }, randomUUID(), g.token); ok(r);
    assert.equal((await post('/metal-purchases', { ...payload, moneda_id: currency.id }, randomUUID(), g.token)).status, 409);
  });
  await check('Metales: cierre original impide reversos y reintento no vuelve a pagar', async () => {
    const k = randomUUID(); const r = await post('/metal-purchases', bankPayload, k, g.token); ok(r);
    await prisma.jornada.update({ where: { id: g.jornada.id }, data: { estado: 'COMPLETADO', fecha_salida: new Date() } });
    assert.equal((await post(`/metal-purchases/${r.body.compra.id}/reversar`, evidence, undefined, adminToken)).status, 409);
    const replay = await post('/metal-purchases', bankPayload, k, g.token); ok(replay); assert.equal(replay.body.compra.id, r.body.compra.id);
    const fresh = await post('/metal-purchases', bankPayload, randomUUID(), g.token); assert.ok([403, 409].includes(fresh.status));
  });
  await check('Metales: SQL impide pureza y pago inválidos', async () => {
    await assert.rejects(pool.query('UPDATE "DetalleCompraMetal" SET pureza=1001 WHERE compra_id=$1', [purchase.id]), /DetalleCompraMetal_values_check/);
    await assert.rejects(pool.query('UPDATE "CompraMetal" SET total=0 WHERE id=$1', [purchase.id]), /CompraMetal_payment_check/);
  });
  if (browserMode) {
    const b = await fixture('000 METALES NAVEGADOR'); ok(await enable(b));
    await prisma.usuario.update({ where: { id: b.user.id }, data: { username: 'navegador_metales' } });
  }
}
