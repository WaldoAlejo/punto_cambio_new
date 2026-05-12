/**
 * Script de pruebas E2E (End-to-End) para flujos críticos del sistema
 * 
 * Estrategia:
 * 1. Crear datos de prueba (punto, usuario, moneda, saldo) en BD
 * 2. Para cada flujo: ejecutar dentro de prisma.$transaction, verificar saldos,
 *    lanzar error intencional para forzar rollback
 * 3. Verificar que los saldos quedan intactos después del rollback
 * 4. Limpiar datos de prueba al final
 * 
 * Flujos probados:
 * - Cambio de divisa (crear + eliminar)
 * - Transferencia (crear + rechazar)
 * - Servicio externo (crear + eliminar)
 * 
 * NOTA: Servientrega NO se prueba porque requiere API externa.
 * 
 * Uso: npx ts-node scripts/e2e-test-suite.ts
 */

import { PrismaClient, TipoViaTransferencia } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// ==================== CONFIGURACIÓN ====================
const TEST_PREFIX = "__E2E_TEST__";
const SALDO_INICIAL_USD = 10000;

// ==================== UTILIDADES ====================
function log(section: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${section}] ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

function logError(section: string, message: string, error: unknown) {
  console.error(`[ERROR] [${section}] ${message}:`, error instanceof Error ? error.message : String(error));
}

// ==================== SETUP / TEARDOWN ====================
async function crearDatosPrueba() {
  log("SETUP", "Creando datos de prueba...");

  // 1. Crear punto de atención
  const punto = await prisma.puntoAtencion.create({
    data: {
      id: uuidv4(),
      nombre: `${TEST_PREFIX} Punto Prueba ${Date.now()}`,
      ciudad: "Guayaquil",
      direccion: "Dirección de prueba",
      provincia: "Guayas",
      activo: true,
    },
  });
  log("SETUP", `Punto creado: ${punto.id}`);

  // 2. Crear usuario de prueba (OPERADOR)
  const usuario = await prisma.usuario.create({
    data: {
      id: uuidv4(),
      username: `${TEST_PREFIX}_user_${Date.now()}`,
      password: "test_password_hash",
      rol: "OPERADOR",
      nombre: "Usuario Prueba E2E",
      activo: true,
      punto_atencion_id: punto.id,
    },
  });
  log("SETUP", `Usuario creado: ${usuario.id}`);

  // 3. Obtener o crear moneda USD
  let usd = await prisma.moneda.findUnique({ where: { codigo: "USD" } });
  if (!usd) {
    usd = await prisma.moneda.create({
      data: {
        id: uuidv4(),
        codigo: "USD",
        nombre: "Dólar estadounidense",
        simbolo: "$",
        activo: true,
        orden_display: 0,
        comportamiento_compra: "MULTIPLICA",
        comportamiento_venta: "DIVIDE",
      },
    });
    log("SETUP", `Moneda USD creada: ${usd.id}`);
  } else {
    log("SETUP", `Moneda USD existente: ${usd.id}`);
  }

  // 4. Crear saldo inicial
  const saldo = await prisma.saldo.create({
    data: {
      id: uuidv4(),
      punto_atencion_id: punto.id,
      moneda_id: usd.id,
      cantidad: SALDO_INICIAL_USD,
      billetes: SALDO_INICIAL_USD,
      monedas_fisicas: 0,
      bancos: 0,
    },
  });
  log("SETUP", `Saldo creado: ${saldo.cantidad} USD`);

  // 5. Crear servicio externo saldo (para servicios con asignación)
  const servicioSaldo = await prisma.servicioExternoSaldo.create({
    data: {
      id: uuidv4(),
      punto_atencion_id: punto.id,
      servicio: "YAGANASTE",
      moneda_id: usd.id,
      cantidad: 5000,
      billetes: 5000,
      monedas_fisicas: 0,
      bancos: 0,
    },
  });
  log("SETUP", `ServicioExternoSaldo creado: ${servicioSaldo.cantidad} USD`);

  return { punto, usuario, usd, saldo };
}

async function limpiarDatosPrueba() {
  log("TEARDOWN", "Limpiando datos de prueba...");

  // Eliminar en orden inverso para evitar violaciones de FK
  await prisma.servicioExternoMovimiento.deleteMany({
    where: { descripcion: { contains: TEST_PREFIX } },
  });
  await prisma.movimientoSaldo.deleteMany({
    where: { descripcion: { contains: TEST_PREFIX } },
  });
  await prisma.recibo.deleteMany({
    where: { numero_recibo: { contains: TEST_PREFIX } },
  });
  await prisma.cambioDivisa.deleteMany({
    where: { numero_recibo: { contains: TEST_PREFIX } },
  });
  await prisma.transferencia.deleteMany({
    where: { descripcion: { contains: TEST_PREFIX } },
  });
  await prisma.saldo.deleteMany({
    where: { puntoAtencion: { nombre: { contains: TEST_PREFIX } } },
  });
  await prisma.servicioExternoSaldo.deleteMany({
    where: { puntoAtencion: { nombre: { contains: TEST_PREFIX } } },
  });
  await prisma.usuario.deleteMany({
    where: { nombre: { contains: "Prueba E2E" } },
  });
  await prisma.puntoAtencion.deleteMany({
    where: { nombre: { contains: TEST_PREFIX } },
  });

  log("TEARDOWN", "Datos de prueba eliminados");
}

