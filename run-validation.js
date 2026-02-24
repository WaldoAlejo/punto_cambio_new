const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('=== INICIANDO VALIDACIÓN DE SALDOS ===\n');
  
  const output = execSync('npx ts-node scripts\\validate\\validate-all-saldos-comprehensive.ts', {
    cwd: __dirname,
    encoding: 'utf-8',
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  console.log(output);
  process.exit(0);
} catch (error) {
  console.error('Error ejecutando validación:', error.message);
  if (error.stdout) console.log('STDOUT:', error.stdout.toString());
  if (error.stderr) console.error('STDERR:', error.stderr.toString());
  process.exit(1);
}
