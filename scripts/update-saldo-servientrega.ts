import { PrismaClient, ServicioExterno } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const puntoNombre = "QUITO_DISTRIBUIDORES ENCALADA_PC - QUITO";
  const nuevoSaldo = 68.27;

  try {
    // Buscar el punto de atención
    const punto = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          contains: "ENCALADA",
          mode: "insensitive",
        },
      },
    });

    if (!punto) {
      console.error("❌ Punto de atención no encontrado");
      return;
    }

    console.log("✅ Punto encontrado:", {
      id: punto.id,
      nombre: punto.nombre,
    });

    // Buscar la moneda USD
    const moneda = await prisma.moneda.findUnique({
      where: { codigo: "USD" },
    });

    if (!moneda) {
      console.error("❌ Moneda USD no encontrada");
      return;
    }

    // Buscar el saldo actual
    const saldoActual = await prisma.servicioExternoSaldo.findUnique({
      where: {
        punto_atencion_id_servicio_moneda_id: {
          punto_atencion_id: punto.id,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: moneda.id,
        },
      },
    });

    console.log("💰 Saldo actual:", saldoActual ? {
      cantidad: saldoActual.cantidad,
      billetes: saldoActual.billetes,
      monedas: saldoActual.monedas_fisicas,
    } : "No existe");

    // Actualizar o crear el saldo
    const resultado = await prisma.servicioExternoSaldo.upsert({
      where: {
        punto_atencion_id_servicio_moneda_id: {
          punto_atencion_id: punto.id,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: moneda.id,
        },
      },
      update: {
        cantidad: nuevoSaldo,
        billetes: nuevoSaldo,
        monedas_fisicas: 0,
        updated_at: new Date(),
      },
      create: {
        punto_atencion_id: punto.id,
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: moneda.id,
        cantidad: nuevoSaldo,
        billetes: nuevoSaldo,
        monedas_fisicas: 0,
      },
    });

    console.log("✅ Saldo actualizado correctamente:");
    console.log({
      punto: punto.nombre,
      saldoAnterior: saldoActual?.cantidad?.toString() || "No existía",
      saldoNuevo: resultado.cantidad.toString(),
    });

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
