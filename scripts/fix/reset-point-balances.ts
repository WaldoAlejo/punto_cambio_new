import "dotenv/config";
import { PrismaClient, ServicioExterno } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_POINT_NAME = "Luis Aviles";
const RESET_NOTE = "Reset de punto de control para iniciar desde cero";
const TRANSFER_RESET_NOTE = "Cancelada automaticamente por reset de punto de control";
const OPEN_TRANSFER_STATES = ["PENDIENTE", "APROBADO", "EN_TRANSITO"] as const;

function getFlagValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatAmount(value: number | string | null | undefined): string {
  return Number(value || 0).toFixed(2);
}

function buildZeroSaldoEsperado(snapshot: unknown): unknown[] {
  if (!Array.isArray(snapshot)) {
    return [];
  }

  return snapshot.map((item) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    const saldo = item as Record<string, unknown>;
    return {
      ...saldo,
      cantidad: 0,
      billetes: 0,
      monedas: 0,
      bancos: 0,
    };
  });
}

async function resolvePoint() {
  const pointId = getFlagValue("--pointId") ?? process.env.npm_config_pointid;
  const pointName =
    getFlagValue("--point") ??
    getFlagValue("--pointName") ??
    process.env.npm_config_point ??
    process.env.npm_config_pointname ??
    DEFAULT_POINT_NAME;

  if (pointId) {
    const point = await prisma.puntoAtencion.findUnique({
      where: { id: pointId },
      select: { id: true, nombre: true, ciudad: true, activo: true },
    });

    if (!point) {
      throw new Error(`No se encontró punto con id ${pointId}`);
    }

    return point;
  }

  const allPoints = await prisma.puntoAtencion.findMany({
    select: { id: true, nombre: true, ciudad: true, activo: true },
    orderBy: { nombre: "asc" },
  });

  const wanted = normalizeText(pointName);
  const exact = allPoints.filter((point) => normalizeText(point.nombre) === wanted);
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    throw new Error(
      `Hay ${exact.length} puntos que coinciden exactamente con \"${pointName}\". Usa --pointId.`
    );
  }

  const partial = allPoints.filter((point) =>
    normalizeText(point.nombre).includes(wanted)
  );
  if (partial.length === 1) {
    return partial[0];
  }
  if (partial.length > 1) {
    throw new Error(
      `Hay ${partial.length} puntos que coinciden con \"${pointName}\": ${partial
        .map((point) => point.nombre)
        .join(", ")}. Usa --pointId.`
    );
  }

  throw new Error(`No se encontró un punto con nombre parecido a \"${pointName}\"`);
}

