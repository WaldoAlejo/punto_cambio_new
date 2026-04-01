const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MS_5H = 5 * 60 * 60 * 1000;

async function main() {
  const desde = new Date('2026-03-01T00:00:00.000Z');
  const hasta = new Date('2026-04-01T00:00:00.000Z');

  // Obtener todos los usuarios que tienen al menos 2 jornadas sospechosas en marzo
  const jornadas = await prisma.jornada.findMany({
    where: {
      estado: 'COMPLETADO',
      fecha_inicio: { gte: desde, lt: hasta },
      fecha_salida: { not: null },
      usuario: { rol: 'OPERADOR' },
    },
    include: {
      usuario: { select: { id: true, nombre: true, username: true } },
      puntoAtencion: { select: { nombre: true } },
    },
    orderBy: [{ usuario_id: 'asc' }, { fecha_inicio: 'asc' }],
  });

  const porUsuario = new Map();

  for (const j of jornadas) {
    const entradaEcu = new Date(j.fecha_inicio.getTime() - MS_5H);
    const salidaEcu = new Date(j.fecha_salida.getTime() - MS_5H);
    const duracionMin = Math.floor((j.fecha_salida.getTime() - j.fecha_inicio.getTime()) / 60000);
    const horaSalida = salidaEcu.getUTCHours() + salidaEcu.getUTCMinutes() / 60;

    if (horaSalida < 17.0 && duracionMin < 480) {
      const uid = j.usuario_id;
      if (!porUsuario.has(uid)) {
        porUsuario.set(uid, { nombre: j.usuario.nombre, username: j.usuario.username, count: 0 });
      }
      porUsuario.get(uid).count++;
    }
  }

  console.log('Usuarios OPERADOR con salidas sospechosas (<17:00, <8h) en marzo 2026:\n');
  const sorted = Array.from(porUsuario.entries()).sort((a, b) => b[1].count - a[1].count);
  for (const [, info] of sorted) {
    console.log(`${info.nombre} (@${info.username}): ${info.count} jornadas`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
