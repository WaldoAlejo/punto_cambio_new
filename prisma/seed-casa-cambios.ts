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
  console.log("🧹 Iniciando limpieza completa de la base de datos...");

  // Eliminar todos los datos existentes en orden correcto (por dependencias)
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
  await safeDelete("Saldos Iniciales", () => prisma.saldoInicial.deleteMany());
  await safeDelete("Salidas Espontáneas", () =>
    prisma.salidaEspontanea.deleteMany()
  );
  await safeDelete("Jornadas", () => prisma.jornada.deleteMany());
  await safeDelete("Historial Asignación Puntos", () =>
    prisma.historialAsignacionPunto.deleteMany()
  );
  await safeDelete("Usuarios", () => prisma.usuario.deleteMany());
  await safeDelete("Monedas", () => prisma.moneda.deleteMany());
  await safeDelete("Puntos de Atención", () =>
    prisma.puntoAtencion.deleteMany()
  );

  console.log("🏗️  Creando nueva estructura de datos...");

  // 1. Crear Puntos de Atención
  const puntoPrincipal = await prisma.puntoAtencion.upsert({
    where: { nombre: "Casa de Cambios Principal" },
    update: {},
    create: {
      nombre: "Casa de Cambios Principal",
      direccion: "Rabida y Juan Leon Mera",
      ciudad: "Quito",
      provincia: "Pichincha",
      telefono: "0999999999",
      codigo_postal: "170101",
      activo: true,
      es_principal: true,
    },
  });
  console.log("✅ Punto principal creado");

  const puntoAmazonas = await prisma.puntoAtencion.upsert({
    where: { nombre: "amazonas1" },
    update: {},
    create: {
      nombre: "amazonas1",
      direccion: "Av. Amazonas y República",
      ciudad: "Quito",
      provincia: "Pichincha",
      telefono: "0998888888",
      codigo_postal: "170102",
      activo: true,
      es_principal: false,
    },
  });
  console.log("✅ Punto amazonas1 creado");

  const puntoNorte = await prisma.puntoAtencion.upsert({
    where: { nombre: "Casa de Cambios Norte" },
    update: {},
    create: {
      nombre: "Casa de Cambios Norte",
      direccion: "Av. 6 de Diciembre y Eloy Alfaro",
      ciudad: "Quito",
      provincia: "Pichincha",
      telefono: "0987654321",
      codigo_postal: "170135",
      activo: true,
      es_principal: false,
    },
  });
  console.log("✅ Punto Norte creado");

  // 2. Crear todas las monedas para casa de cambios
  const monedas = [
    // Monedas principales
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
    { nombre: "Franco Suizo", simbolo: "CHF", codigo: "CHF", orden_display: 4 },
    {
      nombre: "Dólar Canadiense",
      simbolo: "C$",
      codigo: "CAD",
      orden_display: 5,
    },

    // Monedas asiáticas
    { nombre: "Yen Japonés", simbolo: "¥", codigo: "JPY", orden_display: 6 },
    { nombre: "Yuan Chino", simbolo: "¥", codigo: "CNY", orden_display: 7 },
    {
      nombre: "Dólar Australiano",
      simbolo: "A$",
      codigo: "AUD",
      orden_display: 8,
    },

    // Monedas latinoamericanas
    {
      nombre: "Peso Colombiano",
      simbolo: "$",
      codigo: "COP",
      orden_display: 9,
    },
    { nombre: "Sol Peruano", simbolo: "S/", codigo: "PEN", orden_display: 10 },
    {
      nombre: "Real Brasileño",
      simbolo: "R$",
      codigo: "BRL",
      orden_display: 11,
    },
    {
      nombre: "Peso Argentino",
      simbolo: "$",
      codigo: "ARS",
      orden_display: 12,
    },
    { nombre: "Peso Chileno", simbolo: "$", codigo: "CLP", orden_display: 13 },
    { nombre: "Peso Mexicano", simbolo: "$", codigo: "MXN", orden_display: 14 },
    {
      nombre: "Bolívar Venezolano",
      simbolo: "Bs",
      codigo: "VES",
      orden_display: 15,
    },

    // Otras monedas importantes
    { nombre: "Corona Sueca", simbolo: "kr", codigo: "SEK", orden_display: 16 },
    {
      nombre: "Corona Noruega",
      simbolo: "kr",
      codigo: "NOK",
      orden_display: 17,
    },
    {
      nombre: "Corona Danesa",
      simbolo: "kr",
      codigo: "DKK",
      orden_display: 18,
    },
    { nombre: "Zloty Polaco", simbolo: "zł", codigo: "PLN", orden_display: 19 },
    { nombre: "Rublo Ruso", simbolo: "₽", codigo: "RUB", orden_display: 20 },
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

  // 3. Crear usuarios
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPassword,
      rol: "ADMIN",
      nombre: "Administrador Principal",
      correo: "admin@casadecambios.com",
      telefono: "0999999999",
      punto_atencion_id: puntoPrincipal.id,
      activo: true,
    },
  });
  console.log("✅ Usuario administrador creado");

  // Usuario operador para amazonas1
  const operadorAmazonas = await prisma.usuario.upsert({
    where: { username: "operador1" },
    update: {},
    create: {
      username: "operador1",
      password: await bcrypt.hash("operador123", 10),
      rol: "OPERADOR",
      nombre: "Operador Amazonas",
      correo: "operador@amazonas1.com",
      telefono: "0987654321",
      punto_atencion_id: puntoAmazonas.id,
      activo: true,
    },
  });
  console.log("✅ Usuario operador amazonas1 creado");

  // Usuario operador general (sin punto asignado)
  const operadorGeneral = await prisma.usuario.upsert({
    where: { username: "operador" },
    update: {},
    create: {
      username: "operador",
      password: await bcrypt.hash("operador123", 10),
      rol: "OPERADOR",
      nombre: "Operador General",
      correo: "operador@casadecambios.com",
      telefono: "0988888888",
      activo: true,
    },
  });
  console.log("✅ Usuario operador general creado");

  // 4. Crear saldos iniciales para todos los puntos
  const puntos = [puntoPrincipal, puntoAmazonas, puntoNorte];

  for (const punto of puntos) {
    console.log(`💰 Creando saldos para ${punto.nombre}...`);
    for (const moneda of monedasCreadas) {
      // Saldo inicial mayor para USD (moneda base en Ecuador)
      const montoInicial = moneda.codigo === "USD" ? 50000 : 10000;

      // Verificar si ya existe el saldo
      const saldoExistente = await prisma.saldo.findFirst({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
        },
      });

      if (!saldoExistente) {
        // Crear saldo inicial
        await prisma.saldoInicial.create({
          data: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            cantidad_inicial: montoInicial,
            asignado_por: admin.id,
            observaciones: `Asignación inicial para ${moneda.nombre} - ${punto.nombre}`,
            activo: true,
          },
        });

        // Crear saldo actual
        await prisma.saldo.create({
          data: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            cantidad: montoInicial,
            billetes: montoInicial,
            monedas_fisicas: 0,
          },
        });

        // Crear historial del saldo inicial
        await prisma.historialSaldo.create({
          data: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            usuario_id: admin.id,
            cantidad_anterior: 0,
            cantidad_incrementada: montoInicial,
            cantidad_nueva: montoInicial,
            tipo_movimiento: "INGRESO",
            descripcion: `Saldo inicial para ${moneda.nombre} - ${punto.nombre}`,
            numero_referencia: `INIT-${punto.nombre.replace(/\s+/g, "")}-${
              moneda.codigo
            }`,
          },
        });
      }
    }
  }
  console.log("✅ Saldos iniciales creados para todos los puntos");

  console.log("\n🎉 ¡Seed completo ejecutado exitosamente!");
  console.log("\n📊 Resumen de datos creados:");
  console.log(`   • 3 Puntos de atención:`);
  console.log(`     - ${puntoPrincipal.nombre} (Principal)`);
  console.log(`     - ${puntoAmazonas.nombre}`);
  console.log(`     - ${puntoNorte.nombre}`);
  console.log(`   • ${monedasCreadas.length} Monedas configuradas`);
  console.log(`   • 3 Usuarios de prueba:`);
  console.log(`     - admin (ADMIN)`);
  console.log(`     - operador1 (OPERADOR - amazonas1)`);
  console.log(`     - operador (OPERADOR - general)`);
  console.log(`   • ${puntos.length * monedasCreadas.length} Saldos iniciales`);

  console.log("\n🔑 Credenciales de acceso:");
  console.log("   👤 ADMIN:");
  console.log("      • Usuario: admin");
  console.log("      • Contraseña: admin123");
  console.log("   👤 OPERADOR (amazonas1):");
  console.log("      • Usuario: operador1");
  console.log("      • Contraseña: operador123");
  console.log("   👤 OPERADOR (general):");
  console.log("      • Usuario: operador");
  console.log("      • Contraseña: operador123");

  console.log("\n🏢 Puntos de atención disponibles:");
  console.log(
    `   • Principal: ${puntoPrincipal.direccion}, ${puntoPrincipal.ciudad}`
  );
  console.log(
    `   • Amazonas: ${puntoAmazonas.direccion}, ${puntoAmazonas.ciudad}`
  );
  console.log(`   • Norte: ${puntoNorte.direccion}, ${puntoNorte.ciudad}`);
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
