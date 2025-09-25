#!/usr/bin/env tsx

/**
 * Script de Recálculo Completo de Balances
 *
 * Este script recalcula todos los balances desde cero basándose en:
 * 1. Saldos iniciales asignados
 * 2. Cambios de divisas (COMPRA/VENTA)
 * 3. Transferencias entre puntos
 * 4. Operaciones de servicios externos
 * 5. Saldos de Servientrega
 *
 * IMPORTANTE: Este script corrige las inconsistencias causadas por el bug
 * en el cálculo de egresos para monedas no-USD en cambios de divisas.
 */

import { PrismaClient } from "@prisma/client";

// Configurar Prisma para usar la base de datos correcta
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
  inconsistencias_encontradas: number;
  errores: string[];
}

async function main() {
  console.log("🔄 Iniciando recálculo completo de balances...\n");

  const summary: RecalculationSummary = {
    puntos_procesados: 0,
    monedas_procesadas: 0,
    balances_actualizados: 0,
    movimientos_analizados: 0,
    inconsistencias_encontradas: 0,
    errores: [],
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
        balance.billetes += monto; // Asumimos que los saldos iniciales son en efectivo
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
      // Procesar ingreso (moneda origen - lo que recibimos del cliente)
      const keyOrigen = `${cambio.punto_atencion_id}-${cambio.moneda_origen_id}`;
      const balanceOrigen = balancesCalculados.get(keyOrigen);

      if (balanceOrigen) {
        // Usar divisas_entregadas (lo que el cliente nos entregó)
        const ingresoBilletes = Number(cambio.divisas_entregadas_billetes || 0);
        const ingresoMonedas = Number(cambio.divisas_entregadas_monedas || 0);
        const ingresoTotal = Number(cambio.divisas_entregadas_total || 0);

        balanceOrigen.cantidad += ingresoTotal;
        balanceOrigen.billetes += ingresoBilletes;
        balanceOrigen.monedas_fisicas += ingresoMonedas;

        balanceOrigen.movimientos.push({
          tipo: `CAMBIO_DIVISA_INGRESO_${cambio.tipo_operacion}`,
          monto: ingresoTotal,
          descripcion: `Ingreso por ${cambio.tipo_operacion} - Recibo: ${cambio.numero_recibo} (Billetes: ${ingresoBilletes}, Monedas: ${ingresoMonedas})`,
          fecha: cambio.fecha,
          referencia: cambio.id,
        });

        console.log(
          `   📈 ${cambio.puntoAtencion.nombre} - ${
            cambio.monedaOrigen.codigo
          }: +${ingresoTotal.toLocaleString()} (${cambio.numero_recibo})`
        );
      }

      // Procesar egreso (moneda destino - lo que entregamos al cliente)
      const keyDestino = `${cambio.punto_atencion_id}-${cambio.moneda_destino_id}`;
      const balanceDestino = balancesCalculados.get(keyDestino);

      if (balanceDestino) {
        // Usar divisas_recibidas (lo que nosotros entregamos al cliente)
        const egresoBilletes = Number(cambio.divisas_recibidas_billetes || 0);
        const egresoMonedas = Number(cambio.divisas_recibidas_monedas || 0);
        const egresoTotal = Number(cambio.divisas_recibidas_total || 0);

        // Determinar distribución según método de entrega
        let egresoEfectivo = 0;
        let egresoTransfer = 0;

        if (cambio.metodo_entrega === "efectivo") {
          egresoEfectivo = egresoTotal;
        } else if (cambio.metodo_entrega === "transferencia") {
          egresoTransfer = egresoTotal;
        } else {
          // Para otros métodos, asumir efectivo por defecto
          egresoEfectivo = egresoTotal;
        }

        balanceDestino.cantidad -= egresoTotal;
        balanceDestino.billetes -= egresoBilletes;
        balanceDestino.monedas_fisicas -= egresoMonedas;
        balanceDestino.bancos -= egresoTransfer;

        balanceDestino.movimientos.push({
          tipo: `CAMBIO_DIVISA_EGRESO_${cambio.tipo_operacion}`,
          monto: -egresoTotal,
          descripcion: `Egreso por ${cambio.tipo_operacion} - Recibo: ${cambio.numero_recibo} (Billetes: ${egresoBilletes}, Monedas: ${egresoMonedas}, Método: ${cambio.metodo_entrega})`,
          fecha: cambio.fecha,
          referencia: cambio.id,
        });

        console.log(
          `   📉 ${cambio.puntoAtencion.nombre} - ${
            cambio.monedaDestino.codigo
          }: -${egresoTotal.toLocaleString()} (${cambio.numero_recibo})`
        );
      }
    }
    summary.movimientos_analizados += cambiosDivisas.length * 2; // Ingreso + Egreso

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
        balanceOrigen.billetes -= monto; // Asumimos transferencias en efectivo

        balanceOrigen.movimientos.push({
          tipo: "TRANSFERENCIA_SALIDA",
          monto: -monto,
          descripcion: `Transferencia enviada a ${
            transferencia.destino.nombre
          } - ${transferencia.descripcion || ""}`,
          fecha: transferencia.fecha,
          referencia: transferencia.id,
        });

        console.log(
          `   📤 ${transferencia.origen?.nombre || "N/A"} - ${
            transferencia.moneda.codigo
          }: -${monto.toLocaleString()}`
        );
      }

      // Ingreso al punto destino
      const keyDestino = `${transferencia.destino_id}-${transferencia.moneda_id}`;
      const balanceDestino = balancesCalculados.get(keyDestino);

      if (balanceDestino) {
        balanceDestino.cantidad += monto;
        balanceDestino.billetes += monto; // Asumimos transferencias en efectivo

        balanceDestino.movimientos.push({
          tipo: "TRANSFERENCIA_ENTRADA",
          monto: monto,
          descripcion: `Transferencia recibida de ${
            transferencia.origen?.nombre || "N/A"
          } - ${transferencia.descripcion || ""}`,
          fecha: transferencia.fecha,
          referencia: transferencia.id,
        });

        console.log(
          `   📥 ${transferencia.destino.nombre} - ${
            transferencia.moneda.codigo
          }: +${monto.toLocaleString()}`
        );
      }
    }
    summary.movimientos_analizados += transferencias.length * 2; // Salida + Entrada

    // 7. PASO 4: Procesar operaciones de servicios externos
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

        // Determinar si es ingreso o egreso basado en tipo_movimiento
        if (servicio.tipo_movimiento === "EGRESO") {
          montoFinal = -monto;
        }

        balance.cantidad += montoFinal;
        balance.billetes += montoFinal; // Asumimos que se maneja en efectivo

        balance.movimientos.push({
          tipo: `SERVICIO_EXTERNO_${servicio.servicio}`,
          monto: montoFinal,
          descripcion: `${servicio.tipo_movimiento} - ${servicio.servicio} - ${
            servicio.descripcion || ""
          }`,
          fecha: servicio.fecha,
          referencia: servicio.id,
        });

        const signo = montoFinal > 0 ? "+" : "";
        console.log(
          `   💼 ${servicio.puntoAtencion.nombre} - ${
            servicio.moneda.codigo
          }: ${signo}${montoFinal.toLocaleString()} (${servicio.servicio} - ${
            servicio.tipo_movimiento
          })`
        );
      }
    }
    summary.movimientos_analizados += serviciosExternos.length;

    // 8. PASO 5: Procesar saldos de Servientrega
    console.log("\n5️⃣ Procesando saldos de Servientrega...");
    const saldosServientrega = await prisma.servientregaSaldo.findMany({
      include: {
        punto_atencion: { select: { nombre: true } },
      },
    });

    // Para Servientrega, asumimos que es en COP (pesos colombianos)
    const monedaCOP = monedas.find((m) => m.codigo === "COP");

    if (monedaCOP) {
      for (const saldoServientrega of saldosServientrega) {
        const key = `${saldoServientrega.punto_atencion_id}-${monedaCOP.id}`;
        const balance = balancesCalculados.get(key);

        if (balance) {
          const montoTotal = Number(saldoServientrega.monto_total);
          const montoUsado = Number(saldoServientrega.monto_usado);
          const montoDisponible = montoTotal - montoUsado;

          // Agregar el saldo disponible de Servientrega como un activo separado
          // (no afecta el balance principal, pero se registra para auditoría)
          balance.movimientos.push({
            tipo: "SERVIENTREGA_SALDO",
            monto: montoDisponible,
            descripcion: `Saldo Servientrega disponible (Total: ${montoTotal.toLocaleString()}, Usado: ${montoUsado.toLocaleString()})`,
            fecha: saldoServientrega.created_at,
            referencia: saldoServientrega.id,
          });

          console.log(
            `   📦 ${
              saldoServientrega.punto_atencion.nombre
            } - Servientrega: ${montoDisponible.toLocaleString()} COP disponible`
          );
        }
      }
    }

    // 9. PASO 6: Comparar con balances actuales y actualizar
    console.log("\n6️⃣ Comparando y actualizando balances...\n");

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

      // Solo procesar si hay movimientos o si existe un balance actual
      if (balanceCalculado.movimientos.length > 0 || balanceActual) {
        const cantidadCalculada = Math.max(0, balanceCalculado.cantidad);
        const billetesCalculados = Math.max(0, balanceCalculado.billetes);
        const monedasCalculadas = Math.max(0, balanceCalculado.monedas_fisicas);
        const bancosCalculados = Math.max(0, balanceCalculado.bancos);

        if (balanceActual) {
          const cantidadActual = Number(balanceActual.cantidad);
          const billetesActuales = Number(balanceActual.billetes);
          const monedasActuales = Number(balanceActual.monedas_fisicas);
          const bancosActuales = Number(balanceActual.bancos);

          // Verificar si hay diferencias
          const diferenciaCantidad = Math.abs(
            cantidadCalculada - cantidadActual
          );
          const diferenciaBilletes = Math.abs(
            billetesCalculados - billetesActuales
          );
          const diferenciaMonedas = Math.abs(
            monedasCalculadas - monedasActuales
          );
          const diferenciaBancos = Math.abs(bancosCalculados - bancosActuales);

          const hayDiferencias =
            diferenciaCantidad > 0.01 ||
            diferenciaBilletes > 0.01 ||
            diferenciaMonedas > 0.01 ||
            diferenciaBancos > 0.01;

          if (hayDiferencias) {
            summary.inconsistencias_encontradas++;

            console.log(
              `❌ INCONSISTENCIA - ${balanceActual.puntoAtencion.nombre} - ${balanceActual.moneda.codigo}:`
            );
            console.log(
              `   Cantidad: ${cantidadActual.toLocaleString()} → ${cantidadCalculada.toLocaleString()} (Δ ${(
                cantidadCalculada - cantidadActual
              ).toLocaleString()})`
            );
            console.log(
              `   Billetes: ${billetesActuales.toLocaleString()} → ${billetesCalculados.toLocaleString()} (Δ ${(
                billetesCalculados - billetesActuales
              ).toLocaleString()})`
            );
            console.log(
              `   Monedas:  ${monedasActuales.toLocaleString()} → ${monedasCalculadas.toLocaleString()} (Δ ${(
                monedasCalculadas - monedasActuales
              ).toLocaleString()})`
            );
            console.log(
              `   Bancos:   ${bancosActuales.toLocaleString()} → ${bancosCalculados.toLocaleString()} (Δ ${(
                bancosCalculados - bancosActuales
              ).toLocaleString()})`
            );

            // Mostrar últimos movimientos para contexto
            console.log(`   Últimos movimientos:`);
            const ultimosMovimientos = balanceCalculado.movimientos.slice(-3);
            for (const mov of ultimosMovimientos) {
              console.log(
                `     • ${mov.fecha.toISOString().split("T")[0]} - ${
                  mov.tipo
                }: ${mov.monto.toLocaleString()} - ${mov.descripcion}`
              );
            }
            console.log("");
          }

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

          if (!hayDiferencias) {
            console.log(
              `✅ ${balanceActual.puntoAtencion.nombre} - ${
                balanceActual.moneda.codigo
              }: ${cantidadCalculada.toLocaleString()} (Sin cambios)`
            );
          }
        } else if (cantidadCalculada > 0) {
          // Crear nuevo balance si no existe y tiene cantidad positiva
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

    // 10. Generar reporte final
    console.log("\n" + "=".repeat(80));
    console.log("📋 RESUMEN DEL RECÁLCULO DE BALANCES");
    console.log("=".repeat(80));
    console.log(`📍 Puntos procesados: ${summary.puntos_procesados}`);
    console.log(`💱 Monedas procesadas: ${summary.monedas_procesadas}`);
    console.log(
      `📊 Movimientos analizados: ${summary.movimientos_analizados.toLocaleString()}`
    );
    console.log(`🔄 Balances actualizados: ${summary.balances_actualizados}`);
    console.log(
      `❌ Inconsistencias encontradas: ${summary.inconsistencias_encontradas}`
    );

    if (summary.errores.length > 0) {
      console.log(`\n🚨 ERRORES ENCONTRADOS:`);
      for (const error of summary.errores) {
        console.log(`   • ${error}`);
      }
    }

    console.log("\n✅ Recálculo completado exitosamente!");

    if (summary.inconsistencias_encontradas > 0) {
      console.log(
        `\n⚠️  Se encontraron ${summary.inconsistencias_encontradas} inconsistencias que fueron corregidas.`
      );
      console.log(
        "   Revisa los detalles arriba para entender los ajustes realizados."
      );
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

// Ejecutar el script
main().catch(console.error);

export { main as recalculateBalances };
