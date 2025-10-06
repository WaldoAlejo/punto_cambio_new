/**
 * Script para diagnosticar las diferencias entre backend y scripts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// Configuración - DEBE COINCIDIR CON calcular-saldos.ts y actualizar-saldos.ts
const FECHA_INICIO = new Date("2025-09-30T05:00:00.000Z");
const FECHA_CORTE = new Date("2025-10-03T04:00:00.000Z");
async function diagnosticarPunto(puntoNombre) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`DIAGNÓSTICO: ${puntoNombre}`);
    console.log("=".repeat(80));
    const punto = await prisma.puntoAtencion.findFirst({
        where: { nombre: puntoNombre },
    });
    if (!punto) {
        console.log("❌ Punto no encontrado");
        return;
    }
    const monedaUSD = await prisma.moneda.findFirst({
        where: { codigo: "USD" },
    });
    if (!monedaUSD) {
        console.log("❌ Moneda USD no encontrada");
        return;
    }
    // 1. Saldo inicial
    const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
            punto_atencion_id: punto.id,
            moneda_id: monedaUSD.id,
            activo: true,
            fecha_asignacion: { lte: FECHA_CORTE },
        },
        orderBy: { fecha_asignacion: "desc" },
    });
    console.log(`\n1️⃣ SALDO INICIAL:`);
    console.log(`   Cantidad: $${saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0}`);
    console.log(`   Fecha: ${saldoInicial?.fecha_asignacion || "N/A"}`);
    // 2. Movimientos
    const todosMovimientos = await prisma.movimientoSaldo.findMany({
        where: {
            punto_atencion_id: punto.id,
            moneda_id: monedaUSD.id,
            fecha: {
                gte: FECHA_INICIO,
                lte: FECHA_CORTE,
            },
        },
        orderBy: { fecha: "asc" },
    });
    console.log(`\n2️⃣ MOVIMIENTOS TOTALES: ${todosMovimientos.length}`);
    // Filtrar bancarios
    const movimientosBancarios = todosMovimientos.filter((mov) => {
        const desc = mov.descripcion?.toLowerCase() || "";
        return desc.includes("bancos");
    });
    const movimientosNoBancarios = todosMovimientos.filter((mov) => {
        const desc = mov.descripcion?.toLowerCase() || "";
        return !desc.includes("bancos");
    });
    console.log(`   - Bancarios (excluidos): ${movimientosBancarios.length}`);
    console.log(`   - No bancarios (incluidos): ${movimientosNoBancarios.length}`);
    // Agrupar por tipo
    const porTipo = {};
    for (const mov of movimientosNoBancarios) {
        const tipo = mov.tipo_movimiento;
        if (!porTipo[tipo]) {
            porTipo[tipo] = { count: 0, total: 0 };
        }
        porTipo[tipo].count++;
        porTipo[tipo].total += Number(mov.monto);
    }
    console.log(`\n3️⃣ MOVIMIENTOS POR TIPO (no bancarios):`);
    for (const [tipo, data] of Object.entries(porTipo)) {
        console.log(`   ${tipo}: ${data.count} movimientos, Total: $${data.total.toFixed(2)}`);
    }
    // 4. Calcular saldo paso a paso
    let saldo = saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;
    console.log(`\n4️⃣ CÁLCULO PASO A PASO:`);
    console.log(`   Inicio: $${saldo.toFixed(2)}`);
    for (const mov of movimientosNoBancarios) {
        const monto = Number(mov.monto);
        const tipo = mov.tipo_movimiento;
        const saldoAntes = saldo;
        switch (tipo) {
            case "SALDO_INICIAL":
                // Skip
                break;
            case "INGRESO":
                saldo += Math.abs(monto);
                break;
            case "EGRESO":
                saldo -= Math.abs(monto);
                break;
            case "AJUSTE":
                if (monto >= 0) {
                    saldo += monto;
                }
                else {
                    saldo -= Math.abs(monto);
                }
                break;
            default:
                saldo += monto;
                break;
        }
        // Mostrar solo los primeros 5 y últimos 5
        const index = movimientosNoBancarios.indexOf(mov);
        if (index < 5 || index >= movimientosNoBancarios.length - 5) {
            console.log(`   ${tipo.padEnd(15)} $${monto
                .toFixed(2)
                .padStart(10)} → $${saldoAntes.toFixed(2)} → $${saldo.toFixed(2)}`);
        }
        else if (index === 5) {
            console.log(`   ... (${movimientosNoBancarios.length - 10} movimientos más) ...`);
        }
    }
    console.log(`\n   SALDO FINAL: $${saldo.toFixed(2)}`);
    // 5. Comparar con saldo registrado
    const saldoRegistrado = await prisma.saldo.findUnique({
        where: {
            punto_atencion_id_moneda_id: {
                punto_atencion_id: punto.id,
                moneda_id: monedaUSD.id,
            },
        },
    });
    console.log(`\n5️⃣ COMPARACIÓN:`);
    console.log(`   Saldo calculado: $${saldo.toFixed(2)}`);
    console.log(`   Saldo registrado: $${saldoRegistrado ? Number(saldoRegistrado.cantidad) : 0}`);
    console.log(`   Diferencia: $${(saldo - (saldoRegistrado ? Number(saldoRegistrado.cantidad) : 0)).toFixed(2)}`);
    // 6. Mostrar movimientos bancarios si existen
    if (movimientosBancarios.length > 0) {
        console.log(`\n6️⃣ MOVIMIENTOS BANCARIOS (EXCLUIDOS):`);
        for (const mov of movimientosBancarios) {
            console.log(`   ${mov.tipo_movimiento.padEnd(15)} $${Number(mov.monto)
                .toFixed(2)
                .padStart(10)} - ${mov.descripcion}`);
        }
    }
}
async function main() {
    console.log("\n═══════════════════════════════════════════════════════════════════════════");
    console.log("           DIAGNÓSTICO DE DIFERENCIAS BACKEND VS SCRIPTS");
    console.log("═══════════════════════════════════════════════════════════════════════════");
    // Diagnosticar los puntos con mayores diferencias
    const puntosProblematicos = [
        "SCALA",
        "SANTA FE",
        "EL BOSQUE",
        "COTOCOLLAO",
        "PLAZA",
    ];
    for (const punto of puntosProblematicos) {
        await diagnosticarPunto(punto);
    }
    await prisma.$disconnect();
}
main();
