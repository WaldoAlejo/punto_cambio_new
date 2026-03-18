import { PrismaClient, ServicioExterno } from "@prisma/client";

const prisma = new PrismaClient();

const SERVICIOS_CON_ASIGNACION = [
  ServicioExterno.YAGANASTE,
  ServicioExterno.BANCO_GUAYAQUIL,
  ServicioExterno.WESTERN,
  ServicioExterno.PRODUBANCO,
  ServicioExterno.BANCO_PACIFICO,
  ServicioExterno.SERVIENTREGA,
];

const SERVICIOS_SALDO_GENERAL = [
  ServicioExterno.INSUMOS_OFICINA,
  ServicioExterno.INSUMOS_LIMPIEZA,
  ServicioExterno.OTROS,
];

async function main() {
  try {
    const usdId = (await prisma.moneda.findUnique({ where: { codigo: "USD" } }))?.id;
    if (!usdId) throw new Error("No se encontró moneda USD");

    const puntos = await prisma.puntoAtencion.findMany({ where: { activo: true } });

    console.log("🛠️ INICIANDO CORRECCIÓN DEFINITIVA DE SALDOS...");

    for (const punto of puntos) {
      console.log(`\n📍 Punto: ${punto.nombre}`);

      // 1. LIMPIAR SERVICIOS DE SALDO GENERAL (Deben ser 0)
      for (const servicio of SERVICIOS_SALDO_GENERAL) {
        await prisma.servicioExternoSaldo.upsert({
          where: { punto_atencion_id_servicio_moneda_id: { punto_atencion_id: punto.id, servicio, moneda_id: usdId } },
          update: { cantidad: 0, billetes: 0, monedas_fisicas: 0, bancos: 0 },
          create: { punto_atencion_id: punto.id, servicio, moneda_id: usdId, cantidad: 0 }
        });
      }
      console.log("  ✅ Servicios de saldo general reseteados a $0.00");

      // 2. SINCRONIZAR SERVICIOS CON ASIGNACIÓN (Cupo Digital)
      for (const servicio of SERVICIOS_CON_ASIGNACION) {
        // Sumar TODAS las asignaciones de la historia
        const asignaciones = await prisma.servicioExternoAsignacion.findMany({
          where: { punto_atencion_id: punto.id, servicio }
        });
        const totalAsig = asignaciones.reduce((acc, curr) => acc + Number(curr.monto), 0);

        // Sumar movimientos
        const movimientos = await prisma.servicioExternoMovimiento.findMany({
          where: { punto_atencion_id: punto.id, servicio }
        });

        const ingresos = movimientos
          .filter(m => m.tipo_movimiento === "INGRESO")
          .reduce((acc, curr) => acc + Number(curr.monto), 0);
        
        const egresos = movimientos
          .filter(m => m.tipo_movimiento === "EGRESO")
          .reduce((acc, curr) => acc + Number(curr.monto), 0);

        // Saldo Real = Asignaciones (todas sumadas) + Egresos (reposiciones) - Ingresos (consumos)
        const saldoReal = Number((totalAsig + egresos - ingresos).toFixed(2));

        // Actualizar tabla principal
        await prisma.servicioExternoSaldo.upsert({
          where: { punto_atencion_id_servicio_moneda_id: { punto_atencion_id: punto.id, servicio, moneda_id: usdId } },
          update: { cantidad: saldoReal },
          create: {
            punto_atencion_id: punto.id,
            servicio,
            moneda_id: usdId,
            cantidad: saldoReal,
            billetes: 0,
            monedas_fisicas: 0
          }
        });
        console.log(`  ✅ ${servicio}: $${saldoReal.toFixed(2)} (Sincronizado con investigación)`);
      }
    }

    console.log("\n🚀 CORRECCIÓN COMPLETADA EXITOSAMENTE.");
  } catch (error) {
    console.error("❌ Error durante la corrección:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
