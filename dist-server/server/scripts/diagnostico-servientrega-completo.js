#!/usr/bin/env tsx
/**
 * Diagnóstico completo para problemas con Servientrega
 * Simula exactamente la lógica del frontend
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function diagnosticoCompleto() {
    try {
        console.log("🔍 DIAGNÓSTICO COMPLETO - SERVIENTREGA");
        console.log("=".repeat(80));
        // 1. Verificar todos los puntos con configuración Servientrega
        console.log("📍 PUNTOS CON CONFIGURACIÓN SERVIENTREGA:");
        console.log("-".repeat(50));
        const puntosConServientrega = await prisma.puntoAtencion.findMany({
            where: {
                servientrega_agencia_codigo: {
                    not: null,
                },
            },
            include: {
                saldosServientrega: true,
                usuarios: {
                    where: {
                        activo: true,
                        rol: "OPERADOR",
                    },
                    select: {
                        id: true,
                        nombre: true,
                        rol: true,
                    },
                },
            },
            orderBy: {
                nombre: "asc",
            },
        });
        if (puntosConServientrega.length === 0) {
            console.log("❌ No hay puntos con configuración de Servientrega");
            return;
        }
        puntosConServientrega.forEach((punto, index) => {
            console.log(`${index + 1}. ${punto.nombre}`);
            console.log(`   🏪 Código: ${punto.servientrega_agencia_codigo}`);
            console.log(`   🏪 Nombre: ${punto.servientrega_agencia_nombre || "No configurado"}`);
            console.log(`   💰 Saldo: ${punto.saldosServientrega
                ? `$${Number(punto.saldosServientrega.monto_total || 0).toFixed(2)}`
                : "No configurado"}`);
            console.log(`   👥 Operadores: ${punto.usuarios.length}`);
            console.log(`   🔄 Activo: ${punto.activo ? "Sí" : "No"}`);
            // Simular la lógica del frontend
            const deberiaAparecerMenu = !!(punto.servientrega_agencia_codigo && punto.activo);
            console.log(`   📱 ¿Debería aparecer en menú?: ${deberiaAparecerMenu ? "✅ SÍ" : "❌ NO"}`);
            console.log();
        });
        // 2. Verificar usuarios operadores específicamente
        console.log("👤 VERIFICACIÓN DE USUARIOS OPERADORES:");
        console.log("-".repeat(50));
        const operadores = await prisma.usuario.findMany({
            where: {
                rol: "OPERADOR",
                activo: true,
                punto_atencion_id: {
                    not: null,
                },
            },
            include: {
                puntoAtencion: {
                    select: {
                        id: true,
                        nombre: true,
                        servientrega_agencia_codigo: true,
                        servientrega_agencia_nombre: true,
                        activo: true,
                    },
                },
            },
            orderBy: {
                nombre: "asc",
            },
        });
        operadores.forEach((operador, index) => {
            const punto = operador.puntoAtencion;
            const tieneServientrega = !!punto?.servientrega_agencia_codigo;
            console.log(`${index + 1}. ${operador.nombre}`);
            console.log(`   📍 Punto: ${punto?.nombre || "Sin punto asignado"}`);
            console.log(`   🏪 Servientrega: ${tieneServientrega ? "✅ Configurado" : "❌ No configurado"}`);
            if (tieneServientrega) {
                console.log(`   🏪 Código: ${punto?.servientrega_agencia_codigo}`);
            }
            console.log(`   📱 ¿Ve opción Servientrega?: ${tieneServientrega ? "✅ SÍ" : "❌ NO"}`);
            console.log();
        });
        // 3. Verificar la lógica específica del Sidebar
        console.log("🔍 SIMULACIÓN DE LÓGICA DEL SIDEBAR:");
        console.log("-".repeat(50));
        // Simular para el punto AMAZONAS específicamente
        const puntoAmazonas = await prisma.puntoAtencion.findFirst({
            where: {
                nombre: {
                    equals: "AMAZONAS",
                    mode: "insensitive",
                },
            },
        });
        if (puntoAmazonas) {
            console.log("Simulando lógica del Sidebar para punto AMAZONAS:");
            console.log(`selectedPoint?.servientrega_agencia_codigo = "${puntoAmazonas.servientrega_agencia_codigo}"`);
            const condicionSidebar = !!puntoAmazonas.servientrega_agencia_codigo;
            console.log(`!!selectedPoint?.servientrega_agencia_codigo = ${condicionSidebar}`);
            console.log(`Resultado: ${condicionSidebar ? "✅ MOSTRAR opción" : "❌ OCULTAR opción"}`);
            if (condicionSidebar) {
                console.log();
                console.log("🤔 Si la lógica dice que SÍ debe aparecer, pero no aparece, posibles causas:");
                console.log("   1. ❓ El usuario no está logueado como OPERADOR");
                console.log("   2. ❓ El punto seleccionado en el frontend no es AMAZONAS");
                console.log("   3. ❓ Hay un problema de caché en el navegador");
                console.log("   4. ❓ El componente no se está re-renderizando");
                console.log("   5. ❓ Hay un error de JavaScript en el navegador");
            }
        }
        // 4. Verificar si hay problemas de datos
        console.log();
        console.log("🔍 VERIFICACIÓN DE INTEGRIDAD DE DATOS:");
        console.log("-".repeat(50));
        const puntosConProblemas = await prisma.puntoAtencion.findMany({
            where: {
                OR: [
                    {
                        servientrega_agencia_codigo: {
                            equals: "",
                        },
                    },
                    {
                        servientrega_agencia_codigo: {
                            contains: " ",
                        },
                    },
                ],
            },
        });
        if (puntosConProblemas.length > 0) {
            console.log("⚠️  Puntos con códigos problemáticos:");
            puntosConProblemas.forEach((punto) => {
                console.log(`   - ${punto.nombre}: "${punto.servientrega_agencia_codigo}"`);
            });
        }
        else {
            console.log("✅ No se encontraron códigos problemáticos");
        }
        // 5. Recomendaciones finales
        console.log();
        console.log("🎯 RECOMENDACIONES PARA RESOLVER EL PROBLEMA:");
        console.log("=".repeat(80));
        console.log("1. 🔄 Cerrar sesión y volver a iniciar sesión");
        console.log("2. 🗂️  Verificar que el punto seleccionado sea AMAZONAS");
        console.log("3. 🧹 Limpiar caché del navegador (Ctrl+Shift+R)");
        console.log("4. 🔍 Abrir herramientas de desarrollador y verificar errores en consola");
        console.log("5. 📱 Verificar que el usuario tenga rol OPERADOR");
        console.log("6. 🔄 Recompilar el frontend: npm run build");
    }
    catch (error) {
        console.error("❌ Error en el diagnóstico:", error);
    }
    finally {
        await prisma.$disconnect();
    }
}
// Ejecutar el diagnóstico
diagnosticoCompleto();
