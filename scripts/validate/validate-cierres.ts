import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { makeCollector, pickRangeFromArgs, printResult } from "./_shared.js";

async function main() {
  const prisma = new PrismaClient();
  const c = makeCollector("validate:cierres");

  const { from, to, pointId, limit } = pickRangeFromArgs();

  const where: Record<string, unknown> = {};
  if (pointId) where.punto_atencion_id = pointId;
  if (from || to) {
    // CierreDiario.fecha es DATE, pero Prisma acepta DateTime
    where.fecha = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const cierres = await prisma.cierreDiario.findMany({
    where: Object.keys(where).length ? (where as never) : undefined,
    select: {
      id: true,
      fecha: true,
      punto_atencion_id: true,
      usuario_id: true,
      estado: true,
      fecha_cierre: true,
      cerrado_por: true,
      diferencias_reportadas: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { fecha: "desc" },
    take: limit && limit > 0 ? limit : undefined,
  });

  for (const cd of cierres) {
    const estado = (cd.estado || "").toUpperCase();

    if (estado === "CERRADO") {
      if (!cd.fecha_cierre) {
        c.error("CIERRE_NO_FECHA", "CierreDiario CERRADO sin fecha_cierre", {
          id: cd.id,
          pointId: cd.punto_atencion_id,
          fecha: cd.fecha.toISOString().slice(0, 10),
        });
      }
      if (!cd.cerrado_por) {
        c.warn("CIERRE_NO_CERRADOR", "CierreDiario CERRADO sin cerrado_por", {
          id: cd.id,
          pointId: cd.punto_atencion_id,
        });
      }
    }

    if (estado !== "ABIERTO" && estado !== "CERRADO" && estado !== "PARCIAL") {
      c.warn("CIERRE_ESTADO_RARO", "CierreDiario con estado no estándar", {
        id: cd.id,
        estado: cd.estado,
      });
    }
  }

  const seCierres = await prisma.servicioExternoCierreDiario.findMany({
    where: Object.keys(where).length ? (where as never) : undefined,
    select: {
      id: true,
      fecha: true,
      punto_atencion_id: true,
      usuario_id: true,
      estado: true,
      fecha_cierre: true,
      cerrado_por: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { fecha: "desc" },
    take: limit && limit > 0 ? limit : undefined,
  });

  for (const cd of seCierres) {
    const estado = (cd.estado || "").toUpperCase();
    if (estado === "CERRADO") {
      if (!cd.fecha_cierre) {
        c.error("SE_CIERRE_NO_FECHA", "ServicioExternoCierreDiario CERRADO sin fecha_cierre", {
          id: cd.id,
          pointId: cd.punto_atencion_id,
          fecha: cd.fecha.toISOString().slice(0, 10),
        });
      }
      if (!cd.cerrado_por) {
        c.warn("SE_CIERRE_NO_CERRADOR", "ServicioExternoCierreDiario CERRADO sin cerrado_por", {
          id: cd.id,
          pointId: cd.punto_atencion_id,
        });
      }
    }
  }

  const result = c.finish();
  printResult(result);
  await prisma.$disconnect();

  if (result.counts.errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Fallo validate-cierres:", e);
  process.exitCode = 1;
});
