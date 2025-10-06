/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE VALIDACIÓN DEL BACKEND
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este script valida que el backend esté calculando correctamente los saldos
 * comparando la lógica del servicio de reconciliación con los scripts consolidados.
 *
 * MODOS DE OPERACIÓN:
 * - Sin argumentos: Valida usando TODOS los movimientos (modo producción)
 * - Con fechas: Valida usando rango de fechas específico (modo histórico)
 *
 * Validaciones:
 * 1. ✅ Signos correctos en movimientos (INGRESO +, EGRESO -)
 * 2. ✅ Saldos calculados por backend vs scripts
 * 3. ✅ Consistencia de tipos de movimiento
 * 4. ✅ Filtrado correcto de movimientos bancarios
 */
import { PrismaClient } from "@prisma/client";
import saldoReconciliationService from "../services/saldoReconciliationService.js";
const prisma = new PrismaClient();
// Configuración
// Por defecto, el backend usa TODOS los movimientos (sin filtro de fechas)
// Esto es correcto para producción
const USAR_RANGO_FECHAS = false; // Cambiar a true para modo histórico
const FECHA_INICIO = new Date("2025-09-30T05:00:00.000Z");
const FECHA_CORTE = new Date("2025-10-03T04:00:00.000Z");
/**
 * Calcula el saldo usando la MISMA lógica que calcular-saldos.ts
 */
async function calcularSaldoScript(puntoAtencionId, monedaId) {
    // 1. Obtener saldo inicial más reciente
    const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: monedaId,
            activo: true,
            fecha_asignacion: { lte: FECHA_CORTE },
        },
        orderBy: { fecha_asignacion: "desc" },
    });
    let saldo = saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;
    // 2. Obtener movimientos (con o sin filtro de fechas según configuración)
    const whereClause = {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
    };
    if (USAR_RANGO_FECHAS) {
        whereClause.fecha = {
            gte: FECHA_INICIO,
            lte: FECHA_CORTE,
        };
    }
    const todosMovimientos = await prisma.movimientoSaldo.findMany({
        where: whereClause,
        orderBy: { fecha: "asc" },
    });
    // 3. Filtrar movimientos bancarios
    const movimientos = todosMovimientos.filter((mov) => {
        const desc = mov.descripcion?.toLowerCase() || "";
        return !desc.includes("bancos");
    });
    // 4. Calcular saldo
    for (const mov of movimientos) {
        const monto = Number(mov.monto);
        const tipo = mov.tipo_movimiento;
        switch (tipo) {
            case "SALDO_INICIAL":
                // Skip - ya incluido en saldo inicial
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
                console.warn(`⚠️ Tipo desconocido: ${tipo} (monto: ${monto})`);
                saldo += monto;
                break;
        }
    }
    return Number(saldo.toFixed(2));
}
/**
 * Corrige automáticamente los signos incorrectos en movimientos
 */
async function corregirSignosIncorrectos() {
    console.log("\n🔍 Verificando y corrigiendo signos de movimientos...\n");
    // Buscar EGRESOS con montos positivos
    const egresosPositivos = await prisma.movimientoSaldo.findMany({
        where: {
            tipo_movimiento: "EGRESO",
            monto: {
                gt: 0,
            },
        },
        include: {
            puntoAtencion: {
                select: { nombre: true },
            },
            moneda: {
                select: { codigo: true },
            },
        },
    });
    if (egresosPositivos.length === 0) {
        console.log("✅ No se encontraron EGRESOS con signos incorrectos.\n");
        return 0;
    }
    console.log(`⚠️  Se encontraron ${egresosPositivos.length} EGRESOS con montos positivos:\n`);
    // Mostrar los primeros 10
    const mostrar = egresosPositivos.slice(0, 10);
    for (const mov of mostrar) {
        console.log(`   - ${mov.puntoAtencion.nombre} - ${mov.moneda.codigo} - $${Number(mov.monto).toFixed(2)}`);
    }
    if (egresosPositivos.length > 10) {
        console.log(`   ... y ${egresosPositivos.length - 10} más\n`);
    }
    else {
        console.log("");
    }
    // Corregir automáticamente
    console.log("🔧 Corrigiendo signos...\n");
    let corregidos = 0;
    for (const mov of egresosPositivos) {
        try {
            await prisma.movimientoSaldo.update({
                where: { id: mov.id },
                data: {
                    monto: -Math.abs(Number(mov.monto)),
                },
            });
            corregidos++;
        }
        catch (error) {
            console.error(`❌ Error corrigiendo movimiento ${mov.id}:`, error);
        }
    }
    console.log(`✅ Se corrigieron ${corregidos} movimientos.\n`);
    return corregidos;
}
/**
 * Valida los signos de los movimientos
 */
