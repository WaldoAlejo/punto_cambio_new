#!/usr/bin/env node
/**
 * Script para diagnosticar y corregir fechas de jornada
 * Problema: Las fechas se guardan con 5 horas de diferencia
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNÓSTICO DE ZONA HORARIA ===\n');
  
  // 1. Verificar timezone del servidor
  const now = new Date();
  console.log('Fecha/Hora actual del servidor:', now.toISOString());
  console.log('Timezone offset (minutos):', now.getTimezoneOffset());
  console.log('¿Servidor en Ecuador?:', now.getTimezoneOffset() === 300 ? 'SÍ' : 'NO');
  console.log('Hora local:', now.toString());
  console.log('');

  // 2. Obtener jornadas de hoy
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);
  
  const hoyFin = new Date();
  hoyFin.setHours(23, 59, 59, 999);

  console.log('Buscando jornadas entre:', hoyInicio.toISOString(), 'y', hoyFin.toISOString());
  console.log('');

  const jornadas = await prisma.jornada.findMany({
    where: {
      fecha_inicio: {
        gte: hoyInicio,
        lte: hoyFin
      }
    },
    include: {
      usuario: { select: { nombre: true, username: true } },
      puntoAtencion: { select: { nombre: true } }
    },
    orderBy: { fecha_inicio: 'desc' },
    take: 10
  });

  console.log(`Encontradas ${jornadas.length} jornadas recientes:\n`);
  
  for (const j of jornadas) {
    console.log('-------------------------------------------');
    console.log(`Usuario: ${j.usuario?.nombre || 'N/A'} (${j.usuario?.username || 'N/A'})`);
    console.log(`Punto: ${j.puntoAtencion?.nombre || 'N/A'}`);
    console.log(`Estado: ${j.estado}`);
    console.log(`Fecha Inicio (BD): ${j.fecha_inicio?.toISOString()}`);
    console.log(`Fecha Inicio (Local): ${j.fecha_inicio?.toString()}`);
    if (j.fecha_salida) {
      console.log(`Fecha Salida (BD): ${j.fecha_salida?.toISOString()}`);
      console.log(`Fecha Salida (Local): ${j.fecha_salida?.toString()}`);
      
      // Calcular diferencia
      const diff = Math.abs(new Date() - j.fecha_salida);
      const diffHoras = diff / (1000 * 60 * 60);
      console.log(`Diferencia con ahora: ${diffHoras.toFixed(2)} horas`);
    }
    console.log('');
  }

  // 3. Verificar si hay jornadas con fecha_salida en el futuro (indicativo del bug)
  console.log('\n=== JORNADAS CON FECHA_SALIDA EN EL FUTURO (posible bug) ===\n');
  
  const futuro = new Date();
  futuro.setHours(futuro.getHours() + 1); // 1 hora desde ahora
  
  const jornadasFuturas = await prisma.jornada.findMany({
    where: {
      fecha_salida: {
        gt: futuro
      }
    },
    include: {
      usuario: { select: { nombre: true } },
      puntoAtencion: { select: { nombre: true } }
    },
    take: 5
  });

  if (jornadasFuturas.length === 0) {
    console.log('No se encontraron jornadas con fecha_salida en el futuro.');
  } else {
    for (const j of jornadasFuturas) {
      console.log(`⚠️  ${j.usuario?.nombre} - ${j.puntoAtencion?.nombre}`);
      console.log(`   Fecha salida: ${j.fecha_salida?.toISOString()}`);
      console.log(`   Esto indica que la fecha se guardó con desfase de 5 horas`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
