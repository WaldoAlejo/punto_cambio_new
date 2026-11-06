// Escenarios de generación + anulación de guías Servientrega (datos ficticios, BD temporal).
// Invocado desde integration-local.mjs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const cents = (v) => Math.round(Number(v ?? 0) * 100);

export async function testServientregaAnulacion({ prisma, check, usd, user }) {
  const { ServientregaDBService } = await import('../../server/services/servientregaDBService.ts');
  const db = new ServientregaDBService();

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
      await db.guardarGuia({ numero_guia: numero, proceso: 'Guia Generada', punto_atencion_id: p.id, costo_envio: monto }, tx);
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
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ServicioExternoMovimiento" DROP CONSTRAINT IF EXISTS test_se_nonneg`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ServicioExternoMovimiento" DROP CONSTRAINT IF EXISTS test_se_metodo`);
  }
}
