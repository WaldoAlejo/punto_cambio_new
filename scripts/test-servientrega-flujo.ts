/**
 * Script de prueba integral del flujo de Servientrega
 * Valida:
 * 1. Configuración del punto
 * 2. Generación de guía
 * 3. Descuento de saldo Servientrega
 * 4. Ingreso a saldo general USD
 * 5. Anulación de guía
 * 6. Reversión de saldos
 * 7. Filtrado de guías por punto
 * 
 * Ejecutar: npx tsx scripts/test-servientrega-flujo.ts
 */
import prisma from "../server/lib/prisma.js";
import { ServientregaDBService } from "../server/services/servientregaDBService.js";
import { ServicioExterno } from "@prisma/client";

const db = new ServientregaDBService();

// Punto de prueba (EL BOSQUE)
const PUNTO_ID = "3f13bb4e-181b-4026-b1bf-4ae00f1d1391";
const USD_ID = "bc4af218-7052-4df2-a04d-912eed63e32e"; // ID de USD

interface TestResult {
  paso: string;
  exito: boolean;
  detalles: string;
  data?: any;
}

const resultados: TestResult[] = [];

function log(paso: string, exito: boolean, detalles: string, data?: any) {
  resultados.push({ paso, exito, detalles, data });
  const icono = exito ? "✅" : "❌";
  console.log(`${icono} ${paso}: ${detalles}`);
  if (data) console.log("   Data:", JSON.stringify(data, null, 2));
}

