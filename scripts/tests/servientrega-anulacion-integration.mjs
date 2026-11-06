// Escenarios de generación + anulación de guías Servientrega (datos ficticios, BD temporal).
// Invocado desde integration-local.mjs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cents = (v) => Math.round(Number(v ?? 0) * 100);

export async function testServientregaAnulacion({ prisma, pool, check, usd, user }) {
  const { ServientregaDBService } = await import('../../server/services/servientregaDBService.ts');
  const db = new ServientregaDBService();
  const concesionario = await prisma.usuario.create({ data: { username: `concesion_${randomUUID().slice(0, 8)}`, nombre: 'Franquicia ficticia', password: 'NO_LOGIN', rol: 'CONCESION' } });

  // Restricciones CHECK de producción (scripts db:hardening) para validar que los movimientos las cumplen
  const checks = [
    `ALTER TABLE "ServicioExternoMovimiento" ADD CONSTRAINT test_se_nonneg CHECK (COALESCE(billetes,0) >= 0 AND COALESCE(monedas_fisicas,0) >= 0 AND COALESCE(bancos,0) >= 0) NOT VALID`,
    `ALTER TABLE "ServicioExternoMovimiento" ADD CONSTRAINT test_se_metodo CHECK (CASE WHEN metodo_ingreso = 'EFECTIVO' THEN COALESCE(bancos,0) = 0 AND (COALESCE(billetes,0) + COALESCE(monedas_fisicas,0)) = monto WHEN metodo_ingreso = 'BANCO' THEN COALESCE(billetes,0) = 0 AND COALESCE(monedas_fisicas,0) = 0 AND COALESCE(bancos,0) = monto WHEN metodo_ingreso = 'MIXTO' THEN (COALESCE(billetes,0) + COALESCE(monedas_fisicas,0) + COALESCE(bancos,0)) = monto ELSE true END) NOT VALID`,
  ];
  for (const sql of checks) await prisma.$executeRawUnsafe(sql);

  const setup = async (label) => {
    const p = await prisma.puntoAtencion.create({ data: { nombre: `SERVIENTREGA ${label}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    await prisma.servicioExternoSaldo.create({ data: { punto_atencion_id: p.id, servicio: 'SERVIENTREGA', moneda_id: usd.id, cantidad: 100, billetes: 100 } });
    await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: usd.id, cantidad: 500, billetes: 450, monedas_fisicas: 50, bancos: 20 } });
    await prisma.saldoInicial.create({ data: { punto_atencion_id: p.id, moneda_id: usd.id, cantidad_inicial: 500, asignado_por: user.id } });
    return p;
  };
  const snapshot = async (p) => {
    const se = await prisma.servicioExternoSaldo.findFirstOrThrow({ where: { punto_atencion_id: p.id, servicio: 'SERVIENTREGA' } });
    const s = await prisma.saldo.findUniqueOrThrow({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: usd.id } } });
    return { se: cents(se.cantidad), seBilletes: cents(se.billetes), caja: cents(s.cantidad), billetes: cents(s.billetes), monedas: cents(s.monedas_fisicas), bancos: cents(s.bancos) };
  };
  // Replica la transacción de POST /generar-guia
  const generar = async (p, monto, { billetes = 0, monedas = 0, bancos = 0, concesion = false } = {}) => {
    const numero = `TEST${randomUUID().slice(0, 8)}`;
    await prisma.$transaction(async (tx) => {
      await db.guardarGuia({ numero_guia: numero, proceso: 'Guia Generada', punto_atencion_id: p.id, costo_envio: monto, ...(concesion ? { usuario_id: concesionario.id } : {}) }, tx);
      await db.descontarSaldo(p.id, monto, numero, tx);
      await db.registrarIngresoServicioExterno(p.id, monto, numero, billetes, monedas, bancos, !concesion, tx);
    });
    return numero;
  };

  try {
    await check('Servientrega: operador efectivo — anular revierte exacto y no duplica', async () => {
      const p = await setup('operador efectivo');
      const inicial = await snapshot(p);
      const guia = await generar(p, 12.5, { billetes: 12, monedas: 0.5 });
      const tras = await snapshot(p);
      assert.equal(tras.se, inicial.se - 1250);
      assert.equal(tras.caja, inicial.caja + 1250);
      const r1 = await db.anularGuiaConReversion(guia);
      assert.equal(r1.resultado, 'ANULADA');
      assert.deepEqual(await snapshot(p), inicial);
      const r2 = await db.anularGuiaConReversion(guia);
      assert.equal(r2.resultado, 'YA_ANULADA');
      assert.deepEqual(await snapshot(p), inicial, 'la segunda anulación no debe mover dinero');
    });

    await check('Servientrega: operador banco — revierte bancos, no caja', async () => {
      const p = await setup('operador banco');
      const inicial = await snapshot(p);
      const guia = await generar(p, 8, { bancos: 8 });
      assert.equal((await snapshot(p)).bancos, inicial.bancos + 800);
      await db.anularGuiaConReversion(guia);
      assert.deepEqual(await snapshot(p), inicial);
    });

    await check('Servientrega: franquicia — solo devuelve saldo Servientrega, no toca caja', async () => {
      const p = await setup('franquicia');
      const inicial = await snapshot(p);
      const guia = await generar(p, 15, { concesion: true });
      const tras = await snapshot(p);
      assert.equal(tras.se, inicial.se - 1500);
      assert.equal(tras.caja, inicial.caja, 'franquicia no ingresa a caja');
      await db.anularGuiaConReversion(guia);
      assert.deepEqual(await snapshot(p), inicial);
    });

    await check('Servientrega: anulaciones concurrentes revierten una sola vez', async () => {
      const p = await setup('concurrente');
      const inicial = await snapshot(p);
      const guia = await generar(p, 10);
      const resultados = await Promise.all([db.anularGuiaConReversion(guia), db.anularGuiaConReversion(guia)]);
      assert.deepEqual(resultados.map(r => r.resultado).sort(), ['ANULADA', 'YA_ANULADA']);
      assert.deepEqual(await snapshot(p), inicial);
      const reversiones = await prisma.servicioExternoMovimiento.count({ where: { numero_referencia: guia, descripcion: { startsWith: 'Reversión' } } });
      assert.equal(reversiones, 1);
    });

    await check('Servientrega: solicitud de anulación duplicada se rechaza', async () => {
      const p = await setup('solicitud doble');
      const guia = await generar(p, 5);
      const g = await prisma.servientregaGuia.findUniqueOrThrow({ where: { numero_guia: guia } });
      const data = { guia_id: g.id, numero_guia: guia, motivo_anulacion: 'Prueba', solicitado_por: 'X', solicitado_por_nombre: 'X' };
      await db.crearSolicitudAnulacion(data);
      await assert.rejects(() => db.crearSolicitudAnulacion(data), (e) => e.status === 409);
      assert.equal(await prisma.servientregaSolicitudAnulacion.count({ where: { numero_guia: guia } }), 1);
    });
    const leerConciliacion = async () => {
      const sqlFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '../db/conciliacion-servientrega.sql');
      const lineas = (await fs.readFile(sqlFile, 'utf8')).split(/\r?\n/);
      const sql = lineas.filter((l) => !l.startsWith(String.fromCharCode(92)) && !l.startsWith('--')).join('\n');
      const sentencias = sql.split(';').map((x) => x.trim()).filter(Boolean);
      assert.equal(sentencias.length, 2);
      return async () => prisma.$queryRawUnsafe(sentencias[1].replace(/LIMIT 40$/, ''));
    };

    await check('Servientrega: conciliación limpia con datos correctos', async () => {
      const detalle = await leerConciliacion();
      const p = await setup('conciliacion');
      const guias = [await generar(p, 7), await generar(p, 4, { bancos: 4 }), await generar(p, 6, { concesion: true })];
      await db.anularGuiaConReversion(guias[1]);
      const nuestras = (await detalle()).filter((r) => guias.includes(r.numero_guia));
      assert.deepEqual(nuestras, [], JSON.stringify(nuestras));
    });

    await check('Servientrega: script de reparación corrige descuadres históricos y es idempotente', async () => {
      const detalle = await leerConciliacion();
      const { planRepair, applyRepair, ANULADAS_EN_SERVIENTREGA } = await import('../db/repair-servientrega-anulaciones.mjs');
      const sistema = await prisma.usuario.findFirstOrThrow({ where: { correo: 'system@puntocambio.com' } });
      // Reproduce lo que hacía el código anterior en una reversión
      const reversionAntigua = async (p, guia, monto, conCaja) => {
        await prisma.servicioExternoMovimiento.create({ data: { punto_atencion_id: p.id, servicio: 'SERVIENTREGA', tipo_movimiento: 'EGRESO', moneda_id: usd.id, monto, numero_referencia: guia, descripcion: `Reversión por cancelación de guía Servientrega #${guia}`, usuario_id: sistema.id, billetes: monto, monedas_fisicas: 0, bancos: 0 } });
        await prisma.servicioExternoSaldo.updateMany({ where: { punto_atencion_id: p.id, servicio: 'SERVIENTREGA' }, data: { cantidad: { increment: monto }, billetes: { increment: monto } } });
        if (conCaja) {
          await prisma.movimientoSaldo.create({ data: { punto_atencion_id: p.id, moneda_id: usd.id, tipo_movimiento: 'EGRESO', monto: -monto, saldo_anterior: 0, saldo_nuevo: 0, usuario_id: sistema.id, tipo_referencia: 'SERVIENTREGA', referencia_id: guia, descripcion: `Reversión (CAJA) guía Servientrega #${guia}` } });
          await prisma.saldo.update({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: usd.id } }, data: { cantidad: { decrement: monto }, billetes: { decrement: monto } } });
        }
      };
      const franq = await setup('reparacion franquicia');
      const oper = await setup('reparacion operador');
      const inicialF = await snapshot(franq);
      const inicialO = await snapshot(oper);

      // a) franquicia anulada: caja restada sin haber ingresado
      const gA = await generar(franq, 6.47, { concesion: true });
      await prisma.servientregaGuia.update({ where: { numero_guia: gA }, data: { estado: 'ANULADA' } });
      await reversionAntigua(franq, gA, 6.47, true);
      // b) franquicia con devolución duplicada
      const gB = await generar(franq, 10.01, { concesion: true });
      await prisma.servientregaGuia.update({ where: { numero_guia: gB }, data: { estado: 'ANULADA' } });
      await reversionAntigua(franq, gB, 10.01, true);
      await reversionAntigua(franq, gB, 10.01, true);
      // c) operador con devolución duplicada
      const gC = await generar(oper, 2.24);
      await prisma.servientregaGuia.update({ where: { numero_guia: gC }, data: { estado: 'ANULADA' } });
      await reversionAntigua(oper, gC, 2.24, true);
      await reversionAntigua(oper, gC, 2.24, true);
      // d) guía anulada en Servientrega que quedó ACTIVA localmente (franquicia)
      const gD = ANULADAS_EN_SERVIENTREGA[2];
      await prisma.$transaction(async (tx) => {
        await db.guardarGuia({ numero_guia: gD, proceso: 'Guia Generada', punto_atencion_id: franq.id, costo_envio: 29.43, usuario_id: concesionario.id }, tx);
        await db.descontarSaldo(franq.id, 29.43, gD, tx);
        await db.registrarIngresoServicioExterno(franq.id, 29.43, gD, 0, 0, 0, false, tx);
      });
      await reversionAntigua(franq, gD, 29.43, true);

      const nuestras = [gA, gB, gC, gD];
      assert.equal((await detalle()).filter((r) => nuestras.includes(r.numero_guia)).length, 4);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const plan = await planRepair(client);
        assert.deepEqual(plan.marcar, [gD]);
        await applyRepair(client, plan);
        const despues = await planRepair(client);
        assert.equal(despues.marcar.length + despues.acciones.length, 0, 'segunda pasada sin acciones');
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }

      const restantes = (await detalle()).filter((r) => nuestras.includes(r.numero_guia));
      assert.deepEqual(restantes, [], JSON.stringify(restantes));
      // Todo vuelve al estado inicial: las 4 guías quedaron anuladas y revertidas una sola vez
      assert.deepEqual(await snapshot(franq), inicialF);
      assert.deepEqual(await snapshot(oper), inicialO);
      assert.equal((await prisma.servientregaGuia.findUniqueOrThrow({ where: { numero_guia: gD } })).estado, 'ANULADA');
    });
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ServicioExternoMovimiento" DROP CONSTRAINT IF EXISTS test_se_nonneg`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ServicioExternoMovimiento" DROP CONSTRAINT IF EXISTS test_se_metodo`);
  }
}
