/**
 * Anulación guía Servientrega 1000889129
 * Motivo: ERROR DE DIRECCION DEL DESTINATARIO
 * Fecha: 26/05/2026 | Punto: MULTISERVICIOS M&M
 */

import { PrismaClient } from "@prisma/client";
import { ServientregaDBService } from "../server/services/servientregaDBService.js";
import { ServientregaAPIService } from "../server/services/servientregaAPIService.js";

const prisma = new PrismaClient();

const GUIA_NUMERO = "1000889129";
const GUIA_ID = "512ecc29-fdb3-4c8e-aece-3bc1ef3b7934";
const MOTIVO = "ERROR DE DIRECCION DEL DESTINATARIO";
const USUARIO_NOMBRE = "OSWALDO CEVALLOS (ADMIN)";

function esAnulacionExitosa(resp: unknown): boolean {
  if (typeof resp === "object" && resp !== null) {
    const r = resp as Record<string, unknown>;
    if (typeof r.proceso === "string" && /actualizad/i.test(r.proceso)) return true;
    if (r.fetch && typeof r.fetch === "object") {
      const f = r.fetch as Record<string, unknown>;
      if (typeof f.proceso === "string" && /actualizad/i.test(f.proceso)) return true;
    }
  }
  if (typeof resp === "string") {
    const match = resp.match(/\{"proceso":"([^"]+)"\}/i);
    if (match?.[1] && /actualizad/i.test(match[1])) return true;
  }
  return false;
}

async function main() {
  console.log("=".repeat(80));
  console.log("ANULACIÓN GUÍA SERVIENTREGA", GUIA_NUMERO);
  console.log("=".repeat(80));
  console.log(`Motivo: ${MOTIVO}`);

  const usuingreso = process.env.SERVIENTREGA_USER;
  const contrasenha = process.env.SERVIENTREGA_PASSWORD;
  if (!usuingreso || !contrasenha) {
    throw new Error("Faltan variables de entorno SERVIENTREGA_USER y/o SERVIENTREGA_PASSWORD");
  }

  const dbService = new ServientregaDBService();

  // 1. Verificar estado actual de la guía
  const guia = await prisma.servientregaGuia.findUnique({
    where: { numero_guia: GUIA_NUMERO },
    select: {
      id: true,
      estado: true,
      numero_guia: true,
      costo_envio: true,
      punto_atencion_id: true,
    },
  });

  if (!guia) throw new Error(`Guía ${GUIA_NUMERO} no encontrada`);
  if (guia.estado === "ANULADA") {
    console.log("⚠️  La guía ya está ANULADA. No se requiere acción.");
    return;
  }

  console.log(`Estado actual: ${guia.estado} | Costo: $${Number(guia.costo_envio).toFixed(2)}`);
  console.log(`Punto ID: ${guia.punto_atencion_id}`);

  // 2. Crear solicitud de anulación
  console.log("\n📝 Creando solicitud de anulación...");
  const solicitud = await dbService.crearSolicitudAnulacion({
    guia_id: GUIA_ID,
    numero_guia: GUIA_NUMERO,
    motivo_anulacion: MOTIVO,
    solicitado_por: "SYSTEM",
    solicitado_por_nombre: "MULTISERVICIOS M&M - Graciela Maribel Garces Lombeida",
  });
  console.log(`✅ Solicitud creada: ${solicitud.id}`);

  // 3. Llamar API Servientrega para marcar como Anulada
  console.log("\n🌐 Llamando API Servientrega...");
  const apiService = new ServientregaAPIService({ usuingreso, contrasenha });
  const respAPI = await apiService.callAPI({
    tipo: "ActualizaEstadoGuia",
    guia: GUIA_NUMERO,
    estado: "Anulada",
    usuingreso,
    contrasenha,
  });

  console.log("Respuesta API:", JSON.stringify(respAPI));

  if (!esAnulacionExitosa(respAPI)) {
    await dbService.actualizarSolicitudAnulacion(solicitud.id, {
      estado: "RECHAZADA",
      observaciones_respuesta: `Error en API Servientrega: ${JSON.stringify(respAPI)}`,
      respondido_por: "SYSTEM",
      respondido_por_nombre: USUARIO_NOMBRE,
      fecha_respuesta: new Date(),
    });
    throw new Error(`Respuesta inesperada de Servientrega: ${JSON.stringify(respAPI)}`);
  }

  console.log("✅ Anulación confirmada en Servientrega API");

  // 4. Obtener movimiento original para recuperar desglose
  const movimientoOriginal = await prisma.servicioExternoMovimiento.findFirst({
    where: {
      numero_referencia: GUIA_NUMERO,
      servicio: "SERVIENTREGA",
      tipo_movimiento: "INGRESO",
    },
    orderBy: { fecha: "desc" },
  });

  const billetes = movimientoOriginal?.billetes ? Number(movimientoOriginal.billetes) : 0;
  const monedas = movimientoOriginal?.monedas_fisicas ? Number(movimientoOriginal.monedas_fisicas) : 0;
  const bancos = movimientoOriginal?.bancos ? Number(movimientoOriginal.bancos) : 0;

  console.log(`\nDesglose original: billetes=$${billetes}, monedas=$${monedas}, bancos=$${bancos}`);

  // 5. Transacción atómica: anular guía + revertir saldo + aprobar solicitud
  console.log("\n🔒 Ejecutando transacción atómica...");

  if (!guia.punto_atencion_id) {
    throw new Error("La guía no tiene punto_atencion_id asignado");
  }

  const { resultadoReversal, solicitudActualizada } = await prisma.$transaction(async (tx) => {
    // 5a. Anular guía en BD
    await dbService.anularGuia(GUIA_NUMERO, tx);
    console.log("  ✓ Guía marcada como ANULADA");

    let resultadoReversal = null;

    // 5b. Revertir saldos (si tiene costo)
    if (guia.costo_envio && Number(guia.costo_envio) > 0) {
      resultadoReversal = await dbService.revertirIngresoServicioExterno(
        guia.punto_atencion_id!,
        Number(guia.costo_envio),
        GUIA_NUMERO,
        billetes,
        monedas,
        bancos,
        tx
      );
      console.log(`  ✓ Saldo revertido: $${Number(guia.costo_envio).toFixed(2)}`);
    }

    // 5c. Aprobar solicitud
    const solicitudActualizada = await dbService.actualizarSolicitudAnulacion(
      solicitud.id,
      {
        estado: "APROBADA",
        respondido_por: "SYSTEM",
        respondido_por_nombre: USUARIO_NOMBRE,
        observaciones_respuesta: `Procesado administrativamente. ${MOTIVO}`,
        fecha_respuesta: new Date(),
      },
      tx
    );
    console.log("  ✓ Solicitud marcada como APROBADA");

    return { resultadoReversal, solicitudActualizada };
  }, { maxWait: 10000, timeout: 15000 });

  if (resultadoReversal) {
    console.log("\nResumen de saldos:");
    console.log(`  Saldo Servientrega: $${resultadoReversal.saldoServicio.anterior.toFixed(2)} → $${resultadoReversal.saldoServicio.nuevo.toFixed(2)}`);
    console.log(`  Saldo general:      $${resultadoReversal.saldoGeneral.anterior.toFixed(2)} → $${resultadoReversal.saldoGeneral.nuevo.toFixed(2)}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log(`✅ ANULACIÓN COMPLETADA — Guía ${GUIA_NUMERO}`);
  console.log(`   Solicitud ID: ${solicitudActualizada.id}`);
  console.log("=".repeat(80));
}

main()
  .catch((e) => {
    console.error("\n❌ Error:", e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
