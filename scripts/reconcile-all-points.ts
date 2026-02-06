import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import saldoReconciliationService from "../server/services/saldoReconciliationService.ts";

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function getArgValue(name: string) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function printHelp() {
  console.log("\nReconciliar saldos (efectivo) en TODOS los puntos\n");
  console.log("Uso:");
  console.log("  CONFIRM=1 npm run reconcile:all");
  console.log("\nOpciones:");
  console.log("  --include-inactive      Incluye puntos inactivos");
  console.log("  --pointId <uuid>        Reconciliar solo un punto");
  console.log("  --limit <n>             Limitar cantidad de puntos (debug)");
  console.log("  --help                  Mostrar ayuda");
  console.log("\nNotas:");
  console.log(
    "- Esto escribe en la tabla Saldo (caja/efectivo). No requiere JWT porque no llama a la API; conecta directo a la BD."
  );
  console.log(
    "- Asegura que la VM tenga DATABASE_URL (en .env o exportada en el shell)."
  );
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const confirm = process.env.CONFIRM === "1";
  if (!confirm) {
    console.error(
      "Bloqueado por seguridad. Ejecuta con CONFIRM=1 para confirmar. Ejemplo: CONFIRM=1 npm run reconcile:all"
    );
    process.exitCode = 1;
    return;
  }

  const includeInactive = hasFlag("--include-inactive");
  const pointId = getArgValue("--pointId");
  const limitRaw = getArgValue("--limit");
  const limit = limitRaw ? Math.max(0, Number(limitRaw)) : undefined;

  const prisma = new PrismaClient();

  const where = pointId
    ? { id: pointId }
    : includeInactive
      ? {}
      : { activo: true };

  const puntos = await prisma.puntoAtencion.findMany({
    where,
    select: { id: true, nombre: true, activo: true },
    orderBy: { nombre: "asc" },
    take: limit && limit > 0 ? limit : undefined,
  });

  if (puntos.length === 0) {
    console.log("No se encontraron puntos para reconciliar.");
    await prisma.$disconnect();
    return;
  }

  console.log(
    `Iniciando reconciliación: ${puntos.length} punto(s)${includeInactive ? " (incluye inactivos)" : ""}`
  );

  let totalSaldos = 0;
  let totalCorregidos = 0;
  let totalErrores = 0;

  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i];
    const prefix = `[${i + 1}/${puntos.length}] ${p.nombre} (${p.id})`;
    try {
      const resultados = await saldoReconciliationService.reconciliarTodosPuntoAtencion(
        p.id
      );
      const isRecord = (v: unknown): v is Record<string, unknown> =>
        typeof v === "object" && v !== null && !Array.isArray(v);

      const resultadosArr = Array.isArray(resultados) ? resultados : [];
      const corregidos = resultadosArr.filter(
        (r) => isRecord(r) && r.corregido === true
      ).length;
      const errores = resultadosArr.filter(
        (r) => isRecord(r) && r.success === false
      ).length;

      totalSaldos += resultadosArr.length;
      totalCorregidos += corregidos;
      totalErrores += errores;

      console.log(
        `${prefix} -> OK: ${corregidos} corregido(s) de ${resultadosArr.length} saldo(s)${errores ? ` | errores: ${errores}` : ""}`
      );
    } catch (e: unknown) {
      totalErrores++;
      const message =
        typeof (e as { message?: unknown })?.message === "string"
          ? (e as { message: string }).message
          : String(e);
      console.error(`${prefix} -> ERROR: ${message}`);
    }
  }

  console.log("\nResumen:");
  console.log(`- Puntos procesados: ${puntos.length}`);
  console.log(`- Saldos revisados: ${totalSaldos}`);
  console.log(`- Saldos corregidos: ${totalCorregidos}`);
  console.log(`- Errores: ${totalErrores}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fallo fatal en reconcile-all-points:", e);
  process.exitCode = 1;
});
