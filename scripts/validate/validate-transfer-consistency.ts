import "dotenv/config";
import { PrismaClient, EstadoTransferencia } from "@prisma/client";

interface ValidationResult {
  transferId: string;
  numeroRecibo: string | null;
  estado: EstadoTransferencia;
  origen: string;
  destino: string;
  monto: number;
  consistente: boolean;
  notas: string[];
}

async function main() {
  const prisma = new PrismaClient();
  const results: ValidationResult[] = [];

  try {
    console.log("\n=== VALIDANDO CONSISTENCIA DE TRANSFERENCIAS ===\n");

    const transfers = await prisma.transferencia.findMany({
      where: {
        estado: {
          in: ["EN_TRANSITO", "CANCELADO", "COMPLETADO"],
        },
      },
      include: {
        origen: { select: { nombre: true } },
        destino: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    });

    console.log(`Total de transferencias para validar: ${transfers.length}\n`);

    for (const transfer of transfers) {
      const notas: string[] = [];
      let consistente = true;

      const origenMovimientos = await prisma.movimientoSaldo.findMany({
        where: {
          referencia_id: transfer.id,
          tipo_referencia: "TRANSFERENCIA",
          punto_atencion_id: transfer.origen_id || undefined,
        },
      });

      const destinoMovimientos = await prisma.movimientoSaldo.findMany({
        where: {
          referencia_id: transfer.id,
          tipo_referencia: "TRANSFERENCIA",
          punto_atencion_id: transfer.destino_id,
        },
      });

      const monto = Number(transfer.monto);

      if (transfer.estado === "EN_TRANSITO") {
        if (origenMovimientos.length === 0) {
          notas.push("⚠️ EN_TRANSITO pero sin movimiento de salida del origen registrado");
          consistente = false;
        } else {
          const salidaOrigen = origenMovimientos.find(
            (m) => m.tipo_movimiento === "TRANSFERENCIA_SALIENTE"
          );
          if (salidaOrigen && Number(salidaOrigen.monto) !== monto) {
            notas.push(
              `❌ Monto de salida (${salidaOrigen.monto}) no coincide con monto de transferencia (${monto})`
            );
            consistente = false;
          } else if (salidaOrigen) {
            notas.push(`✅ Salida del origen registrada correctamente`);
          }
        }

        if (destinoMovimientos.length > 0) {
          notas.push("❌ EN_TRANSITO pero ya tiene movimientos en destino (no debería)");
          consistente = false;
        } else {
          notas.push("✅ Destino sin movimientos (correcto para EN_TRANSITO)");
        }
      }

      if (transfer.estado === "CANCELADO") {
        const salidaOrigen = origenMovimientos.find(
          (m) => m.tipo_movimiento === "TRANSFERENCIA_SALIENTE"
        );
        const devolucion = origenMovimientos.find(
          (m) => m.tipo_movimiento === "TRANSFERENCIA_DEVOLUCION"
        );

        if (!salidaOrigen) {
          notas.push("⚠️ CANCELADO pero sin salida original registrada");
          consistente = false;
        } else {
          notas.push(
            `✅ Salida original: ${salidaOrigen.monto} (${salidaOrigen.fecha.toISOString()})`
          );
        }

        if (!devolucion) {
          notas.push("❌ CANCELADO pero sin movimiento de devolución registrado");
          consistente = false;
        } else {
          if (Number(devolucion.monto) !== monto) {
            notas.push(
              `❌ Devolución (${devolucion.monto}) no coincide con monto original (${monto})`
            );
            consistente = false;
          } else {
            notas.push(`✅ Devolución correcta: ${devolucion.monto}`);
          }
        }

        if (destinoMovimientos.length > 0) {
          notas.push(
            `❌ CANCELADO pero destino tiene ${destinoMovimientos.length} movimientos (no debería)`
          );
          consistente = false;
        } else {
          notas.push("✅ Destino sin movimientos (correcto para CANCELADO)");
        }
      }

      if (transfer.estado === "COMPLETADO") {
        const salidaOrigen = origenMovimientos.find(
          (m) => m.tipo_movimiento === "TRANSFERENCIA_SALIENTE"
        );
        const ingresoDestino = destinoMovimientos.find(
          (m) => m.tipo_movimiento === "TRANSFERENCIA_ENTRANTE"
        );

        if (!salidaOrigen) {
          notas.push("⚠️ COMPLETADO pero sin salida del origen");
          consistente = false;
        } else {
          notas.push(`✅ Salida del origen: ${salidaOrigen.monto}`);
        }

        if (!ingresoDestino) {
          notas.push("❌ COMPLETADO pero sin ingreso en destino");
          consistente = false;
        } else {
          if (Number(ingresoDestino.monto) !== monto) {
            notas.push(
              `❌ Ingreso destino (${ingresoDestino.monto}) != monto original (${monto})`
            );
            consistente = false;
          } else {
            notas.push(`✅ Ingreso destino correcto: ${ingresoDestino.monto}`);
          }
        }
      }

      results.push({
        transferId: transfer.id,
        numeroRecibo: transfer.numero_recibo,
        estado: transfer.estado,
        origen: transfer.origen?.nombre || "N/A",
        destino: transfer.destino.nombre,
        monto,
        consistente,
        notas,
      });
    }

    console.log("\n=== RESULTADOS DE VALIDACIÓN ===\n");

    const consistentes = results.filter((r) => r.consistente);
    const inconsistentes = results.filter((r) => !r.consistente);

    console.log(
      `✅ Consistentes: ${consistentes.length}/${results.length}`
    );
    console.log(`❌ Inconsistentes: ${inconsistentes.length}/${results.length}\n`);

    for (const result of inconsistentes) {
      console.log(`\n[${result.estado}] ${result.numeroRecibo || result.transferId}`);
      console.log(`  Origen: ${result.origen} → Destino: ${result.destino}`);
      console.log(`  Monto: ${result.monto}`);
      for (const nota of result.notas) {
        console.log(`  ${nota}`);
      }
    }

    if (inconsistentes.length === 0) {
      console.log("✅ Todas las transferencias son consistentes!");
    }

    console.log("\n=== RESUMEN POR ESTADO ===\n");
    const porEstado = results.reduce(
      (acc, r) => {
        if (!acc[r.estado]) {
          acc[r.estado] = { total: 0, consistentes: 0 };
        }
        acc[r.estado].total++;
        if (r.consistente) acc[r.estado].consistentes++;
        return acc;
      },
      {} as Record<string, { total: number; consistentes: number }>
    );

    for (const [estado, counts] of Object.entries(porEstado)) {
      console.log(
        `${estado}: ${counts.consistentes}/${counts.total} consistentes`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error en validación:", e);
  process.exitCode = 1;
});
