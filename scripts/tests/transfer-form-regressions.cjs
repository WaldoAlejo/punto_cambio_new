// Isolated form submission checks: no network or production data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

async function submit(kind, amount, coins) {
  const requests = [], errors = [];
  const state = ['destination', 'usd', amount, kind, coins, 'Entrega de efectivo'];
  let index = 0;
  const jsx = (type, props) => ({ type, props });
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/components/transfer/TransferForm.tsx'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const module = { exports: {} };
  const mocks = {
    react: { useState: initial => [index < state.length ? state[index++] : (index++, initial), () => {}], useEffect: () => {} },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/services/transferService': { transferService: { createTransfer: async body => {
      requests.push(body); return { transfer: { id: 'local', monto: body.monto }, error: null };
    } } },
    '@/services/currencyService': {}, '@/services/pointService': {},
    sonner: { toast: { error: message => errors.push(message), success: () => {} } },
  };
  const requireMock = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/components/ui/') || name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error('Unexpected dependency: ' + name);
  };
  new Function('require', 'module', 'exports', outputText)(requireMock, module, module.exports);
  const tree = module.exports.default({ user: { id: 'operator' }, selectedPoint: { id: 'origin' }, onTransferCreated: () => {}, onCancel: () => {} });
  function find(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'form') return node;
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child); if (result) return result; }
    return null;
  }
  const form = find(tree); assert.ok(form);
  await form.props.onSubmit({ preventDefault() {} });
  return { requests, errors };
}

for (const [kind, coins, expected] of [
  ['MONEDAS', '0', { billetes: 0, monedas: 50.25, total: 50.25 }],
  ['BILLETES', '0', { billetes: 50.25, monedas: 0, total: 50.25 }],
  ['COMBINADO', '38.15', { billetes: 12.1, monedas: 38.15, total: 50.25 }],
]) test('Form sends exact physical breakdown: ' + kind, async () => {
  const { requests, errors } = await submit(kind, '50.25', coins);
  assert.deepEqual(errors, []); assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].detalle_divisas, expected);
  assert.equal(requests[0].via, 'EFECTIVO');
});

for (const [amount, coins] of [['50.25', '51'], ['50.25', '0.001'], ['50.251', '0']]) {
  test('Form rejects invalid physical amounts: ' + amount + '/' + coins, async () => {
    const { requests, errors } = await submit('COMBINADO', amount, coins);
    assert.equal(requests.length, 0); assert.equal(errors.length, 1);
  });
}
