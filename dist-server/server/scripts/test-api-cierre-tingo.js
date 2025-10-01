import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function testAPICierreTingo() {
    console.log("🧪 PROBANDO API DE CIERRE - EL TINGO");
    console.log("============================================================");
    try {
        // Buscar el operador de EL TINGO
        const operador = await prisma.usuario.findFirst({
            where: {
                puntoAtencion: {
                    nombre: { contains: "TINGO", mode: "insensitive" },
                },
                rol: "OPERADOR",
                activo: true,
            },
            include: {
                puntoAtencion: true,
            },
        });
        if (!operador) {
            console.log("❌ No se encontró operador para EL TINGO");
            return;
        }
        console.log(`✅ Operador: ${operador.nombre}`);
        console.log(`📍 Punto: ${operador.puntoAtencion?.nombre}`);
        // 1. Simular la llamada a /schedules/active
        console.log("\n🔍 SIMULANDO API: GET /schedules/active");
        console.log("----------------------------------------");
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const mañana = new Date(hoy);
        mañana.setDate(mañana.getDate() + 1);
        const activeSchedule = await prisma.jornada.findFirst({
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
        if (activeSchedule) {
            console.log("✅ API /schedules/active EXITOSA");
            console.log(`📋 Estado jornada: ${activeSchedule.estado}`);
            console.log(`🆔 ID jornada: ${activeSchedule.id}`);
            console.log(`👤 Usuario: ${activeSchedule.usuario.nombre}`);
            console.log(`📍 Punto: ${activeSchedule.puntoAtencion.nombre}`);
        }
        else {
            console.log("❌ API /schedules/active FALLÓ");
            console.log("No se encontró jornada activa");
            return;
        }
        // 2. Simular la validación del componente DailyClose
        console.log("\n🔍 SIMULANDO VALIDACIONES DEL COMPONENTE");
        console.log("----------------------------------------");
        // Verificar si el usuario es OPERADOR
        const isOperador = operador.rol === "OPERADOR";
        console.log(`👤 ¿Es OPERADOR? ${isOperador ? "✅ SÍ" : "❌ NO"}`);
        // Verificar si tiene punto seleccionado
        const hasSelectedPoint = !!operador.punto_atencion_id;
        console.log(`📍 ¿Tiene punto seleccionado? ${hasSelectedPoint ? "✅ SÍ" : "❌ NO"}`);
        // Verificar si la jornada está activa
        const hasActiveSchedule = activeSchedule &&
            (activeSchedule.estado === "ACTIVO" ||
                activeSchedule.estado === "ALMUERZO");
        console.log(`📅 ¿Jornada activa? ${hasActiveSchedule ? "✅ SÍ" : "❌ NO"}`);
        // 3. Verificar si ya existe un cierre para hoy
        console.log("\n🔍 VERIFICANDO CIERRE EXISTENTE");
        console.log("----------------------------------------");
        const existingClose = await prisma.cierreDiario.findFirst({
            where: {
                punto_atencion_id: operador.punto_atencion_id,
                fecha: {
                    gte: hoy,
                    lt: mañana,
                },
            },
        });
        if (existingClose) {
            console.log("❌ YA EXISTE CIERRE PARA HOY");
            console.log(`🆔 ID: ${existingClose.id}`);
            console.log(`📋 Estado: ${existingClose.estado}`);
            console.log(`🕐 Fecha: ${existingClose.fecha}`);
        }
        else {
            console.log("✅ No existe cierre para hoy");
        }
        // 4. Verificar transacciones del día
        console.log("\n🔍 VERIFICANDO TRANSACCIONES");
        console.log("----------------------------------------");
        const transacciones = await prisma.servicioExternoMovimiento.findMany({
            where: {
                punto_atencion_id: operador.punto_atencion_id,
                fecha: {
                    gte: hoy,
                    lt: mañana,
                },
            },
        });
        console.log(`📊 Transacciones encontradas: ${transacciones.length}`);
        if (transacciones.length > 0) {
            transacciones.forEach((t, index) => {
                console.log(`${index + 1}. ${t.servicio} - $${t.monto} (${t.tipo_movimiento})`);
            });
        }
        // 5. Resultado final
        console.log("\n🎯 RESULTADO FINAL");
        console.log("============================================================");
        const canClose = isOperador && hasSelectedPoint && hasActiveSchedule && !existingClose;
        if (canClose) {
            console.log("✅ EL OPERADOR DEBERÍA PODER HACER CIERRE DE CAJA");
            console.log("\n💡 Si no puede hacer el cierre, posibles causas:");
            console.log("1. 🌐 Problema de conectividad con el servidor");
            console.log("2. 💾 Cache del navegador con datos obsoletos");
            console.log("3. 🐛 Error de JavaScript en el frontend");
            console.log("4. 🔒 Validación adicional en el backend no contemplada");
            console.log("5. 🔄 Estado de la sesión del usuario");
            console.log("\n🛠️ SOLUCIONES RECOMENDADAS:");
            console.log("1. Refrescar la página (F5)");
            console.log("2. Cerrar sesión y volver a iniciar");
            console.log("3. Limpiar cache del navegador");
            console.log("4. Verificar consola del navegador por errores");
        }
        else {
            console.log("❌ EL OPERADOR NO PUEDE HACER CIERRE DE CAJA");
            console.log("\n🔍 PROBLEMAS IDENTIFICADOS:");
            if (!isOperador)
                console.log("- No es OPERADOR");
            if (!hasSelectedPoint)
                console.log("- No tiene punto seleccionado");
            if (!hasActiveSchedule)
                console.log("- No tiene jornada activa");
            if (existingClose)
                console.log("- Ya existe un cierre para hoy");
        }
    }
    catch (error) {
        console.error("❌ Error al probar API:", error);
    }
    finally {
        await prisma.$disconnect();
    }
}
testAPICierreTingo();
