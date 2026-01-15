import fs from 'fs';
import os from 'os';
import path from 'path';

const migrationsPath = path.join(process.cwd(), 'prisma', 'migrations');
const tmpDir = fs.existsSync('/tmp') ? '/tmp' : os.tmpdir();
const backupDir = path.join(tmpDir, `prisma_migrations_backup_${Date.now()}`);

function log(...args: unknown[]) {
  console.log('[clear-migrations]', ...args);
}

try {
  if (!fs.existsSync(migrationsPath)) {
    log('No existe carpeta prisma/migrations — nada que limpiar.');
    process.exit(0);
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const dest = path.join(backupDir, 'migrations');
  fs.renameSync(migrationsPath, dest);
  log(`Migraciones movidas a backup: ${dest}`);
  log('Si quieres recuperarlas, mueve la carpeta de vuelta o restaura desde el backup.');
} catch (err) {
  console.error('[clear-migrations] Error:', err);
  process.exit(1);
}

process.exit(0);
