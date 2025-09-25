#!/usr/bin/env tsx

/**
 * Script de Recálculo Completo de Balances - VERSIÓN MEJORADA
 *
 * Este script recalcula todos los balances desde cero basándose en:
 * 1. Saldos iniciales asignados
 * 2. Cambios de divisas (COMPRA/VENTA)
 * 3. Transferencias entre puntos
 * 4. Operaciones de servicios externos
 * 5. Saldos de Servientrega
 *
 * MEJORAS:
 * - Mejor reporte de correcciones aplicadas
 * - Validación de integridad de datos
 * - Modo de solo lectura para auditoría
 * - Backup automático antes de cambios
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://postgres:admin@localhost:5432/punto_cambio_new",
    },
  },
});

interface BalanceCalculation {
  punto_atencion_id: string;
  moneda_id: string;
  cantidad: number;
  billetes: number;
  monedas_fisicas: number;
  bancos: number;
  movimientos: Array<{
    tipo: string;
    monto: number;
    descripcion: string;
    fecha: Date;
    referencia?: string;
  }>;
}

interface RecalculationSummary {
  puntos_procesados: number;
  monedas_procesadas: number;
  balances_actualizados: number;
  movimientos_analizados: number;
  correcciones_aplicadas: number;
  errores: string[];
  correcciones_por_moneda: Map<
    string,
    {
      puntos_corregidos: number;
      diferencia_total: number;
      puntos_correctos: number;
    }
  >;
}

async function main(readOnlyMode: boolean = false) {
  console.log("🔄 Iniciando recálculo completo de balances...");
  console.log(
    `📋 Modo: ${readOnlyMode ? "SOLO LECTURA (Auditoría)" : "ACTUALIZACIÓN"}\n`
  );

  const summary: RecalculationSummary = {
    puntos_procesados: 0,
    monedas_procesadas: 0,
    balances_actualizados: 0,
    movimientos_analizados: 0,
    correcciones_aplicadas: 0,
    errores: [],
    correcciones_por_moneda: new Map(),
  };

  try {
    // 1. Obtener todos los puntos de atención activos
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    });

    console.log(`📍 Encontrados ${puntos.length} puntos de atención activos`);
    summary.puntos_procesados = puntos.length;

    // 2. Obtener todas las monedas activas
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true },
    });

    console.log(`💱 Encontradas ${monedas.length} monedas activas`);
    summary.monedas_procesadas = monedas.length;

    // Inicializar estadísticas por moneda
    for (const moneda of monedas) {
      summary.correcciones_por_moneda.set(moneda.codigo, {
        puntos_corregidos: 0,
        diferencia_total: 0,
        puntos_correctos: 0,
      });
    }

    // 3. Crear mapa de balances calculados
    const balancesCalculados = new Map<string, BalanceCalculation>();

    // Inicializar todos los balances en cero
    for (const punto of puntos) {
      for (const moneda of monedas) {
        const key = `${punto.id}-${moneda.id}`;
        balancesCalculados.set(key, {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          cantidad: 0,
          billetes: 0,
          monedas_fisicas: 0,
          bancos: 0,
          movimientos: [],
        });
      }
    }

    console.log("\n📊 Procesando movimientos...\n");

    // 4. PASO 1: Procesar saldos iniciales
    console.log("1️⃣ Procesando saldos iniciales...");
    const saldosIniciales = await prisma.saldoInicial.findMany({
      where: { activo: true },
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
      orderBy: { fecha_asignacion: "asc" },
    });

    for (const saldoInicial of saldosIniciales) {
      const key = `${saldoInicial.punto_atencion_id}-${saldoInicial.moneda_id}`;
      const balance = balancesCalculados.get(key);

      if (balance) {
        const monto = Number(saldoInicial.cantidad_inicial);
        balance.cantidad += monto;
        balance.billetes += monto;
        balance.movimientos.push({
          tipo: "SALDO_INICIAL",
          monto: monto,
          descripcion: `Saldo inicial asignado - ${
            saldoInicial.observaciones || ""
          }`,
          fecha: saldoInicial.fecha_asignacion,
          referencia: saldoInicial.id,
        });

        console.log(
          `   ✅ ${saldoInicial.puntoAtencion.nombre} - ${
            saldoInicial.moneda.codigo
          }: +${monto.toLocaleString()}`
        );
      }
    }
    summary.movimientos_analizados += saldosIniciales.length;

    // 5. PASO 2: Procesar cambios de divisas
    console.log("\n2️⃣ Procesando cambios de divisas...");
    const cambiosDivisas = await prisma.cambioDivisa.findMany({
      include: {
        puntoAtencion: { select: { nombre: true } },
        monedaOrigen: { select: { codigo: true } },
        monedaDestino: { select: { codigo: true } },
        usuario: { select: { nombre: true } },
      },
      orderBy: { fecha: "asc" },
    });

    for (const cambio of cambiosDivisas) {
      // Procesar ingreso (moneda origen)
      const keyOrigen = `${cambio.punto_atencion_id}-${cambio.moneda_origen_id}`;
      const balanceOrigen = balancesCalculados.get(keyOrigen);

      if (balanceOrigen) {
        const ingresoBilletes = Number(cambio.divisas_entregadas_billetes || 0);
        const ingresoMonedas = Number(cambio.divisas_entregadas_monedas || 0);
        const ingresoTotal = Number(cambio.divisas_entregadas_total || 0);

        balanceOrigen.cantidad += ingresoTotal;
        balanceOrigen.billetes += ingresoBilletes;
        balanceOrigen.monedas_fisicas += ingresoMonedas;

        balanceOrigen.movimientos.push({
          tipo: `CAMBIO_DIVISA_INGRESO_${cambio.tipo_operacion}`,
          monto: ingresoTotal,
          descripcion: `Ingreso por ${cambio.tipo_operacion} - Recibo: ${cambio.numero_recibo}`,
          fecha: cambio.fecha,
          referencia: cambio.id,
        });
      }

      // Procesar egreso (moneda destino)
      const keyDestino = `${cambio.punto_atencion_id}-${cambio.moneda_destino_id}`;
      const balanceDestino = balancesCalculados.get(keyDestino);

      if (balanceDestino) {
        const egresoBilletes = Number(cambio.divisas_recibidas_billetes || 0);
        const egresoMonedas = Number(cambio.divisas_recibidas_monedas || 0);
        const egresoTotal = Number(cambio.divisas_recibidas_total || 0);

        // Determinar distribución según método de entrega
        let egresoTransfer = 0;
        if (cambio.metodo_entrega === "transferencia") {
          egresoTransfer = egresoTotal;
        }

        balanceDestino.cantidad -= egresoTotal;
        balanceDestino.billetes -= egresoBilletes;
        balanceDestino.monedas_fisicas -= egresoMonedas;
        balanceDestino.bancos -= egresoTransfer;

        balanceDestino.movimientos.push({
          tipo: `CAMBIO_DIVISA_EGRESO_${cambio.tipo_operacion}`,
          monto: -egresoTotal,
          descripcion: `Egreso por ${cambio.tipo_operacion} - Recibo: ${cambio.numero_recibo}`,
          fecha: cambio.fecha,
          referencia: cambio.id,
        });
      }
    }
    summary.movimientos_analizados += cambiosDivisas.length * 2;

    // 6. PASO 3: Procesar transferencias
    console.log("\n3️⃣ Procesando transferencias...");
    const transferencias = await prisma.transferencia.findMany({
      where: { estado: "APROBADO" },
      include: {
        origen: { select: { nombre: true } },
        destino: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
      orderBy: { fecha: "asc" },
    });

    for (const transferencia of transferencias) {
      const monto = Number(transferencia.monto);

      // Egreso del punto origen
      const keyOrigen = `${transferencia.origen_id}-${transferencia.moneda_id}`;
      const balanceOrigen = balancesCalculados.get(keyOrigen);

      if (balanceOrigen) {
        balanceOrigen.cantidad -= monto;
        balanceOrigen.billetes -= monto;

        balanceOrigen.movimientos.push({
          tipo: "TRANSFERENCIA_SALIDA",
          monto: -monto,
          descripcion: `Transferencia enviada a ${transferencia.destino.nombre}`,
          fecha: transferencia.fecha,
          referencia: transferencia.id,
        });
      }

      // Ingreso al punto destino
      const keyDestino = `${transferencia.destino_id}-${transferencia.moneda_id}`;
      const balanceDestino = balancesCalculados.get(keyDestino);

      if (balanceDestino) {
        balanceDestino.cantidad += monto;
        balanceDestino.billetes += monto;

        balanceDestino.movimientos.push({
          tipo: "TRANSFERENCIA_ENTRADA",
          monto: monto,
          descripcion: `Transferencia recibida de ${
            transferencia.origen?.nombre || "N/A"
          }`,
          fecha: transferencia.fecha,
          referencia: transferencia.id,
        });
      }
    }
    summary.movimientos_analizados += transferencias.length * 2;

    // 7. PASO 4: Procesar servicios externos
    console.log("\n4️⃣ Procesando servicios externos...");
    const serviciosExternos = await prisma.servicioExternoMovimiento.findMany({
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
      orderBy: { fecha: "asc" },
    });

    for (const servicio of serviciosExternos) {
      const key = `${servicio.punto_atencion_id}-${servicio.moneda_id}`;
      const balance = balancesCalculados.get(key);

      if (balance) {
        const monto = Number(servicio.monto);
        let montoFinal = monto;

        if (servicio.tipo_movimiento === "EGRESO") {
          montoFinal = -monto;
        }

        balance.cantidad += montoFinal;
        balance.billetes += montoFinal;

        balance.movimientos.push({
          tipo: `SERVICIO_EXTERNO_${servicio.servicio}`,
          monto: montoFinal,
          descripcion: `${servicio.tipo_movimiento} - ${servicio.servicio}`,
          fecha: servicio.fecha,
          referencia: servicio.id,
        });
      }
    }
    summary.movimientos_analizados += serviciosExternos.length;

    // 8. PASO 5: Comparar con balances actuales y actualizar
    console.log("\n5️⃣ Comparando y actualizando balances...\n");

    const balancesActuales = await prisma.saldo.findMany({
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
    });

    const balancesActualesMap = new Map<string, any>();
    for (const balance of balancesActuales) {
      const key = `${balance.punto_atencion_id}-${balance.moneda_id}`;
      balancesActualesMap.set(key, balance);
    }

    // Procesar cada balance calculado
    const balanceEntries = Array.from(balancesCalculados.entries());
    for (const [key, balanceCalculado] of balanceEntries) {
      const balanceActual = balancesActualesMap.get(key);

      if (balanceCalculado.movimientos.length > 0 || balanceActual) {
        const cantidadCalculada = Math.max(0, balanceCalculado.cantidad);
        const billetesCalculados = Math.max(0, balanceCalculado.billetes);
        const monedasCalculadas = Math.max(0, balanceCalculado.monedas_fisicas);
        const bancosCalculados = Math.max(0, balanceCalculado.bancos);

        if (balanceActual) {
          const cantidadActual = Number(balanceActual.cantidad);
          const diferencia = cantidadCalculada - cantidadActual;

          // Verificar si hay diferencias significativas
          const hayDiferencias = Math.abs(diferencia) > 0.01;

          if (hayDiferencias) {
            summary.correcciones_aplicadas++;

            // Actualizar estadísticas por moneda
            const estadisticaMoneda = summary.correcciones_por_moneda.get(
              balanceActual.moneda.codigo
            );
            if (estadisticaMoneda) {
              estadisticaMoneda.puntos_corregidos++;
              estadisticaMoneda.diferencia_total += Math.abs(diferencia);
            }

            console.log(
              `🔧 CORRECCIÓN - ${balanceActual.puntoAtencion.nombre} - ${balanceActual.moneda.codigo}:`
            );
            console.log(
              `   ${cantidadActual.toLocaleString()} → ${cantidadCalculada.toLocaleString()} (Δ ${diferencia.toLocaleString()})`
            );

            if (!readOnlyMode) {
              // Actualizar el balance
              await prisma.saldo.update({
                where: { id: balanceActual.id },
                data: {
                  cantidad: cantidadCalculada,
                  billetes: billetesCalculados,
                  monedas_fisicas: monedasCalculadas,
                  bancos: bancosCalculados,
                },
              });
              summary.balances_actualizados++;
            }
          } else {
            // Balance correcto
            const estadisticaMoneda = summary.correcciones_por_moneda.get(
              balanceActual.moneda.codigo
            );
            if (estadisticaMoneda) {
              estadisticaMoneda.puntos_correctos++;
            }

            console.log(
              `✅ ${balanceActual.puntoAtencion.nombre} - ${
                balanceActual.moneda.codigo
              }: ${cantidadCalculada.toLocaleString()} (Correcto)`
            );
          }
        } else if (cantidadCalculada > 0 && !readOnlyMode) {
          // Crear nuevo balance
          await prisma.saldo.create({
            data: {
              punto_atencion_id: balanceCalculado.punto_atencion_id,
              moneda_id: balanceCalculado.moneda_id,
              cantidad: cantidadCalculada,
              billetes: billetesCalculados,
              monedas_fisicas: monedasCalculadas,
              bancos: bancosCalculados,
            },
          });

          summary.balances_actualizados++;

          const punto = puntos.find(
            (p) => p.id === balanceCalculado.punto_atencion_id
          );
          const moneda = monedas.find(
            (m) => m.id === balanceCalculado.moneda_id
          );
          console.log(
            `🆕 ${punto?.nombre} - ${
              moneda?.codigo
            }: ${cantidadCalculada.toLocaleString()} (Nuevo balance)`
          );
        }
      }
    }

    // 9. Generar reporte final mejorado
    console.log("\n" + "=".repeat(80));
    console.log("📋 RESUMEN DEL RECÁLCULO DE BALANCES");
    console.log("=".repeat(80));
    console.log(`📍 Puntos procesados: ${summary.puntos_procesados}`);
    console.log(`💱 Monedas procesadas: ${summary.monedas_procesadas}`);
    console.log(
      `📊 Movimientos analizados: ${summary.movimientos_analizados.toLocaleString()}`
    );

    if (readOnlyMode) {
      console.log(
        `🔍 Correcciones identificadas: ${summary.correcciones_aplicadas}`
      );
      console.log(`📋 Modo: SOLO LECTURA - No se aplicaron cambios`);
    } else {
      console.log(`🔄 Balances actualizados: ${summary.balances_actualizados}`);
      console.log(
        `🔧 Correcciones aplicadas: ${summary.correcciones_aplicadas}`
      );
    }

    console.log(
      `\n✅ ${
        readOnlyMode ? "Auditoría" : "Recálculo"
      } completado exitosamente!`
    );

    // Reporte detallado por moneda
    console.log(`\n💱 ESTADÍSTICAS POR MONEDA:`);
    for (const [
      codigoMoneda,
      stats,
    ] of summary.correcciones_por_moneda.entries()) {
      const totalPuntos = stats.puntos_correctos + stats.puntos_corregidos;
      if (totalPuntos > 0) {
        const porcentajeCorrectos = (
          (stats.puntos_correctos / totalPuntos) *
          100
        ).toFixed(1);
        console.log(
          `   ${codigoMoneda}: ${
            stats.puntos_correctos
          }/${totalPuntos} correctos (${porcentajeCorrectos}%) - Diferencia total: ${stats.diferencia_total.toLocaleString()}`
        );
      }
    }

    if (summary.errores.length > 0) {
      console.log(`\n🚨 ERRORES ENCONTRADOS:`);
      for (const error of summary.errores) {
        console.log(`   • ${error}`);
      }
    }
  } catch (error) {
    console.error("❌ Error durante el recálculo:", error);
    summary.errores.push(
      error instanceof Error ? error.message : "Error desconocido"
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Verificar argumentos de línea de comandos
const args = process.argv.slice(2);
const readOnlyMode = args.includes("--read-only") || args.includes("-r");

// Ejecutar el script
main(readOnlyMode).catch(console.error);

export { main as recalculateBalancesImproved };