// ==================== TESTS ====================

async function testCambioDivisa({ punto, usuario, usd }: { punto: any; usuario: any; usd: any }) {
  log("TEST-EXCHANGE", "=== PRUEBA: Crear y Eliminar Cambio de Divisa ===");

  const saldoAntes = await prisma.saldo.findUnique({
    where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
  });
  log("TEST-EXCHANGE", `Saldo antes: ${saldoAntes?.cantidad}`);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Crear cambio de divisa (COMPRA USD con efectivo)
      const cambio = await tx.cambioDivisa.create({
        data: {
          id: uuidv4(),
          punto_atencion_id: punto.id,
          usuario_id: usuario.id,
          moneda_origen_id: usd.id,
          moneda_destino_id: usd.id,
          monto_origen: 100,
          monto_destino: 100,
          tasa_cambio_billetes: 1,
          tasa_cambio_monedas: 1,
          tipo_operacion: "COMPRA",
          estado: "COMPLETADO",
          metodo_pago_origen: TipoViaTransferencia.EFECTIVO,
          metodo_entrega: TipoViaTransferencia.EFECTIVO,
          divisas_entregadas_billetes: 100,
          divisas_entregadas_monedas: 0,
          divisas_entregadas_total: 100,
          divisas_recibidas_billetes: 100,
          divisas_recibidas_monedas: 0,
          divisas_recibidas_total: 100,
          usd_recibido_efectivo: 100,
          usd_recibido_transfer: 0,
          usd_entregado_efectivo: 100,
          usd_entregado_transfer: 0,
          numero_recibo: `${TEST_PREFIX}_EXC_${Date.now()}`,
        },
      });
      log("TEST-EXCHANGE", `Cambio creado: ${cambio.id}`);

      // 2. Simular actualización de saldos (como hace el backend)
      await tx.saldo.update({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
        data: {
          cantidad: { increment: 100 }, // Ingreso origen
          billetes: { increment: 100 },
        },
      });
      await tx.saldo.update({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
        data: {
          cantidad: { decrement: 100 }, // Egreso destino
          billetes: { decrement: 100 },
        },
      });

      // 3. Verificar saldo DENTRO de la transacción
      const saldoDurante = await tx.saldo.findUnique({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
      });
      log("TEST-EXCHANGE", `Saldo durante transacción: ${saldoDurante?.cantidad}`);

      if (Number(saldoDurante?.cantidad) !== Number(saldoAntes?.cantidad)) {
        throw new Error(`INCONSISTENCIA: El saldo debería ser ${saldoAntes?.cantidad} pero es ${saldoDurante?.cantidad}`);
      }

      // 4. Forzar rollback
      throw new Error("INTENTIONAL_ROLLBACK");
    });
  } catch (error: any) {
    if (error.message === "INTENTIONAL_ROLLBACK") {
      log("TEST-EXCHANGE", "Rollback intencional ejecutado ✅");
    } else {
      throw error;
    }
  }

  // 5. Verificar saldo DESPUÉS del rollback
  const saldoDespues = await prisma.saldo.findUnique({
    where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
  });
  log("TEST-EXCHANGE", `Saldo después del rollback: ${saldoDespues?.cantidad}`);

  if (Number(saldoDespues?.cantidad) !== Number(saldoAntes?.cantidad)) {
    throw new Error(`❌ INCONSISTENCIA POST-ROLLBACK: Esperado ${saldoAntes?.cantidad}, obtenido ${saldoDespues?.cantidad}`);
  }

  log("TEST-EXCHANGE", "✅ TEST PASADO: Cambio de divisa consistente con rollback");
}

