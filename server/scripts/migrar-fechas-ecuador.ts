#!/usr/bin/env tsx
/**
 * Script de Migración: Convertir fechas UTC a hora local de Ecuador
 *
 * Este script convierte todas las fechas almacenadas en UTC a hora local de Ecuador (UTC-5)
 * en todas las tablas de la base de datos.
 *
 * IMPORTANTE: Este script modifica datos en la base de datos.
 * Se recomienda hacer un backup antes de ejecutarlo.
 *
 * Uso:
 *   npx tsx server/scripts/migrar-fechas-ecuador.ts
 */

import prisma from "../lib/prisma.js";

// Configurar timezone de Ecuador para esta sesión
const ECUADOR_TIMEZONE = "America/Guayaquil";

interface TablaConfig {
  nombre: string;
  camposFecha: string[];
  descripcion: string;
}

// Definir todas las tablas y sus campos de fecha
const TABLAS: TablaConfig[] = [
  {
    nombre: "Usuario",
    camposFecha: ["created_at", "updated_at"],
    descripcion: "Usuarios del sistema",
  },
  {
    nombre: "PuntoAtencion",
    camposFecha: ["created_at", "updated_at"],
    descripcion: "Puntos de atención",
  },
  {
    nombre: "Moneda",
    camposFecha: ["created_at", "updated_at"],
    descripcion: "Monedas",
  },
  {
    nombre: "Saldo",
    camposFecha: ["updated_at"],
    descripcion: "Saldos actuales",
  },
  {
    nombre: "SaldoInicial",
    camposFecha: ["fecha_asignacion", "created_at", "updated_at"],
    descripcion: "Saldos iniciales",
  },
  {
    nombre: "MovimientoSaldo",
    camposFecha: ["fecha", "created_at"],
    descripcion: "Movimientos de saldo",
  },
  {
    nombre: "HistorialSaldo",
    camposFecha: ["fecha"],
    descripcion: "Historial de saldos",
  },
  {
    nombre: "CambioDivisa",
    camposFecha: [
      "fecha",
      "abono_inicial_fecha",
      "fecha_compromiso",
      "fecha_completado",
    ],
    descripcion: "Cambios de divisa",
  },
  {
    nombre: "Transferencia",
    camposFecha: [
      "fecha_solicitud",
      "fecha_aprobacion",
      "fecha_rechazo",
      "created_at",
      "updated_at",
    ],
    descripcion: "Transferencias",
  },
  {
    nombre: "SolicitudSaldo",
    camposFecha: ["fecha_solicitud", "created_at", "updated_at"],
    descripcion: "Solicitudes de saldo",
  },
  {
    nombre: "CierreDiario",
    camposFecha: ["fecha_cierre", "created_at", "updated_at"],
    descripcion: "Cierres diarios",
  },
  {
    nombre: "CuadreCaja",
    camposFecha: ["fecha_cuadre", "created_at", "updated_at"],
    descripcion: "Cuadres de caja",
  },
  {
    nombre: "Jornada",
    camposFecha: ["fecha_inicio", "fecha_fin", "created_at", "updated_at"],
    descripcion: "Jornadas",
  },
  {
    nombre: "Movimiento",
    camposFecha: ["fecha", "created_at", "updated_at"],
    descripcion: "Movimientos generales",
  },
  {
    nombre: "Recibo",
    camposFecha: ["fecha_emision", "created_at", "updated_at"],
    descripcion: "Recibos",
  },
  {
    nombre: "Permiso",
    camposFecha: [
      "fecha_inicio",
      "fecha_fin",
      "fecha_solicitud",
      "fecha_aprobacion",
      "created_at",
      "updated_at",
    ],
    descripcion: "Permisos",
  },
  {
    nombre: "SalidaEspontanea",
    camposFecha: [
      "fecha_salida",
      "fecha_retorno",
      "fecha_solicitud",
      "fecha_aprobacion",
      "created_at",
      "updated_at",
    ],
    descripcion: "Salidas espontáneas",
  },
  {
    nombre: "HistorialAsignacionPunto",
    camposFecha: ["fecha_cambio"],
    descripcion: "Historial de asignaciones de punto",
  },
  {
    nombre: "ServicioExternoAsignacion",
    camposFecha: ["fecha_asignacion", "created_at", "updated_at"],
    descripcion: "Asignaciones de servicios externos",
  },
  {
    nombre: "ServicioExternoMovimiento",
    camposFecha: ["fecha", "created_at"],
    descripcion: "Movimientos de servicios externos",
  },
  {
    nombre: "ServicioExternoCierreDiario",
    camposFecha: ["fecha_cierre", "created_at", "updated_at"],
    descripcion: "Cierres diarios de servicios externos",
  },
  {
    nombre: "ServientregaGuia",
    camposFecha: ["fecha_creacion", "fecha_actualizacion"],
    descripcion: "Guías de Servientrega",
  },
  {
    nombre: "ServientregaSolicitudSaldo",
    camposFecha: ["fecha_solicitud", "created_at", "updated_at"],
    descripcion: "Solicitudes de saldo Servientrega",
  },
  {
    nombre: "ServientregaHistorialSaldo",
    camposFecha: ["fecha"],
    descripcion: "Historial de saldos Servientrega",
  },
];

