#!/usr/bin/env tsx

/**
 * Script para verificar la configuración de Servientrega de un punto específico
 * Verifica tanto la configuración del punto como el saldo asignado
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verificarConfiguracionServientrega(nombrePunto: string) {
  try {
    console.log(
      `🔍 Verificando configuración de Servientrega para el punto: ${nombrePunto}`
    );
    console.log("=".repeat(80));

    // 1. Buscar el punto de atención
    const punto = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          equals: nombrePunto,
          mode: "insensitive",
        },
      },
      include: {
        saldosServientrega: true,
        usuarios: {
          where: {
            activo: true,
          },
          select: {
            id: true,
            nombre: true,
            rol: true,
          },
        },
      },
    });

    if (!punto) {
      console.log(`❌ No se encontró el punto de atención: ${nombrePunto}`);
      return;
    }

    console.log(`✅ Punto encontrado: ${punto.nombre}`);
    console.log(`📍 ID: ${punto.id}`);
    console.log(`🏢 Dirección: ${punto.direccion}, ${punto.ciudad}`);
    console.log(`📞 Teléfono: ${punto.telefono || "No configurado"}`);
    console.log(`🔄 Activo: ${punto.activo ? "Sí" : "No"}`);
    console.log();

    // 2. Verificar configuración de Servientrega
    console.log("📦 CONFIGURACIÓN SERVIENTREGA:");
    console.log("-".repeat(40));

    const tieneAgenciaCodigo = !!punto.servientrega_agencia_codigo;
    const tieneAgenciaNombre = !!punto.servientrega_agencia_nombre;

    console.log(
      `🏪 Código de Agencia: ${
        punto.servientrega_agencia_codigo || "❌ NO CONFIGURADO"
      }`
    );
    console.log(
      `🏪 Nombre de Agencia: ${
        punto.servientrega_agencia_nombre || "❌ NO CONFIGURADO"
      }`
    );

    if (!tieneAgenciaCodigo) {
      console.log(
        `⚠️  PROBLEMA IDENTIFICADO: El punto no tiene código de agencia Servientrega configurado`
      );
      console.log(
        `   Esto impide que aparezca la opción "Guías Servientrega" en el menú del operador`
      );
    }
    console.log();

    // 3. Verificar saldo de Servientrega
    console.log("💰 SALDO SERVIENTREGA:");
    console.log("-".repeat(40));

    if (punto.saldosServientrega) {
      console.log(`✅ Saldo configurado:`);
      console.log(
        `   💵 Saldo actual: $${Number(
          punto.saldosServientrega.monto_total || 0
        ).toFixed(2)}`
      );
      console.log(
        `   📅 Creado en: ${punto.saldosServientrega.created_at.toLocaleString()}`
      );
    } else {
      console.log(
        `❌ No hay saldo de Servientrega configurado para este punto`
      );
    }
    console.log();

    // 4. Verificar usuarios asignados
    console.log("👥 USUARIOS ASIGNADOS:");
    console.log("-".repeat(40));

    if (punto.usuarios.length > 0) {
      punto.usuarios.forEach((usuario) => {
        console.log(`👤 ${usuario.nombre} (${usuario.rol})`);
      });
    } else {
      console.log(`❌ No hay usuarios asignados a este punto`);
    }
    console.log();

    // 5. Resumen y recomendaciones
    console.log("📋 RESUMEN Y RECOMENDACIONES:");
    console.log("=".repeat(80));

    const problemas = [];
    const soluciones = [];

    if (!tieneAgenciaCodigo) {
      problemas.push("❌ Falta código de agencia Servientrega");
      soluciones.push(
        "✅ Configurar servientrega_agencia_codigo en la base de datos"
      );
    }

    if (!tieneAgenciaNombre) {
      problemas.push(
        "⚠️  Falta nombre de agencia Servientrega (opcional pero recomendado)"
      );
      soluciones.push(
        "✅ Configurar servientrega_agencia_nombre en la base de datos"
      );
    }

    if (!punto.saldosServientrega) {
      problemas.push("❌ No hay saldo de Servientrega configurado");
      soluciones.push(
        "✅ Asignar saldo inicial de Servientrega desde el panel de administración"
      );
    }

    if (!punto.activo) {
      problemas.push("❌ El punto de atención está inactivo");
      soluciones.push("✅ Activar el punto de atención");
    }

    if (punto.usuarios.length === 0) {
      problemas.push("⚠️  No hay usuarios asignados al punto");
      soluciones.push("✅ Asignar al menos un operador al punto");
    }

    if (problemas.length === 0) {
      console.log("🎉 ¡Todo está configurado correctamente!");
      console.log(
        '   La opción "Guías Servientrega" debería aparecer en el menú del operador.'
      );
    } else {
      console.log("🚨 PROBLEMAS ENCONTRADOS:");
      problemas.forEach((problema) => console.log(`   ${problema}`));
      console.log();
      console.log("🔧 SOLUCIONES RECOMENDADAS:");
      soluciones.forEach((solucion) => console.log(`   ${solucion}`));
    }

    // 6. Comando SQL para solución rápida
    if (!tieneAgenciaCodigo) {
      console.log();
      console.log("🛠️  SOLUCIÓN RÁPIDA (SQL):");
      console.log("-".repeat(40));
      console.log(`UPDATE "PuntoAtencion" SET`);
      console.log(`  servientrega_agencia_codigo = 'CODIGO_AGENCIA',`);
      console.log(`  servientrega_agencia_nombre = 'NOMBRE_AGENCIA'`);
      console.log(`WHERE id = '${punto.id}';`);
      console.log();
      console.log(
        "⚠️  Reemplaza CODIGO_AGENCIA y NOMBRE_AGENCIA con los valores correctos"
      );
    }
  } catch (error) {
    console.error("❌ Error al verificar la configuración:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
const nombrePunto = process.argv[2] || "AMAZONAS";
verificarConfiguracionServientrega(nombrePunto);
