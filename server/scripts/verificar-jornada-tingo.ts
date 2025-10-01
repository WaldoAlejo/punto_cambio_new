import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verificarJornadaTingo() {
  console.log("🔍 VERIFICANDO JORNADA ACTIVA - EL TINGO");
  console.log("============================================================");

  try {
    // Buscar el punto EL TINGO
    const punto = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: { contains: "TINGO", mode: "insensitive" },
      },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto EL TINGO");
      return;
    }

    // Buscar el operador
    const operador = await prisma.usuario.findFirst({
      where: {
        punto_atencion_id: punto.id,
        rol: "OPERADOR",
        activo: true,
      },
    });

    if (!operador) {
      console.log("❌ No se encontró operador activo para EL TINGO");
      return;
    }

    console.log(`✅ Operador encontrado: ${operador.nombre}`);
    console.log(`📍 ID del operador: ${operador.id}`);

    // Verificar jornada de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const mañana = new Date(hoy);
    mañana.setDate(mañana.getDate() + 1);

    const jornadaHoy = await prisma.jornada.findFirst({
      where: {
        usuario_id: operador.id,
        fecha_inicio: {
          gte: hoy,
          lt: mañana,
        },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            rol: true,
          },
        },
        puntoAtencion: {
          select: {
            nombre: true,
          },
        },
      },
    });

    if (!jornadaHoy) {
      console.log("❌ No hay jornada para hoy");
      return;
    }

    console.log("\n📅 JORNADA DE HOY:");
    console.log("----------------------------------------");
    console.log(`🆔 ID de jornada: ${jornadaHoy.id}`);
    console.log(`👤 Usuario: ${jornadaHoy.usuario.nombre}`);
    console.log(`📍 Punto: ${jornadaHoy.puntoAtencion.nombre}`);
    console.log(`🕐 Inicio: ${jornadaHoy.fecha_inicio}`);
    console.log(`🍽️ Almuerzo: ${jornadaHoy.fecha_almuerzo || "No registrado"}`);
    console.log(`🔄 Regreso: ${jornadaHoy.fecha_regreso || "No registrado"}`);
    console.log(`🚪 Salida: ${jornadaHoy.fecha_salida || "No registrado"}`);
    console.log(`📋 Estado: ${jornadaHoy.estado}`);
    console.log(`📝 Observaciones: ${jornadaHoy.observaciones || "Ninguna"}`);

    // Verificar si cumple con los criterios de la API
    const esActiva =
      jornadaHoy.estado === "ACTIVO" || jornadaHoy.estado === "ALMUERZO";
    console.log(`\n🔍 ANÁLISIS DE ESTADO:`);
    console.log(`----------------------------------------`);
    console.log(
      `¿Estado es ACTIVO o ALMUERZO? ${esActiva ? "✅ SÍ" : "❌ NO"}`
    );
    console.log(`Estado actual: ${jornadaHoy.estado}`);

    if (!esActiva) {
      console.log(`\n⚠️ PROBLEMA IDENTIFICADO:`);
      console.log(
        `El estado de la jornada es "${jornadaHoy.estado}" pero la API busca estados "ACTIVO" o "ALMUERZO"`
      );

      // Verificar todos los estados posibles
      const todosEstados = await prisma.jornada.findMany({
        where: {
          usuario_id: operador.id,
        },
        select: {
          estado: true,
          fecha_inicio: true,
        },
        distinct: ["estado"],
        orderBy: {
          fecha_inicio: "desc",
        },
        take: 10,
      });

      console.log(`\n📊 ESTADOS HISTÓRICOS DE JORNADAS:`);
      console.log(`----------------------------------------`);
      todosEstados.forEach((j, index) => {
        console.log(`${index + 1}. Estado: ${j.estado} (${j.fecha_inicio})`);
      });
    }

    // Simular la consulta de la API
    console.log(`\n🔍 SIMULANDO CONSULTA DE API /schedules/active:`);
    console.log(`----------------------------------------`);

    const activeScheduleAPI = await prisma.jornada.findFirst({
      where: {
        usuario_id: operador.id,
        fecha_inicio: { gte: hoy, lt: mañana },
        OR: [{ estado: "ACTIVO" }, { estado: "ALMUERZO" }],
      },
      include: {
        usuario: { select: { id: true, nombre: true, username: true } },
        puntoAtencion: {
          select: {
            id: true,
            nombre: true,
            direccion: true,
            ciudad: true,
            provincia: true,
            codigo_postal: true,
            activo: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });

    if (activeScheduleAPI) {
      console.log(`✅ API encontraría jornada activa`);
      console.log(`Estado: ${activeScheduleAPI.estado}`);
    } else {
      console.log(`❌ API NO encontraría jornada activa`);
      console.log(
        `Razón: No hay jornada con estado ACTIVO o ALMUERZO para hoy`
      );
    }
  } catch (error) {
    console.error("❌ Error al verificar jornada:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarJornadaTingo();
