import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function findSantaFeMovimientoSaldo() {
    console.log("🔍 BÚSQUEDA DE MOVIMIENTOS SALDO SANTA FE");
    console.log("=".repeat(50));
    try {
        // Obtener el punto de atención SANTA FE
        const puntoAtencion = await prisma.puntoAtencion.findFirst({
            where: { nombre: "SANTA FE" },
        });
        if (!puntoAtencion) {
            console.log("❌ No se encontró el punto SANTA FE");
            return;
        }
        // Obtener la moneda USD
        const monedaUSD = await prisma.moneda.findFirst({
            where: { codigo: "USD" },
        });
        if (!monedaUSD) {
            console.log("❌ No se encontró la moneda USD");
            return;
        }
        console.log(`📍 Punto: ${puntoAtencion.nombre} (ID: ${puntoAtencion.id})`);
        console.log(`💰 Moneda: ${monedaUSD.codigo} (ID: ${monedaUSD.id})`);
        console.log("");
        // Buscar movimientos en MovimientoSaldo
        const movimientosSaldo = await prisma.movimientoSaldo.findMany({
            where: {
                punto_atencion_id: puntoAtencion.id,
                moneda_id: monedaUSD.id,
            },
            orderBy: {
                fecha: "asc",
            },
            include: {
                usuario: {
                    select: { nombre: true },
                },
            },
        });
        console.log(`📊 MOVIMIENTOS SALDO ENCONTRADOS: ${movimientosSaldo.length}`);
        console.log("");
        if (movimientosSaldo.length === 0) {
            console.log("❌ No se encontraron movimientos saldo para SANTA FE USD");
            return;
        }
        // Mostrar rango de fechas
        const primerMovimiento = movimientosSaldo[0];
        const ultimoMovimiento = movimientosSaldo[movimientosSaldo.length - 1];
        console.log("📅 RANGO DE MOVIMIENTOS:");
        console.log(`   Primer movimiento: ${primerMovimiento.fecha.toISOString()}`);
        console.log(`   Último movimiento: ${ultimoMovimiento.fecha.toISOString()}`);
        console.log("");
        // Agrupar por día desde el 28 de septiembre
        const movimientosPorDia = new Map();
        movimientosSaldo
            .filter((mov) => mov.fecha >= new Date("2024-09-28T00:00:00.000Z"))
            .forEach((mov) => {
            const fecha = mov.fecha.toISOString().split("T")[0];
            if (!movimientosPorDia.has(fecha)) {
                movimientosPorDia.set(fecha, []);
            }
            movimientosPorDia.get(fecha).push(mov);
        });
        console.log("📅 ANÁLISIS DESDE 28 SEPTIEMBRE:");
        console.log("=".repeat(80));
        for (const [fecha, movsDia] of Array.from(movimientosPorDia.entries()).sort()) {
            console.log(`\n📆 ${fecha}`);
            console.log("   Movimientos:");
            movsDia.forEach((mov, index) => {
                const hora = mov.fecha.toTimeString().split(" ")[0];
                const signo = Number(mov.monto) >= 0 ? "+" : "-";
                const monto = Math.abs(Number(mov.monto));
                console.log(`   ${(index + 1)
                    .toString()
                    .padStart(2)}. [${hora}] ${signo}${monto.toFixed(2)} ${mov.tipo_movimiento.padEnd(25)} | ${mov.descripcion || "Sin descripción"} | Usuario: ${mov.usuario?.nombre || "N/A"} | Saldo: ${Number(mov.saldo_nuevo).toFixed(2)}`);
            });
        }
        // Mostrar todos los movimientos si son pocos
        if (movimientosSaldo.length <= 50) {
            console.log("\n📋 TODOS LOS MOVIMIENTOS:");
            console.log("=".repeat(80));
            movimientosSaldo.forEach((mov, index) => {
                const fecha = mov.fecha.toISOString().split("T")[0];
                const hora = mov.fecha.toTimeString().split(" ")[0];
                const signo = Number(mov.monto) >= 0 ? "+" : "-";
                const monto = Math.abs(Number(mov.monto));
                console.log(`${(index + 1)
                    .toString()
                    .padStart(3)}. ${fecha} ${hora} | ${signo}${monto.toFixed(2)} | ${mov.tipo_movimiento.padEnd(25)} | Saldo: ${Number(mov.saldo_anterior).toFixed(2)} → ${Number(mov.saldo_nuevo).toFixed(2)} | ${mov.descripcion || "Sin descripción"}`);
            });
        }
        // Resumen
        console.log("\n📋 RESUMEN:");
        console.log("=".repeat(50));
        const saldoInicial = Number(movimientosSaldo[0]?.saldo_anterior || 0);
        const saldoFinal = Number(movimientosSaldo[movimientosSaldo.length - 1]?.saldo_nuevo || 0);
        console.log(`💰 Saldo inicial: ${saldoInicial.toFixed(2)} USD`);
        console.log(`💳 Saldo final:   ${saldoFinal.toFixed(2)} USD`);
        console.log(`🔄 Cambio total:  ${(saldoFinal - saldoInicial).toFixed(2)} USD`);
    }
    catch (error) {
        console.error("❌ Error en la búsqueda:", error);
    }
    finally {
        await prisma.$disconnect();
    }
}
findSantaFeMovimientoSaldo().catch(console.error);
