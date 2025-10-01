import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verificarPuntoTingo() {
  console.log("🔍 VERIFICANDO PUNTO EL TINGO");
  console.log("============================================================");

  try {
    // Buscar el punto EL TINGO
    const punto = await prisma.puntoAtencion.findFirst({
      where: {
        OR: [
          { nombre: { contains: "TINGO", mode: "insensitive" } },
          { nombre: { contains: "EL TINGO", mode: "insensitive" } },
        ],
      },
      include: {
        usuarios: {
          where: { activo: true },
          select: {
            id: true,
            nombre: true,
            rol: true,
          },
        },
        jornadas: {
          where: {
            fecha_inicio: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
          include: {
            usuario: {
              select: {
                nombre: true,
                rol: true,
              },
            },
          },
        },
      },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto EL TINGO");

      // Buscar puntos similares
      const puntosSimilares = await prisma.puntoAtencion.findMany({
        where: {
          nombre: {
            contains: "TING",
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          nombre: true,
          activo: true,
        },
      });

      if (puntosSimilares.length > 0) {
        console.log("\n📍 Puntos similares encontrados:");
        puntosSimilares.forEach((p) => {
          console.log(`   - ${p.nombre} (${p.activo ? "Activo" : "Inactivo"})`);
        });
      }

      return;
    }

    console.log(`✅ Punto encontrado: ${punto.nombre}`);
    console.log(`📍 ID: ${punto.id}`);
    console.log(`🏢 Dirección: ${punto.direccion}`);
    console.log(`📞 Teléfono: ${punto.telefono || "No especificado"}`);
    console.log(`🔄 Activo: ${punto.activo ? "Sí" : "No"}`);

    console.log("\n👥 USUARIOS ASIGNADOS:");
    console.log("----------------------------------------");
    if (punto.usuarios.length === 0) {
      console.log("❌ No hay usuarios asignados a este punto");
    } else {
      punto.usuarios.forEach((usuario) => {
        console.log(`👤 ${usuario.nombre} (${usuario.rol})`);
      });
    }

    console.log("\n📅 JORNADAS DE HOY:");
    console.log("----------------------------------------");
    if (punto.jornadas.length === 0) {
      console.log("❌ No hay jornadas abiertas hoy");
    } else {
      punto.jornadas.forEach((jornada) => {
        console.log(`🕐 Jornada iniciada: ${jornada.fecha_inicio}`);
        console.log(
          `👤 Usuario: ${jornada.usuario.nombre} (${jornada.usuario.rol})`
        );
        console.log(
          `🔄 Estado: ${jornada.fecha_salida ? "Cerrada" : "Abierta"}`
        );
        if (jornada.fecha_salida) {
          console.log(`🕐 Jornada cerrada: ${jornada.fecha_salida}`);
        }
      });
    }

    // Verificar transacciones de servicios externos del día
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const mañana = new Date(hoy);
    mañana.setDate(mañana.getDate() + 1);

    const transaccionesHoy = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: hoy,
          lt: mañana,
        },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        fecha: "desc",
      },
    });

    console.log("\n💳 TRANSACCIONES DE SERVICIOS EXTERNOS HOY:");
    console.log("----------------------------------------");
    if (transaccionesHoy.length === 0) {
      console.log("❌ No hay transacciones de servicios externos hoy");
    } else {
      console.log(`📊 Total de transacciones: ${transaccionesHoy.length}`);
      transaccionesHoy.forEach((transaccion, index) => {
        console.log(`\n${index + 1}. Transacción:`);
        console.log(`   💰 Monto: $${transaccion.monto}`);
        console.log(`   📝 Servicio: ${transaccion.servicio}`);
        console.log(`   📝 Tipo: ${transaccion.tipo_movimiento}`);
        console.log(`   👤 Usuario: ${transaccion.usuario.nombre}`);
        console.log(`   🕐 Fecha: ${transaccion.fecha}`);
        console.log(
          `   📋 Referencia: ${transaccion.numero_referencia || "N/A"}`
        );
      });
    }

    // Verificar si hay cierre de caja pendiente
    const cierrePendiente = await prisma.cierreDiario.findFirst({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: hoy,
          lt: mañana,
        },
      },
    });

    console.log("\n📋 ESTADO DEL CIERRE DIARIO:");
    console.log("----------------------------------------");
    if (cierrePendiente) {
      console.log(`✅ Ya existe un cierre para hoy`);
      console.log(`🕐 Fecha del cierre: ${cierrePendiente.fecha}`);
      console.log(`📊 Estado: ${cierrePendiente.estado}`);
      console.log(
        `🕐 Fecha de cierre: ${cierrePendiente.fecha_cierre || "Pendiente"}`
      );
    } else {
      console.log(`❌ No hay cierre diario para hoy`);
    }
  } catch (error) {
    console.error("❌ Error al verificar punto:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarPuntoTingo();
