import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Función para eliminar datos de forma segura
async function safeDelete(nombre: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`✅ ${nombre} eliminados correctamente`);
  } catch (error: any) {
    if (error.code === "P2021") {
      console.log(`ℹ️  ${nombre}: tabla no existe, continuando...`);
    } else {
      console.log(`⚠️  Error eliminando ${nombre}:`, error.message);
    }
  }
}

async function main() {
  console.log("🧹 Iniciando limpieza y configuración básica para pruebas...");

  // Eliminar datos existentes en orden correcto
  await safeDelete("Cierres Diarios", () => prisma.cierreDiario.deleteMany());
  await safeDelete("Recibos", () => prisma.recibo.deleteMany());
  await safeDelete("Transferencias", () => prisma.transferencia.deleteMany());
  await safeDelete("Detalles Cuadre Caja", () =>
    prisma.detalleCuadreCaja.deleteMany()
  );
  await safeDelete("Cuadres Caja", () => prisma.cuadreCaja.deleteMany());
  await safeDelete("Cambios Divisa", () => prisma.cambioDivisa.deleteMany());
  await safeDelete("Movimientos", () => prisma.movimiento.deleteMany());
  await safeDelete("Solicitudes Saldo", () =>
    prisma.solicitudSaldo.deleteMany()
  );
  await safeDelete("Historial Saldo", () => prisma.historialSaldo.deleteMany());
  await safeDelete("Saldos", () => prisma.saldo.deleteMany());
  await safeDelete("Salidas Espontáneas", () =>
    prisma.salidaEspontanea.deleteMany()
  );
  await safeDelete("Jornadas", () => prisma.jornada.deleteMany());
  await safeDelete("Historial Asignación Puntos", () =>
    prisma.historialAsignacionPunto.deleteMany()
  );
  await safeDelete("Saldos Iniciales", () => prisma.saldoInicial.deleteMany());
  await safeDelete("Movimientos Saldo", () =>
    prisma.movimientoSaldo.deleteMany()
  );
  await safeDelete("Usuarios", () => prisma.usuario.deleteMany());
  await safeDelete("Monedas", () => prisma.moneda.deleteMany());
  await safeDelete("Puntos de Atención", () =>
    prisma.puntoAtencion.deleteMany()
  );

  console.log("🏗️  Creando estructura básica para pruebas...");

  // 1. Crear Punto de Atención Principal
  const puntoPrincipal = await prisma.puntoAtencion.upsert({
    where: { nombre: "Casa de Cambios Principal" },
    update: {},
    create: {
      nombre: "Casa de Cambios Principal",
      direccion: "Rabida y Juan Leon Mera",
      ciudad: "Quito",
      provincia: "Pichincha",
      telefono: "0999999999",
      codigo_postal: "170150",
      activo: true,
      es_principal: true,
    },
  });
  console.log("✅ Punto principal creado");

  // 2. Crear monedas básicas para pruebas
  const monedasBasicas = [
    {
      nombre: "Dólar Estadounidense",
      simbolo: "$",
      codigo: "USD",
      orden_display: 1,
    },
    { nombre: "Euro", simbolo: "€", codigo: "EUR", orden_display: 2 },
    {
      nombre: "Libra Esterlina",
      simbolo: "£",
      codigo: "GBP",
      orden_display: 3,
    },
    {
      nombre: "Peso Colombiano",
      simbolo: "$",
      codigo: "COP",
      orden_display: 4,
    },
    { nombre: "Sol Peruano", simbolo: "S/", codigo: "PEN", orden_display: 5 },
  ];

  const monedasCreadas = [];
  for (const moneda of monedasBasicas) {
    const monedaCreada = await prisma.moneda.upsert({
      where: { codigo: moneda.codigo },
      update: {},
      create: moneda,
    });
    monedasCreadas.push(monedaCreada);
  }
  console.log(`✅ ${monedasCreadas.length} monedas básicas creadas`);

  // 3. Crear usuario administrador
  const hashedPasswordAdmin = await bcrypt.hash("Admin123!", 10);

  const admin = await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPasswordAdmin,
      rol: "ADMIN",
      nombre: "Administrador Principal",
      correo: "admin@casadecambios.com",
      telefono: "0999999999",
      punto_atencion_id: puntoPrincipal.id,
      activo: true,
    },
  });
  console.log("✅ Usuario administrador creado");

  // 4. Crear saldos iniciales básicos
  for (const moneda of monedasCreadas) {
    // Saldo inicial mayor para USD (moneda base en Ecuador)
    const montoInicial = moneda.codigo === "USD" ? 10000 : 5000;

    // Verificar si ya existe el saldo
    const saldoExistente = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: puntoPrincipal.id,
        moneda_id: moneda.id,
      },
    });

    if (!saldoExistente) {
      await prisma.saldo.create({
        data: {
          punto_atencion_id: puntoPrincipal.id,
          moneda_id: moneda.id,
          cantidad: montoInicial,
          billetes: montoInicial,
          monedas_fisicas: 0,
        },
      });

      // Crear historial del saldo inicial
      await prisma.historialSaldo.create({
        data: {
          punto_atencion_id: puntoPrincipal.id,
          moneda_id: moneda.id,
          usuario_id: admin.id,
          cantidad_anterior: 0,
          cantidad_incrementada: montoInicial,
          cantidad_nueva: montoInicial,
          tipo_movimiento: "INGRESO",
          descripcion: `Saldo inicial para ${moneda.nombre}`,
          numero_referencia: `INIT-${moneda.codigo}`,
        },
      });
    }
  }
  console.log("✅ Saldos iniciales básicos creados");

  // 5. Crear cuadre de caja inicial
  const cuadreExistente = await prisma.cuadreCaja.findFirst({
    where: {
      punto_atencion_id: puntoPrincipal.id,
      estado: "ABIERTO",
    },
  });

  if (!cuadreExistente) {
    const cuadreInicial = await prisma.cuadreCaja.create({
      data: {
        usuario_id: admin.id,
        punto_atencion_id: puntoPrincipal.id,
        estado: "ABIERTO",
        fecha: new Date(),
        observaciones: "Cuadre inicial del sistema para pruebas",
        total_cambios: 0,
        total_transferencias_entrada: 0,
        total_transferencias_salida: 0,
      },
    });

    // Crear detalles del cuadre para todas las monedas
    for (const moneda of monedasCreadas) {
      const montoInicial = moneda.codigo === "USD" ? 10000 : 5000;

      await prisma.detalleCuadreCaja.create({
        data: {
          cuadre_id: cuadreInicial.id,
          moneda_id: moneda.id,
          saldo_apertura: montoInicial,
          saldo_cierre: montoInicial,
          conteo_fisico: montoInicial,
          billetes: montoInicial,
          monedas_fisicas: 0,
          diferencia: 0,
        },
      });
    }
  }
  console.log("✅ Cuadre de caja inicial creado");

  console.log("\n🎉 ¡Configuración básica para pruebas completada!");
  console.log("\n📊 Resumen de datos creados:");
  console.log(`   • 1 Punto de atención: ${puntoPrincipal.nombre}`);
  console.log(`   • ${monedasCreadas.length} Monedas básicas configuradas:`);
  monedasCreadas.forEach((moneda) => {
    console.log(`     - ${moneda.nombre} (${moneda.codigo})`);
  });
  console.log(`   • 1 Usuario administrador: ${admin.username}`);
  console.log(`   • ${monedasCreadas.length} Saldos iniciales`);
  console.log(`   • 1 Cuadre de caja inicial`);

  console.log("\n🔑 Credenciales de acceso:");
  console.log("   👤 ADMINISTRADOR:");
  console.log("      • Usuario: admin");
  console.log("      • Contraseña: Admin123!");
  console.log("      • Rol: ADMIN");
  console.log("      • Punto: Casa de Cambios Principal");

  console.log("\n💰 Saldos iniciales:");
  console.log("   • USD: $10,000");
  console.log("   • EUR: €5,000");
  console.log("   • GBP: £5,000");
  console.log("   • COP: $5,000");
  console.log("   • PEN: S/5,000");

  console.log("\n✨ ¡Listo para empezar las pruebas!");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando seed básico:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
