/*
  Limpia datos operativos dejando solo:
  - Usuarios
  - Puntos de Atención
  - Jornadas (marcaciones de horarios de trabajo)
  Además mantiene tablas de configuración como Moneda (sin borrar datos por seguridad).

  Ejecución:
    DRY RUN (solo muestra qué borrará):
      tsx scripts/clean-operational-data.ts

    Ejecutar realmente (requerido uno de los dos):
      tsx scripts/clean-operational-data.ts --yes
      FORCE_CLEAN=yes tsx scripts/clean-operational-data.ts
*/

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function wantToProceed(): boolean {
  const argsYes = process.argv.includes("--yes") || process.argv.includes("-y");
  const envYes =
    process.env.FORCE_CLEAN === "yes" || process.env.FORCE_CLEAN === "true";
  return argsYes || envYes;
}

async function main() {
  const proceed = wantToProceed();

  const steps: { label: string; action: () => Promise<number> }[] = [
    // Cuadres
    {
      label: "DetalleCuadreCaja",
      action: async () => (await prisma.detalleCuadreCaja.deleteMany({})).count,
    },
    {
      label: "CuadreCaja",
      action: async () => (await prisma.cuadreCaja.deleteMany({})).count,
    },

    // Recibos y movimientos
    {
      label: "Recibo",
      action: async () => (await prisma.recibo.deleteMany({})).count,
    },
    {
      label: "MovimientoSaldo",
      action: async () => (await prisma.movimientoSaldo.deleteMany({})).count,
    },
    {
      label: "HistorialSaldo",
      action: async () => (await prisma.historialSaldo.deleteMany({})).count,
    },
    {
      label: "Movimiento",
      action: async () => (await prisma.movimiento.deleteMany({})).count,
    },

    // Operaciones principales
    {
      label: "CambioDivisa",
      action: async () => (await prisma.cambioDivisa.deleteMany({})).count,
    },
    {
      label: "Transferencia",
      action: async () => (await prisma.transferencia.deleteMany({})).count,
    },

    // Saldos
    {
      label: "SolicitudSaldo",
      action: async () => (await prisma.solicitudSaldo.deleteMany({})).count,
    },
    {
      label: "SaldoInicial",
      action: async () => (await prisma.saldoInicial.deleteMany({})).count,
    },
    {
      label: "Saldo",
      action: async () => (await prisma.saldo.deleteMany({})).count,
    },

    // Jornadas se conservan (NO borrar)

    // Otras operativas
    {
      label: "SalidaEspontanea",
      action: async () => (await prisma.salidaEspontanea.deleteMany({})).count,
    },
    {
      label: "HistorialAsignacionPunto",
      action: async () =>
        (await prisma.historialAsignacionPunto.deleteMany({})).count,
    },
    {
      label: "CierreDiario",
      action: async () => (await prisma.cierreDiario.deleteMany({})).count,
    },
    {
      label: "ServicioExternoMovimiento",
      action: async () =>
        (await prisma.servicioExternoMovimiento.deleteMany({})).count,
    },

    // Servientrega primero dependientes
    {
      label: "ServientregaGuia",
      action: async () => (await prisma.servientregaGuia.deleteMany({})).count,
    },
    {
      label: "ServientregaSolicitudAnulacion",
      action: async () =>
        (await prisma.servientregaSolicitudAnulacion.deleteMany({})).count,
    },
    {
      label: "ServientregaSaldo",
      action: async () => (await prisma.servientregaSaldo.deleteMany({})).count,
    },
    {
      label: "ServientregaHistorialSaldo",
      action: async () =>
        (await prisma.servientregaHistorialSaldo.deleteMany({})).count,
    },
    {
      label: "ServientregaSolicitudSaldo",
      action: async () =>
        (await prisma.servientregaSolicitudSaldo.deleteMany({})).count,
    },
    {
      label: "ServientregaRemitente",
      action: async () =>
        (await prisma.servientregaRemitente.deleteMany({})).count,
    },
    {
      label: "ServientregaDestinatario",
      action: async () =>
        (await prisma.servientregaDestinatario.deleteMany({})).count,
    },

    // Permisos
    {
      label: "Permiso",
      action: async () => (await prisma.permiso.deleteMany({})).count,
    },
  ];

  console.log("\n=== Limpieza de datos operativos ===");
  console.log("Se conservarán: Usuario, PuntoAtencion, Jornada y Moneda.");
  if (!proceed) {
    console.log(
      "\nDRY RUN: no se borrará nada. Use --yes o FORCE_CLEAN=yes para ejecutar.\n"
    );
  }

  let total = 0;

  for (const step of steps) {
    try {
      if (proceed) {
        const count = await step.action();
        total += count;
        console.log(`- ${step.label}: eliminados ${count} registro(s)`);
      } else {
        // En DRY RUN, mostramos cuántos hay actualmente
        const label = step.label as keyof PrismaClient;
        // Conteo usando mapeo manual porque no podemos indexar dinámicamente el cliente typed
        let count = 0;
        switch (step.label) {
          case "DetalleCuadreCaja":
            count = await prisma.detalleCuadreCaja.count();
            break;
          case "CuadreCaja":
            count = await prisma.cuadreCaja.count();
            break;
          case "Recibo":
            count = await prisma.recibo.count();
            break;
          case "MovimientoSaldo":
            count = await prisma.movimientoSaldo.count();
            break;
          case "HistorialSaldo":
            count = await prisma.historialSaldo.count();
            break;
          case "Movimiento":
            count = await prisma.movimiento.count();
            break;
          case "CambioDivisa":
            count = await prisma.cambioDivisa.count();
            break;
          case "Transferencia":
            count = await prisma.transferencia.count();
            break;
          case "SolicitudSaldo":
            count = await prisma.solicitudSaldo.count();
            break;
          case "SaldoInicial":
            count = await prisma.saldoInicial.count();
            break;
          case "Saldo":
            count = await prisma.saldo.count();
            break;
          case "SalidaEspontanea":
            count = await prisma.salidaEspontanea.count();
            break;
          case "HistorialAsignacionPunto":
            count = await prisma.historialAsignacionPunto.count();
            break;
          case "CierreDiario":
            count = await prisma.cierreDiario.count();
            break;
          case "ServicioExternoMovimiento":
            count = await prisma.servicioExternoMovimiento.count();
            break;
          case "ServientregaGuia":
            count = await prisma.servientregaGuia.count();
            break;
          case "ServientregaSolicitudAnulacion":
            count = await prisma.servientregaSolicitudAnulacion.count();
            break;
          case "ServientregaSaldo":
            count = await prisma.servientregaSaldo.count();
            break;
          case "ServientregaHistorialSaldo":
            count = await prisma.servientregaHistorialSaldo.count();
            break;
          case "ServientregaSolicitudSaldo":
            count = await prisma.servientregaSolicitudSaldo.count();
            break;
          case "ServientregaRemitente":
            count = await prisma.servientregaRemitente.count();
            break;
          case "ServientregaDestinatario":
            count = await prisma.servientregaDestinatario.count();
            break;
          case "Permiso":
            count = await prisma.permiso.count();
            break;
          default:
            count = 0;
        }
        console.log(`- ${step.label}: ${count} registro(s) serían eliminados`);
      }
    } catch (err: any) {
      console.error(`! Error en ${step.label}:`, err?.message || err);
    }
  }

  if (proceed) {
    console.log(`\nHecho. Total aproximado de registros eliminados: ${total}.`);
  } else {
    console.log("\nNada eliminado. Agrega --yes para ejecutar.");
  }
}

main()
  .catch((e) => {
    console.error("Error ejecutando limpieza:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