async function runTests() {
  console.log("\n🧪 INICIANDO PRUEBAS DE FLUJO SERVIENTREGA\n");
  console.log("=" .repeat(60));

  let montoPrueba = 1.00; // Valor por defecto

  // ==========================================
  // TEST 1: Verificar configuración del punto
  // ==========================================
  console.log("\n📍 TEST 1: Configuración del punto\n");
  
  const punto = await prisma.puntoAtencion.findUnique({
    where: { id: PUNTO_ID },
    select: {
      id: true,
      nombre: true,
      servientrega_agencia_codigo: true,
      servientrega_agencia_nombre: true,
      servientrega_alianza: true,
      servientrega_oficina_alianza: true,
    },
  });

  if (!punto) {
    log("Configuración del punto", false, "Punto no encontrado");
    return;
  }

  const camposRequeridos = {
    agencia_codigo: punto.servientrega_agencia_codigo,
    agencia_nombre: punto.servientrega_agencia_nombre,
    alianza: punto.servientrega_alianza,
    oficina_alianza: punto.servientrega_oficina_alianza,
  };

  const camposFaltantes = Object.entries(camposRequeridos)
    .filter(([_, valor]) => !valor)
    .map(([campo]) => campo);

  if (camposFaltantes.length === 0) {
    log("Configuración del punto", true, "Todos los campos configurados", camposRequeridos);
  } else {
    log("Configuración del punto", false, `Faltan campos: ${camposFaltantes.join(", ")}`);
  }

  // ==========================================
  // TEST 2: Verificar saldo inicial
  // ==========================================
  console.log("\n💰 TEST 2: Saldos iniciales\n");

  const saldoServientregaInicial = await prisma.servicioExternoSaldo.findUnique({
    where: {
      punto_atencion_id_servicio_moneda_id: {
        punto_atencion_id: PUNTO_ID,
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: USD_ID,
      },
    },
  });

  const saldoGeneralInicial = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: PUNTO_ID,
        moneda_id: USD_ID,
      },
    },
  });

  log("Saldo Servientrega inicial", 
    !!saldoServientregaInicial, 
    saldoServientregaInicial ? `USD ${saldoServientregaInicial.cantidad}` : "No hay saldo",
    { cantidad: saldoServientregaInicial?.cantidad }
  );

  log("Saldo General USD inicial", 
    !!saldoGeneralInicial, 
    saldoGeneralInicial ? `USD ${saldoGeneralInicial.cantidad}` : "No hay saldo",
    { cantidad: saldoGeneralInicial?.cantidad }
  );

  if (!saldoServientregaInicial || Number(saldoServientregaInicial.cantidad) < 1) {
    log("Saldo suficiente", false, "Se requiere al menos USD 1 de saldo en Servientrega");
    return;
  }

  // Usar un monto de prueba que no exceda el saldo disponible
  montoPrueba = Math.min(1.00, Number(saldoServientregaInicial.cantidad) / 2);

  // ==========================================
  // TEST 3: Simular generación de guía
  // ==========================================
  console.log("\n📦 TEST 3: Generación de guía\n");

  const numeroGuiaPrueba = `TEST${Date.now()}`;

  try {
    // 3.1 Descontar saldo de Servientrega
    const resultadoDescuento = await db.descontarSaldo(PUNTO_ID, montoPrueba, numeroGuiaPrueba);
    log("Descuento saldo Servientrega", true, `USD ${montoPrueba} descontados`, resultadoDescuento);

    // 3.2 Registrar ingreso en saldo general
    const resultadoIngreso = await db.registrarIngresoServicioExterno(
      PUNTO_ID,
      montoPrueba,
      numeroGuiaPrueba,
      montoPrueba, // billetes
      0, // monedas
      0  // bancos
    );
    log("Ingreso saldo general USD", true, `USD ${montoPrueba} ingresados`, {
      saldoServicioAnterior: resultadoIngreso.saldoServicio.anterior,
      saldoServicioNuevo: resultadoIngreso.saldoServicio.nuevo,
      saldoGeneralAnterior: resultadoIngreso.saldoGeneral.anterior,
      saldoGeneralNuevo: resultadoIngreso.saldoGeneral.nuevo,
    });

    // 3.3 Crear guía en BD
    const guiaCreada = await prisma.servientregaGuia.create({
      data: {
        numero_guia: numeroGuiaPrueba,
        punto_atencion_id: PUNTO_ID,
        usuario_id: "system",
        costo_envio: montoPrueba,
        estado: "ACTIVA",
        proceso: "Generada",
      },
    });
    log("Creación de guía en BD", true, `Guía ${numeroGuiaPrueba} creada`, { id: guiaCreada.id });

    // ==========================================
    // TEST 4: Verificar saldos después de generar
    // ==========================================
    console.log("\n💰 TEST 4: Saldos después de generar guía\n");

    const saldoServientregaPost = await prisma.servicioExternoSaldo.findUnique({
      where: {
        punto_atencion_id_servicio_moneda_id: {
          punto_atencion_id: PUNTO_ID,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: USD_ID,
        },
      },
    });

    const saldoGeneralPost = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: PUNTO_ID,
          moneda_id: USD_ID,
        },
      },
    });

    const descuentoCorrecto = 
      Number(saldoServientregaInicial.cantidad) - Number(saldoServientregaPost?.cantidad || 0) === montoPrueba;
    
    log("Descuento Servientrega correcto", 
      descuentoCorrecto, 
      descuentoCorrecto ? `Descontado: USD ${montoPrueba}` : "Monto incorrecto",
      { 
        anterior: saldoServientregaInicial.cantidad, 
        actual: saldoServientregaPost?.cantidad,
        diferencia: Number(saldoServientregaInicial.cantidad) - Number(saldoServientregaPost?.cantidad || 0)
      }
    );

    const ingresoCorrecto = 
      Number(saldoGeneralPost?.cantidad || 0) - Number(saldoGeneralInicial?.cantidad || 0) === montoPrueba;
    
    log("Ingreso a divisas correcto", 
      ingresoCorrecto, 
      ingresoCorrecto ? `Ingresado: USD ${montoPrueba}` : "Monto incorrecto",
      { 
        anterior: saldoGeneralInicial?.cantidad, 
        actual: saldoGeneralPost?.cantidad,
        diferencia: Number(saldoGeneralPost?.cantidad || 0) - Number(saldoGeneralInicial?.cantidad || 0)
      }
    );

    // ==========================================
    // TEST 5: Anulación de guía
    // ==========================================
    console.log("\n🚫 TEST 5: Anulación de guía\n");

    // 5.1 Anular guía
    await db.anularGuia(numeroGuiaPrueba);
    log("Anulación de guía", true, `Guía ${numeroGuiaPrueba} anulada`);

    // 5.2 Devolver saldo
    await db.devolverSaldo(PUNTO_ID, montoPrueba, numeroGuiaPrueba);
    log("Devolución saldo Servientrega", true, `USD ${montoPrueba} devueltos`);

    // 5.3 Revertir ingreso en saldo general
    await db.revertirIngresoServicioExterno(PUNTO_ID, montoPrueba, numeroGuiaPrueba);
    log("Reversión saldo general USD", true, `USD ${montoPrueba} revertidos`);

    // ==========================================
    // TEST 6: Verificar saldos después de anular
    // ==========================================
    console.log("\n💰 TEST 6: Saldos después de anular guía\n");

    const saldoServientregaFinal = await prisma.servicioExternoSaldo.findUnique({
      where: {
        punto_atencion_id_servicio_moneda_id: {
          punto_atencion_id: PUNTO_ID,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: USD_ID,
        },
      },
    });

    const saldoGeneralFinal = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: PUNTO_ID,
          moneda_id: USD_ID,
        },
      },
    });

    const saldoServientregaRestaurado = 
      Number(saldoServientregaFinal?.cantidad || 0) === Number(saldoServientregaInicial.cantidad);
    
    log("Saldo Servientrega restaurado", 
      saldoServientregaRestaurado, 
      saldoServientregaRestaurado ? "Restaurado correctamente" : "No coincide con el inicial",
      { 
        inicial: saldoServientregaInicial.cantidad, 
        final: saldoServientregaFinal?.cantidad 
      }
    );

    const saldoGeneralRestaurado = 
      Number(saldoGeneralFinal?.cantidad || 0) === Number(saldoGeneralInicial?.cantidad || 0);
    
    log("Saldo General restaurado", 
      saldoGeneralRestaurado, 
      saldoGeneralRestaurado ? "Restaurado correctamente" : "No coincide con el inicial",
      { 
        inicial: saldoGeneralInicial?.cantidad, 
        final: saldoGeneralFinal?.cantidad 
      }
    );

    // ==========================================
    // TEST 7: Filtrado de guías por punto
    // ==========================================
    console.log("\n🔒 TEST 7: Filtrado de guías por punto\n");

    // Obtener guías del punto de prueba
    const guiasPunto = await db.obtenerGuias(undefined, undefined, PUNTO_ID, undefined, undefined);
    
    // Verificar que todas las guías pertenecen al punto
    const todasDelPunto = guiasPunto.every(g => g.punto_atencion_id === PUNTO_ID);
    
    log("Filtrado por punto", 
      todasDelPunto, 
      todasDelPunto ? `${guiasPunto.length} guías filtradas correctamente` : "Hay guías de otros puntos",
      { totalGuias: guiasPunto.length }
    );

    // Limpiar guía de prueba
    await prisma.servientregaGuia.delete({ where: { id: guiaCreada.id } }).catch(() => {});
    log("Limpieza", true, "Guía de prueba eliminada");

  } catch (error) {
    log("Error en pruebas", false, error instanceof Error ? error.message : String(error));
  }

  // ==========================================
  // RESUMEN
  // ==========================================
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMEN DE PRUEBAS\n");
  
  const exitosos = resultados.filter(r => r.exito).length;
  const fallidos = resultados.filter(r => !r.exito).length;
  
  console.log(`✅ Exitosos: ${exitosos}`);
  console.log(`❌ Fallidos: ${fallidos}`);
  console.log(`📊 Total: ${resultados.length}`);
  
  if (fallidos === 0) {
    console.log("\n🎉 TODAS LAS PRUEBAS PASARON CORRECTAMENTE");
  } else {
    console.log("\n⚠️  ALGUNAS PRUEBAS FALLARON");
    console.log("\nDetalles de fallos:");
    resultados.filter(r => !r.exito).forEach(r => {
      console.log(`  - ${r.paso}: ${r.detalles}`);
    });
  }

  await prisma.$disconnect();
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
