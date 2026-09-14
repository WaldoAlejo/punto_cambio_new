import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partialPosting } from '../../server/utils/partialPosting.js';
import { remainingPartialAmounts } from '../../server/utils/partialCashSettlement.js';

test('abono 5,01 mixto conserva el total sin duplicar el medio centavo', () => {
  assert.deepEqual(partialPosting(500, 500, 501, 1000), [251, 250]);
  assert.deepEqual(partialPosting(500, 500, 499, 1000), [250, 249]);
});
test('todo abono conserva centavos y no supera cada componente completo', () => {
  for (const [cash, bank] of [[500, 500], [0, 1000], [1000, 0], [1, 999], [999, 1], [333, 777]]) {
    for (let paid = 0; paid <= 1000; paid++) {
      const [a, b] = partialPosting(cash, bank, paid, 1000);
      assert.equal(a + b, Math.round((cash + bank) * paid / 1000));
      assert.ok(a >= 0 && a <= cash && b >= 0 && b <= bank);
    }
  }
});
test('rechaza entradas invalidas o abonos mayores al total', () => {
  for (const args of [[1.5, 1, 1, 2], [-1, 2, 1, 2], [1, 1, 3, 2], [1, 1, 0, 0], [Infinity, 1, 1, 2]]) {
    assert.throws(() => partialPosting(...args as [number, number, number, number]));
  }
});

test('liquidacion admite el redondeo anterior verificable y descuenta lo realmente registrado', async () => {
  const cambio = { id: 'cambio', punto_atencion_id: 'punto', moneda_origen_id: 'a', moneda_destino_id: 'b',
    divisas_entregadas_total: 10, divisas_recibidas_total: 10, monto_destino: 10, abono_inicial_monto: 5.01,
    metodo_pago_origen: 'MIXTO', metodo_entrega: 'mixto', usd_recibido_efectivo: 5, usd_recibido_transfer: 5,
    usd_entregado_efectivo: 5, usd_entregado_transfer: 5 };
  const movements = ['a', 'b'].flatMap(moneda_id => ['efectivo', 'bancos'].map(descripcion => {
    const monto = moneda_id === 'a' ? 2.51 : -2.51;
    return { moneda_id, descripcion, monto, punto_atencion_id: 'punto', saldo_anterior: 10, saldo_nuevo: 10 + monto };
  }));
  const tx = { movimientoSaldo: { findMany: async () => movements } };
  assert.deepEqual(await remainingPartialAmounts(tx as unknown as Parameters<typeof remainingPartialAmounts>[0],
    cambio as unknown as Parameters<typeof remainingPartialAmounts>[1]),
    { ingresoEf: 2.49, ingresoBk: 2.49, egresoEf: 2.49, egresoBk: 2.49 });
});