async function validarSignosMovimientos() {
    console.log("📋 Validando signos de movimientos...\n");
    const whereClause = {};
    if (USAR_RANGO_FECHAS) {
        whereClause.fecha = {
            gte: FECHA_INICIO,
            lte: FECHA_CORTE,
        };
    }
    const movimientos = await prisma.movimientoSaldo.findMany({
        where: whereClause,
        select: {
            id: true,
            tipo_movimiento: true,
            monto: true,
            descripcion: true,
            puntoAtencion: { select: { nombre: true } },
            moneda: { select: { codigo: true } },
        },
    });
    let errores = 0;
    for (const mov of movimientos) {
        const monto = Number(mov.monto);
        const tipo = mov.tipo_movimiento;
        // Validar signos según tipo
        if (tipo === "INGRESO" && monto < 0) {
            console.log(`❌ INGRESO con monto negativo: ${mov.puntoAtencion.nombre} - ${mov.moneda.codigo} - $${monto}`);
            errores++;
        }
        else if (tipo === "EGRESO" && monto > 0) {
            console.log(`❌ EGRESO con monto positivo: ${mov.puntoAtencion.nombre} - ${mov.moneda.codigo} - $${monto}`);
            errores++;
        }
    }
    if (errores === 0) {
        console.log("✅ Todos los movimientos tienen signos correctos\n");
    }
    else {
        console.log(`❌ Se encontraron ${errores} movimientos con signos incorrectos\n`);
    }
}
/**
 * Valida tipos de movimiento
 */
async function validarTiposMovimiento() {
    console.log("📋 Validando tipos de movimiento...\n");
    const tiposValidos = ["INGRESO", "EGRESO", "AJUSTE", "SALDO_INICIAL"];
    const whereClause = {};
    if (USAR_RANGO_FECHAS) {
        whereClause.fecha = {
            gte: FECHA_INICIO,
            lte: FECHA_CORTE,
        };
    }
    const tiposEncontrados = await prisma.movimientoSaldo.groupBy({
        by: ["tipo_movimiento"],
        _count: true,
        where: whereClause,
    });
    let tiposInvalidos = 0;
    for (const tipo of tiposEncontrados) {
        if (!tiposValidos.includes(tipo.tipo_movimiento)) {
            console.log(`⚠️ Tipo no estándar encontrado: "${tipo.tipo_movimiento}" (${tipo._count} movimientos)`);
            tiposInvalidos++;
        }
        else {
            console.log(`✅ ${tipo.tipo_movimiento}: ${tipo._count} movimientos`);
        }
    }
    if (tiposInvalidos === 0) {
        console.log("\n✅ Todos los tipos de movimiento son válidos\n");
    }
    else {
        console.log(`\n⚠️ Se encontraron ${tiposInvalidos} tipos no estándar (pueden ser válidos pero requieren revisión)\n`);
    }
}
/**
 * Compara saldos calculados por backend vs scripts
 */