async function testTransferencia({ punto, usuario, usd }: { punto: any; usuario: any; usd: any }) {
  log("TEST-TRANSFER", "=== PRUEBA: Crear y Rechazar Transferencia ===");

  // Crear punto destino
  const puntoDestino = await prisma.puntoAtencion.create({
    data: {
      id: uuidv4(),
      nombre: `${TEST_PREFIX} Punto Destino ${Date.now()}`,
      ciudad: "Guayaquil",
      direccion: "Dirección destino",
      provincia: "Guayas",
      activo: true,
    },
  });

  const saldoAntes = await prisma.saldo.findUnique({
    where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
  });
  log("TEST-TRANSFER", `Saldo origen antes: ${saldoAntes?.cantidad}`);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Crear transferencia
      const transfer = await tx.transferencia.create({
        data: {
          id: uuidv4(),
          origen_id: punto.id,
          destino_id: puntoDestino.id,
          moneda_id: usd.id,
          monto: 500,
          tipo_transferencia: "PUNTO_A_PUNTO",
          estado: "EN_TRANSITO",
          via: TipoViaTransferencia.EFECTIVO,
          solicitado_por: usuario.id,
          descripcion: `${TEST_PREFIX} Transferencia de prueba`,
        },
      });
      log("TEST-TRANSFER", `Transferencia creada: ${transfer.id}`);

      // 2. Descontar del origen
      await tx.saldo.update({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
        data: {
          cantidad: { decrement: 500 },
          billetes: { decrement: 500 },
        },
      });

      // 3. Rechazar transferencia (devolver al origen)
      await tx.transferencia.update({
        where: { id: transfer.id },
        data: { estado: "CANCELADO" },
      });
      await tx.saldo.update({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
        data: {
          cantidad: { increment: 500 },
          billetes: { increment: 500 },
        },
      });

      // 4. Verificar saldo
      const saldoDurante = await tx.saldo.findUnique({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
      });
      log("TEST-TRANSFER", `Saldo durante transacción: ${saldoDurante?.cantidad}`);

      if (Number(saldoDurante?.cantidad) !== Number(saldoAntes?.cantidad)) {
        throw new Error(`INCONSISTENCIA: Esperado ${saldoAntes?.cantidad}, obtenido ${saldoDurante?.cantidad}`);
      }

      throw new Error("INTENTIONAL_ROLLBACK");
    });
  } catch (error: any) {
    if (error.message === "INTENTIONAL_ROLLBACK") {
      log("TEST-TRANSFER", "Rollback intencional ejecutado ✅");
    } else {
      throw error;
    }
  }

  const saldoDespues = await prisma.saldo.findUnique({
    where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
  });
  log("TEST-TRANSFER", `Saldo después del rollback: ${saldoDespues?.cantidad}`);

  if (Number(saldoDespues?.cantidad) !== Number(saldoAntes?.cantidad)) {
    throw new Error(`❌ INCONSISTENCIA POST-ROLLBACK: Esperado ${saldoAntes?.cantidad}, obtenido ${saldoDespues?.cantidad}`);
  }

  // Limpiar punto destino
  await prisma.puntoAtencion.delete({ where: { id: puntoDestino.id } });

  log("TEST-TRANSFER", "✅ TEST PASADO: Transferencia consistente con rollback");
}

