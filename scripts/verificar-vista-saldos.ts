/**
 * Script para verificar que admin y operador vean los mismos saldos
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Verificando vista de saldos para Admin y Operador\n");

  // Buscar un punto específico (Plaza del Valle)
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: "Plaza del Valle", mode: 'insensitive' } },
  });

  if (!punto) {
    console.log("❌ No se encontró Plaza del Valle");
    await prisma.$disconnect();
    return;
  }

  console.log(`📍 Punto: ${punto.nombre} (ID: ${punto.id})\n`);

  // Buscar EUR
  const eur = await prisma.moneda.findFirst({ where: { codigo: "EUR" } });
  if (!eur) {
    console.log("❌ No se encontró EUR");
    await prisma.$disconnect();
    return;
  }

  const key = `${punto.id}:${eur.id}`;

  // 1. Saldo desde tabla Saldo (lo que ven sin reconciliar)
  const saldoTabla = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  // 2. Saldo Inicial activo
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
      activo: true,
    },
  });

  // 3. Movimientos de saldo
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
    },
    orderBy: { fecha: "asc" },
  });

  // Calcular saldo desde movimientos (modo reconciliar)
  let saldoCalculado = 0;
  const saldosInicialesMovs = movimientos.filter(m => m.tipo_movimiento === "SALDO_INICIAL");
  
  // Sumar todos los saldos iniciales
  saldosInicialesMovs.forEach(m => {
    saldoCalculado += Number(m.monto);
  });

  // Tomar la fecha del último saldo inicial
  const ultimoSaldoInicial = saldosInicialesMovs[saldosInicialesMovs.length - 1];
  const fechaCorte = ultimoSaldoInicial?.fecha;

  // Sumar movimientos posteriores (excluyendo bancos)
  movimientos.forEach(m => {
    if (m.tipo_movimiento === "SALDO_INICIAL") return;
    
    const desc = (m.descripcion || "").toLowerCase();
    if (/\bbancos?\b/i.test(desc) && !desc.includes("(caja)")) return;
    
    saldoCalculado += Number(m.monto);
  });

  saldoCalculado = Number(saldoCalculado.toFixed(2));

  console.log("📊 Comparación de saldos EUR:\n");
  console.log(`   Tabla Saldo.cantidad:      ${Number(saldoTabla?.cantidad || 0).toFixed(2)} EUR`);
  console.log(`   SaldoInicial.cantidad:     ${Number(saldoInicial?.cantidad_inicial || 0).toFixed(2)} EUR`);
  console.log(`   Calculado desde movs:      ${saldoCalculado.toFixed(2)} EUR`);
  console.log(`   Diferencia (Tabla - Calc): ${(Number(saldoTabla?.cantidad || 0) - saldoCalculado).toFixed(2)} EUR\n`);

  // Mostrar últimos 10 movimientos
  console.log("📝 Últimos 10 movimientos:\n");
  movimientos.slice(-10).forEach((m, i) => {
    const desc = m.descripcion || "";
    const esBanco = /\bbancos?\b/i.test(desc.toLowerCase()) && !desc.toLowerCase().includes("(caja)");
    console.log(`   ${i + 1}. ${m.tipo_movimiento} | Monto: ${Number(m.monto).toFixed(2)} | ${esBanco ? "[BANCO] " : ""}${desc.slice(0, 50)}`);
  });

  // Verificar si hay diferencia
  const diferencia = Number((Number(saldoTabla?.cantidad || 0) - saldoCalculado).toFixed(2));
  
  if (Math.abs(diferencia) > 0.01) {
    console.log(`\n⚠️  ALERTA: Hay una diferencia de ${diferencia.toFixed(2)} EUR`);
    console.log(`   Esto significa que el admin y operador pueden ver diferentes valores`);
    console.log(`   dependiendo de si usan ?reconciliar=true o no.\n`);
    
    console.log(`   ✅ RECOMENDACIÓN: Usar siempre el valor de la tabla Saldo (sin reconciliar)`);
    console.log(`      ya que es el que se actualiza atómicamente en cada transacción.\n`);
  } else {
    console.log("\n✅ Los saldos coinciden correctamente\n");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
