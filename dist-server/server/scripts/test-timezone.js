/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE PRUEBA - FUNCIONES DE TIMEZONE ECUADOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este script prueba todas las funciones de manejo de fechas para Ecuador.
 *
 * USO:
 * npx tsx server/scripts/test-timezone.ts
 */
import { toEcuadorTime, fromEcuadorToUTC, formatEcuadorDateTime, formatEcuadorDate, formatEcuadorTime, nowEcuador, createEcuadorDate, gyeDayRangeUtcFromYMD, todayGyeDateOnly, } from "../utils/timezone.js";
console.log("\n" + "═".repeat(80));
console.log("🧪 PRUEBAS DE FUNCIONES DE TIMEZONE - ECUADOR (UTC-5)");
console.log("═".repeat(80) + "\n");
// ═══════════════════════════════════════════════════════════════════════════
// PRUEBA 1: Conversión UTC a Ecuador
// ═══════════════════════════════════════════════════════════════════════════
console.log("📝 PRUEBA 1: Conversión UTC a Ecuador");
console.log("─".repeat(80));
const utcDate = new Date("2025-10-03T23:00:00.000Z");
console.log(`Fecha UTC:     ${utcDate.toISOString()}`);
console.log(`Hora Ecuador:  ${formatEcuadorDateTime(utcDate)}`);
console.log(`Esperado:      03/10/2025 18:00 (23:00 UTC - 5 horas = 18:00 Ecuador)`);
console.log();
// ═══════════════════════════════════════════════════════════════════════════
// PRUEBA 2: Formateo de Fechas
// ═══════════════════════════════════════════════════════════════════════════
console.log("📝 PRUEBA 2: Formateo de Fechas");
console.log("─".repeat(80));
const testDate = new Date("2025-10-03T14:30:45.000Z");
console.log(`Fecha UTC:           ${testDate.toISOString()}`);
console.log(`Fecha y Hora:        ${formatEcuadorDateTime(testDate)}`);
console.log(`Solo Fecha:          ${formatEcuadorDate(testDate)}`);
console.log(`Solo Hora:           ${formatEcuadorTime(testDate)}`);
console.log(`Esperado Fecha/Hora: 03/10/2025 09:30`);
console.log(`Esperado Fecha:      03/10/2025`);
console.log(`Esperado Hora:       09:30:45`);
console.log();
// ═══════════════════════════════════════════════════════════════════════════
// PRUEBA 3: Conversión Ecuador a UTC
// ═══════════════════════════════════════════════════════════════════════════
console.log("📝 PRUEBA 3: Conversión Ecuador a UTC");
console.log("─".repeat(80));
const ecuadorLocal = new Date("2025-10-03T18:00:00");
const backToUTC = fromEcuadorToUTC(ecuadorLocal);
console.log(`Fecha Ecuador (local): ${ecuadorLocal.toISOString()}`);
console.log(`Convertida a UTC:      ${backToUTC.toISOString()}`);
console.log(`Esperado:              2025-10-03T23:00:00.000Z (18:00 + 5 horas = 23:00 UTC)`);
console.log();
// ═══════════════════════════════════════════════════════════════════════════
// PRUEBA 4: Crear Fecha desde Componentes
// ═══════════════════════════════════════════════════════════════════════════
console.log("📝 PRUEBA 4: Crear Fecha desde Componentes");
console.log("─".repeat(80));
const createdDate = createEcuadorDate(2025, 10, 3, 18, 30, 0);
console.log(`Crear: 3 de octubre de 2025, 18:30:00 (Ecuador)`);
console.log(`Resultado UTC:        ${createdDate.toISOString()}`);
console.log(`Formateado Ecuador:   ${formatEcuadorDateTime(createdDate)}`);
console.log(`Esperado UTC:         2025-10-03T23:30:00.000Z`);
console.log(`Esperado Ecuador:     03/10/2025 18:30`);
console.log();
// ═══════════════════════════════════════════════════════════════════════════
// PRUEBA 5: Rango de Día Completo
// ═══════════════════════════════════════════════════════════════════════════
console.log("📝 PRUEBA 5: Rango de Día Completo (3 de octubre de 2025)");
console.log("─".repeat(80));
const { gte, lt } = gyeDayRangeUtcFromYMD(2025, 10, 3);
console.log(`Inicio del día (UTC): ${gte.toISOString()}`);
console.log(`Fin del día (UTC):    ${lt.toISOString()}`);
console.log(`Inicio Ecuador:       ${formatEcuadorDateTime(gte)}`);
console.log(`Fin Ecuador:          ${formatEcuadorDateTime(lt)}`);
console.log(`Esperado Inicio:      03/10/2025 00:00 (Ecuador) = 2025-10-03T05:00:00.000Z (UTC)`);
console.log(`Esperado Fin:         04/10/2025 00:00 (Ecuador) = 2025-10-04T05:00:00.000Z (UTC)`);
console.log();
// ═══════════════════════════════════════════════════════════════════════════
// PRUEBA 6: Fecha Actual
// ═══════════════════════════════════════════════════════════════════════════
console.log("📝 PRUEBA 6: Fecha y Hora Actual");
console.log("─".repeat(80));
const ahoraUTC = new Date();
const ahoraEcuador = nowEcuador();
console.log(`Ahora UTC:            ${ahoraUTC.toISOString()}`);
console.log(`Ahora Ecuador (obj):  ${ahoraEcuador.toISOString()}`);
console.log(`Ahora Ecuador (fmt):  ${formatEcuadorDateTime(ahoraUTC)}`);
console.log(`Hoy Ecuador (str):    ${todayGyeDateOnly()}`);
console.log();
// ═══════════════════════════════════════════════════════════════════════════
// PRUEBA 7: Casos Extremos
// ═══════════════════════════════════════════════════════════════════════════
console.log("📝 PRUEBA 7: Casos Extremos");
console.log("─".repeat(80));
// Medianoche UTC
const medianoche = new Date("2025-10-03T00:00:00.000Z");
console.log(`Medianoche UTC:       ${medianoche.toISOString()}`);
console.log(`En Ecuador:           ${formatEcuadorDateTime(medianoche)}`);
console.log(`Esperado:             02/10/2025 19:00 (día anterior en Ecuador)`);
console.log();
// Mediodía UTC
const mediodia = new Date("2025-10-03T12:00:00.000Z");
console.log(`Mediodía UTC:         ${mediodia.toISOString()}`);
console.log(`En Ecuador:           ${formatEcuadorDateTime(mediodia)}`);
console.log(`Esperado:             03/10/2025 07:00`);
console.log();
// Fin del día UTC
const finDia = new Date("2025-10-03T23:59:59.999Z");
console.log(`Fin del día UTC:      ${finDia.toISOString()}`);
console.log(`En Ecuador:           ${formatEcuadorDateTime(finDia)}`);
console.log(`Esperado:             03/10/2025 18:59`);
console.log();
// ═══════════════════════════════════════════════════════════════════════════
// PRUEBA 8: Conversión Ida y Vuelta
// ═══════════════════════════════════════════════════════════════════════════
console.log("📝 PRUEBA 8: Conversión Ida y Vuelta (Verificar Consistencia)");
console.log("─".repeat(80));
const original = new Date("2025-10-03T23:00:00.000Z");
const ecuadorTime = toEcuadorTime(original);
const backToOriginal = fromEcuadorToUTC(ecuadorTime);
console.log(`Original UTC:         ${original.toISOString()}`);
console.log(`→ Ecuador:            ${ecuadorTime.toISOString()}`);
console.log(`→ De vuelta a UTC:    ${backToOriginal.toISOString()}`);
console.log(`¿Son iguales?         ${original.getTime() === backToOriginal.getTime() ? "✅ SÍ" : "❌ NO"}`);
console.log();
// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════════════════════════════════
console.log("═".repeat(80));
console.log("✅ PRUEBAS COMPLETADAS");
console.log("═".repeat(80));
console.log();
console.log("📋 RESUMEN:");
console.log("   • Ecuador usa UTC-5 (sin horario de verano)");
console.log("   • Las fechas en BD se guardan en UTC");
console.log("   • Las fechas se muestran en formato Ecuador: DD/MM/YYYY HH:mm");
console.log("   • Todas las conversiones son reversibles");
console.log();
console.log("📚 Documentación completa en: server/scripts/MANEJO_FECHAS_ECUADOR.md");
console.log();