async function testServicioExterno({ punto, usuario, usd }: { punto: any; usuario: any; usd: any }) {
  log("TEST-SERV-EXT", "=== PRUEBA: Crear y Eliminar Servicio Externo ===");

  const saldoGeneralAntes = await prisma.saldo.findUnique({
    where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
  });
  const saldoDigitalAntes = await prisma.servicioExternoSaldo.findUnique({
    where: {
      punto_atencion_id_servicio_moneda_id: {
        punto_atencion_id: punto.id,
        servicio: "YAGANASTE",
        moneda_id: usd.id,
      },
    },
  });
  log("TEST-SERV-EXT", `Saldo general antes: ${saldoGeneralAntes?.cantidad}, Saldo digital antes: ${saldoDigitalAntes?.cantidad}`);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Crear movimiento de servicio externo (INGRESO)
      const mov = await tx.servicioExternoMovimiento.create({
        data: {
          id: uuidv4(),
          punto_atencion_id: punto.id,
          servicio: "YAGANASTE",
          tipo_movimiento: "INGRESO",
          moneda_id: usd.id,
          monto: 200,
          billetes: 200,
          monedas_fisicas: 0,
          bancos: 0,
          metodo_ingreso: TipoViaTransferencia.EFECTIVO,
          descripcion: `${TEST_PREFIX} Movimiento de prueba`,
          usuario_id: usuario.id,
        },
      });
      log("TEST-SERV-EXT", `Movimiento creado: ${mov.id}`);

      // 2. Actualizar saldo digital (restar por INGRESO)
      await tx.servicioExternoSaldo.update({
        where: {
          punto_atencion_id_servicio_moneda_id: {
            punto_atencion_id: punto.id,
            servicio: "YAGANASTE",
            moneda_id: usd.id,
          },
        },
        data: {
          cantidad: { decrement: 200 },
          billetes: { decrement: 200 },
        },
      });

      // 3. Actualizar saldo general (sumar por INGRESO)
      await tx.saldo.update({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
        data: {
          cantidad: { increment: 200 },
          billetes: { increment: 200 },
        },
      });

      // 4. Revertir (como hace DELETE /movimientos/:id)
      await tx.servicioExternoSaldo.update({
        where: {
          punto_atencion_id_servicio_moneda_id: {
            punto_atencion_id: punto.id,
            servicio: "YAGANASTE",
            moneda_id: usd.id,
          },
        },
        data: {
          cantidad: { increment: 200 },
          billetes: { increment: 200 },
        },
      });
      await tx.saldo.update({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
        data: {
          cantidad: { decrement: 200 },
          billetes: { decrement: 200 },
        },
      });
      await tx.servicioExternoMovimiento.delete({ where: { id: mov.id } });

      // 5. Verificar saldos
      const saldoGeneralDurante = await tx.saldo.findUnique({
        where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
      });
      const saldoDigitalDurante = await tx.servicioExternoSaldo.findUnique({
        where: {
          punto_atencion_id_servicio_moneda_id: {
            punto_atencion_id: punto.id,
            servicio: "YAGANASTE",
            moneda_id: usd.id,
          },
        },
      });

      if (Number(saldoGeneralDurante?.cantidad) !== Number(saldoGeneralAntes?.cantidad)) {
        throw new Error(`INCONSISTENCIA SALDO GENERAL: Esperado ${saldoGeneralAntes?.cantidad}, obtenido ${saldoGeneralDurante?.cantidad}`);
      }
      if (Number(saldoDigitalDurante?.cantidad) !== Number(saldoDigitalAntes?.cantidad)) {
        throw new Error(`INCONSISTENCIA SALDO DIGITAL: Esperado ${saldoDigitalAntes?.cantidad}, obtenido ${saldoDigitalDurante?.cantidad}`);
      }

      throw new Error("INTENTIONAL_ROLLBACK");
    });
  } catch (error: any) {
    if (error.message === "INTENTIONAL_ROLLBACK") {
      log("TEST-SERV-EXT", "Rollback intencional ejecutado ✅");
    } else {
      throw error;
    }
  }

  const saldoGeneralDespues = await prisma.saldo.findUnique({
    where: { punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: usd.id } },
  });
  const saldoDigitalDespues = await prisma.servicioExternoSaldo.findUnique({
    where: {
      punto_atencion_id_servicio_moneda_id: {
        punto_atencion_id: punto.id,
        servicio: "YAGANASTE",
        moneda_id: usd.id,
      },
    },
  });

  if (Number(saldoGeneralDespues?.cantidad) !== Number(saldoGeneralAntes?.cantidad)) {
    throw new Error(`❌ INCONSISTENCIA POST-ROLLBACK GENERAL: Esperado ${saldoGeneralAntes?.cantidad}, obtenido ${saldoGeneralDespues?.cantidad}`);
  }
  if (Number(saldoDigitalDespues?.cantidad) !== Number(saldoDigitalAntes?.cantidad)) {
    throw new Error(`❌ INCONSISTENCIA POST-ROLLBACK DIGITAL: Esperado ${saldoDigitalAntes?.cantidad}, obtenido ${saldoDigitalDespues?.cantidad}`);
  }

  log("TEST-SERV-EXT", "✅ TEST PASADO: Servicio externo consistente con rollback");
}

// ==================== MAIN ====================
async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("  SUITE DE PRUEBAS E2E - PUNTO CAMBIO");
  console.log("  Estrategia: Transacción + Rollback Intencional");
  console.log("=".repeat(80) + "\n");

  let datos: any = null;
  let passed = 0;
  let failed = 0;

  try {
    // 1. Setup
    datos = await crearDatosPrueba();

    // 2. Tests
    try {
      await testCambioDivisa(datos);
      passed++;
    } catch (e) {
      logError("TEST-EXCHANGE", "TEST FALLIDO", e);
      failed++;
    }

    try {
      await testTransferencia(datos);
      passed++;
    } catch (e) {
      logError("TEST-TRANSFER", "TEST FALLIDO", e);
      failed++;
    }

    try {
      await testServicioExterno(datos);
      passed++;
    } catch (e) {
      logError("TEST-SERV-EXT", "TEST FALLIDO", e);
      failed++;
    }

  } catch (e) {
    logError("MAIN", "Error general en suite de pruebas", e);
  } finally {
    // 3. Teardown
    if (datos) {
      await limpiarDatosPrueba();
    }
    await prisma.$disconnect();
  }

  console.log("\n" + "=".repeat(80));
  console.log(`  RESULTADOS: ${passed} PASADOS | ${failed} FALLIDOS`);
  console.log("=".repeat(80) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
