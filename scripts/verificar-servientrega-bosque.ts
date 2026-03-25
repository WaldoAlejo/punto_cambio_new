/**
 * Script para verificar la configuración de Servientrega del punto El Bosque
 * Ejecutar: npx tsx scripts/verificar-servientrega-bosque.ts
 */
import prisma from "../server/lib/prisma.js";

async function verificarConfiguracion() {
  console.log("🔍 Verificando configuración de Servientrega...\n");

  // Buscar el punto "El Bosque" o similar
  const puntos = await prisma.puntoAtencion.findMany({
    where: {
      OR: [
        { nombre: { contains: "Bosque", mode: "insensitive" } },
        { nombre: { contains: "bosque", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      nombre: true,
      servientrega_agencia_codigo: true,
      servientrega_agencia_nombre: true,
      servientrega_alianza: true,
      servientrega_oficina_alianza: true,
    },
  });

  console.log(`📍 Puntos encontrados: ${puntos.length}\n`);

  for (const punto of puntos) {
    console.log(`📍 Punto: ${punto.nombre} (ID: ${punto.id})`);
    
    const camposRequeridos = {
      agencia_codigo: punto.servientrega_agencia_codigo,
      agencia_nombre: punto.servientrega_agencia_nombre,
      alianza: punto.servientrega_alianza,
      oficina_alianza: punto.servientrega_oficina_alianza,
    };

    const camposFaltantes = Object.entries(camposRequeridos)
      .filter(([_, valor]) => !valor)
      .map(([campo]) => campo);

    const habilitado = camposFaltantes.length === 0;

    console.log(`   ✅ Habilitado: ${habilitado}`);
    console.log(`   📋 Campos configurados:`);
    console.log(`      - Agencia código: ${punto.servientrega_agencia_codigo || "❌ NO CONFIGURADO"}`);
    console.log(`      - Agencia nombre: ${punto.servientrega_agencia_nombre || "❌ NO CONFIGURADO"}`);
    console.log(`      - Alianza: ${punto.servientrega_alianza || "❌ NO CONFIGURADO"}`);
    console.log(`      - Oficina alianza: ${punto.servientrega_oficina_alianza || "❌ NO CONFIGURADO"}`);
    
    if (camposFaltantes.length > 0) {
      console.log(`   ❌ Campos faltantes: ${camposFaltantes.join(", ")}`);
    }

    // Verificar saldo en ServientregaSaldo
    const saldoServientrega = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id: punto.id },
    });

    if (saldoServientrega) {
      console.log(`   💰 Saldo Servientrega: ${saldoServientrega.cantidad}`);
    } else {
      console.log(`   ❌ No tiene saldo en ServientregaSaldo`);
    }

    // Verificar saldo en ServicioExternoSaldo
    const saldoServicioExterno = await prisma.servicioExternoSaldo.findUnique({
      where: {
        punto_atencion_id_servicio_moneda_id: {
          punto_atencion_id: punto.id,
          servicio: "SERVIENTREGA",
          moneda_id: "bc4af218-7052-4df2-a04d-912eed63e32e", // USD
        },
      },
    });

    if (saldoServicioExterno) {
      console.log(`   💰 Saldo ServicioExterno: ${saldoServicioExterno.cantidad}`);
    } else {
      console.log(`   ❌ No tiene saldo en ServicioExternoSaldo`);
    }

    console.log("");
  }

  await prisma.$disconnect();
}

verificarConfiguracion().catch((e) => {
  console.error(e);
  process.exit(1);
});
