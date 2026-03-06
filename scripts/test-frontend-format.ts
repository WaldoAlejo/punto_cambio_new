// Simular cómo el frontend formatearía las fechas

const testDates = [
  "2026-03-05T04:48:00.000Z", // Giuliana - UTC 04:48
  "2026-03-05T00:17:00.000Z", // Byron - UTC 00:17
  "2026-03-05T03:01:00.000Z", // Aruba - UTC 03:01
];

console.log("=== Simulación de formateo frontend ===\n");

console.log("Método 1: toLocaleTimeString (usado en ActivePointsReport)");
for (const dateStr of testDates) {
  const d = new Date(dateStr);
  const formatted = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Guayaquil" // Forzar zona horaria de Ecuador
  });
  console.log(`  ${dateStr} -> ${formatted}`);
}

console.log("\nMétodo 2: toGyeClock (usado en TimeTracker/TimeReports)");
const GYE_OFFSET_MS = 5 * 60 * 60 * 1000;
function toGyeClock(date: Date): Date {
  return new Date(date.getTime() - GYE_OFFSET_MS);
}
for (const dateStr of testDates) {
  const d = toGyeClock(new Date(dateStr));
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  console.log(`  ${dateStr} -> ${h}:${m}`);
}

console.log("\n=== Análisis ===");
console.log("Si el servidor está en Ecuador y guardó new Date() a las 23:48:");
console.log("  - El objeto Date internamente es 04:48 UTC del día siguiente");
console.log("  - toISOString() devuelve '2026-03-06T04:48:00.000Z'");
console.log("  - toLocaleTimeString('America/Guayaquil') muestra '23:48' (correcto)");
console.log("  - toGyeClock(04:48 UTC) = 23:48 del día anterior (correcto)");
