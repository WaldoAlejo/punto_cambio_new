import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Ejecutando seed-fresh: truncando todas las tablas (public) ...');

  // Obtener tablas en el esquema public, excluir tablas internas de prisma
  const rows: Array<{ tablename: string }> = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'` as any;
  const tables = rows
    .map(r => r.tablename)
    .filter(t => !t.startsWith('prisma_') && t !== '_prisma_migrations');

  if (tables.length === 0) {
    console.log('No hay tablas para truncar.');
  } else {
    const quoted = tables.map(t => `"${t}"`).join(', ');
    console.log('Truncating tables:', quoted);
    // Usamos executeRawUnsafe para construir la sentencia TRUNCATE
    await prisma.$executeRawUnsafe(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE;`);
    console.log('✅ Todas las tablas truncadas.');
  }

  // Si quieres datos iniciales mínimos, puedes descomentar y ajustarlos aquí
  // Ejemplo: crear monedas básicas y un usuario admin (opcional)
  /*
  await prisma.moneda.createMany({
    data: [
      { nombre: 'Dólar Estadounidense', simbolo: '$', codigo: 'USD', activo: true, orden_display: 1 },
      { nombre: 'Euro', simbolo: '€', codigo: 'EUR', activo: true, orden_display: 2 },
    ],
  });
  await prisma.usuario.create({
    data: {
      username: 'admin',
      password: 'REPLACE_WITH_STRONG_HASHED_PASS',
      rol: 'ADMIN',
      nombre: 'Administrador',
      correo: 'admin@example.com',
      activo: true,
    },
  });
  */

  console.log('Seed-fresh finalizado. La base de datos está limpia.');
}

main()
  .catch(e => {
    console.error('Error en seed-fresh:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
