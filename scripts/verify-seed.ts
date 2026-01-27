import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySeed() {
  try {
    const [usuarios, puntos, monedas, transferencias, saldos] = await Promise.all([
      prisma.usuario.count(),
      prisma.puntoAtencion.count(),
      prisma.moneda.count(),
      prisma.transferencia.count(),
      prisma.saldo.count(),
    ]);

    console.log('\n📊 Datos en la base de datos:');
    console.log('============================');
    console.log(`✅ Usuarios:        ${usuarios}`);
    console.log(`✅ Puntos:          ${puntos}`);
    console.log(`✅ Monedas:         ${monedas}`);
    console.log(`✅ Transferencias:  ${transferencias}`);
    console.log(`✅ Saldos:          ${saldos}`);
    console.log('============================\n');

    // Mostrar usuarios con sus roles
    console.log('👥 Usuarios creados:');
    const users = await prisma.usuario.findMany({
      select: {
        nombre: true,
        username: true,
        rol: true,
        punto_atencion_id: true,
      },
      orderBy: { nombre: 'asc' },
    });

    users.forEach(user => {
      console.log(`  - ${user.nombre} (@${user.username}) - ${user.rol}${user.punto_atencion_id ? ' [Punto asignado]' : ''}`);
    });

  } catch (error) {
    console.error('❌ Error al verificar seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySeed();
