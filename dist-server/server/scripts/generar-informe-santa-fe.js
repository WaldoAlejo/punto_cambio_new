import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
const prisma = new PrismaClient();
async function generarInformeSantaFe() {
    try {
        console.log("🔍 Generando informe completo para SANTA FE...");
        // 1. Obtener información del punto de atención
        const puntoAtencion = await prisma.puntoAtencion.findFirst({
            where: { nombre: "SANTA FE" },
            include: {
                usuarios: true,
            },
        });
        if (!puntoAtencion) {
            throw new Error("Punto de atención SANTA FE no encontrado");
        }
        // 2. Obtener moneda USD
        const monedaUSD = await prisma.moneda.findFirst({
            where: { codigo: "USD" },
        });
        if (!monedaUSD) {
            throw new Error("Moneda USD no encontrada");
        }
        // 3. Obtener saldo inicial
        const saldoInicial = await prisma.saldoInicial.findFirst({
            where: {
                punto_atencion_id: puntoAtencion.id,
                moneda_id: monedaUSD.id,
            },
        });
        // 4. Obtener todos los movimientos desde el 28 de septiembre
        const movimientos = await prisma.movimientoSaldo.findMany({
            where: {
                punto_atencion_id: puntoAtencion.id,
                moneda_id: monedaUSD.id,
                fecha: {
                    gte: new Date("2025-09-28T00:00:00Z"),
                },
            },
            include: {
                usuario: true,
            },
            orderBy: {
                fecha: "asc",
            },
        });
        // 5. Obtener saldo actual
        const saldoActual = await prisma.saldo.findFirst({
            where: {
                punto_atencion_id: puntoAtencion.id,
                moneda_id: monedaUSD.id,
            },
        });
        // 6. Procesar movimientos para el informe
        const movimientosDetalle = movimientos.map((mov) => ({
            fecha: mov.fecha,
            tipo: mov.tipo_movimiento,
            monto: Number(mov.monto),
            saldoAnterior: Number(mov.saldo_anterior),
            saldoNuevo: Number(mov.saldo_nuevo),
            descripcion: mov.descripcion || "",
            usuario: mov.usuario?.nombre || "Sistema",
            referencia: mov.referencia_id || "",
        }));
        // 7. Calcular estadísticas
        const totalIngresos = movimientos
            .filter((m) => Number(m.monto) > 0)
            .reduce((sum, m) => sum + Number(m.monto), 0);
        const totalEgresos = movimientos
            .filter((m) => Number(m.monto) < 0)
            .reduce((sum, m) => sum + Math.abs(Number(m.monto)), 0);
        const saldoInicialMonto = Number(saldoInicial?.cantidad_inicial || 0);
        const saldoFinal = Number(saldoActual?.cantidad || 0);
        const deficitCalculado = saldoInicialMonto + totalIngresos - totalEgresos;
        // 8. Crear el libro de Excel
        const workbook = XLSX.utils.book_new();
        // HOJA 1: RESUMEN EJECUTIVO
        const resumenData = [
            ["INFORME EJECUTIVO - PUNTO DE ATENCIÓN SANTA FE"],
            ["Análisis de Saldo Negativo en USD"],
            ["Fecha del Informe:", new Date().toLocaleDateString("es-ES")],
            ["Período Analizado:", "Desde 28 de Septiembre 2025"],
            [""],
            ["INFORMACIÓN GENERAL"],
            ["Punto de Atención:", puntoAtencion.nombre],
            ["Responsable:", puntoAtencion.usuarios?.[0]?.nombre || "N/A"],
            ["Moneda:", "USD (Dólares Americanos)"],
            [""],
            ["RESUMEN FINANCIERO"],
            ["Saldo Inicial Asignado:", `$${saldoInicialMonto.toFixed(2)}`],
            ["Total Ingresos:", `$${totalIngresos.toFixed(2)}`],
            ["Total Egresos:", `$${totalEgresos.toFixed(2)}`],
            ["Saldo Actual:", `$${saldoFinal.toFixed(2)}`],
            [""],
            ["ANÁLISIS DEL PROBLEMA"],
            ["Déficit Identificado:", `$${Math.abs(saldoFinal).toFixed(2)}`],
            [
                "Causa Principal:",
                "Egresos realizados antes de asignar saldo inicial suficiente",
            ],
            ["Primeros Egresos:", "$600.00 (antes del saldo inicial)"],
            [
                "Saldo Inicial Posterior:",
                `$${saldoInicialMonto.toFixed(2)} (insuficiente)`,
            ],
            [""],
            ["RECOMENDACIÓN"],
            ["Transferencia Requerida:", "$600.00"],
            [
                "Justificación:",
                "Cubrir déficit operacional por secuencia incorreta de operaciones",
            ],
            ["Urgencia:", "ALTA - Punto sin capacidad operativa"],
            [""],
            ["MOVIMIENTOS CRÍTICOS"],
            [
                "29/09/2025 13:42:50",
                "EGRESO Western Union",
                "-$300.00",
                "Saldo: -$300.00",
            ],
            [
                "29/09/2025 13:46:31",
                "EGRESO Micropagos",
                "-$300.00",
                "Saldo: -$600.00",
            ],
            ["29/09/2025 14:18:39", "SALDO_INICIAL", "+$16.87", "Saldo: -$583.13"],
        ];
        const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
        // Aplicar estilos al resumen
        resumenSheet["!cols"] = [
            { width: 25 },
            { width: 30 },
            { width: 15 },
            { width: 20 },
        ];
        XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen Ejecutivo");
        // HOJA 2: DETALLE DE MOVIMIENTOS
        const movimientosHeaders = [
            "Fecha y Hora",
            "Tipo de Movimiento",
            "Monto",
            "Saldo Anterior",
            "Saldo Nuevo",
            "Descripción",
            "Usuario",
            "Referencia",
        ];
        const movimientosRows = movimientosDetalle.map((mov) => [
            mov.fecha.toLocaleString("es-ES"),
            mov.tipo,
            mov.monto,
            mov.saldoAnterior,
            mov.saldoNuevo,
            mov.descripcion,
            mov.usuario,
            mov.referencia,
        ]);
        const movimientosData = [movimientosHeaders, ...movimientosRows];
        const movimientosSheet = XLSX.utils.aoa_to_sheet(movimientosData);
        // Configurar columnas
        movimientosSheet["!cols"] = [
            { width: 20 },
            { width: 18 },
            { width: 12 },
            { width: 15 },
            { width: 15 },
            { width: 30 },
            { width: 15 },
            { width: 15 },
        ];
        XLSX.utils.book_append_sheet(workbook, movimientosSheet, "Detalle Movimientos");
        // HOJA 3: ANÁLISIS POR TIPO
        const tiposMovimiento = Array.from(new Set(movimientos.map((m) => m.tipo_movimiento)));
        const analisisTipos = tiposMovimiento.map((tipo) => {
            const movsTipo = movimientos.filter((m) => m.tipo_movimiento === tipo);
            const totalTipo = movsTipo.reduce((sum, m) => sum + Number(m.monto), 0);
            const cantidadTipo = movsTipo.length;
            return [
                tipo,
                cantidadTipo,
                `$${totalTipo.toFixed(2)}`,
                `$${(totalTipo / cantidadTipo).toFixed(2)}`,
            ];
        });
        const analisisData = [
            ["ANÁLISIS POR TIPO DE MOVIMIENTO"],
            [""],
            ["Tipo", "Cantidad", "Total", "Promedio"],
            ...analisisTipos,
            [""],
            ["RESUMEN"],
            ["Total Movimientos:", movimientos.length],
            [
                "Período:",
                `${movimientos.length > 0
                    ? movimientos[0].fecha.toLocaleDateString("es-ES")
                    : "N/A"} - ${movimientos.length > 0
                    ? movimientos[movimientos.length - 1].fecha.toLocaleDateString("es-ES")
                    : "N/A"}`,
            ],
        ];
        const analisisSheet = XLSX.utils.aoa_to_sheet(analisisData);
        analisisSheet["!cols"] = [
            { width: 25 },
            { width: 12 },
            { width: 15 },
            { width: 15 },
        ];
        XLSX.utils.book_append_sheet(workbook, analisisSheet, "Análisis por Tipo");
        // HOJA 4: RECOMENDACIONES DETALLADAS
        const recomendacionesData = [
            ["RECOMENDACIONES PARA LA ADMINISTRACIÓN"],
            [""],
            ["1. ACCIÓN INMEDIATA REQUERIDA"],
            ["Transferir $600.00 USD al punto SANTA FE"],
            ["Justificación: Cubrir déficit operacional"],
            ["Urgencia: ALTA"],
            [""],
            ["2. OPCIONES DE IMPLEMENTACIÓN"],
            [""],
            ["Opción A: Transferencia desde otro punto"],
            ["- Identificar punto con excedente en USD"],
            ["- Realizar transferencia interna"],
            ["- Documentar como corrección operacional"],
            [""],
            ["Opción B: Ajuste de saldo inicial"],
            ["- Modificar saldo inicial de $16.87 a $616.87"],
            ["- Justificar como corrección retroactiva"],
            ["- Mantener trazabilidad del ajuste"],
            [""],
            ["Opción C: Inyección de capital"],
            ["- Depositar $600.00 desde caja central"],
            ["- Registrar como aporte de capital"],
            ["- Actualizar registros contables"],
            [""],
            ["3. MEDIDAS PREVENTIVAS"],
            [""],
            ["Implementar validaciones de saldo:"],
            ["- Bloquear egresos si saldo insuficiente"],
            ["- Permitir solo ingresos en saldo negativo"],
            ["- Alertas automáticas de saldo bajo"],
            ["- Aprobación gerencial para sobregiros"],
            [""],
            ["4. CONTROLES RECOMENDADOS"],
            [""],
            ["- Verificación de saldo antes de cada egreso"],
            ["- Límites máximos de sobregiro por punto"],
            ["- Reportes diarios de saldos negativos"],
            ["- Auditoría semanal de movimientos"],
            [""],
            ["5. CRONOGRAMA SUGERIDO"],
            [""],
            ["Inmediato (Hoy):", "Transferir $600.00 para normalizar operaciones"],
            ["Esta semana:", "Implementar validaciones de saldo"],
            ["Próximo mes:", "Revisar y ajustar límites operacionales"],
            [""],
            ["CONTACTO TÉCNICO"],
            ["Para implementación de medidas preventivas"],
            ["Equipo de Desarrollo - Sistema Punto de Cambio"],
        ];
        const recomendacionesSheet = XLSX.utils.aoa_to_sheet(recomendacionesData);
        recomendacionesSheet["!cols"] = [{ width: 40 }, { width: 30 }];
        XLSX.utils.book_append_sheet(workbook, recomendacionesSheet, "Recomendaciones");
        // 9. Guardar el archivo
        const fechaHoy = new Date().toISOString().split("T")[0];
        const nombreArchivo = `Informe_SANTA_FE_Deficit_USD_${fechaHoy}.xlsx`;
        const rutaArchivo = path.join(process.cwd(), "informes", nombreArchivo);
        // Crear directorio si no existe
        const dirInformes = path.dirname(rutaArchivo);
        if (!fs.existsSync(dirInformes)) {
            fs.mkdirSync(dirInformes, { recursive: true });
        }
        XLSX.writeFile(workbook, rutaArchivo);
        console.log("✅ Informe generado exitosamente");
        console.log(`📁 Archivo: ${rutaArchivo}`);
        console.log("");
        console.log("📊 RESUMEN DEL INFORME:");
        console.log(`   • Punto: ${puntoAtencion.nombre}`);
        console.log(`   • Saldo Actual: $${saldoFinal.toFixed(2)} USD`);
        console.log(`   • Déficit: $${Math.abs(saldoFinal).toFixed(2)} USD`);
        console.log(`   • Transferencia Requerida: $600.00 USD`);
        console.log(`   • Total Movimientos: ${movimientos.length}`);
        console.log(`   • Período: ${movimientos.length > 0
            ? movimientos[0].fecha.toLocaleDateString("es-ES")
            : "N/A"} - ${movimientos.length > 0
            ? movimientos[movimientos.length - 1].fecha.toLocaleDateString("es-ES")
            : "N/A"}`);
        return {
            archivo: rutaArchivo,
            resumen: {
                punto: puntoAtencion.nombre,
                saldoActual: saldoFinal,
                deficit: Math.abs(saldoFinal),
                transferenciaRequerida: 600.0,
                totalMovimientos: movimientos.length,
            },
        };
    }
    catch (error) {
        console.error("❌ Error generando informe:", error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
export { generarInformeSantaFe };
// Ejecutar si es llamado directamente
if (require.main === module) {
    generarInformeSantaFe()
        .then((resultado) => {
        console.log("🎯 Informe completado:", resultado.archivo);
    })
        .catch((error) => {
        console.error("💥 Error:", error);
        process.exit(1);
    });
}
