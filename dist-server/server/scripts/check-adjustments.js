import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function verificarAjustes() {
    console.log("🔍 Verificando movimientos de tipo AJUSTE...");
    const ajustes = await prisma.movimientoSaldo.findMany({
        where: {
            tipo_movimiento: "AJUSTE",
        },
        include: {
            puntoAtencion: {
                select: { nombre: true },
            },
            moneda: {
                select: { codigo: true },
            },
        },
        orderBy: {
            fecha: "desc",
        },
    });
    console.log(`📊 Total de ajustes encontrados: ${ajustes.length}`);
    if (ajustes.length > 0) {
        console.log("\n⚠️ AJUSTES ENCONTRADOS:");
        console.log("=".repeat(60));
        for (const ajuste of ajustes) {
            console.log(`📍 ${ajuste.puntoAtencion.nombre} - ${ajuste.moneda.codigo}`);
            console.log(`   💰 Monto: ${ajuste.monto}`);
            console.log(`   📅 Fecha: ${ajuste.fecha}`);
            console.log(`   📝 Descripción: ${ajuste.descripcion}`);
            console.log(`   🔗 Referencia: ${ajuste.referencia_id}`);
            console.log("");
        }
    }
    else {
        console.log("✅ ¡Perfecto! No hay ajustes automáticos en el sistema");
        console.log("🎯 La reconciliación está funcionando correctamente sin crear ajustes");
    }
    await prisma.$disconnect();
}
verificarAjustes().catch(console.error);
