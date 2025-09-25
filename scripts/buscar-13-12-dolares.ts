import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

function D(n: Prisma.Decimal | number | string | null | undefined) {
  return new Prisma.Decimal(n ?? 0);
}

async function buscarMonto1312() {
  console.log(
    "🔍 Buscando específicamente el monto de $13.12 en AMAZONAS...\n"
  );

  try {
    // 0) Punto AMAZONAS
    const puntoAmazonas = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
      select: { id: true, nombre: true },
    });

    if (!puntoAmazonas) {
      console.log("❌ No se encontró el punto AMAZONAS");
      return;
    }
    console.log(
      `📍 Punto encontrado: ${puntoAmazonas.nombre} (ID: ${puntoAmazonas.id})\n`
    );

    // 1) MOVIMIENTOS DE SALDO exactos 13.12
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
      include: { usuario: true, moneda: true, puntoAtencion: true },
      orderBy: { fecha: "desc" },
    });

    if (movimientos1312.length > 0) {
      movimientos1312.forEach((mov, index) => {
        console.log(`${index + 1}. ID: ${mov.id}`);
        console.log(`   Monto: $${mov.monto}`);
        console.log(`   Tipo: ${mov.tipo_movimiento}`);
        console.log(`   Fecha: ${mov.fecha}`);
        console.log(`   Usuario: ${mov.usuario?.nombre || "N/A"}`);
        console.log(`   Descripción: ${mov.descripcion || "N/A"}`);
        console.log(
          `   Referencia: ${mov.tipo_referencia || "N/A"} - ${
            mov.referencia_id || "N/A"
          }`
        );
        console.log(`   Saldo anterior: $${mov.saldo_anterior}`);
        console.log(`   Saldo nuevo: $${mov.saldo_nuevo}\n`);
      });
    } else {
      console.log("   ❌ No se encontraron movimientos exactos de $13.12\n");
    }

    // 2) CAMBIOS DE DIVISAS con 13.12 en origen/destino USD
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
        puntoAtencion: true,
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
        console.log(`   Usuario: ${cambio.usuario?.nombre || "N/A"}\n`);
      });
    } else {
      console.log("   ❌ No se encontraron cambios exactos de $13.12\n");
    }

    // 3) SERVICIOS EXTERNOS con 13.12
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
      include: { usuario: true, moneda: true, puntoAtencion: true },
      orderBy: { fecha: "desc" },
    });

    if (servicios1312.length > 0) {
      servicios1312.forEach((servicio, index) => {
        console.log(`${index + 1}. Servicio: ${servicio.servicio}`); // enum ServicioExterno
        console.log(`   Monto: $${servicio.monto}`);
        console.log(`   Tipo: ${servicio.tipo_movimiento}`);
        console.log(`   Fecha: ${servicio.fecha}`);
        console.log(`   Usuario: ${servicio.usuario?.nombre || "N/A"}`);
        console.log(`   Descripción: ${servicio.descripcion || "N/A"}`);
        console.log(`   Referencia: ${servicio.numero_referencia || "N/A"}\n`);
      });
    } else {
      console.log("   ❌ No se encontraron servicios exactos de $13.12\n");
    }

    // 4) TRANSFERENCIAS con 13.12 (APROBADO)
    console.log("↔️ TRANSFERENCIAS CON $13.12:");
    const transferencias1312 = await prisma.transferencia.findMany({
      where: {
        OR: [{ origen_id: puntoAmazonas.id }, { destino_id: puntoAmazonas.id }],
        moneda: { codigo: "USD" },
        monto: new Prisma.Decimal(13.12),
        estado: "APROBADO",
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
        console.log(`   Descripción: ${transfer.descripcion || "N/A"}\n`);
      });
    } else {
      console.log("   ❌ No se encontraron transferencias exactas de $13.12\n");
    }

    // 5) Cercanos 13.00 a 13.25
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
      include: { usuario: true },
      orderBy: { fecha: "desc" },
      take: 10,
    });

    if (movimientosCercanos.length > 0) {
      console.log("   Movimientos de saldo cercanos:");
      movimientosCercanos.forEach((mov, index) => {
        console.log(
          `   ${index + 1}. $${mov.monto} | ${mov.tipo_movimiento} | ${
            mov.fecha
          }`
        );
        console.log(`      ${mov.descripcion || "Sin descripción"}`);
      });
      console.log("");
    } else {
      console.log(
        "   — No se hallaron movimientos cercanos en el último rango consultado\n"
      );
    }

    // 6) SALDO ACTUAL y verificación contra saldo inicial + movimientos
    console.log("💰 SALDO ACTUAL USD EN AMAZONAS:");
    const saldoActual = await prisma.saldo.findFirst({
      where: { punto_atencion_id: puntoAmazonas.id, moneda: { codigo: "USD" } },
      include: { moneda: true },
    });

    if (saldoActual) {
      console.log(
        `   Cantidad total: $${saldoActual.cantidad} ${saldoActual.moneda.codigo}`
      );
      console.log(`   Última actualización: ${saldoActual.updated_at}`);

      const saldoInicialActivo = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: puntoAmazonas.id,
          activo: true,
          moneda: { codigo: "USD" },
        },
        orderBy: { fecha_asignacion: "desc" },
        select: { cantidad_inicial: true, fecha_asignacion: true },
      });

      const sumMovimientos = await prisma.movimientoSaldo.aggregate({
        where: {
          punto_atencion_id: puntoAmazonas.id,
          moneda: { codigo: "USD" },
        },
        _sum: { monto: true },
      });

      const saldoInicial = D(saldoInicialActivo?.cantidad_inicial ?? 0);
      const sumaMovs = D(sumMovimientos._sum.monto ?? 0);
      const saldoTeorico = saldoInicial.plus(sumaMovs);
      const diferencia = D(saldoActual.cantidad).minus(saldoTeorico);

      if (saldoInicialActivo) {
        console.log(
          `   Saldo inicial activo: $${saldoInicial} (asignado ${saldoInicialActivo.fecha_asignacion})`
        );
      } else {
        console.log("   ⚠️ No hay saldo inicial activo registrado en USD");
      }
      console.log(`   Suma de movimientos: $${sumaMovs}`);
      console.log(`   Saldo teórico (inicial + movimientos): $${saldoTeorico}`);
      console.log(`   Diferencia encontrada: $${diferencia}`);

      // ¿Coincide con 13.12?
      const diffNum = Number(diferencia);
      if (Math.abs(diffNum - 13.12) < 0.01) {
        console.log("   🎯 ¡La diferencia coincide exactamente con $13.12!");
      } else if (Math.abs(diffNum + 13.12) < 0.01) {
        console.log("   🎯 ¡La diferencia coincide exactamente con -$13.12!");
      }
    } else {
      console.log("   ⚠️ No se encontró registro de saldo USD para el punto");
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
      console.log("   - Errores de redondeo");
      console.log("   - Transacción manual no registrada correctamente");
      console.log("   - Diferencias en tasas de cambio");
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
