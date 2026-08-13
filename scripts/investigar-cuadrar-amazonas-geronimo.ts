/**
 * Diagnóstico y cuadre de saldos para AMAZONAS GERONIMO tras una anulación
 * de cambio de divisa cuyo origen fue pagado por transferencia bancaria.
 *
 * Bug corregido en server/routes/exchanges.ts (DELETE /:id): el reverso de
 * anulación debitaba el efectivo aunque el dinero se hubiera recibido por
 * banco, dejando el saldo en efectivo por debajo del real.
 *
 * Modo por defecto: SOLO DIAGNÓSTICO (no escribe nada).
 * Por defecto usa el día de hoy (hora Ecuador). Para apuntar a otro día:
 *   npx tsx scripts/investigar-cuadrar-amazonas-geronimo.ts --fecha=2026-08-12
 * Para aplicar la corrección, agregar además: --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Ecuador (America/Guayaquil) es UTC-5 todo el año, sin horario de verano.
const OFFSET_ECUADOR_HORAS = 5;

function rangoDiaEcuador() {
  const argFecha = process.argv.find((a) => a.startsWith("--fecha="));

  let year: number, month: number, day: number;
  if (argFecha) {
    const valor = argFecha.split("=")[1]; // formato YYYY-MM-DD
    const [y, m, d] = valor.split("-").map(Number);
    year = y;
    month = m - 1;
    day = d;
  } else {
    const nowUtc = new Date();
    const nowEcuador = new Date(nowUtc.getTime() - OFFSET_ECUADOR_HORAS * 3600 * 1000);
    year = nowEcuador.getUTCFullYear();
    month = nowEcuador.getUTCMonth();
    day = nowEcuador.getUTCDate();
  }

  const inicioComoUtc = new Date(Date.UTC(year, month, day));
  // inicioComoUtc representa 00:00 hora Ecuador, expresado como si fuera UTC;
  // sumamos el offset para obtener el instante UTC real.
  const inicio = new Date(inicioComoUtc.getTime() + OFFSET_ECUADOR_HORAS * 3600 * 1000);
  const fin = new Date(inicio.getTime() + 24 * 3600 * 1000);
  return { inicio, fin };
}

async function main() {
  console.log("=".repeat(100));
  console.log("DIAGNÓSTICO DE SALDOS - AMAZONAS GERONIMO");
  console.log(APPLY ? "MODO: APLICAR CORRECCIÓN" : "MODO: SOLO DIAGNÓSTICO (dry-run)");
  console.log("=".repeat(100));

  const candidatos = await prisma.puntoAtencion.findMany({
    where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
  });

  if (candidatos.length === 0) {
    console.error("No se encontró ningún punto de atención que contenga 'AMAZONAS'.");
    return;
  }

  console.log(`\nPuntos encontrados con 'AMAZONAS' en el nombre: ${candidatos.length}`);
  for (const c of candidatos) console.log(`  - ${c.nombre} (ID: ${c.id})`);

  const punto =
    candidatos.find((c) => c.nombre.toUpperCase().includes("JERONIMO")) ??
    candidatos.find((c) => c.nombre.toUpperCase().includes("JERÓNIMO")) ??
    candidatos.find((c) => c.nombre.toUpperCase().includes("GERONIMO")) ??
    candidatos.find((c) => c.nombre.toUpperCase().includes("GERÓNIMO"));

  if (!punto) {
    console.error(
      "\nNinguno de los puntos encontrados contiene 'JERONIMO'/'GERONIMO' en el nombre. Revisa la lista de arriba y ajusta el filtro del script."
    );
    return;
  }
  console.log(`\nUsando punto: ${punto.nombre} (ID: ${punto.id})\n`);

  const { inicio, fin } = rangoDiaEcuador();
  console.log(
    `Rango de día analizado (hora Ecuador, UTC-5): ${inicio.toISOString()} a ${fin.toISOString()}\n`
  );

  const movimientosDia = await prisma.movimientoSaldo.findMany({
    where: { punto_atencion_id: punto.id, fecha: { gte: inicio, lt: fin } },
    include: { moneda: true },
    orderBy: { fecha: "asc" },
  });

  console.log(`Movimientos del día analizado: ${movimientosDia.length}`);
  for (const m of movimientosDia) {
    console.log(
      `  [${m.fecha.toISOString()}] ${m.moneda.codigo} | ${m.tipo_movimiento} | monto=${Number(
        m.monto
      ).toFixed(2)} | anterior=${Number(m.saldo_anterior).toFixed(2)} | nuevo=${Number(
        m.saldo_nuevo
      ).toFixed(2)} | ref=${m.tipo_referencia}/${m.referencia_id} | ${m.descripcion}`
    );
  }

  // Reconciliación robusta: en vez de re-sumar movimiento por movimiento (frágil,
  // depende de listar TODOS los tipos posibles: INGRESO/EGRESO/AJUSTE/
  // TRANSFERENCIA_ENTRANTE/etc.), comparamos el saldo actual contra el
  // `saldo_nuevo` del ÚLTIMO movimiento registrado para cada moneda: ese campo
  // ya es la foto de "cuánto debería haber" según el propio libro de movimientos.
  const saldosDelPunto = await prisma.saldo.findMany({
    where: { punto_atencion_id: punto.id },
    include: { moneda: true },
  });

  console.log("\n" + "=".repeat(100));
  console.log(
    "COMPARACIÓN: saldo_nuevo del último movimiento registrado vs saldo actual en tabla Saldo"
  );
  console.log("=".repeat(100));

  for (const saldo of saldosDelPunto) {
    const ultimoMovimiento = await prisma.movimientoSaldo.findFirst({
      where: { punto_atencion_id: punto.id, moneda_id: saldo.moneda_id },
      orderBy: { fecha: "desc" },
    });

    console.log(`\n--- ${saldo.moneda.codigo} (${saldo.moneda.nombre}) ---`);

    if (!ultimoMovimiento) {
      console.log("  Sin movimientos registrados para esta moneda, se omite.");
      continue;
    }

    const saldoEsperado = Number(ultimoMovimiento.saldo_nuevo);
    const saldoDb = Number(saldo.cantidad);

    console.log(
      `  Último movimiento: [${ultimoMovimiento.fecha.toISOString()}] ${
        ultimoMovimiento.tipo_movimiento
      } | saldo_nuevo=${saldoEsperado.toFixed(2)} | ${ultimoMovimiento.descripcion}`
    );
    console.log(`  Saldo actual en tabla Saldo (cantidad): ${saldoDb.toFixed(2)}`);
    console.log(
      `  Billetes: ${Number(saldo.billetes).toFixed(2)} | Monedas físicas: ${Number(
        saldo.monedas_fisicas
      ).toFixed(2)} | Bancos: ${Number(saldo.bancos).toFixed(2)}`
    );

    const diferencia = round2(saldoEsperado - saldoDb);
    if (Math.abs(diferencia) > 0.01) {
      console.log(
        `  ⚠️  DIFERENCIA DETECTADA: ${diferencia > 0 ? "+" : ""}${diferencia.toFixed(
          2
        )} (saldo en DB está ${diferencia > 0 ? "por debajo" : "por encima"} de lo que indica el último movimiento)`
      );

      if (APPLY) {
        const usuarioId = await getUsuarioCorreccionId();
        const nuevaCantidad = round2(saldoDb + diferencia);
        const nuevosBilletes = round2(Number(saldo.billetes) + diferencia);
        await prisma.saldo.update({
          where: {
            punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: saldo.moneda_id },
          },
          data: { cantidad: nuevaCantidad, billetes: nuevosBilletes, updated_at: new Date() },
        });
        await prisma.movimientoSaldo.create({
          data: {
            punto_atencion_id: punto.id,
            moneda_id: saldo.moneda_id,
            tipo_movimiento: "AJUSTE",
            monto: diferencia,
            saldo_anterior: saldoDb,
            saldo_nuevo: nuevaCantidad,
            usuario_id: usuarioId,
            tipo_referencia: "CORRECCION_MANUAL",
            descripcion:
              "Corrección: saldo en tabla Saldo no coincidía con el saldo_nuevo del último MovimientoSaldo registrado",
          },
        });
        console.log(`  ✅ Corregido. Nuevo saldo: ${nuevaCantidad.toFixed(2)}`);
      } else {
        console.log(`  ℹ️  Ejecuta con --apply para corregir automáticamente este punto/moneda.`);
      }
    } else {
      console.log("  ✅ Saldo consistente con el último movimiento registrado.");
    }

    // Chequeo aparte: cantidad debe ser igual a billetes + monedas_fisicas.
    // Un bug detectado en la reversión de anulaciones podía recuperar `cantidad`
    // sin recuperar `billetes`/`monedas_fisicas` en la misma proporción.
    const saldoDbActualizado = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: saldo.moneda_id },
      },
    });
    if (saldoDbActualizado) {
      const cantidadFinal = Number(saldoDbActualizado.cantidad);
      const desglose = round2(
        Number(saldoDbActualizado.billetes) + Number(saldoDbActualizado.monedas_fisicas)
      );
      const diferenciaDesglose = round2(cantidadFinal - desglose);
      if (Math.abs(diferenciaDesglose) > 0.01) {
        console.log(
          `  ⚠️  DESGLOSE NO CUADRA: cantidad=${cantidadFinal.toFixed(2)} vs billetes+monedas=${desglose.toFixed(
            2
          )} (diferencia ${diferenciaDesglose > 0 ? "+" : ""}${diferenciaDesglose.toFixed(2)} en billetes/monedas faltante)`
        );
        if (APPLY) {
          const nuevosBilletesDesglose = round2(
            Number(saldoDbActualizado.billetes) + diferenciaDesglose
          );
          await prisma.saldo.update({
            where: {
              punto_atencion_id_moneda_id: { punto_atencion_id: punto.id, moneda_id: saldo.moneda_id },
            },
            data: { billetes: nuevosBilletesDesglose, updated_at: new Date() },
          });
          console.log(`  ✅ Desglose corregido. Nuevo billetes: ${nuevosBilletesDesglose.toFixed(2)}`);
        } else {
          console.log(`  ℹ️  Ejecuta con --apply para corregir el desglose de este punto/moneda.`);
        }
      }
    }
  }

  console.log("\n" + "=".repeat(100));
  console.log("FIN DEL DIAGNÓSTICO");
  console.log("=".repeat(100));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

let usuarioCorreccionIdCache: string | null = null;
async function getUsuarioCorreccionId(): Promise<string> {
  if (usuarioCorreccionIdCache) return usuarioCorreccionIdCache;
  const argUsuario = process.argv.find((a) => a.startsWith("--usuario-id="));
  if (argUsuario) {
    usuarioCorreccionIdCache = argUsuario.split("=")[1];
    return usuarioCorreccionIdCache;
  }
  const admin = await prisma.usuario.findFirst({
    where: { rol: { in: ["SUPER_USUARIO", "ADMIN"] as any } },
    orderBy: { rol: "asc" },
  });
  if (!admin) {
    throw new Error(
      "No se encontró un usuario ADMIN/SUPER_USUARIO para atribuir la corrección. Pasa --usuario-id=<id> explícitamente."
    );
  }
  usuarioCorreccionIdCache = admin.id;
  return admin.id;
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