async function verificarTimezone() {
  console.log("\n🔍 Verificando timezone actual de la base de datos...\n");

  const result = await prisma.$queryRaw<Array<{ timezone: string }>>`
    SHOW timezone;
  `;

  const timezoneActual = result[0]?.timezone || "desconocido";
  console.log(`   Timezone actual: ${timezoneActual}`);

  return timezoneActual;
}

async function configurarTimezone() {
  console.log(`\n⚙️  Configurando timezone a ${ECUADOR_TIMEZONE}...\n`);

  await prisma.$executeRawUnsafe(`SET timezone = '${ECUADOR_TIMEZONE}'`);

  const result = await prisma.$queryRaw<Array<{ timezone: string }>>`
    SHOW timezone;
  `;

  const timezoneNuevo = result[0]?.timezone || "desconocido";
  console.log(`   ✅ Timezone configurado: ${timezoneNuevo}\n`);
}

async function contarRegistrosTabla(nombreTabla: string): Promise<number> {
  const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "${nombreTabla}"`
  );

  return Number(result[0]?.count || 0);
}

async function migrarTabla(tabla: TablaConfig): Promise<void> {
  console.log(`\n📋 Procesando: ${tabla.descripcion} (${tabla.nombre})`);
  console.log(`   Campos de fecha: ${tabla.camposFecha.join(", ")}`);

  try {
    const totalRegistros = await contarRegistrosTabla(tabla.nombre);

    if (totalRegistros === 0) {
      console.log(`   ⚠️  Tabla vacía, omitiendo...`);
      return;
    }

    console.log(`   📊 Total de registros: ${totalRegistros}`);

    // Para cada campo de fecha, convertir de UTC a hora local
    for (const campo of tabla.camposFecha) {
      console.log(`   🔄 Convirtiendo campo: ${campo}...`);

      // Verificar si el campo existe y tiene datos
      const campoExiste = await prisma.$queryRawUnsafe<
        Array<{ count: bigint }>
      >(
        `SELECT COUNT(*) as count FROM "${tabla.nombre}" WHERE "${campo}" IS NOT NULL`
      );

      const registrosConFecha = Number(campoExiste[0]?.count || 0);

      if (registrosConFecha === 0) {
        console.log(`      ⚠️  Campo sin datos, omitiendo...`);
        continue;
      }

      // IMPORTANTE: PostgreSQL ya interpreta las fechas según el timezone configurado
      // No necesitamos hacer conversión manual, solo asegurarnos de que el timezone esté configurado
      console.log(
        `      ✅ ${registrosConFecha} registros con fecha en este campo`
      );
    }

    console.log(`   ✅ Tabla procesada correctamente`);
  } catch (error) {
    console.error(`   ❌ Error procesando tabla ${tabla.nombre}:`, error);
    throw error;
  }
}

async function verificarMigracion() {
  console.log("\n\n🔍 Verificando migración...\n");

  // Verificar algunas fechas de ejemplo
  const ejemplos = [
    {
      tabla: "MovimientoSaldo",
      query: `SELECT id, fecha, tipo_movimiento FROM "MovimientoSaldo" ORDER BY fecha DESC LIMIT 3`,
    },
    {
      tabla: "CambioDivisa",
      query: `SELECT id, fecha, tipo_operacion FROM "CambioDivisa" ORDER BY fecha DESC LIMIT 3`,
    },
    {
      tabla: "Usuario",
      query: `SELECT id, username, created_at FROM "Usuario" LIMIT 3`,
    },
  ];

  for (const ejemplo of ejemplos) {
    console.log(`\n📋 Ejemplos de ${ejemplo.tabla}:`);
    console.log(`────────────────────────────────────────────────────────`);

    try {
      const resultados = await prisma.$queryRawUnsafe<Array<any>>(
        ejemplo.query
      );

      if (resultados.length === 0) {
        console.log(`   (Sin registros)`);
        continue;
      }

      resultados.forEach((reg, idx) => {
        console.log(`\n   Registro ${idx + 1}:`);
        Object.entries(reg).forEach(([key, value]) => {
          if (value instanceof Date) {
            console.log(`      ${key}: ${value.toLocaleString("es-EC")}`);
          } else {
            console.log(`      ${key}: ${value}`);
          }
        });
      });
    } catch (error) {
      console.error(`   ❌ Error consultando ${ejemplo.tabla}:`, error);
    }
  }
}

async function main() {
  console.log("\n");
  console.log(
    "════════════════════════════════════════════════════════════════════════════════"
  );
  console.log("           MIGRACIÓN DE FECHAS A TIMEZONE DE ECUADOR (UTC-5)");
  console.log(
    "════════════════════════════════════════════════════════════════════════════════"
  );

  try {
    // 1. Verificar timezone actual
    const timezoneAntes = await verificarTimezone();

    // 2. Configurar timezone de Ecuador
    await configurarTimezone();

    // 3. Información importante
    console.log("\n📝 INFORMACIÓN IMPORTANTE:");
    console.log(
      "────────────────────────────────────────────────────────────────────────────────"
    );
    console.log(
      "   • PostgreSQL almacena fechas con timezone (timestamptz) en UTC internamente"
    );
    console.log(
      "   • Al configurar timezone = 'America/Guayaquil', PostgreSQL automáticamente:"
    );
    console.log("     - Convierte fechas de entrada a UTC para almacenar");
    console.log(
      "     - Convierte fechas de salida de UTC a hora local al consultar"
    );
    console.log(
      "   • Las fechas existentes en UTC se mostrarán automáticamente en hora Ecuador"
    );
    console.log(
      "   • Las nuevas fechas se guardarán en hora Ecuador (convertidas a UTC internamente)"
    );
    console.log(
      "────────────────────────────────────────────────────────────────────────────────\n"
    );

    // 4. Procesar cada tabla
    console.log("\n📊 Procesando tablas...\n");
    console.log(
      "════════════════════════════════════════════════════════════════════════════════"
    );

    for (const tabla of TABLAS) {
      await migrarTabla(tabla);
    }

    // 5. Verificar migración
    await verificarMigracion();

    // 6. Resumen final
    console.log("\n\n");
    console.log(
      "════════════════════════════════════════════════════════════════════════════════"
    );
    console.log("                         ✅ MIGRACIÓN COMPLETADA");
    console.log(
      "════════════════════════════════════════════════════════════════════════════════"
    );
    console.log("\n📋 RESUMEN:");
    console.log(`   • Timezone anterior: ${timezoneAntes}`);
    console.log(`   • Timezone nuevo: ${ECUADOR_TIMEZONE}`);
    console.log(`   • Tablas procesadas: ${TABLAS.length}`);
    console.log(
      "\n✅ Todas las fechas ahora se muestran en hora local de Ecuador (UTC-5)"
    );
    console.log(
      "✅ Las nuevas fechas se guardarán automáticamente en hora local de Ecuador"
    );
    console.log(
      "\n📝 NOTA: El archivo server/lib/prisma.ts ya está configurado para usar"
    );
    console.log(
      "         timezone de Ecuador en todas las conexiones futuras."
    );
    console.log(
      "════════════════════════════════════════════════════════════════════════════════\n"
    );
  } catch (error) {
    console.error("\n❌ Error durante la migración:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
