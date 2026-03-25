/**
 * Verificar configuración de Servientrega y saldo actual
 * Ejecutar: npx tsx scripts/verificar-configuracion-servientrega.ts
 */
import prisma from "../server/lib/prisma.js";
import { ServicioExterno } from "@prisma/client";

async function verificar() {
  console.log("🔍 Verificando configuración de Servientrega...\n");

  const PUNTO_ID = "3f13bb4e-181b-4026-b1bf-4ae00f1d1391";
  
  // Obtener configuración del punto
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

  console.log("📍 Configuración del punto:");
  console.log(`   Nombre: ${punto?.nombre}`);
  console.log(`   Agencia Código: ${punto?.servientrega_agencia_codigo}`);
  console.log(`   Agencia Nombre: ${punto?.servientrega_agencia_nombre}`);
  console.log(`   Alianza: ${punto?.servientrega_alianza}`);
  console.log(`   Oficina Alianza: ${punto?.servientrega_oficina_alianza}`);

  // Obtener saldo actual
  const usd = await prisma.moneda.findUnique({
    where: { codigo: "USD" },
    select: { id: true },
  });

  if (usd) {
    const saldo = await prisma.servicioExternoSaldo.findUnique({
      where: {
        punto_atencion_id_servicio_moneda_id: {
          punto_atencion_id: PUNTO_ID,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: usd.id,
        },
      },
    });

    if (saldo) {
      console.log("\n💰 Saldo actual:");
      console.log(`   Cantidad: $${saldo.cantidad}`);
      console.log(`   Billetes: $${saldo.billetes}`);
      console.log(`   Monedas: $${saldo.monedas_fisicas}`);
      console.log(`   Bancos: $${saldo.bancos || 0}`);
      
      const suma = Number(saldo.billetes || 0) + Number(saldo.monedas_fisicas || 0) + Number(saldo.bancos || 0);
      console.log(`   Suma (billetes + monedas + bancos): $${suma.toFixed(2)}`);
      
      if (Number(saldo.cantidad) !== suma) {
        console.log(`\n⚠️  INCONSISTENCIA: cantidad ($${saldo.cantidad}) !== suma ($${suma.toFixed(2)})`);
      }
    }
  }

  // Obtener últimas guías generadas
  const guias = await prisma.servientregaGuia.findMany({
    where: { punto_atencion_id: PUNTO_ID },
    orderBy: { created_at: "desc" },
    take: 5,
    select: {
      numero_guia: true,
      estado: true,
      costo_envio: true,
      created_at: true,
    },
  });

  console.log("\n📦 Últimas guías generadas:");
  guias.forEach(g => {
    console.log(`   - ${g.numero_guia}: ${g.estado} ($${g.costo_envio})`);
  });

  await prisma.$disconnect();
}

verificar().catch(console.error);
