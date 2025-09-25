import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function validateCuadreServiciosExternos() {
  console.log(
    "🔍 Validando inclusión de servicios externos en cuadre de caja...\n"
  );

  try {
    // 1. Obtener todos los cuadres de caja activos (no cerrados definitivamente)
    const cuadres = await prisma.cuadreCaja.findMany({
      include: {
        puntoAtencion: true,
        detalles: {
          include: {
            moneda: true,
          },
        },
      },
      orderBy: {
        fecha: "desc",
      },
      take: 10, // Solo los últimos 10 para análisis
    });

    console.log(
      `📊 Analizando ${cuadres.length} cuadres de caja más recientes...\n`
    );

    for (const cuadre of cuadres) {
      console.log(`\n🏢 CUADRE: ${cuadre.puntoAtencion.nombre}`);
      console.log(`📅 Fecha: ${cuadre.fecha.toLocaleDateString()}`);
      console.log(`📊 Estado: ${cuadre.estado}`);
      console.log(`💰 Total Ingresos en Cuadre: $${cuadre.total_ingresos}`);
      console.log(`💸 Total Egresos en Cuadre: $${cuadre.total_egresos}`);

      // 2. Obtener movimientos de servicios externos para el mismo día y punto
      const fechaCuadre = new Date(cuadre.fecha);
      const inicioDelDia = new Date(fechaCuadre);
      inicioDelDia.setHours(0, 0, 0, 0);

      const finDelDia = new Date(fechaCuadre);
      finDelDia.setHours(23, 59, 59, 999);

      const movimientosServiciosExternos =
        await prisma.servicioExternoMovimiento.findMany({
          where: {
            punto_atencion_id: cuadre.punto_atencion_id,
            fecha: {
              gte: inicioDelDia,
              lte: finDelDia,
            },
          },
          include: {
            moneda: true,
          },
        });

      console.log(
        `\n📋 MOVIMIENTOS DE SERVICIOS EXTERNOS (${movimientosServiciosExternos.length}):`
      );

      let totalIngresosServiciosExternos = 0;
      let totalEgresosServiciosExternos = 0;

      if (movimientosServiciosExternos.length === 0) {
        console.log(
          "   ✅ No hay movimientos de servicios externos para este día"
        );
      } else {
        movimientosServiciosExternos.forEach((mov, index) => {
          const monto = parseFloat(mov.monto.toString());
          console.log(
            `   ${index + 1}. ${mov.servicio} - ${mov.moneda.codigo}`
          );
          console.log(`      Tipo: ${mov.tipo_movimiento}`);
          console.log(`      Monto: $${monto}`);
          console.log(`      Descripción: ${mov.descripcion || "N/A"}`);

          if (mov.tipo_movimiento === "INGRESO") {
            totalIngresosServiciosExternos += monto;
          } else if (mov.tipo_movimiento === "EGRESO") {
            totalEgresosServiciosExternos += monto;
          }
        });

        console.log(
          `\n💰 Total Ingresos Servicios Externos: $${totalIngresosServiciosExternos}`
        );
        console.log(
          `💸 Total Egresos Servicios Externos: $${totalEgresosServiciosExternos}`
        );
      }

      // 3. Obtener otros movimientos del día (cambios, transferencias)
      const cambiosDivisa = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: cuadre.punto_atencion_id,
          fecha: {
            gte: inicioDelDia,
            lte: finDelDia,
          },
        },
      });

      const transferenciasEntrada = await prisma.transferencia.findMany({
        where: {
          destino_id: cuadre.punto_atencion_id,
          fecha_solicitud: {
            gte: inicioDelDia,
            lte: finDelDia,
          },
          estado: "APROBADA",
        },
      });

      const transferenciasSalida = await prisma.transferencia.findMany({
        where: {
          origen_id: cuadre.punto_atencion_id,
          fecha_solicitud: {
            gte: inicioDelDia,
            lte: finDelDia,
          },
          estado: "APROBADA",
        },
      });

      console.log(`\n📈 OTROS MOVIMIENTOS DEL DÍA:`);
      console.log(`   Cambios de divisas: ${cambiosDivisa.length}`);
      console.log(`   Transferencias entrada: ${transferenciasEntrada.length}`);
      console.log(`   Transferencias salida: ${transferenciasSalida.length}`);

      // 4. Análisis de inclusión
      console.log(`\n🔍 ANÁLISIS DE INCLUSIÓN:`);

      if (movimientosServiciosExternos.length > 0) {
        const totalIngresosCalculados = totalIngresosServiciosExternos;
        const totalEgresosCalculados = totalEgresosServiciosExternos;

        const ingresosEnCuadre = parseFloat(cuadre.total_ingresos.toString());
        const egresosEnCuadre = parseFloat(cuadre.total_egresos.toString());

        console.log(`   Ingresos en cuadre: $${ingresosEnCuadre}`);
        console.log(
          `   Ingresos servicios externos: $${totalIngresosCalculados}`
        );
        console.log(`   Egresos en cuadre: $${egresosEnCuadre}`);
        console.log(
          `   Egresos servicios externos: $${totalEgresosCalculados}`
        );

        // Verificar si los servicios externos están incluidos
        const ingresosIncluidos = ingresosEnCuadre >= totalIngresosCalculados;
        const egresosIncluidos = egresosEnCuadre >= totalEgresosCalculados;

        if (ingresosIncluidos && egresosIncluidos) {
          console.log(
            `   ✅ Los servicios externos PARECEN estar incluidos en el cuadre`
          );
        } else {
          console.log(
            `   ❌ Los servicios externos NO parecen estar incluidos completamente`
          );
          if (!ingresosIncluidos) {
            console.log(
              `      - Ingresos faltantes: $${
                totalIngresosCalculados - ingresosEnCuadre
              }`
            );
          }
          if (!egresosIncluidos) {
            console.log(
              `      - Egresos faltantes: $${
                totalEgresosCalculados - egresosEnCuadre
              }`
            );
          }
        }
      } else {
        console.log(`   ℹ️  No hay servicios externos para comparar`);
      }

      console.log("\n" + "=".repeat(80));
    }

    // 5. Resumen general
    console.log(`\n📊 RESUMEN GENERAL:`);

    const totalCuadresConServiciosExternos = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT cc.id) as cuadres_con_servicios
      FROM "CuadreCaja" cc
      INNER JOIN "ServicioExternoMovimiento" sem 
        ON cc.punto_atencion_id = sem.punto_atencion_id 
        AND DATE(cc.fecha) = DATE(sem.fecha)
    `;

    const totalCuadres = await prisma.cuadreCaja.count();

    console.log(`   Total de cuadres: ${totalCuadres}`);
    console.log(
      `   Cuadres con servicios externos: ${
        (totalCuadresConServiciosExternos as any)[0]?.cuadres_con_servicios || 0
      }`
    );

    // 6. Verificar si existe lógica de cálculo automático
    console.log(`\n🔧 RECOMENDACIONES:`);
    console.log(
      `   1. Verificar si los campos total_ingresos y total_egresos se calculan automáticamente`
    );
    console.log(
      `   2. Si no incluyen servicios externos, considerar modificar la lógica de cálculo`
    );
    console.log(
      `   3. Revisar los procedimientos de cierre de caja para incluir servicios externos`
    );
    console.log(
      `   4. Considerar agregar campos específicos para servicios externos en el cuadre`
    );
  } catch (error) {
    console.error("❌ Error durante la validación:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la validación
validateCuadreServiciosExternos()
  .then(() => {
    console.log("\n✅ Validación completada.");
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
