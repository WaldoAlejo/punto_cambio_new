import { PrismaClient } from '@prisma/client';
import getSymbolFromCurrency from 'currency-symbol-map';

const prisma = new PrismaClient();

// Lista de monedas con nombres en español
const SPANISH_CURRENCIES: Array<{ codigo: string; nombre: string; simbolo?: string }> = [
  { codigo: 'USD', nombre: 'Dólar estadounidense' },
  { codigo: 'EUR', nombre: 'Euro' },
  { codigo: 'COP', nombre: 'Peso colombiano' },
  { codigo: 'VES', nombre: 'Bolívar venezolano' },
  { codigo: 'PEN', nombre: 'Sol peruano' },
  { codigo: 'CLP', nombre: 'Peso chileno' },
  { codigo: 'ARS', nombre: 'Peso argentino' },
  { codigo: 'MXN', nombre: 'Peso mexicano' },
  { codigo: 'BRL', nombre: 'Real brasileño' },
  { codigo: 'CAD', nombre: 'Dólar canadiense' },
  { codigo: 'BOB', nombre: 'Boliviano' },
  { codigo: 'PYG', nombre: 'Guaraní paraguayo' },
  { codigo: 'UYU', nombre: 'Peso uruguayo' },
  { codigo: 'DOP', nombre: 'Peso dominicano' },
  { codigo: 'GBP', nombre: 'Libra esterlina' },
  { codigo: 'CHF', nombre: 'Franco suizo' },
  { codigo: 'NOK', nombre: 'Corona noruega' },
  { codigo: 'SEK', nombre: 'Corona sueca' },
  { codigo: 'DKK', nombre: 'Corona danesa' },
  { codigo: 'PLN', nombre: 'Zloty polaco' },
  { codigo: 'CZK', nombre: 'Corona checa' },
  { codigo: 'HUF', nombre: 'Forinto húngaro' },
  { codigo: 'JPY', nombre: 'Yen japonés' },
  { codigo: 'CNY', nombre: 'Yuan chino (Renminbi)' },
  { codigo: 'KRW', nombre: 'Won surcoreano' },
  { codigo: 'INR', nombre: 'Rupia india' },
  { codigo: 'AUD', nombre: 'Dólar australiano' },
  { codigo: 'NZD', nombre: 'Dólar neozelandés' },
  { codigo: 'SGD', nombre: 'Dólar de Singapur' },
  { codigo: 'HKD', nombre: 'Dólar de Hong Kong' },
  { codigo: 'THB', nombre: 'Baht tailandés' },
  { codigo: 'AED', nombre: 'Dirham de Emiratos Árabes Unidos' },
  { codigo: 'SAR', nombre: 'Riyal saudí' },
  { codigo: 'TRY', nombre: 'Lira turca' },
  { codigo: 'EGP', nombre: 'Libra egipcia' },
  { codigo: 'MAD', nombre: 'Dirham marroquí' },
  { codigo: 'ZAR', nombre: 'Rand sudafricano' },
];

async function upsertSpanishCurrencies() {
  for (const c of SPANISH_CURRENCIES) {
    const symbol = c.simbolo || getSymbolFromCurrency(c.codigo) || c.codigo;
    await prisma.moneda.upsert({
      where: { codigo: c.codigo },
      update: {
        nombre: c.nombre,
        simbolo: symbol,
        activo: true,
        updated_at: new Date(),
      },
      create: {
        codigo: c.codigo,
        nombre: c.nombre,
        simbolo: symbol,
        activo: true,
      },
    });
  }
}

async function truncateAndInsertSpanishCurrencies() {
  console.warn('¡ATENCIÓN! Esto eliminará TODA la información relacionada por CASCADE.');
  console.warn('Esto incluye saldos, movimientos, cambios de divisa, etc.');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Moneda" CASCADE;');
  for (const c of SPANISH_CURRENCIES) {
    const symbol = c.simbolo || getSymbolFromCurrency(c.codigo) || c.codigo;
    await prisma.moneda.create({
      data: {
        codigo: c.codigo,
        nombre: c.nombre,
        simbolo: symbol,
        activo: true,
      },
    });
  }
}

async function main() {
  const mode = process.env.CURRENCIES_TRUNCATE === '1' ? 'truncate' : 'update';
  console.log(`Seed (es) mode: ${mode}`);
  if (mode === 'truncate') {
    await truncateAndInsertSpanishCurrencies();
  } else {
    await upsertSpanishCurrencies();
  }
  console.log('Seed (es) completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
