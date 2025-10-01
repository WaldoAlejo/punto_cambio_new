import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verificarCierreTingo() {
  console.log("🔍 VERIFICANDO CIERRE DE CAJA - EL TINGO");
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

    console.log(`✅ Operador: ${operador.nombre}`);
    console.log(`📍 Punto: ${punto.nombre}`);

    // Verificar fecha de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const mañana = new Date(hoy);
    mañana.setDate(mañana.getDate() + 1);

    console.log(`📅 Verificando para fecha: ${hoy.toLocaleDateString()}`);

    // 1. Verificar si ya existe un cierre de caja para hoy
    const cierreHoy = await prisma.cierreDiario.findFirst({
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
    });

    console.log("\n💰 CIERRE DE CAJA HOY:");
    console.log("----------------------------------------");
    if (cierreHoy) {
      console.log("❌ YA EXISTE UN CIERRE DE CAJA PARA HOY");
      console.log(`🆔 ID: ${cierreHoy.id}`);
      console.log(`👤 Realizado por: ${cierreHoy.usuario.nombre}`);
      console.log(`🕐 Fecha: ${cierreHoy.fecha}`);
      console.log(`📋 Estado: ${cierreHoy.estado}`);
      console.log(`🕐 Fecha cierre: ${cierreHoy.fecha_cierre || "No cerrado"}`);
      console.log(`📝 Observaciones: ${cierreHoy.observaciones || "Ninguna"}`);
      console.log("\n⚠️ PROBLEMA: No se puede hacer otro cierre el mismo día");
      return;
    } else {
      console.log("✅ No hay cierre de caja para hoy - Se puede proceder");
    }

    // 2. Verificar jornada activa
    const jornadaHoy = await prisma.jornada.findFirst({
      where: {
        usuario_id: operador.id,
        fecha_inicio: {
          gte: hoy,
          lt: mañana,
        },
      },
    });

    console.log("\n📅 JORNADA:");
    console.log("----------------------------------------");
    if (jornadaHoy) {
      console.log(`✅ Jornada encontrada - Estado: ${jornadaHoy.estado}`);
      const esValida =
        jornadaHoy.estado === "ACTIVO" || jornadaHoy.estado === "ALMUERZO";
      console.log(
        `🔍 ¿Estado válido para cierre? ${esValida ? "✅ SÍ" : "❌ NO"}`
      );
    } else {
      console.log("❌ No hay jornada para hoy");
      return;
    }

    // 3. Verificar transacciones del día (servicios externos)
    const transaccionesHoy = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: hoy,
          lt: mañana,
        },
      },
      include: {
        moneda: {
          select: {
            nombre: true,
            simbolo: true,
          },
        },
      },
      orderBy: {
        fecha: "desc",
      },
    });

    console.log("\n💼 TRANSACCIONES HOY:");
    console.log("----------------------------------------");
    console.log(`📊 Total transacciones: ${transaccionesHoy.length}`);

    if (transaccionesHoy.length > 0) {
      transaccionesHoy.forEach((t, index) => {
        console.log(
          `${index + 1}. ${t.servicio} - ${t.moneda.simbolo}${t.monto} (${
            t.fecha
          }) - ${t.tipo_movimiento}`
        );
        if (t.descripcion) {
          console.log(`   📝 ${t.descripcion}`);
        }
        if (t.numero_referencia) {
          console.log(`   🔢 Ref: ${t.numero_referencia}`);
        }
      });

      // Calcular totales por servicio
      const totalPorServicio = transaccionesHoy.reduce((acc, t) => {
        const servicio = t.servicio;
        if (!acc[servicio]) {
          acc[servicio] = 0;
        }
        acc[servicio] += Number(t.monto);
        return acc;
      }, {} as Record<string, number>);

      console.log("\n💰 RESUMEN POR SERVICIO:");
      console.log("----------------------------------------");
      Object.entries(totalPorServicio).forEach(([servicio, total]) => {
        console.log(`${servicio}: $${total}`);
      });

      const totalGeneral = transaccionesHoy.reduce(
        (sum, t) => sum + Number(t.monto),
        0
      );
      console.log(`📊 Total general: $${totalGeneral}`);
    } else {
      console.log("ℹ️ No hay transacciones de servicios externos para hoy");
    }

    // 4. Verificar si el usuario tiene permisos
    console.log("\n👤 PERMISOS DE USUARIO:");
    console.log("----------------------------------------");
    console.log(`🔑 Rol: ${operador.rol}`);
    console.log(`✅ Activo: ${operador.activo}`);
    console.log(`📍 Punto asignado: ${punto.nombre}`);
    console.log(
      `🔍 ¿Es OPERADOR? ${operador.rol === "OPERADOR" ? "✅ SÍ" : "❌ NO"}`
    );

    // 5. Verificar configuración del punto
    console.log("\n🏢 CONFIGURACIÓN DEL PUNTO:");
    console.log("----------------------------------------");
    console.log(`✅ Punto activo: ${punto.activo}`);
    console.log(`📍 Nombre: ${punto.nombre}`);
    console.log(`🆔 ID: ${punto.id}`);

    console.log("\n🎯 DIAGNÓSTICO FINAL:");
    console.log("============================================================");

    const problemas = [];

    if (cierreHoy) {
      problemas.push("Ya existe un cierre de caja para hoy");
    }

    if (
      !jornadaHoy ||
      (jornadaHoy.estado !== "ACTIVO" && jornadaHoy.estado !== "ALMUERZO")
    ) {
      problemas.push("No hay jornada activa válida");
    }

    if (operador.rol !== "OPERADOR") {
      problemas.push("El usuario no tiene rol de OPERADOR");
    }

    if (!operador.activo) {
      problemas.push("El usuario no está activo");
    }

    if (!punto.activo) {
      problemas.push("El punto de atención no está activo");
    }

    if (problemas.length === 0) {
      console.log("✅ TODOS LOS REQUISITOS SE CUMPLEN");
      console.log("El operador debería poder realizar el cierre de caja");
      console.log("\n💡 POSIBLES CAUSAS DEL PROBLEMA:");
      console.log("1. Error en el frontend (cache, JavaScript)");
      console.log("2. Error en la API del servidor");
      console.log("3. Problema de conectividad");
      console.log("4. Validación adicional no contemplada");
    } else {
      console.log("❌ PROBLEMAS ENCONTRADOS:");
      problemas.forEach((problema, index) => {
        console.log(`${index + 1}. ${problema}`);
      });
    }
  } catch (error) {
    console.error("❌ Error al verificar cierre:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarCierreTingo();
