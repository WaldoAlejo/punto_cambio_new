const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MS_5H = 5 * 60 * 60 * 1000;

async function main() {
  const desde = new Date('2026-03-01T00:00:00.000Z');
  const hasta = new Date('2026-04-01T00:00:00.000Z');

  const jornadas = await prisma.jornada.findMany({
    where: {
      estado: 'COMPLETADO',
      fecha_inicio: { gte: desde, lt: hasta },
      fecha_salida: { not: null },
    },
    include: {
      usuario: { select: { nombre: true, username: true, rol: true } },
      puntoAtencion: { select: { nombre: true } },
    },
    orderBy: { fecha_inicio: 'asc' },
  });

  console.log('=== Jornadas con duración <= 0 ===');
  for (const j of jornadas) {
    const duracionMin = Math.floor((j.fecha_salida.getTime() - j.fecha_inicio.getTime()) / 60000);
    if (duracionMin <= 0) {
      const entradaEcu = new Date(j.fecha_inicio.getTime() - MS_5H);
      const salidaEcu = new Date(j.fecha_salida.getTime() - MS_5H);
      console.log(
        `${j.usuario?.nombre} | ${j.puntoAtencion?.nombre} | ` +
        `${entradaEcu.toISOString()} | ${salidaEcu.toISOString()} | ` +
        `Duración: ${duracionMin}min | Rol: ${j.usuario?.rol} | ID: ${j.id}`
      );
    }
  }

  console.log('\n=== Jornadas no-OPERADOR con salida < 17:00 y <8h ===');
  for (const j of jornadas) {
    if (j.usuario?.rol === 'OPERADOR') continue;
    const duracionMin = Math.floor((j.fecha_salida.getTime() - j.fecha_inicio.getTime()) / 60000);
    const salidaEcu = new Date(j.fecha_salida.getTime() - MS_5H);
    const horaSalida = salidaEcu.getUTCHours() + salidaEcu.getUTCMinutes() / 60;
    if (horaSalida < 17.0 && duracionMin < 480) {
      const entradaEcu = new Date(j.fecha_inicio.getTime() - MS_5H);
      console.log(
        `${j.usuario?.nombre} | ${j.puntoAtencion?.nombre} | ` +
        `${entradaEcu.toISOString().slice(0, 10)} | ` +
        `Entrada: ${entradaEcu.toISOString().slice(11, 16)} | ` +
        `Salida: ${salidaEcu.toISOString().slice(11, 16)} | ` +
        `Duración: ${duracionMin}min | Rol: ${j.usuario?.rol} | ID: ${j.id}`
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
