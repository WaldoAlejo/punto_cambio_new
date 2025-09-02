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
  console.log(
    "🧹 Iniciando limpieza completa de la base de datos para PRODUCCIÓN..."
  );

  // Eliminar todos los datos existentes en orden correcto (por dependencias)
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

  console.log("🏗️  Creando estructura de datos para PRODUCCIÓN...");

  // 1. Crear SOLO el Punto de Atención Principal
  const puntoPrincipal = await prisma.puntoAtencion.upsert({
    where: { nombre: "Casa de Cambios Principal" },
    update: {},
    create: {
      nombre: "Casa de Cambios Principal",
      direccion: "Dirección Principal", // Cambiar por la dirección real
      ciudad: "Ciudad Principal", // Cambiar por la ciudad real
      provincia: "Provincia Principal", // Cambiar por la provincia real
      telefono: "0999999999", // Cambiar por el teléfono real
      codigo_postal: "000000", // Cambiar por el código postal real
      activo: true,
      es_principal: true,
    },
  });
  console.log("✅ Punto principal creado");

  // 2. Crear todas las monedas para casa de cambios
  const monedas = [
    // Monedas principales
    {
      nombre: "Dólar Estadounidense",
      simbolo: "$",
      codigo: "USD",
      orden_display: 1,
      activo: true,
    },
    {
      nombre: "Euro",
      simbolo: "€",
      codigo: "EUR",
      orden_display: 2,
      activo: true,
    },
    {
      nombre: "Libra Esterlina",
      simbolo: "£",
      codigo: "GBP",
      orden_display: 3,
      activo: true,
    },
    {
      nombre: "Franco Suizo",
      simbolo: "CHF",
      codigo: "CHF",
      orden_display: 4,
      activo: true,
    },
    {
      nombre: "Dólar Canadiense",
      simbolo: "C$",
      codigo: "CAD",
      orden_display: 5,
      activo: true,
    },

    // Monedas asiáticas
    {
      nombre: "Yen Japonés",
      simbolo: "¥",
      codigo: "JPY",
      orden_display: 6,
      activo: true,
    },
    {
      nombre: "Yuan Chino",
      simbolo: "¥",
      codigo: "CNY",
      orden_display: 7,
      activo: true,
    },
    {
      nombre: "Dólar Australiano",
      simbolo: "A$",
      codigo: "AUD",
      orden_display: 8,
      activo: true,
    },

    // Monedas latinoamericanas
    {
      nombre: "Peso Colombiano",
      simbolo: "$",
      codigo: "COP",
      orden_display: 9,
      activo: true,
    },
    {
      nombre: "Sol Peruano",
      simbolo: "S/",
      codigo: "PEN",
      orden_display: 10,
      activo: true,
    },
    {
      nombre: "Real Brasileño",
      simbolo: "R$",
      codigo: "BRL",
      orden_display: 11,
      activo: true,
    },
    {
      nombre: "Peso Argentino",
      simbolo: "$",
      codigo: "ARS",
      orden_display: 12,
      activo: true,
    },
    {
      nombre: "Peso Chileno",
      simbolo: "$",
      codigo: "CLP",
      orden_display: 13,
      activo: true,
    },
    {
      nombre: "Peso Mexicano",
      simbolo: "$",
      codigo: "MXN",
      orden_display: 14,
      activo: true,
    },
    {
      nombre: "Bolívar Venezolano",
      simbolo: "Bs",
      codigo: "VES",
      orden_display: 15,
      activo: true,
    },

    // Otras monedas importantes
    {
      nombre: "Corona Sueca",
      simbolo: "kr",
      codigo: "SEK",
      orden_display: 16,
      activo: true,
    },
    {
      nombre: "Corona Noruega",
      simbolo: "kr",
      codigo: "NOK",
      orden_display: 17,
      activo: true,
    },
    {
      nombre: "Corona Danesa",
      simbolo: "kr",
      codigo: "DKK",
      orden_display: 18,
      activo: true,
    },
    {
      nombre: "Zloty Polaco",
      simbolo: "zł",
      codigo: "PLN",
      orden_display: 19,
      activo: true,
    },
    {
      nombre: "Rublo Ruso",
      simbolo: "₽",
      codigo: "RUB",
      orden_display: 20,
      activo: true,
    },
  ];

  const monedasCreadas = [];
  for (const moneda of monedas) {
    const monedaCreada = await prisma.moneda.upsert({
      where: { codigo: moneda.codigo },
      update: {},
      create: moneda,
    });
    monedasCreadas.push(monedaCreada);
  }
  console.log(`✅ ${monedasCreadas.length} monedas creadas`);

  // 3. Crear SOLO el usuario administrador
  const hashedPasswordAdmin = await bcrypt.hash("Admin123!", 10);

  const admin = await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPasswordAdmin,
      rol: "ADMIN",
      nombre: "Administrador Principal",
      correo: "admin@casadecambios.com", // Cambiar por el correo real
      telefono: "0999999999", // Cambiar por el teléfono real
      punto_atencion_id: puntoPrincipal.id,
      activo: true,
    },
  });
  console.log("✅ Usuario administrador creado");

  console.log("\n🎉 ¡Seed de PRODUCCIÓN ejecutado exitosamente!");
  console.log("\n📊 Resumen de datos creados:");
  console.log("   • 1 Punto de atención principal");
  console.log("   • 20 Monedas configuradas");
  console.log("   • 1 Usuario administrador");
  console.log("\n🔑 Credenciales de acceso:");
  console.log("   👤 ADMIN:");
  console.log("      • Usuario: admin");
  console.log("      • Contraseña: Admin123!");
  console.log("\n⚠️  IMPORTANTE:");
  console.log("   • Cambie las credenciales por defecto");
  console.log("   • Configure la información real del punto de atención");
  console.log(
    "   • Los saldos se asignarán desde la interfaz de administración"
  );
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando seed de producción:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