async function main() {
  const execute = hasFlag("--execute");
  const point = await resolvePoint();

  const [activeCurrencies, usd, currentSaldos, currentServiceBalances, currentServientrega, openTransfers, openAperturas] =
    await Promise.all([
      prisma.moneda.findMany({
        where: { activo: true },
        select: { id: true, codigo: true },
        orderBy: { orden_display: "asc" },
      }),
      prisma.moneda.findUnique({
        where: { codigo: "USD" },
        select: { id: true },
      }),
      prisma.saldo.findMany({
        where: { punto_atencion_id: point.id },
        include: { moneda: { select: { codigo: true } } },
        orderBy: { moneda: { codigo: "asc" } },
      }),
      prisma.servicioExternoSaldo.findMany({
        where: { punto_atencion_id: point.id },
        include: { moneda: { select: { codigo: true } } },
        orderBy: [{ servicio: "asc" }, { moneda: { codigo: "asc" } }],
      }),
      prisma.servientregaSaldo.findUnique({
        where: { punto_atencion_id: point.id },
      }),
      prisma.transferencia.findMany({
        where: {
          origen_id: point.id,
          estado: { in: [...OPEN_TRANSFER_STATES] },
        },
        select: {
          id: true,
          numero_recibo: true,
          estado: true,
          monto: true,
          solicitado_por: true,
          destino: { select: { nombre: true } },
          moneda: { select: { codigo: true } },
        },
        orderBy: [{ estado: "asc" }, { fecha: "asc" }],
      }),
      prisma.aperturaCaja.findMany({
        where: {
          punto_atencion_id: point.id,
          hora_apertura: null,
        },
        select: {
          id: true,
          jornada_id: true,
          estado: true,
          saldo_esperado: true,
        },
        orderBy: { hora_inicio_conteo: "desc" },
      }),
    ]);

  const counts = await prisma.$transaction(async (tx) => {
    const [movimientoSaldo, historialSaldo, saldoInicialActivos, servicioMovimientos, servicioAsignaciones, servicioSaldos, servientregaHistorial] =
      await Promise.all([
        tx.movimientoSaldo.count({ where: { punto_atencion_id: point.id } }),
        tx.historialSaldo.count({ where: { punto_atencion_id: point.id } }),
        tx.saldoInicial.count({ where: { punto_atencion_id: point.id, activo: true } }),
        tx.servicioExternoMovimiento.count({ where: { punto_atencion_id: point.id } }),
        tx.servicioExternoAsignacion.count({ where: { punto_atencion_id: point.id } }),
        tx.servicioExternoSaldo.count({ where: { punto_atencion_id: point.id } }),
        tx.servientregaHistorialSaldo.count({ where: { punto_atencion_id: point.id } }),
      ]);

    return {
      movimientoSaldo,
      historialSaldo,
      saldoInicialActivos,
      servicioMovimientos,
      servicioAsignaciones,
      servicioSaldos,
      servientregaHistorial,
    };
  });

  console.log("\n=== RESET DE SALDOS DE PUNTO DE CONTROL ===\n");
  console.log(`Punto: ${point.nombre} (${point.ciudad})`);
  console.log(`ID: ${point.id}`);
  console.log(`Activo: ${point.activo ? "SI" : "NO"}`);
  console.log(`Modo: ${execute ? "EJECUCION" : "DRY-RUN"}`);

  console.log("\nResumen actual:");
  console.log(`- Saldos de divisas: ${currentSaldos.length}`);
  for (const saldo of currentSaldos) {
    console.log(
      `  • ${saldo.moneda.codigo}: cantidad=${Number(saldo.cantidad).toFixed(2)}, billetes=${Number(saldo.billetes).toFixed(2)}, monedas=${Number(saldo.monedas_fisicas).toFixed(2)}, bancos=${Number(saldo.bancos).toFixed(2)}`
    );
  }

  console.log(`- Saldos de servicios externos: ${currentServiceBalances.length}`);
  for (const saldo of currentServiceBalances) {
    console.log(
      `  • ${saldo.servicio}/${saldo.moneda.codigo}: cantidad=${Number(saldo.cantidad).toFixed(2)}`
    );
  }

  console.log(
    `- Saldo Servientrega: ${currentServientrega ? Number(currentServientrega.monto_total).toFixed(2) : "NO EXISTE"}`
  );

  console.log(`- Transferencias salientes abiertas: ${openTransfers.length}`);
  for (const transfer of openTransfers) {
    console.log(
      `  • ${transfer.estado} | ${transfer.moneda.codigo} ${formatAmount(transfer.monto)} | destino=${transfer.destino.nombre} | recibo=${transfer.numero_recibo || transfer.id}`
    );
  }

  console.log(`- Aperturas no abiertas a reiniciar: ${openAperturas.length}`);
  for (const apertura of openAperturas) {
    console.log(`  • ${apertura.estado} | apertura=${apertura.id} | jornada=${apertura.jornada_id}`);
  }

  console.log("\nRegistros que se limpiarán o pondrán en cero:");
  console.log(`- MovimientoSaldo a borrar: ${counts.movimientoSaldo}`);
  console.log(`- HistorialSaldo a borrar: ${counts.historialSaldo}`);
  console.log(`- SaldoInicial activos a poner en 0: ${counts.saldoInicialActivos}`);
  console.log(`- ServicioExternoMovimiento a borrar: ${counts.servicioMovimientos}`);
  console.log(`- ServicioExternoAsignacion a borrar: ${counts.servicioAsignaciones}`);
  console.log(`- ServicioExternoSaldo a poner en 0: ${counts.servicioSaldos}`);
  console.log(`- ServientregaHistorialSaldo a borrar: ${counts.servientregaHistorial}`);
  console.log(`- Saldos de divisas a garantizar en 0: ${activeCurrencies.length}`);
  console.log(`- Saldos USD de servicios a garantizar en 0: ${usd ? Object.values(ServicioExterno).length : 0}`);
  console.log(`- Transferencias salientes a cancelar: ${openTransfers.length}`);
  console.log(`- Aperturas en conteo a reiniciar: ${openAperturas.length}`);

  if (!execute) {
    console.log("\nDRY-RUN completado. Usa --execute para aplicar los cambios.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (openTransfers.length > 0) {
      await tx.transferencia.updateMany({
        where: {
          id: { in: openTransfers.map((transfer) => transfer.id) },
        },
        data: {
          estado: "CANCELADO",
          fecha_rechazo: new Date(),
          observaciones_rechazo: `${TRANSFER_RESET_NOTE} (${new Date().toISOString()})`,
          rechazado_por: null,
        },
      });
    }

    for (const apertura of openAperturas) {
      await tx.aperturaCaja.update({
        where: { id: apertura.id },
        data: {
          estado: "EN_CONTEO",
          saldo_esperado: buildZeroSaldoEsperado(apertura.saldo_esperado) as any,
          conteo_fisico: [],
          diferencias: [],
          observaciones_operador: `${RESET_NOTE} - apertura reiniciada (${new Date().toISOString()})`,
          observaciones_admin: null,
          requiere_aprobacion: false,
          aprobado_por: null,
          hora_aprobacion: null,
          metodo_verificacion: null,
          hora_fin_conteo: null,
          fotos_urls: [],
        },
      });
    }

    await tx.movimientoSaldo.deleteMany({ where: { punto_atencion_id: point.id } });
    await tx.historialSaldo.deleteMany({ where: { punto_atencion_id: point.id } });
    await tx.servicioExternoMovimiento.deleteMany({ where: { punto_atencion_id: point.id } });
    await tx.servicioExternoAsignacion.deleteMany({ where: { punto_atencion_id: point.id } });
    await tx.servientregaHistorialSaldo.deleteMany({ where: { punto_atencion_id: point.id } });

    await tx.saldoInicial.updateMany({
      where: { punto_atencion_id: point.id, activo: true },
      data: {
        cantidad_inicial: 0,
        observaciones: `${RESET_NOTE} (${new Date().toISOString()})`,
      },
    });

    await tx.saldo.updateMany({
      where: { punto_atencion_id: point.id },
      data: {
        cantidad: 0,
        billetes: 0,
        monedas_fisicas: 0,
        bancos: 0,
      },
    });

    for (const moneda of activeCurrencies) {
      await tx.saldo.upsert({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: point.id,
            moneda_id: moneda.id,
          },
        },
        update: {
          cantidad: 0,
          billetes: 0,
          monedas_fisicas: 0,
          bancos: 0,
        },
        create: {
          punto_atencion_id: point.id,
          moneda_id: moneda.id,
          cantidad: 0,
          billetes: 0,
          monedas_fisicas: 0,
          bancos: 0,
        },
      });
    }

    await tx.servicioExternoSaldo.updateMany({
      where: { punto_atencion_id: point.id },
      data: {
        cantidad: 0,
        billetes: 0,
        monedas_fisicas: 0,
        bancos: 0,
      },
    });

    if (usd) {
      for (const servicio of Object.values(ServicioExterno)) {
        await tx.servicioExternoSaldo.upsert({
          where: {
            punto_atencion_id_servicio_moneda_id: {
              punto_atencion_id: point.id,
              servicio,
              moneda_id: usd.id,
            },
          },
          update: {
            cantidad: 0,
            billetes: 0,
            monedas_fisicas: 0,
            bancos: 0,
          },
          create: {
            punto_atencion_id: point.id,
            servicio,
            moneda_id: usd.id,
            cantidad: 0,
            billetes: 0,
            monedas_fisicas: 0,
            bancos: 0,
          },
        });
      }
    }

    if (currentServientrega) {
      await tx.servientregaSaldo.update({
        where: { punto_atencion_id: point.id },
        data: {
          monto_total: 0,
          monto_usado: 0,
          billetes: 0,
          monedas_fisicas: 0,
        },
      });
    } else {
      await tx.servientregaSaldo.create({
        data: {
          punto_atencion_id: point.id,
          creado_por: "SCRIPT_RESET_CONTROL",
          monto_total: 0,
          monto_usado: 0,
          billetes: 0,
          monedas_fisicas: 0,
        },
      });
    }
  });

  console.log("\nOK: el punto quedó con saldos reiniciados a cero.");
  if (openTransfers.length > 0) {
    console.log(`Se cancelaron ${openTransfers.length} transferencias salientes abiertas del punto.`);
  }
  if (openAperturas.length > 0) {
    console.log(`Se reiniciaron ${openAperturas.length} aperturas no abiertas del punto.`);
  }
  console.log("Recomendación: inicia la siguiente jornada/apertura del punto ya con el nuevo estado limpio.");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Fallo reset-point-balances:", error);
  process.exitCode = 1;
  await prisma.$disconnect();
});