/**
 * Script de prueba para el flujo de rechazo/anulación de transferencias
 * 
 * Este script valida:
 * 1. Creación de transferencia EN_TRANSITO
 * 2. Verificación de débito en origen
 * 3. Rechazo por punto destino
 * 4. Verificación de devolución al origen
 * 5. Verificación de movimientos registrados
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TestResult {
  test: string;
  status: "PASS" | "FAIL";
  message: string;
}

const results: TestResult[] = [];

async function main() {
  console.log("🧪 Iniciando pruebas de flujo de rechazo de transferencias\n");

  try {
    // 1. Obtener puntos de prueba
    console.log("📍 Buscando puntos de atención...");
    const puntos = await prisma.puntoAtencion.findMany({
      take: 2,
      where: { activo: true },
    });

    if (puntos.length < 2) {
      throw new Error("Se necesitan al menos 2 puntos de atención activos");
    }

    const [puntoOrigen, puntoDestino] = puntos;
    console.log(`  ✓ Origen: ${puntoOrigen.nombre}`);
    console.log(`  ✓ Destino: ${puntoDestino.nombre}\n`);

    // 2. Obtener una moneda
    console.log("💱 Buscando moneda...");
    const moneda = await prisma.moneda.findFirst({
      where: { activo: true },
    });

    if (!moneda) {
      throw new Error("No se encontró ninguna moneda activa");
    }
    console.log(`  ✓ Moneda: ${moneda.codigo}\n`);

    // 3. Obtener usuarios de prueba
    console.log("👤 Buscando usuarios de prueba...");
    const usuarioOrigen = await prisma.usuario.findFirst({
      where: {
        punto_atencion_id: puntoOrigen.id,
        rol: "OPERADOR",
      },
    });

    const usuarioDestino = await prisma.usuario.findFirst({
      where: {
        punto_atencion_id: puntoDestino.id,
        rol: "OPERADOR",
      },
    });

    if (!usuarioOrigen || !usuarioDestino) {
      throw new Error("No se encontraron usuarios operadores en ambos puntos");
    }

    console.log(`  ✓ Usuario origen: ${usuarioOrigen.nombre}`);
    console.log(`  ✓ Usuario destino: ${usuarioDestino.nombre}\n`);

    // 4. Preparar saldos iniciales
    const montoTransferencia = 500.0;
    console.log(`💰 Asegurando saldo inicial de ${montoTransferencia} ${moneda.codigo} en punto origen...`);
    
    await prisma.saldo.upsert({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoOrigen.id,
          moneda_id: moneda.id,
        },
      },
      create: {
        punto_atencion_id: puntoOrigen.id,
        moneda_id: moneda.id,
        cantidad: 2000.0,
        billetes: 2000.0,
        monedas_fisicas: 0,
      },
      update: {
        cantidad: 2000.0,
        billetes: 2000.0,
        monedas_fisicas: 0,
      },
    });

    const saldoInicialOrigen = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoOrigen.id,
          moneda_id: moneda.id,
        },
      },
    });

    console.log(`  ✓ Saldo inicial origen: ${saldoInicialOrigen?.cantidad}\n`);

    // 5. Crear transferencia EN_TRANSITO
    console.log("📤 Creando transferencia EN_TRANSITO...");
    const transferencia = await prisma.$transaction(async (tx) => {
      // Crear transferencia
      const transfer = await tx.transferencia.create({
        data: {
          origen_id: puntoOrigen.id,
          destino_id: puntoDestino.id,
          moneda_id: moneda.id,
          monto: montoTransferencia,
          tipo_transferencia: "ENTRE_PUNTOS",
          estado: "EN_TRANSITO",
          solicitado_por: usuarioOrigen.id,
          fecha_envio: new Date(),
          descripcion: "Transferencia de prueba - flujo de rechazo",
          via: "EFECTIVO",
        },
      });

      // Debitar del origen
      await tx.saldo.update({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoOrigen.id,
            moneda_id: moneda.id,
          },
        },
        data: {
          cantidad: { decrement: montoTransferencia },
          billetes: { decrement: montoTransferencia },
        },
      });

      // Registrar movimiento de salida
      await tx.movimientoSaldo.create({
        data: {
          punto_atencion_id: puntoOrigen.id,
          moneda_id: moneda.id,
          tipo_movimiento: "TRANSFERENCIA_SALIENTE",
          monto: montoTransferencia,
          saldo_anterior: Number(saldoInicialOrigen?.cantidad || 0),
          saldo_nuevo: Number(saldoInicialOrigen?.cantidad || 0) - montoTransferencia,
          usuario_id: usuarioOrigen.id,
          referencia_id: transfer.id,
          tipo_referencia: "TRANSFERENCIA",
          descripcion: `Transferencia de salida a ${puntoDestino.nombre}`,
        },
      });

      return transfer;
    });

    console.log(`  ✓ Transferencia creada: ${transferencia.id}`);
    console.log(`  ✓ Estado: ${transferencia.estado}\n`);

    // TEST 1: Verificar débito en origen
    const saldoDespuesDebito = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoOrigen.id,
          moneda_id: moneda.id,
        },
      },
    });

    const saldoEsperadoDespuesDebito = Number(saldoInicialOrigen?.cantidad || 0) - montoTransferencia;
    
    if (Number(saldoDespuesDebito?.cantidad) === saldoEsperadoDespuesDebito) {
      results.push({
        test: "Débito en punto origen",
        status: "PASS",
        message: `Saldo correcto: ${saldoDespuesDebito?.cantidad}`,
      });
    } else {
      results.push({
        test: "Débito en punto origen",
        status: "FAIL",
        message: `Saldo esperado: ${saldoEsperadoDespuesDebito}, obtenido: ${saldoDespuesDebito?.cantidad}`,
      });
    }

    // 6. Simular rechazo por punto destino
    console.log("❌ Simulando rechazo por punto destino...");
    const observacionesRechazo = "Prueba de flujo de rechazo - efectivo no recibido";

    const transferenciaRechazada = await prisma.$transaction(async (tx) => {
      // Actualizar estado
      const updated = await tx.transferencia.update({
        where: { id: transferencia.id },
        data: {
          estado: "CANCELADO",
          fecha_rechazo: new Date(),
          observaciones_rechazo: observacionesRechazo,
        },
      });

      // Obtener saldo actual del origen
      const saldoActual = await tx.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoOrigen.id,
            moneda_id: moneda.id,
          },
        },
      });

      const saldoAnterior = Number(saldoActual?.cantidad || 0);
      const saldoNuevo = saldoAnterior + montoTransferencia;

      // Devolver dinero
      await tx.saldo.update({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoOrigen.id,
            moneda_id: moneda.id,
          },
        },
        data: {
          cantidad: { increment: montoTransferencia },
          billetes: { increment: montoTransferencia },
        },
      });

      // Registrar devolución
      await tx.movimientoSaldo.create({
        data: {
          punto_atencion_id: puntoOrigen.id,
          moneda_id: moneda.id,
          tipo_movimiento: "TRANSFERENCIA_DEVOLUCION",
          monto: montoTransferencia,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          usuario_id: usuarioDestino.id,
          referencia_id: transferencia.id,
          tipo_referencia: "TRANSFERENCIA",
          descripcion: `Devolución por transferencia rechazada - ${observacionesRechazo}`,
        },
      });

      return updated;
    });

    console.log(`  ✓ Transferencia rechazada`);
    console.log(`  ✓ Estado: ${transferenciaRechazada.estado}`);
    console.log(`  ✓ Observaciones: ${transferenciaRechazada.observaciones_rechazo}\n`);

    // TEST 2: Verificar estado CANCELADO
    if (transferenciaRechazada.estado === "CANCELADO") {
      results.push({
        test: "Estado de transferencia",
        status: "PASS",
        message: "Estado correcto: CANCELADO",
      });
    } else {
      results.push({
        test: "Estado de transferencia",
        status: "FAIL",
        message: `Estado esperado: CANCELADO, obtenido: ${transferenciaRechazada.estado}`,
      });
    }

    // TEST 3: Verificar devolución de saldo
    const saldoFinal = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoOrigen.id,
          moneda_id: moneda.id,
        },
      },
    });

    const saldoEsperadoFinal = Number(saldoInicialOrigen?.cantidad);

    if (Number(saldoFinal?.cantidad) === saldoEsperadoFinal) {
      results.push({
        test: "Devolución de saldo",
        status: "PASS",
        message: `Saldo restaurado correctamente: ${saldoFinal?.cantidad}`,
      });
    } else {
      results.push({
        test: "Devolución de saldo",
        status: "FAIL",
        message: `Saldo esperado: ${saldoEsperadoFinal}, obtenido: ${saldoFinal?.cantidad}`,
      });
    }

    // TEST 4: Verificar movimientos registrados
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        referencia_id: transferencia.id,
        tipo_referencia: "TRANSFERENCIA",
      },
      orderBy: { fecha: "asc" },
    });

    const tieneMovimientoSalida = movimientos.some(
      (m) => m.tipo_movimiento === "TRANSFERENCIA_SALIENTE"
    );
    const tieneMovimientoDevolucion = movimientos.some(
      (m) => m.tipo_movimiento === "TRANSFERENCIA_DEVOLUCION"
    );

    if (tieneMovimientoSalida && tieneMovimientoDevolucion) {
      results.push({
        test: "Registro de movimientos",
        status: "PASS",
        message: `${movimientos.length} movimientos registrados correctamente`,
      });
    } else {
      results.push({
        test: "Registro de movimientos",
        status: "FAIL",
        message: `Faltan movimientos: salida=${tieneMovimientoSalida}, devolución=${tieneMovimientoDevolucion}`,
      });
    }

    // TEST 5: Verificar que destino NO tiene movimiento entrante
    const movimientosDestino = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoDestino.id,
        referencia_id: transferencia.id,
      },
    });

    if (movimientosDestino.length === 0) {
      results.push({
        test: "Sin movimientos en destino",
        status: "PASS",
        message: "Punto destino no tiene movimientos (correcto)",
      });
    } else {
      results.push({
        test: "Sin movimientos en destino",
        status: "FAIL",
        message: `Punto destino tiene ${movimientosDestino.length} movimientos (incorrecto)`,
      });
    }

    // Mostrar resultados
    console.log("\n" + "=".repeat(60));
    console.log("📊 RESULTADOS DE PRUEBAS");
    console.log("=".repeat(60) + "\n");

    let passed = 0;
    let failed = 0;

    results.forEach((result) => {
      const icon = result.status === "PASS" ? "✅" : "❌";
      console.log(`${icon} ${result.test}`);
      console.log(`   ${result.message}\n`);

      if (result.status === "PASS") passed++;
      else failed++;
    });

    console.log("=".repeat(60));
    console.log(`Total: ${passed + failed} pruebas`);
    console.log(`✅ Pasadas: ${passed}`);
    console.log(`❌ Fallidas: ${failed}`);
    console.log("=".repeat(60) + "\n");

    if (failed === 0) {
      console.log("🎉 ¡Todas las pruebas pasaron exitosamente!");
    } else {
      console.log("⚠️  Algunas pruebas fallaron. Revisar implementación.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Error durante las pruebas:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
