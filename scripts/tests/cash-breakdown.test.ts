import assert from "node:assert/strict";
import test from "node:test";
import { splitCash } from "../../server/utils/cashBreakdown.js";

test("un centavo no se duplica al repartirlo entre dos componentes", () => {
  assert.deepEqual(splitCash(0.01, 1, 1), { bills: 0.01, coins: 0 });
  assert.deepEqual(splitCash(10.01, 1, 1), { bills: 5.01, coins: 5 });
});

test("el reparto conserva centavos, no negatividad y componentes exclusivos", () => {
  for (let cents = 0; cents <= 1001; cents++) {
    for (const [bills, coins] of [[0, 0], [0, 1], [1, 0], [1, 1], [5, 5.01], [100, 0.01]]) {
      const split = splitCash(cents / 100, bills, coins);
      assert.equal(Math.round(split.bills * 100) + Math.round(split.coins * 100), cents);
      assert.ok(split.bills >= 0 && split.coins >= 0);
      if (bills === 0 && coins > 0) assert.equal(split.bills, 0);
      if (coins === 0) assert.equal(split.coins, 0);
    }
  }
});

test("rechaza importes negativos y no finitos", () => {
  for (const bad of [-1, NaN, Infinity]) {
    assert.throws(() => splitCash(bad, 1, 1));
    assert.throws(() => splitCash(1, bad, 1));
    assert.throws(() => splitCash(1, 1, bad));
  }
});
