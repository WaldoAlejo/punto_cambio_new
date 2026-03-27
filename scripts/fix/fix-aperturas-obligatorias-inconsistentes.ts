import "dotenv/config";
import { EstadoApertura, PrismaClient } from "@prisma/client";
import { getEstadoMonedasObligatorias } from "../../server/utils/aperturaCajaRequirements.js";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getFlagValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseIntArg(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type AperturaSnapshot = {
  id: string;
  jornada_id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha: Date;
  estado: EstadoApertura;
  requiere_aprobacion: boolean;
  aprobado_por: string | null;
  hora_aprobacion: Date | null;
  hora_apertura: Date | null;
  metodo_verificacion: string | null;
  saldo_esperado: unknown;
  conteo_fisico: unknown;
  tolerancia_usd: unknown;
  tolerancia_otras: unknown;
};

type NormalizacionObjetivo = {
  estado: EstadoApertura.EN_CONTEO | EstadoApertura.CON_DIFERENCIA;
  requiere_aprobacion: boolean;
  motivo: string;
};

function determinarObjetivo(apertura: AperturaSnapshot): NormalizacionObjetivo | null {
  const estadoObligatorias = getEstadoMonedasObligatorias(apertura);

  if (estadoObligatorias.pendientes_guardado.length > 0) {
    return {
      estado: EstadoApertura.EN_CONTEO,
      requiere_aprobacion: false,
      motivo: `pendientes_guardado=${estadoObligatorias.pendientes_guardado.join(",")}`,
    };
  }

  if (estadoObligatorias.descuadradas.length > 0) {
    return {
      estado: EstadoApertura.CON_DIFERENCIA,
      requiere_aprobacion: true,
      motivo: `descuadradas=${estadoObligatorias.descuadradas.join(",")}`,
    };
  }

  return null;
}

function necesitaActualizacion(apertura: AperturaSnapshot, objetivo: NormalizacionObjetivo): boolean {
  if (apertura.estado !== objetivo.estado) {
    return true;
  }

  if (apertura.requiere_aprobacion !== objetivo.requiere_aprobacion) {
    return true;
  }

  if (apertura.hora_apertura !== null) {
    return true;
  }

  if (apertura.metodo_verificacion !== null) {
    return true;
  }

  if (apertura.aprobado_por !== null) {
    return true;
  }

  if (apertura.hora_aprobacion !== null) {
    return true;
  }

  return false;
}

async function main() {
  const prisma = new PrismaClient();
  const execute = hasFlag("--execute");
  const limit = parseIntArg(getFlagValue("--limit") ?? process.env.npm_config_limit, 1000);
  const pointId = getFlagValue("--pointId") ?? process.env.npm_config_pointid;
  const userId = getFlagValue("--userId") ?? process.env.npm_config_userid;

  try {
    const aperturas = await prisma.aperturaCaja.findMany({
      where: {
        estado: {
          in: [
            EstadoApertura.ABIERTA,
            EstadoApertura.CUADRADO,
            EstadoApertura.CON_DIFERENCIA,
            EstadoApertura.EN_CONTEO,
          ],
        },
        ...(pointId ? { punto_atencion_id: pointId } : {}),
        ...(userId ? { usuario_id: userId } : {}),
      },
      select: {
        id: true,
        jornada_id: true,
        usuario_id: true,
        punto_atencion_id: true,
        fecha: true,
        estado: true,
        requiere_aprobacion: true,
        aprobado_por: true,
        hora_aprobacion: true,
        hora_apertura: true,
        metodo_verificacion: true,
        saldo_esperado: true,
        conteo_fisico: true,
        tolerancia_usd: true,
        tolerancia_otras: true,
      },
      orderBy: [{ fecha: "desc" }, { hora_inicio_conteo: "desc" }],
      take: limit,
    });

    const candidatas = aperturas
      .map((apertura) => {
        const objetivo = determinarObjetivo(apertura);
        if (!objetivo || !necesitaActualizacion(apertura, objetivo)) {
          return null;
        }

        return {
          apertura,
          objetivo,
        };
      })
      .filter((item): item is { apertura: AperturaSnapshot; objetivo: NormalizacionObjetivo } => item !== null);

    if (candidatas.length === 0) {
      console.log("OK: no se encontraron aperturas inconsistentes por USD/EUR obligatorios.");
      return;
    }

    console.log(
      `${execute ? "EJECUCION" : "DRY-RUN"}: se ${execute ? "corregiran" : "corregirian"} ${candidatas.length} apertura(s) inconsistentes.`
    );

    for (const { apertura, objetivo } of candidatas) {
      console.log(
        [
          `- apertura=${apertura.id}`,
          `fecha=${apertura.fecha.toISOString().slice(0, 10)}`,
          `punto=${apertura.punto_atencion_id}`,
          `usuario=${apertura.usuario_id}`,
          `estado=${apertura.estado}=>${objetivo.estado}`,
          `motivo=${objetivo.motivo}`,
        ].join(" | ")
      );

      if (!execute) {
        continue;
      }

      await prisma.aperturaCaja.update({
        where: { id: apertura.id },
        data: {
          estado: objetivo.estado,
          requiere_aprobacion: objetivo.requiere_aprobacion,
          hora_apertura: null,
          metodo_verificacion: null,
          aprobado_por: null,
          hora_aprobacion: null,
        },
      });
    }

    if (execute) {
      console.log("OK: aperturas inconsistentes normalizadas correctamente.");
    } else {
      console.log("Usa --execute para aplicar los cambios.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Fallo fix-aperturas-obligatorias-inconsistentes:", error);
  process.exitCode = 1;
});