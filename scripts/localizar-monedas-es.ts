// scripts/localizar-monedas-es.ts
// DRY-RUN: npx tsx scripts/localizar-monedas-es.ts
// REAL   : npx tsx scripts/localizar-monedas-es.ts --yes
// Añadir código ISO al nombre: ... --yes --with-code
// Locale por defecto: es-EC (cámbialo con --locale=es-ES, es-MX, etc.)
// Requiere: DATABASE_URL en .env

import "dotenv/config";
import { PrismaClient, ComportamientoCalculo } from "@prisma/client";

const prisma = new PrismaClient();

const YES = process.argv.includes("--yes");
const WITH_CODE = process.argv.includes("--with-code");

function getArgValue(flag: string): string | undefined {
  const ix = process.argv.findIndex(
    (a) => a === flag || a.startsWith(flag + "=")
  );
  if (ix === -1) return undefined;
  const a = process.argv[ix];
  const eq = a.indexOf("=");
  if (eq >= 0) return a.slice(eq + 1);
  return process.argv[ix + 1];
}

const LOCALE = (getArgValue("--locale") || "es-EC").trim();

// Mapa mínimo de símbolos para crear CHF/GBP si no existen
const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CHF: "Fr.",
};

// Overrides de nombre por si el Intl de tu Node da variantes raras:
const NAME_OVERRIDES_ES: Record<string, string> = {
  USD: "dólar estadounidense",
  EUR: "euro",
  GBP: "libra esterlina",
  CHF: "franco suizo",
};

function titleCaseEs(s: string) {
  // Mantén minúsculas naturales; solo capitaliza primera letra
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function localizedCurrencyNameEs(code: string, locale = LOCALE): string {
  const upper = code.toUpperCase();
  // Override primero
  if (NAME_OVERRIDES_ES[upper]) return NAME_OVERRIDES_ES[upper];

  try {
    // currencyDisplay:'name' devuelve "1,00 francos suizos", extraemos la parte 'currency'
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: upper as any,
      currencyDisplay: "name",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(1);

    const cur = parts.find((p) => p.type === "currency")?.value;
    if (cur && typeof cur === "string" && cur.trim()) {
      return cur.toLowerCase(); // homogéneo en minúsculas
    }
  } catch {
    // fallback abajo
  }
  // Fallback: usa el código
  return upper;
}

async function ensureExists(code: string, nombreEs: string) {
  const exists = await prisma.moneda.findUnique({ where: { codigo: code } });
  if (exists) return exists;

  // Si no existe, creamos con defaults coherentes. Ajusta si quieres otros comportamientos.
  const simbolo = SYMBOLS[code] || code;
  const created = await prisma.moneda.create({
    data: {
      codigo: code,
      nombre: titleCaseEs(nombreEs),
      simbolo,
      activo: true,
      orden_display: 0,
      comportamiento_compra: ComportamientoCalculo.MULTIPLICA,
      comportamiento_venta: ComportamientoCalculo.DIVIDE,
    },
  });
  return created;
}

async function main() {
  console.log(
    `🌎 Localizando nombres de monedas a "${LOCALE}"${
      WITH_CODE ? " (con código ISO)" : ""
    }`
  );
  if (!YES) {
    console.log(
      "⚠️  DRY-RUN: no se escribirá en la base. Usa --yes para aplicar."
    );
  }

  // Asegurar CHF/GBP
  const chfName = localizedCurrencyNameEs("CHF");
  const gbpName = localizedCurrencyNameEs("GBP");

  await ensureExists("CHF", chfName);
  await ensureExists("GBP", gbpName);

  // Traer todas
  const monedas = await prisma.moneda.findMany({
    select: { id: true, codigo: true, nombre: true },
    orderBy: { codigo: "asc" },
  });

  let updates = 0;

  for (const m of monedas) {
    const esName = localizedCurrencyNameEs(m.codigo);
    const finalName = WITH_CODE
      ? `${titleCaseEs(esName)} (${m.codigo})`
      : titleCaseEs(esName);

    if (m.nombre === finalName) {
      console.log(`• ${m.codigo}: OK → ${finalName}`);
      continue;
    }

    if (!YES) {
      console.log(`• [DRY] ${m.codigo}: "${m.nombre}" → "${finalName}"`);
      updates++;
      continue;
    }

    await prisma.moneda.update({
      where: { id: m.id },
      data: { nombre: finalName },
    });

    console.log(`✓ ${m.codigo}: "${m.nombre}" → "${finalName}"`);
    updates++;
  }

  console.log(
    `\n✅ Finalizado. Registros a actualizar: ${updates}${
      YES ? "" : " (simulado)"
    }`
  );
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
