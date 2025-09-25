import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function buscarMonto1312() {
  console.log(
    "🔍 Buscando específicamente el monto de $13.12 en AMAZONAS...\n"
  );

  try {
    // Buscar el punto AMAZONAS
    const puntoAmazonas = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          contains: "AMAZONAS",
          mode: "insensitive",
        },
      },
    });

    if (!puntoAmazonas) {
      console.log("❌ No se encontró el punto AMAZONAS");
      return;
    }

    console.log(
      `📍 Punto encontrado: ${puntoAmazonas.nombre} (ID: ${puntoAmazonas.id})\n`
    );

    // 1. Buscar movimientos de saldo exactos de $13.12
    console.log("💰 MOVIMIENTOS DE SALDO CON $13.12:");
    const movimientos1312 = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoAmazonas.id,
        moneda: { codigo: "USD" },
        OR: [
          { monto: new Prisma.Decimal(13.12) },
          { monto: new Prisma.Decimal(-13.12) },
        ],
      },
      include: {
        usuario: true,
        moneda: true,
      },
      orderBy: { created_at: "desc" },
    });

    if (movimientos1312.length > 0) {
      movimientos1312.forEach((mov, index) => {
        console.log(`${index + 1}. ID: ${mov.id}`);
        console.log(`   Monto: $${mov.monto}`);
        console.log(`   Tipo: ${mov.tipo_movimiento}`);
        console.log(`   Fecha: ${mov.created_at}`);
        console.log(`   Usuario: ${mov.usuario?.nombre || "N/A"}`);
        console.log(`   Descripción: ${mov.descripcion || "N/A"}`);
        console.log(
          `   Referencia: ${mov.tipo_referencia} - ${mov.referencia_id}`
        );
        console.log(`   Saldo anterior: $${mov.saldo_anterior}`);
        console.log(`   Saldo nuevo: $${mov.saldo_nuevo}`);
        console.log("");
      });
    } else {
      console.log("   ❌ No se encontraron movimientos exactos de $13.12\n");
    }

    // 2. Buscar cambios de divisas con $13.12
    console.log("🔄 CAMBIOS DE DIVISAS CON $13.12:");
    const cambios1312 = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: puntoAmazonas.id,
        estado: "COMPLETADO",
        OR: [
          {
            monedaOrigen: { codigo: "USD" },
            monto_origen: new Prisma.Decimal(13.12),
          },
          {
            monedaDestino: { codigo: "USD" },
            monto_destino: new Prisma.Decimal(13.12),
          },
        ],
      },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
        usuario: true,
      },
      orderBy: { fecha: "desc" },
    });

    if (cambios1312.length > 0) {
      cambios1312.forEach((cambio, index) => {
        console.log(`${index + 1}. Recibo: ${cambio.numero_recibo || "N/A"}`);
        console.log(
          `   ${cambio.monedaOrigen.codigo} $${cambio.monto_origen} → ${cambio.monedaDestino.codigo} $${cambio.monto_destino}`
        );
        console.log(`   Tasa billetes: ${cambio.tasa_cambio_billetes}`);
        console.log(`   Fecha: ${cambio.fecha_completado || cambio.fecha}`);
        console.log(`   Usuario: ${cambio.usuario?.nombre || "N/A"}`);
        console.log("");
      });
    } else {
      console.log("   ❌ No se encontraron cambios exactos de $13.12\n");
    }

    // 3. Buscar servicios externos con $13.12
    console.log("🏪 SERVICIOS EXTERNOS CON $13.12:");
    const servicios1312 = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: puntoAmazonas.id,
        moneda: { codigo: "USD" },
        OR: [
          { monto: new Prisma.Decimal(13.12) },
          { monto: new Prisma.Decimal(-13.12) },
        ],
      },
      include: {
        servicio_externo: true,
        usuario: true,
      },
      orderBy: { created_at: "desc" },
    });

    if (servicios1312.length > 0) {
      servicios1312.forEach((servicio, index) => {
        console.log(
          `${index + 1}. Servicio: ${servicio.servicio_externo.nombre}`
        );
        console.log(`   Monto: $${servicio.monto}`);
        console.log(`   Tipo: ${servicio.tipo_movimiento}`);
        console.log(`   Fecha: ${servicio.created_at}`);
        console.log(`   Usuario: ${servicio.usuario?.nombre || "N/A"}`);
        console.log(`   Descripción: ${servicio.descripcion || "N/A"}`);
        console.log(`   Referencia: ${servicio.numero_referencia || "N/A"}`);
        console.log("");
      });
    } else {
      console.log("   ❌ No se encontraron servicios exactos de $13.12\n");
    }

    // 4. Buscar transferencias con $13.12
    console.log("↔️ TRANSFERENCIAS CON $13.12:");
    const transferencias1312 = await prisma.transferencia.findMany({
      where: {
        OR: [{ origen_id: puntoAmazonas.id }, { destino_id: puntoAmazonas.id }],
        moneda: { codigo: "USD" },
        monto: new Prisma.Decimal(13.12),
        estado: "APROBADA",
      },
      include: {
        origen: true,
        destino: true,
        usuarioSolicitante: true,
        usuarioAprobador: true,
      },
      orderBy: { fecha_aprobacion: "desc" },
    });

    if (transferencias1312.length > 0) {
      transferencias1312.forEach((transfer, index) => {
        console.log(
          `${index + 1}. Transferencia: ${transfer.numero_recibo || "N/A"}`
        );
        console.log(
          `   ${transfer.origen?.nombre || "N/A"} → ${transfer.destino.nombre}`
        );
        console.log(`   Monto: $${transfer.monto}`);
        console.log(`   Fecha aprobación: ${transfer.fecha_aprobacion}`);
        console.log(
          `   Solicitante: ${transfer.usuarioSolicitante?.nombre || "N/A"}`
        );
        console.log(
          `   Aprobador: ${transfer.usuarioAprobador?.nombre || "N/A"}`
        );
        console.log(`   Descripción: ${transfer.descripcion || "N/A"}`);
        console.log("");
      });
    } else {
      console.log("   ❌ No se encontraron transferencias exactas de $13.12\n");
    }

    // 5. Buscar montos cercanos (entre $13.00 y $13.25)
    console.log("🔍 MONTOS CERCANOS A $13.12 (entre $13.00 y $13.25):");

    const movimientosCercanos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoAmazonas.id,
        moneda: { codigo: "USD" },
        OR: [
          {
            monto: {
              gte: new Prisma.Decimal(13.0),
              lte: new Prisma.Decimal(13.25),
            },
          },
          {
            monto: {
              gte: new Prisma.Decimal(-13.25),
              lte: new Prisma.Decimal(-13.0),
            },
          },
        ],
      },
      include: {
        usuario: true,
      },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    if (movimientosCercanos.length > 0) {
      console.log("   Movimientos de saldo cercanos:");
      movimientosCercanos.forEach((mov, index) => {
        console.log(
          `   ${index + 1}. $${mov.monto} | ${mov.tipo_movimiento} | ${
            mov.created_at
          }`
        );
        console.log(`      ${mov.descripcion || "Sin descripción"}`);
      });
      console.log("");
    }

    // 6. Verificar saldo actual
    console.log("💰 SALDO ACTUAL USD EN AMAZONAS:");
    const saldoActual = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: puntoAmazonas.id,
        moneda: { codigo: "USD" },
      },
      include: {
        moneda: true,
      },
    });

    if (saldoActual) {
      console.log(`   Saldo Inicial: $${saldoActual.saldo_inicial}`);
      console.log(`   Saldo Actual: $${saldoActual.saldo_actual}`);
      console.log(`   Diferencia: $${saldoActual.diferencia}`);
      console.log(`   Última actualización: ${saldoActual.updated_at}`);

      // Calcular si la diferencia es exactamente $13.12
      const diferencia = Number(saldoActual.diferencia);
      if (Math.abs(diferencia - 13.12) < 0.01) {
        console.log("   🎯 ¡LA DIFERENCIA COINCIDE EXACTAMENTE CON $13.12!");
      } else if (Math.abs(diferencia + 13.12) < 0.01) {
        console.log("   🎯 ¡LA DIFERENCIA COINCIDE EXACTAMENTE CON -$13.12!");
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎯 ANÁLISIS ESPECÍFICO PARA $13.12");
    console.log("=".repeat(60));

    const totalEncontrados =
      movimientos1312.length +
      cambios1312.length +
      servicios1312.length +
      transferencias1312.length;

    if (totalEncontrados > 0) {
      console.log(
        `✅ Se encontraron ${totalEncontrados} transacciones exactas de $13.12`
      );
      console.log(
        "📝 Revisar cada transacción listada arriba para identificar la causa del descuadre"
      );
    } else {
      console.log("❌ No se encontraron transacciones exactas de $13.12");
      console.log("💡 El descuadre podría ser resultado de:");
      console.log("   - Suma de múltiples transacciones pequeñas");
      console.log("   - Error de redondeo en cálculos");
      console.log("   - Transacción manual no registrada correctamente");
      console.log("   - Diferencia en tasas de cambio");
    }
  } catch (error) {
    console.error("❌ Error durante la búsqueda:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar solo si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  buscarMonto1312();
}

export { buscarMonto1312 };
