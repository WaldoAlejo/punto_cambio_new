// scripts/configurar-comportamientos-divisas.ts
// DRY-RUN: npx tsx scripts/configurar-comportamientos-divisas.ts
// REAL   : npx tsx scripts/configurar-comportamientos-divisas.ts --yes
// Con mapa: npx tsx scripts/configurar-comportamientos-divisas.ts --yes --map=./divisas-map.json
// Requiere: DATABASE_URL en .env

import "dotenv/config";
import { PrismaClient, ComportamientoCalculo } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();

const YES = process.argv.includes("--yes");

// Si tu base no es USD, cambia aquí:
const BASE_CODE = process.env.BASE_CURRENCY_CODE || "USD";

// === Mapa opcional desde JSON ===
/**
 * Estructura esperada para --map=archivo.json
 * {
 *   "defaults": { "compra": "MULTIPLICA", "venta": "DIVIDE" },
 *   "overrides": {
 *     "VES": { "compra": "DIVIDE", "venta": "MULTIPLICA" },
 *     "ARS": { "compra": "DIVIDE", "venta": "MULTIPLICA" }
 *   }
 * }
 */
function getArgValue(flag: string): string | undefined {
  const idx = process.argv.findIndex(
    (a) => a === flag || a.startsWith(flag + "=")
  );
  if (idx === -1) return undefined;
  const a = process.argv[idx];
  const eq = a.indexOf("=");
  if (eq >= 0) return a.slice(eq + 1);
  return process.argv[idx + 1];
}

type BehaviorStr = "MULTIPLICA" | "DIVIDE";
type MapFile = {
  defaults?: { compra?: BehaviorStr; venta?: BehaviorStr };
  overrides?: Record<string, { compra?: BehaviorStr; venta?: BehaviorStr }>;
};

function parseMapFile(): MapFile | null {
  const p = getArgValue("--map");
  if (!p) return null;
  const abs = resolve(process.cwd(), p);
  const raw = readFileSync(abs, "utf8");
  const json = JSON.parse(raw) as MapFile;
  return json;
}

const mapFile = parseMapFile();

// === Defaults por convención (puedes cambiarlos aquí o con --map) ===
const DEFAULT_COMPRA: ComportamientoCalculo =
  mapFile?.defaults?.compra === "DIVIDE"
    ? ComportamientoCalculo.DIVIDE
    : ComportamientoCalculo.MULTIPLICA;

const DEFAULT_VENTA: ComportamientoCalculo =
  mapFile?.defaults?.venta === "MULTIPLICA"
    ? ComportamientoCalculo.MULTIPLICA
    : ComportamientoCalculo.DIVIDE;

// Overrides inline (si no usas --map, puedes configurar aquí)
const OVERRIDES_INLINE: Record<
  string,
  { compra?: ComportamientoCalculo; venta?: ComportamientoCalculo }
> = {
  // Ejemplos reales de inversión:
  // VES: algunas casas lo manejan invertido
  // "VES": { compra: ComportamientoCalculo.DIVIDE, venta: ComportamientoCalculo.MULTIPLICA },
  // "ARS": { compra: ComportamientoCalculo.DIVIDE, venta: ComportamientoCalculo.MULTIPLICA },
};

function resolveBehavior(code: string): {
  compra: ComportamientoCalculo;
  venta: ComportamientoCalculo;
} {
  const fromFile = mapFile?.overrides?.[code.toUpperCase()];
  if (fromFile) {
    return {
      compra:
        fromFile.compra === "DIVIDE"
          ? ComportamientoCalculo.DIVIDE
          : ComportamientoCalculo.MULTIPLICA,
      venta:
        fromFile.venta === "MULTIPLICA"
          ? ComportamientoCalculo.MULTIPLICA
          : ComportamientoCalculo.DIVIDE,
    };
  }
  const inline = OVERRIDES_INLINE[code.toUpperCase()];
  if (inline) {
    return {
      compra: inline.compra ?? DEFAULT_COMPRA,
      venta: inline.venta ?? DEFAULT_VENTA,
    };
  }
  return { compra: DEFAULT_COMPRA, venta: DEFAULT_VENTA };
}

async function main() {
  const monedas = await prisma.moneda.findMany({
    select: {
      id: true,
      codigo: true,
      comportamiento_compra: true,
      comportamiento_venta: true,
    },
    orderBy: { codigo: "asc" },
  });

  console.log(`🪙 Monedas encontradas: ${monedas.length} (base=${BASE_CODE})`);
  if (!YES) {
    console.log(
      "⚠️  DRY-RUN: no se escribirá en la base. Usa --yes para aplicar."
    );
  }

  let updates = 0;

  for (const m of monedas) {
    const target = resolveBehavior(m.codigo);
    const needsUpdate =
      m.comportamiento_compra !== target.compra ||
      m.comportamiento_venta !== target.venta;

    if (!needsUpdate) {
      console.log(
        `• ${m.codigo}: OK (compra=${m.comportamiento_compra}, venta=${m.comportamiento_venta})`
      );
      continue;
    }

    if (!YES) {
      console.log(
        `• [DRY] ${m.codigo}: compra=${m.comportamiento_compra}→${target.compra}, venta=${m.comportamiento_venta}→${target.venta}`
      );
      updates++;
      continue;
    }

    await prisma.moneda.update({
      where: { id: m.id },
      data: {
        comportamiento_compra: target.compra,
        comportamiento_venta: target.venta,
      },
    });

    console.log(
      `✓ ${m.codigo}: compra=${m.comportamiento_compra}→${target.compra}, venta=${m.comportamiento_venta}→${target.venta}`
    );
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
