// scripts/test_cambio_euro_a_dolar.ts
import prisma from '../server/lib/prisma';

async function main() {
  const punto_atencion_id = '416efc7b-a531-4bc0-949a-ee98568ee6bb'; // EL BOSQUE
  const moneda_origen_id = 'a5c09e3a-ceca-4065-abc3-daf4452bc2da'; // EUR
  const moneda_destino_id = 'd7b34ea2-f014-4046-b7ca-d0aa5885a6a4'; // USD
  const monto_origen = 10;
  const monto_destino = 10.5;

  // Consulta los saldos antes del cambio
  const saldoUSD = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id,
        moneda_id: moneda_destino_id,
      },
    },
  });

  console.log('Saldo USD antes del cambio:', saldoUSD);

  // Simula la lógica de validación del backend
  const saldoBilletes = Number(saldoUSD?.billetes || 0);
  const saldoMonedas = Number(saldoUSD?.monedas_fisicas || 0);
  const saldoFisicoTotal = saldoBilletes + saldoMonedas;

  if (monto_destino > saldoFisicoTotal) {
    console.error('ERROR: SALDO_INSUFICIENTE_CAMBIO');
    console.error(`Disponible: ${saldoFisicoTotal} (Billetes: ${saldoBilletes}, Monedas: ${saldoMonedas}), Requerido: ${monto_destino}`);
  } else {
    console.log('Cambio permitido. Hay saldo suficiente.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
