/**
 * Script de reconciliación de saldo Servientrega
 * 
 * Problema: Algunas guías se generaron en Servientrega y se guardaron en BD,
 * pero el saldo no se descontó porque el servidor falló entre el guardado y el descuento.
 * 
 * Este script:
 * 1. Encuentra guías ACTIVAS que no tienen movimiento de EGRESO asociado
 * 2. Desconta el saldo por cada guía encontrada
 * 3. Crea los movimientos de EGRESO e INGRESO faltantes
 * 
 * Uso: npx ts-node scripts/reconciliar-saldo-servientrega.ts [punto_atencion_id]
 */

import { PrismaClient, ServicioExterno, TipoMovimiento as PrismaTipoMovimiento } from "@prisma/client";
import { ServientregaDBService } from "../server/services/servientregaDBService.js";

const prisma = new PrismaClient();

async function main() {
  const puntoAtencionId = process.argv[2];

  if (!puntoAtencionId) {
    console.error("❌ Uso: npx ts-node scripts/reconciliar-saldo-servientrega.ts <punto_atencion_id>");
    console.error("   Ejemplo: npx ts-node scripts/reconciliar-saldo-servientrega.ts 3f13bb4e-181b-4026-b1bf-4ae00f1d1391");
    process.exit(1);
  }

  console.log(`🔍 Reconciliando saldo Servientrega para punto: ${puntoAtencionId}`);

  // Verificar que el punto existe
  const punto = await prisma.puntoAtencion.findUnique({
    where: { id: puntoAtencionId },
    select: { nombre: true },
  });

  if (!punto) {
    console.error("❌ Punto de atención no encontrado");
    process.exit(1);
  }

  console.log(`📍 Punto: ${punto.nombre}`);

  // Buscar guías ACTIVAS sin movimiento de EGRESO
  const guiasSinMovimiento = await prisma.$queryRaw<Array<{
    numero_guia: string;
    costo_envio: number;
    created_at: Date;
  }>>`
    SELECT 
      g.numero_guia,
      g.costo_envio,
      g.created_at
    FROM "ServientregaGuia" g
    LEFT JOIN "ServicioExternoMovimiento" m 
      ON g.numero_guia = m.numero_referencia 
      AND m.servicio = 'SERVIENTREGA'
      AND m.tipo_movimiento = 'EGRESO'
    WHERE g.punto_atencion_id = ${puntoAtencionId}
    AND g.estado = 'ACTIVA'
    AND m.numero_referencia IS NULL
    AND g.costo_envio > 0
    ORDER BY g.created_at ASC;
  `;

  if (guiasSinMovimiento.length === 0) {
    console.log("✅ No hay guías pendientes de reconciliación");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📋 Guías sin movimiento de EGRESO: ${guiasSinMovimiento.length}`);
  console.log("-".repeat(60));

  let totalReconciliado = 0;
  const dbService = new ServientregaDBService();

  for (const guia of guiasSinMovimiento) {
    const monto = Number(guia.costo_envio);
    console.log(`\n📝 Procesando guía ${guia.numero_guia} - $${monto.toFixed(2)}`);

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Descontar saldo
        await dbService.descontarSaldo(puntoAtencionId, monto, guia.numero_guia, tx);
        console.log(`   ✅ Saldo descontado: $${monto.toFixed(2)}`);

        // 2. Registrar ingreso en caja general
        await dbService.registrarIngresoServicioExterno(
          puntoAtencionId,
          monto,
          guia.numero_guia,
          monto, // billetes
          0,     // monedas
          0,     // bancos
          true,  // actualizar saldo general
          tx
        );
        console.log(`   ✅ Ingreso registrado en caja general`);

        // 3. Marcar guía como saldo_descontado = true
        await tx.servientregaGuia.updateMany({
          where: { numero_guia: guia.numero_guia },
          data: { saldo_descontado: true },
        });
        console.log(`   ✅ Guía marcada como saldo_descontado`);
      });

      totalReconciliado += monto;
    } catch (error) {
      console.error(`   ❌ Error procesando guía ${guia.numero_guia}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`📊 RESUMEN DE RECONCILIACIÓN`);
  console.log("=".repeat(60));
  console.log(`Guías procesadas: ${guiasSinMovimiento.length}`);
  console.log(`Total reconciliado: $${totalReconciliado.toFixed(2)}`);

  // Verificar saldo actual
  const saldoActual = await prisma.servicioExternoSaldo.findUnique({
    where: {
      punto_atencion_id_servicio_moneda_id: {
        punto_atencion_id: puntoAtencionId,
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: (await prisma.moneda.findUnique({ where: { codigo: "USD" }, select: { id: true } }))!.id,
      },
    },
  });

  if (saldoActual) {
    console.log(`Saldo actual: $${Number(saldoActual.cantidad).toFixed(2)}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Error fatal:", error);
  process.exit(1);
});
