import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const check = port => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../healthcheck.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(port) }, stdio: 'ignore',
  });
  child.on('error', reject);
  child.on('exit', resolve);
});
test('healthcheck distingue salud, error HTTP y servidor detenido', async () => {
  let status = 200;
  const server = createServer((req, res) => { assert.equal(req.url, '/health'); res.writeHead(status); res.end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    assert.equal(await check(port), 0);
    status = 503;
    assert.equal(await check(port), 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
  assert.equal(await check(port), 1);
});
