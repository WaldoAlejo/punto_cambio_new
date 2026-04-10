/**
 * Script de ANÁLISIS PROFUNDO de saldos para PLAZA DEL VALLE
 * NO modifica la base de datos, solo calcula y reporta
 * 
 * Objetivo:
 * - Analizar TODOS los movimientos históricos
 * - Identificar transacciones anuladas mal procesadas
 * - Calcular el saldo correcto
 * - Comparar con valores físicos reportados por operador
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Valores físicos reportados por el operador
const SALDOS_FISICOS_REPORTADOS = {
  USD: 4021.46,
  EUR: 52.74,
};

interface AnalisisTransaccion {
  id: string;
  fecha: Date;
  tipo: string;
  moneda: string;
  monto: number;
  descripcion: string;
  esReverso: boolean;
  transaccionOriginalId?: string;
  estado: 'VALIDO' | 'ANULADO' | 'REVERSO' | 'DUDOSO';
}

async function main() {
  console.log("=".repeat(80));
  console.log("ANÁLISIS PROFUNDO DE SALDOS - PLAZA DEL VALLE");
  console.log("=".repeat(80));
  console.log("\n⚠️  Este script SOLO ANALIZA, NO MODIFICA la base de datos\n");

  // 1. Buscar PLAZA DEL VALLE
  const punto = await prisma.puntoAtencion.findFirst({
    where: {
      nombre: {
        contains: "PLAZA DEL VALLE",
        mode: "insensitive",
      },
    },
  });

  if (!punto) {
    console.error("❌ No se encontró PLAZA DEL VALLE");
    return;
  }

  console.log(`📍 Punto: ${punto.nombre} (ID: ${punto.id})\n`);

  // 2. Obtener monedas USD y EUR
  const monedas = await prisma.moneda.findMany({
    where: { codigo: { in: ["USD", "EUR"] } },
  });

  for (const moneda of monedas) {
    console.log("\n" + "=".repeat(80));
    console.log(`💱 ANÁLISIS DE ${moneda.codigo} (${moneda.nombre})`);
    console.log("=".repeat(80));

    // 3. Obtener TODOS los movimientos de esta moneda
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
      orderBy: { fecha: "asc" },
    });

    console.log(`\n📊 Total movimientos encontrados: ${movimientos.length}`);

    if (movimientos.length === 0) {
      console.log("⚠️  No hay movimientos para esta moneda");
      continue;
    }

    // 4. Analizar cada movimiento
    const analisis: AnalisisTransaccion[] = [];
    const transaccionesAnuladas = new Set<string>();
    const reversosDetectados = new Map<string, string>(); // reversoId -> originalId

    for (const mov of movimientos) {
      const descripcion = mov.descripcion || "";
      const esReverso = descripcion.toLowerCase().includes("reverso") || 
                        descripcion.toLowerCase().includes("eliminación") ||
                        descripcion.toLowerCase().includes("anulad");
      
      // Buscar referencia a transacción original en descripción
      let transaccionOriginalId: string | undefined;
      
      // Buscar patrones como "CAM-1234567890" o referencias a recibos
      const matchRecibo = descripcion.match(/CAM-\d+-[a-z0-9]+/i);
      if (matchRecibo) {
        transaccionOriginalId = matchRecibo[0];
      }

      // Determinar estado
      let estado: AnalisisTransaccion['estado'] = 'VALIDO';
      if (esReverso) {
        estado = 'REVERSO';
        if (mov.referencia_id) {
          reversosDetectados.set(mov.id, mov.referencia_id);
          transaccionesAnuladas.add(mov.referencia_id);
        }
      }

      analisis.push({
        id: mov.id,
        fecha: mov.fecha,
        tipo: mov.tipo_movimiento,
        moneda: moneda.codigo,
        monto: Number(mov.monto),
        descripcion: descripcion,
        esReverso,
        transaccionOriginalId,
        estado,
      });
    }

    // 5. Mostrar movimientos de hoy (9/4/2026) - fecha del problema
    console.log("\n📅 MOVIMIENTOS DEL DÍA 9/4/2026 (fecha del problema):");
    console.log("-".repeat(80));
    
    const movimientosHoy = analisis.filter(m => {
      const fecha = new Date(m.fecha);
      return fecha.getFullYear() === 2026 && 
             fecha.getMonth() === 3 && // Abril = 3
             fecha.getDate() === 9;
    });

    if (movimientosHoy.length === 0) {
      console.log("No hay movimientos registrados para el 9/4/2026");
    } else {
      let saldoAcumulado = 0;
      for (const m of movimientosHoy) {
        const signo = m.tipo === "INGRESO" ? "+" : m.tipo === "EGRESO" ? "-" : (m.monto >= 0 ? "+" : "");
        const cambio = m.tipo === "INGRESO" ? m.monto : m.tipo === "EGRESO" ? -m.monto : m.monto;
        saldoAcumulado += cambio;
        
        const hora = new Date(m.fecha).toLocaleTimeString('es-EC', { hour12: true });
        const tipoStr = m.esReverso ? `🔴 ${m.tipo}` : m.tipo;
        console.log(`${hora.padEnd(12)} | ${tipoStr.padEnd(12)} | ${signo}${m.monto.toFixed(2).padStart(10)} | Saldo: ${saldoAcumulado.toFixed(2).padStart(10)} | ${m.descripcion.substring(0, 40)}`);
      }
    }

    // 6. Buscar transacciones con CAM-1775764188730 (el problema mencionado)
    console.log("\n🔍 BÚSQUEDA ESPECÍFICA - Transacción CAM-1775764188730:");
    console.log("-".repeat(80));
    
    const transaccionEspecifica = analisis.filter(m => 
      m.descripcion.includes("1775764188730") || 
      m.descripcion.includes("CAM-1775764188730")
    );

    if (transaccionEspecifica.length === 0) {
      console.log("No se encontraron movimientos con referencia CAM-1775764188730");
    } else {
      for (const m of transaccionEspecifica) {
        const hora = new Date(m.fecha).toLocaleString('es-EC');
        console.log(`Fecha: ${hora}`);
        console.log(`Tipo: ${m.tipo}${m.esReverso ? ' (REVERSO)' : ''}`);
        console.log(`Monto: ${m.monto.toFixed(2)} ${moneda.codigo}`);
        console.log(`Descripción: ${m.descripcion}`);
        console.log("-".repeat(40));
      }
    }

    // 7. Calcular saldo de diferentes formas
    console.log("\n📊 CÁLCULOS DE SALDO:");
    console.log("-".repeat(80));

    // 7.1 Saldo según movimientos (suma simple)
    let saldoSimple = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalAjustesPos = 0;
    let totalAjustesNeg = 0;

    for (const m of analisis) {
      if (m.tipo === "INGRESO") {
        saldoSimple += m.monto;
        totalIngresos += m.monto;
      } else if (m.tipo === "EGRESO") {
        saldoSimple -= m.monto;
        totalEgresos += m.monto;
      } else if (m.tipo === "AJUSTE") {
        saldoSimple += m.monto;
        if (m.monto > 0) totalAjustesPos += m.monto;
        else totalAjustesNeg += Math.abs(m.monto);
      }
    }

    console.log(`Cálculo 1 - Suma simple de todos los movimientos:`);
    console.log(`  INGRESOS:  +${totalIngresos.toFixed(2)}`);
    console.log(`  EGRESOS:   -${totalEgresos.toFixed(2)}`);
    console.log(`  AJUSTES +: +${totalAjustesPos.toFixed(2)}`);
    console.log(`  AJUSTES -: -${totalAjustesNeg.toFixed(2)}`);
    console.log(`  SALDO:      ${saldoSimple.toFixed(2)}`);

    // 7.2 Saldo excluyendo reversos (transacciones netas)
    let saldoNeto = 0;
    const transaccionesProcesadas = new Set<string>();

    for (const m of analisis) {
      // Si es un reverso, marcar la transacción original como anulada
      if (m.esReverso && m.transaccionOriginalId) {
        transaccionesProcesadas.add(m.transaccionOriginalId);
        continue; // No sumar el reverso
      }
      
      // Si esta transacción fue anulada, ignorarla
      if (transaccionesProcesadas.has(m.id) || transaccionesAnuladas.has(m.id)) {
        continue;
      }

      if (m.tipo === "INGRESO") {
        saldoNeto += m.monto;
      } else if (m.tipo === "EGRESO") {
        saldoNeto -= m.monto;
      } else if (m.tipo === "AJUSTE") {
        saldoNeto += m.monto;
      }
    }

    console.log(`\nCálculo 2 - Excluyendo transacciones anuladas:`);
    console.log(`  SALDO NETO: ${saldoNeto.toFixed(2)}`);

    // 7.3 Saldo actual en base de datos
    const saldoDb = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
        },
      },
    });

    const saldoDbValor = saldoDb ? Number(saldoDb.cantidad) : 0;
    console.log(`\nCálculo 3 - Saldo actual en base de datos:`);
    console.log(`  SALDO DB:   ${saldoDbValor.toFixed(2)}`);

    // 8. Comparaciones
    console.log("\n📈 COMPARACIONES:");
    console.log("-".repeat(80));
    
    const fisicoReportado = SALDOS_FISICOS_REPORTADOS[moneda.codigo as keyof typeof SALDOS_FISICOS_REPORTADOS];
    
    console.log(`Físico reportado por operador: ${fisicoReportado.toFixed(2)}`);
    console.log(`Saldo en base de datos:        ${saldoDbValor.toFixed(2)}`);
    console.log(`Diferencia Físico vs DB:       ${(fisicoReportado - saldoDbValor).toFixed(2)}`);
    console.log(`\nSaldo calculado (movimientos): ${saldoSimple.toFixed(2)}`);
    console.log(`Diferencia Cálculo vs DB:      ${(saldoSimple - saldoDbValor).toFixed(2)}`);
    console.log(`Diferencia Cálculo vs Físico:  ${(saldoSimple - fisicoReportado).toFixed(2)}`);

    // 9. Identificar problemas específicos
    console.log("\n⚠️  PROBLEMAS DETECTADOS:");
    console.log("-".repeat(80));

    const problemas: string[] = [];

    // Verificar si hay reversos sin transacción original
    for (const [reversoId, originalId] of reversosDetectados) {
      const reverso = analisis.find(m => m.id === reversoId);
      const original = analisis.find(m => m.id === originalId);
      
      if (!original) {
        problemas.push(`Reverso ${reversoId} referencia a transacción ${originalId} que no se encontró`);
      } else {
        // Verificar si los montos coinciden
        const montoReverso = Math.abs(reverso?.monto || 0);
        const montoOriginal = Math.abs(original.monto);
        
        if (Math.abs(montoReverso - montoOriginal) > 0.01) {
          problemas.push(`Diferencia de montos: Reverso=${montoReverso.toFixed(2)}, Original=${montoOriginal.toFixed(2)}`);
        }
      }
    }

    // Verificar transacciones del 9/4/2026 con diferencias
    const transacciones9Abril = movimientosHoy.filter(m => !m.esReverso);
    const reversos9Abril = movimientosHoy.filter(m => m.esReverso);
    
    for (const original of transacciones9Abril) {
      const reverso = reversos9Abril.find(r => 
        r.descripcion.includes(original.id.substring(0, 8)) ||
        (original.transaccionOriginalId && r.descripcion.includes(original.transaccionOriginalId))
      );
      
      if (reverso) {
        const dif = Math.abs(original.monto) - Math.abs(reverso.monto);
        if (Math.abs(dif) > 0.01) {
          problemas.push(`Transacción ${original.id.substring(0, 8)}... anulada con diferencia de ${dif.toFixed(2)}`);
        }
      }
    }

    if (problemas.length === 0) {
      console.log("No se detectaron problemas obvios en los reversos");
    } else {
      for (const p of problemas) {
        console.log(`  • ${p}`);
      }
    }

    // 10. Recomendación
    console.log("\n💡 RECOMENDACIÓN:");
    console.log("-".repeat(80));
    
    const difFisicoDb = fisicoReportado - saldoDbValor;
    if (Math.abs(difFisicoDb) < 0.01) {
      console.log("✅ El saldo en DB coincide con el físico reportado");
    } else {
      console.log(`⚠️  Hay una diferencia de ${difFisicoDb.toFixed(2)} ${moneda.codigo}`);
      console.log(`   entre el saldo en DB (${saldoDbValor.toFixed(2)}) y el físico (${fisicoReportado.toFixed(2)})`);
      
      if (Math.abs(saldoSimple - fisicoReportado) < 0.01) {
        console.log(`\n   El cálculo por movimientos coincide con el físico.`);
        console.log(`   El problema está en que el saldo_almacenado en DB no se actualizó correctamente.`);
      } else {
        console.log(`\n   El cálculo por movimientos (${saldoSimple.toFixed(2)}) NO coincide con el físico.`);
        console.log(`   Hay transacciones no registradas o mal procesadas.`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("ANÁLISIS COMPLETADO");
  console.log("=".repeat(80));
  console.log("\nEste script solo mostró información. No se modificó ningún dato.");
  console.log("Para corregir los saldos, ejecuta el script de ajuste correspondiente.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
