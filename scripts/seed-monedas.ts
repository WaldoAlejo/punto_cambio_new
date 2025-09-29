// scripts/seed-monedas.ts
// DRY-RUN: npx tsx scripts/seed-monedas.ts
// REAL   : npx tsx scripts/seed-monedas.ts --yes
// Requiere: DATABASE_URL en .env

import "dotenv/config";
import { PrismaClient, ComportamientoCalculo } from "@prisma/client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// Estos paquetes son CommonJS, así que los cargamos con createRequire
const currency: any = require("currency-codes");
const getSymbolFromCurrency: (
  code: string
) => string | undefined = require("currency-symbol-map");

const prisma = new PrismaClient();
const YES = process.argv.includes("--yes");

// Excluir códigos especiales si no los quieres
const EXCLUDE = new Set<string>([
  "XAG",
  "XAU",
  "XDR",
  "XPD",
  "XPT", // metales / DEG FMI
  "XTS",
  "XXX", // testing / no currency
]);

function toNombre(info: any, code: string) {
  const n = (info?.currency ?? "").toString().trim();
  return n || code;
}
function toSimbolo(code: string) {
  const s = getSymbolFromCurrency(code);
  return s || code; // fallback al código si no hay símbolo conocido
}

async function main() {
  const codes: string[] = currency.codes(); // ISO-4217 vigentes
  const filtered = codes.filter((c) => !EXCLUDE.has(c));

  console.log(`🪙 Monedas detectadas: ${filtered.length}`);
  if (!YES) {
    console.log(
      "⚠️  DRY-RUN: no se escribirá en la base. Usa --yes para aplicar."
    );
  }

  let ok = 0,
    fail = 0;

  const chunkSize = 25;
  for (let i = 0; i < filtered.length; i += chunkSize) {
    const chunk = filtered.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (code, idx) => {
        try {
          const info = currency.code(code); // { code, currency, digits, ... }
          const nombre = toNombre(info, code);
          const simbolo = toSimbolo(code);
          const orden_display = i + idx;

          if (!YES) {
            console.log(`• [DRY] ${code} → ${nombre} (${simbolo})`);
            ok++;
            return;
          }

          await prisma.moneda.upsert({
            where: { codigo: code },
            update: {
              nombre,
              simbolo,
              activo: true,
              comportamiento_compra: ComportamientoCalculo.MULTIPLICA,
              comportamiento_venta: ComportamientoCalculo.DIVIDE,
            },
            create: {
              codigo: code,
              nombre,
              simbolo,
              activo: true,
              orden_display,
              comportamiento_compra: ComportamientoCalculo.MULTIPLICA,
              comportamiento_venta: ComportamientoCalculo.DIVIDE,
            },
          });

          console.log(`✓ ${code} → ${nombre} (${simbolo})`);
          ok++;
        } catch (e: any) {
          console.error(`✗ Error con ${code}:`, e?.message ?? e);
          fail++;
        }
      })
    );
  }

  console.log(`\n✅ Listo. OK: ${ok}  ✗ Fallos: ${fail}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
