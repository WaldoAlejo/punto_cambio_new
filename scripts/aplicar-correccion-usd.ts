import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const PUNTO_ID = 'fa75bb3a-e881-471a-b558-749b0f0de0ff'; // OFICINA ROYAL PACIFIC
  const USD_ID = (await prisma.moneda.findFirst({ where: { codigo: 'USD' } }))!.id;
  const USUARIO_ID = (await prisma.usuario.findFirst({ where: { username: 'admin' } }))?.id || (await prisma.usuario.findFirst())!.id;

  console.log('--- APLICANDO CORRECCIÓN USD ROYAL PACIFIC ---');

  const saldoActual = await prisma.saldo.findUnique({
    where: { punto_atencion_id_moneda_id: { punto_atencion_id: PUNTO_ID, moneda_id: USD_ID } }
  });

  const saldoSistema = Number(saldoActual?.cantidad || 0);
  const saldoReportado = 1923.14;
  const diferencia = saldoReportado - saldoSistema;

  console.log(`Saldo en sistema: ${saldoSistema}`);
  console.log(`Saldo reportado: ${saldoReportado}`);
  console.log(`Ajuste necesario: ${diferencia}`);

  if (Math.abs(diferencia) > 0.001) {
    const nuevoSaldo = saldoReportado;

    // Crear movimiento de ajuste
    await prisma.movimientoSaldo.create({
      data: {
        punto_atencion_id: PUNTO_ID,
        moneda_id: USD_ID,
        tipo_movimiento: 'AJUSTE',
        monto: diferencia,
        saldo_anterior: saldoSistema,
        saldo_nuevo: nuevoSaldo,
        usuario_id: USUARIO_ID,
        descripcion: 'Ajuste manual para cuadre de caja USD (regularización histórica)',
        fecha: new Date()
      }
    });
    console.log(`   - Creado movimiento de AJUSTE por ${diferencia} USD`);

    // Actualizar tabla Saldo
    await prisma.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: PUNTO_ID,
          moneda_id: USD_ID
        }
      },
      data: {
        cantidad: nuevoSaldo,
        billetes: nuevoSaldo // Se asume billetes
      }
    });
    console.log(`   - Saldo final USD actualizado a: ${nuevoSaldo}`);
  } else {
    console.log('No es necesario realizar ajustes.');
  }

  console.log('\n--- CORRECCIÓN USD COMPLETADA ---');

  await prisma.$disconnect();
}

main();
