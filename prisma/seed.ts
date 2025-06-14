
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando limpieza completa de la base de datos...');

  // Eliminar todos los datos en el orden correcto para evitar violaciones de clave foránea
  console.log('🧹 Eliminando todos los datos existentes...');
  
  // Primero eliminar tablas que dependen de otras
  await prisma.detalleCuadreCaja.deleteMany();
  console.log('✅ DetalleCuadreCaja eliminados');
  
  await prisma.recibo.deleteMany();
  console.log('✅ Recibos eliminados');
  
  await prisma.transferencia.deleteMany();
  console.log('✅ Transferencias eliminadas');
  
  await prisma.cambioDivisa.deleteMany();
  console.log('✅ Cambios de divisa eliminados');
  
  await prisma.movimiento.deleteMany();
  console.log('✅ Movimientos eliminados');
  
  await prisma.jornada.deleteMany();
  console.log('✅ Jornadas eliminadas');
  
  await prisma.cuadreCaja.deleteMany();
  console.log('✅ Cuadres de caja eliminados');
  
  await prisma.solicitudSaldo.deleteMany();
  console.log('✅ Solicitudes de saldo eliminadas');
  
  await prisma.historialSaldo.deleteMany();
  console.log('✅ Historial de saldos eliminado');
  
  await prisma.saldo.deleteMany();
  console.log('✅ Saldos eliminados');
  
  // Ahora eliminar usuarios
  await prisma.usuario.deleteMany();
  console.log('✅ Usuarios eliminados');
  
  // Eliminar puntos de atención
  await prisma.puntoAtencion.deleteMany();
  console.log('✅ Puntos de atención eliminados');
  
  // Eliminar monedas
  await prisma.moneda.deleteMany();
  console.log('✅ Monedas eliminadas');

  console.log('🎯 Base de datos completamente limpia');

  // Crear monedas básicas
  console.log('💰 Creando monedas básicas...');
  const monedas = await Promise.all([
    prisma.moneda.create({
      data: {
        nombre: 'Dólar Estadounidense',
        simbolo: '$',
        codigo: 'USD',
        activo: true,
        orden_display: 1
      }
    }),
    prisma.moneda.create({
      data: {
        nombre: 'Euro',
        simbolo: '€',
        codigo: 'EUR',
        activo: true,
        orden_display: 2
      }
    }),
    prisma.moneda.create({
      data: {
        nombre: 'Bolívar Venezolano',
        simbolo: 'Bs',
        codigo: 'VES',
        activo: true,
        orden_display: 3
      }
    })
  ]);

  console.log(`✅ ${monedas.length} monedas creadas`);

  // Crear SOLO el usuario administrador
  console.log('👤 Creando usuario administrador...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.usuario.create({
    data: {
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

  console.log('🎉 ¡Base de datos completamente limpia y lista!');
  console.log('\n📋 Estado actual del sistema:');
  console.log(`- ${monedas.length} monedas básicas (USD, EUR, VES)`);
  console.log('- 1 usuario administrador único');
  console.log('- 0 puntos de atención (crear desde el panel admin)');
  console.log('- 0 transferencias');
  console.log('- 0 jornadas o horarios');
  console.log('- 0 saldos o movimientos');
  console.log('\n🔑 Credenciales de acceso:');
  console.log('Usuario: admin');
  console.log('Contraseña: admin123');
  console.log('\n🚀 Ahora puedes comenzar a crear puntos de atención y configurar el sistema desde cero');
}

main()
  .catch((e) => {
    console.error('❌ Error en la limpieza:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
