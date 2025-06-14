
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando semilla limpia de la base de datos...');

  // Limpiar datos existentes en el orden correcto para evitar violaciones de clave foránea
  console.log('🧹 Limpiando datos existentes...');
  await prisma.detalleCuadreCaja.deleteMany();
  await prisma.cuadreCaja.deleteMany();
  await prisma.recibo.deleteMany();
  await prisma.transferencia.deleteMany();
  await prisma.cambioDivisa.deleteMany();
  await prisma.movimiento.deleteMany();
  await prisma.jornada.deleteMany();
  await prisma.solicitudSaldo.deleteMany();
  await prisma.historialSaldo.deleteMany();
  await prisma.saldo.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.puntoAtencion.deleteMany();
  await prisma.moneda.deleteMany();

  // Crear monedas básicas
  console.log('📄 Creando monedas...');
  const monedas = await Promise.all([
    prisma.moneda.upsert({
      where: { codigo: 'USD' },
      update: {},
      create: {
        nombre: 'Dólar Estadounidense',
        simbolo: '$',
        codigo: 'USD',
        activo: true,
        orden_display: 1
      }
    }),
    prisma.moneda.upsert({
      where: { codigo: 'EUR' },
      update: {},
      create: {
        nombre: 'Euro',
        simbolo: '€',
        codigo: 'EUR',
        activo: true,
        orden_display: 2
      }
    }),
    prisma.moneda.upsert({
      where: { codigo: 'VES' },
      update: {},
      create: {
        nombre: 'Bolívar Venezolano',
        simbolo: 'Bs',
        codigo: 'VES',
        activo: true,
        orden_display: 3
      }
    })
  ]);

  console.log(`✅ ${monedas.length} monedas creadas`);

  // Crear solo usuario administrador
  console.log('👤 Creando usuario administrador...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.usuario.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      rol: 'ADMIN',
      nombre: 'Administrador Principal',
      correo: 'admin@puntocambio.com',
      telefono: '+58 212-555-0000',
      activo: true
      // Sin punto_atencion_id para que el admin pueda gestionar todos
    }
  });

  console.log(`✅ Usuario administrador creado: ${admin.username}`);

  console.log('🎉 ¡Semilla limpia completada exitosamente!');
  console.log('\n📋 Sistema limpio con:');
  console.log(`- ${monedas.length} monedas básicas`);
  console.log('- 1 administrador principal');
  console.log('- Base de datos lista para configuración inicial');
  console.log('\n🔑 Credenciales:');
  console.log('Usuario: admin / Contraseña: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error en la semilla:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
