
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando semilla de la base de datos...');

  // Crear monedas
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
      where: { codigo: 'ARS' },
      update: {},
      create: {
        nombre: 'Peso Argentino',
        simbolo: '$',
        codigo: 'ARS',
        activo: true,
        orden_display: 3
      }
    }),
    prisma.moneda.upsert({
      where: { codigo: 'BRL' },
      update: {},
      create: {
        nombre: 'Real Brasileño',
        simbolo: 'R$',
        codigo: 'BRL',
        activo: true,
        orden_display: 4
      }
    })
  ]);

  console.log(`✅ ${monedas.length} monedas creadas/actualizadas`);

  // Crear puntos de atención
  console.log('📍 Creando puntos de atención...');
  const puntos = await Promise.all([
    prisma.puntoAtencion.upsert({
      where: { id: 'punto-centro' },
      update: {},
      create: {
        id: 'punto-centro',
        nombre: 'Punto Centro',
        direccion: 'Av. Principal 123',
        ciudad: 'Buenos Aires',
        provincia: 'Buenos Aires',
        codigo_postal: '1000',
        telefono: '+54 11 1234-5678',
        activo: true
      }
    }),
    prisma.puntoAtencion.upsert({
      where: { id: 'punto-norte' },
      update: {},
      create: {
        id: 'punto-norte',
        nombre: 'Punto Norte',
        direccion: 'Calle Norte 456',
        ciudad: 'Buenos Aires',
        provincia: 'Buenos Aires',
        codigo_postal: '1001',
        telefono: '+54 11 2345-6789',
        activo: true
      }
    }),
    prisma.puntoAtencion.upsert({
      where: { id: 'punto-oeste' },
      update: {},
      create: {
        id: 'punto-oeste',
        nombre: 'Punto Oeste',
        direccion: 'Av. Oeste 789',
        ciudad: 'Buenos Aires',
        provincia: 'Buenos Aires',
        codigo_postal: '1002',
        telefono: '+54 11 3456-7890',
        activo: true
      }
    })
  ]);

  console.log(`✅ ${puntos.length} puntos de atención creados/actualizados`);

  // Crear usuario administrador
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
      telefono: '+54 11 9999-0000',
      activo: true,
      punto_atencion_id: puntos[0].id
    }
  });

  console.log(`✅ Usuario administrador creado: ${admin.username}`);

  // Crear operadores de ejemplo
  console.log('👥 Creando operadores de ejemplo...');
  const operadores = await Promise.all([
    prisma.usuario.upsert({
      where: { username: 'operador1' },
      update: {},
      create: {
        username: 'operador1',
        password: await bcrypt.hash('admin123', 10),
        rol: 'OPERADOR',
        nombre: 'Operador Punto Centro',
        correo: 'operador1@puntocambio.com',
        activo: true,
        punto_atencion_id: puntos[0].id
      }
    }),
    prisma.usuario.upsert({
      where: { username: 'operador2' },
      update: {},
      create: {
        username: 'operador2',
        password: await bcrypt.hash('admin123', 10),
        rol: 'OPERADOR',
        nombre: 'Operador Punto Norte',
        correo: 'operador2@puntocambio.com',
        activo: true,
        punto_atencion_id: puntos[1].id
      }
    })
  ]);

  console.log(`✅ ${operadores.length} operadores creados/actualizados`);

  // Crear saldos iniciales
  console.log('💰 Creando saldos iniciales...');
  const saldos = [];
  
  for (const punto of puntos) {
    for (const moneda of monedas) {
      const saldo = await prisma.saldo.upsert({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id
          }
        },
        update: {},
        create: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          cantidad: 10000,
          billetes: 100,
          monedas_fisicas: 50
        }
      });
      saldos.push(saldo);
    }
  }

  console.log(`✅ ${saldos.length} saldos iniciales creados/actualizados`);

  console.log('🎉 ¡Semilla completada exitosamente!');
  console.log('\n📋 Datos creados:');
  console.log(`- ${monedas.length} monedas`);
  console.log(`- ${puntos.length} puntos de atención`);
  console.log(`- 1 administrador + ${operadores.length} operadores`);
  console.log(`- ${saldos.length} saldos iniciales`);
  console.log('\n🔑 Credenciales de prueba:');
  console.log('Usuario: admin / Contraseña: admin123');
  console.log('Usuario: operador1 / Contraseña: admin123');
  console.log('Usuario: operador2 / Contraseña: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error en la semilla:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
