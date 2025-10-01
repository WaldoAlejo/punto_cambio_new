#!/usr/bin/env tsx

/**
 * Script para limpiar los códigos de agencia Servientrega
 * Elimina espacios en blanco y normaliza los datos
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function limpiarCodigosServientrega() {
  try {
    console.log("🧹 LIMPIANDO CÓDIGOS DE AGENCIA SERVIENTREGA");
    console.log("=".repeat(60));

    // 1. Buscar todos los puntos con códigos problemáticos
    const puntosConProblemas = await prisma.puntoAtencion.findMany({
      where: {
        servientrega_agencia_codigo: {
          not: null,
        },
      },
      select: {
        id: true,
        nombre: true,
        servientrega_agencia_codigo: true,
        servientrega_agencia_nombre: true,
      },
    });

    console.log(
      `📍 Encontrados ${puntosConProblemas.length} puntos con configuración Servientrega`
    );
    console.log();

    // 2. Procesar cada punto
    for (const punto of puntosConProblemas) {
      const codigoOriginal = punto.servientrega_agencia_codigo;
      const nombreOriginal = punto.servientrega_agencia_nombre;

      // Limpiar espacios en blanco
      const codigoLimpio = codigoOriginal?.trim() || null;
      const nombreLimpio = nombreOriginal?.trim() || null;

      const necesitaActualizacion =
        codigoOriginal !== codigoLimpio || nombreOriginal !== nombreLimpio;

      console.log(`📍 ${punto.nombre}:`);
      console.log(`   Código original: "${codigoOriginal}"`);
      console.log(`   Código limpio:   "${codigoLimpio}"`);

      if (nombreOriginal) {
        console.log(`   Nombre original: "${nombreOriginal}"`);
        console.log(`   Nombre limpio:   "${nombreLimpio}"`);
      }

      if (necesitaActualizacion) {
        console.log(`   🔄 Actualizando...`);

        await prisma.puntoAtencion.update({
          where: { id: punto.id },
          data: {
            servientrega_agencia_codigo: codigoLimpio,
            servientrega_agencia_nombre: nombreLimpio,
          },
        });

        console.log(`   ✅ Actualizado correctamente`);
      } else {
        console.log(`   ✅ No necesita actualización`);
      }
      console.log();
    }

    // 3. Verificar resultados
    console.log("🔍 VERIFICACIÓN FINAL:");
    console.log("-".repeat(40));

    const puntosActualizados = await prisma.puntoAtencion.findMany({
      where: {
        servientrega_agencia_codigo: {
          not: null,
        },
      },
      select: {
        nombre: true,
        servientrega_agencia_codigo: true,
        servientrega_agencia_nombre: true,
      },
      orderBy: {
        nombre: "asc",
      },
    });

    puntosActualizados.forEach((punto, index) => {
      console.log(`${index + 1}. ${punto.nombre}`);
      console.log(`   🏪 Código: "${punto.servientrega_agencia_codigo}"`);
      if (punto.servientrega_agencia_nombre) {
        console.log(`   🏪 Nombre: "${punto.servientrega_agencia_nombre}"`);
      }

      // Verificar si aún tiene espacios
      const tieneEspacios =
        punto.servientrega_agencia_codigo?.includes(" ") ||
        punto.servientrega_agencia_nombre?.includes(" ");

      console.log(
        `   🔍 Estado: ${
          tieneEspacios ? "⚠️  Aún tiene espacios" : "✅ Limpio"
        }`
      );
      console.log();
    });

    console.log("🎉 LIMPIEZA COMPLETADA");
    console.log("✅ Todos los códigos han sido normalizados");
    console.log("🔄 Recomendación: Reiniciar el frontend para aplicar cambios");
  } catch (error) {
    console.error("❌ Error durante la limpieza:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la limpieza
limpiarCodigosServientrega();