async function compararSaldos() {
    console.log("📊 Comparando saldos Backend vs Scripts...\n");
    // Obtener todos los puntos con saldos en USD
    const monedaUSD = await prisma.moneda.findFirst({
        where: { codigo: "USD" },
    });
    if (!monedaUSD) {
        throw new Error("No se encontró la moneda USD");
    }
    const puntos = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        orderBy: { nombre: "asc" },
    });
    const resultados = [];
    console.log("┌─────────────────────────┬──────────────┬──────────────┬──────────────┬────────┐");
    console.log("│ Punto                   │ Backend      │ Script       │ Diferencia   │ Estado │");
    console.log("├─────────────────────────┼──────────────┼──────────────┼──────────────┼────────┤");
    for (const punto of puntos) {
        try {
            // Calcular con backend (servicio de reconciliación)
            const saldoBackend = await saldoReconciliationService.calcularSaldoReal(punto.id, monedaUSD.id);
            // Calcular con lógica de scripts
            const saldoScript = await calcularSaldoScript(punto.id, monedaUSD.id);
            const diferencia = Number((saldoBackend - saldoScript).toFixed(2));
            const estado = Math.abs(diferencia) <= 0.02
                ? "✅"
                : Math.abs(diferencia) <= 1
                    ? "⚠️"
                    : "❌";
            resultados.push({
                punto: punto.nombre,
                moneda: "USD",
                saldoBackend,
                saldoScript,
                diferencia,
                estado,
            });
            const nombrePadded = punto.nombre.padEnd(23);
            const backendPadded = `$${saldoBackend.toFixed(2)}`.padStart(12);
            const scriptPadded = `$${saldoScript.toFixed(2)}`.padStart(12);
            const difPadded = `$${diferencia.toFixed(2)}`.padStart(12);
            console.log(`│ ${nombrePadded} │ ${backendPadded} │ ${scriptPadded} │ ${difPadded} │ ${estado}    │`);
        }
        catch (error) {
            console.log(`│ ${punto.nombre.padEnd(23)} │ ERROR        │ ERROR        │ ERROR        │ ❌    │`);
        }
    }
    console.log("└─────────────────────────┴──────────────┴──────────────┴──────────────┴────────┘\n");
    return resultados;
}
/**
 * Genera resumen de validación
 */
function generarResumen(resultados) {
    const perfectos = resultados.filter((r) => r.estado === "✅").length;
    const advertencias = resultados.filter((r) => r.estado === "⚠️").length;
    const errores = resultados.filter((r) => r.estado === "❌").length;
    console.log("\n═══════════════════════════════════════════════════════════════════════════");
    console.log("                         RESUMEN DE VALIDACIÓN");
    console.log("═══════════════════════════════════════════════════════════════════════════\n");
    console.log(`✅ Perfectos (diferencia ≤ $0.02):  ${perfectos}/${resultados.length}`);
    console.log(`⚠️  Advertencias (diferencia ≤ $1): ${advertencias}/${resultados.length}`);
    console.log(`❌ Errores (diferencia > $1):       ${errores}/${resultados.length}\n`);
    if (perfectos === resultados.length) {
        console.log("🎉 ¡EXCELENTE! El backend está calculando correctamente todos los saldos.\n");
    }
    else if (errores === 0) {
        console.log("✅ El backend está funcionando correctamente con diferencias mínimas.\n");
    }
    else {
        console.log("⚠️ Se encontraron diferencias significativas. Revisar la lógica del backend.\n");
    }
    console.log("═══════════════════════════════════════════════════════════════════════════\n");
}
/**
 * Función principal
 */
async function main() {
    console.log("\n═══════════════════════════════════════════════════════════════════════════");
    console.log("                    VALIDACIÓN DEL BACKEND");
    console.log("═══════════════════════════════════════════════════════════════════════════\n");
    if (USAR_RANGO_FECHAS) {
        console.log("🔍 MODO: Validación Histórica (con rango de fechas)");
        console.log(`📅 Rango: ${FECHA_INICIO.toLocaleString("es-EC", {
            timeZone: "America/Guayaquil",
        })} - ${FECHA_CORTE.toLocaleString("es-EC", {
            timeZone: "America/Guayaquil",
        })}\n`);
    }
    else {
        console.log("🔍 MODO: Validación de Producción (todos los movimientos)");
        console.log(`📅 Fecha de corte: ${FECHA_CORTE.toLocaleString("es-EC", {
            timeZone: "America/Guayaquil",
        })}\n`);
    }
    try {
        // 1. Corregir signos incorrectos automáticamente
        await corregirSignosIncorrectos();
        // 2. Validar signos de movimientos
        await validarSignosMovimientos();
        // 3. Validar tipos de movimiento
        await validarTiposMovimiento();
        // 4. Comparar saldos
        const resultados = await compararSaldos();
        // 5. Generar resumen
        generarResumen(resultados);
    }
    catch (error) {
        console.error("\n❌ Error durante la validación:", error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
// Ejecutar
main();
