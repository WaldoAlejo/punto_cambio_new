import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Función para eliminar datos de forma segura
async function safeDelete(nombre: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`✅ ${nombre} eliminados correctamente`);
  } catch (error: any) {
    if (error.code === 'P2021') {
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
  await safeDelete("Detalles Cuadre Caja", () => prisma.detalleCuadreCaja.deleteMany());
  await safeDelete("Cuadres Caja", () => prisma.cuadreCaja.deleteMany());
  await safeDelete("Cambios Divisa", () => prisma.cambioDivisa.deleteMany());
  await safeDelete("Movimientos", () => prisma.movimiento.deleteMany());
  await safeDelete("Solicitudes Saldo", () => prisma.solicitudSaldo.deleteMany());
  await safeDelete("Historial Saldo", () => prisma.historialSaldo.deleteMany());
  await safeDelete("Saldos", () => prisma.saldo.deleteMany());
  await safeDelete("Saldos Iniciales", () => prisma.saldoInicial.deleteMany());
  await safeDelete("Salidas Espontáneas", () => prisma.salidaEspontanea.deleteMany());
  await safeDelete("Jornadas", () => prisma.jornada.deleteMany());
  await safeDelete("Historial Asignación Puntos", () => prisma.historialAsignacionPunto.deleteMany());
  await safeDelete("Usuarios", () => prisma.usuario.deleteMany());
  await safeDelete("Monedas", () => prisma.moneda.deleteMany());
  await safeDelete("Puntos de Atención", () => prisma.puntoAtencion.deleteMany());

  console.log("🏗️  Creando nueva estructura de datos...");

  // 1. Crear Puntos de Atención
  const puntoPrincipal = await prisma.puntoAtencion.create({
    data: {
      nombre: "Casa de Cambios Principal",
      direccion: "Rabida y Juan Leon Mera",
      ciudad: "Quito",
      provincia: "Pichincha",
      telefono: "0999999999",
      codigo_postal: "170101",
      activo: true,
    },
  });
  console.log("✅ Punto principal creado");

  const puntoAmazonas = await prisma.puntoAtencion.create({
    data: {
      nombre: "amazonas1",
      direccion: "Av. Amazonas y República",
      ciudad: "Quito",
      provincia: "Pichincha",
      telefono: "0998888888",
      codigo_postal: "170102",
      activo: true,
    },
  });
  console.log("✅ Punto amazonas1 creado");

  // 2. Crear todas las monedas para casa de cambios
  const monedas = [
    // Monedas principales
    { nombre: "Dólar Estadounidense", simbolo: "$", codigo: "USD", orden_display: 1 },
    { nombre: "Euro", simbolo: "€", codigo: "EUR", orden_display: 2 },
    { nombre: "Libra Esterlina", simbolo: "£", codigo: "GBP", orden_display: 3 },
    { nombre: "Franco Suizo", simbolo: "CHF", codigo: "CHF", orden_display: 4 },
    { nombre: "Dólar Canadiense", simbolo: "C$", codigo: "CAD", orden_display: 5 },
    
    // Monedas asiáticas
    { nombre: "Yen Japonés", simbolo: "¥", codigo: "JPY", orden_display: 6 },
    { nombre: "Yuan Chino", simbolo: "¥", codigo: "CNY", orden_display: 7 },
    { nombre: "Dólar Australiano", simbolo: "A$", codigo: "AUD", orden_display: 8 },
    
    // Monedas latinoamericanas
    { nombre: "Peso Colombiano", simbolo: "$", codigo: "COP", orden_display: 9 },
    { nombre: "Sol Peruano", simbolo: "S/", codigo: "PEN", orden_display: 10 },
    { nombre: "Real Brasileño", simbolo: "R$", codigo: "BRL", orden_display: 11 },
    { nombre: "Peso Argentino", simbolo: "$", codigo: "ARS", orden_display: 12 },
    { nombre: "Peso Chileno", simbolo: "$", codigo: "CLP", orden_display: 13 },
    { nombre: "Peso Mexicano", simbolo: "$", codigo: "MXN", orden_display: 14 },
    { nombre: "Bolívar Venezolano", simbolo: "Bs", codigo: "VES", orden_display: 15 },
    
    // Otras monedas importantes
    { nombre: "Corona Sueca", simbolo: "kr", codigo: "SEK", orden_display: 16 },
    { nombre: "Corona Noruega", simbolo: "kr", codigo: "NOK", orden_display: 17 },
    { nombre: "Corona Danesa", simbolo: "kr", codigo: "DKK", orden_display: 18 },
    { nombre: "Zloty Polaco", simbolo: "zł", codigo: "PLN", orden_display: 19 },
    { nombre: "Rublo Ruso", simbolo: "₽", codigo: "RUB", orden_display: 20 },
  ];

  const monedasCreadas = [];
  for (const moneda of monedas) {
    const monedaCreada = await prisma.moneda.create({ data: moneda });
    monedasCreadas.push(monedaCreada);
  }
  console.log(`✅ ${monedasCreadas.length} monedas creadas`);

  // 3. Crear usuarios
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.usuario.create({
    data: {
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
  const operadorAmazonas = await prisma.usuario.create({
    data: {
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

  // 4. Crear saldos iniciales y saldos para el punto principal (1,000,000 cada moneda)
  console.log("💰 Creando saldos iniciales para Casa de Cambios Principal (1,000,000 cada moneda)...");
  for (const moneda of monedasCreadas) {
    // Crear saldo inicial
    await prisma.saldoInicial.create({
      data: {
        punto_atencion_id: puntoPrincipal.id,
        moneda_id: moneda.id,
        cantidad_inicial: 1000000,
        asignado_por: admin.id,
        observaciones: `Asignación inicial para ${moneda.nombre} - Casa de Cambios Principal`,
        activo: true,
      },
    });

    // Crear saldo actual
    await prisma.saldo.create({
      data: {
        punto_atencion_id: puntoPrincipal.id,
        moneda_id: moneda.id,
        cantidad: 1000000,
        billetes: 1000000,
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
        cantidad_incrementada: 1000000,
        cantidad_nueva: 1000000,
        tipo_movimiento: "INGRESO",
        descripcion: `Saldo inicial para ${moneda.nombre} - Casa de Cambios Principal`,
        numero_referencia: `INIT-PRINCIPAL-${moneda.codigo}`,
      },
    });
  }
  console.log("✅ Saldos iniciales del punto principal creados");

  // 5. Crear saldos iniciales y saldos para amazonas1 (800 cada moneda)
  console.log("💰 Creando saldos iniciales para amazonas1 (800 cada moneda)...");
  for (const moneda of monedasCreadas) {
    // Crear saldo inicial
    await prisma.saldoInicial.create({
      data: {
        punto_atencion_id: puntoAmazonas.id,
        moneda_id: moneda.id,
        cantidad_inicial: 800,
        asignado_por: admin.id,
        observaciones: `Asignación inicial para ${moneda.nombre} - amazonas1`,
        activo: true,
      },
    });

    // Crear saldo actual
    await prisma.saldo.create({
      data: {
        punto_atencion_id: puntoAmazonas.id,
        moneda_id: moneda.id,
        cantidad: 800,
        billetes: 800,
        monedas_fisicas: 0,
      },
    });

    // Crear historial del saldo inicial
    await prisma.historialSaldo.create({
      data: {
        punto_atencion_id: puntoAmazonas.id,
        moneda_id: moneda.id,
        usuario_id: admin.id,
        cantidad_anterior: 0,
        cantidad_incrementada: 800,
        cantidad_nueva: 800,
        tipo_movimiento: "INGRESO",
        descripcion: `Saldo inicial para ${moneda.nombre} - amazonas1`,
        numero_referencia: `INIT-AMAZONAS-${moneda.codigo}`,
      },
    });
  }
  console.log("✅ Saldos iniciales de amazonas1 creados");

  // 6. Crear cuadres de caja iniciales
  const cuadrePrincipal = await prisma.cuadreCaja.create({
    data: {
      usuario_id: admin.id,
      punto_atencion_id: puntoPrincipal.id,
      estado: "ABIERTO",
      fecha: new Date(),
      observaciones: "Cuadre inicial - Casa de Cambios Principal",
      total_cambios: 0,
      total_transferencias_entrada: 0,
      total_transferencias_salida: 0,
    },
  });

  const cuadreAmazonas = await prisma.cuadreCaja.create({
    data: {
      usuario_id: operadorAmazonas.id,
      punto_atencion_id: puntoAmazonas.id,
      estado: "ABIERTO",
      fecha: new Date(),
      observaciones: "Cuadre inicial - amazonas1",
      total_cambios: 0,
      total_transferencias_entrada: 0,
      total_transferencias_salida: 0,
    },
  });

  // Crear detalles del cuadre para punto principal
  for (const moneda of monedasCreadas) {
    await prisma.detalleCuadreCaja.create({
      data: {
        cuadre_id: cuadrePrincipal.id,
        moneda_id: moneda.id,
        saldo_apertura: 1000000,
        saldo_cierre: 1000000,
        conteo_fisico: 1000000,
        billetes: 1000000,
        monedas_fisicas: 0,
        diferencia: 0,
      },
    });
  }

  // Crear detalles del cuadre para amazonas1
  for (const moneda of monedasCreadas) {
    await prisma.detalleCuadreCaja.create({
      data: {
        cuadre_id: cuadreAmazonas.id,
        moneda_id: moneda.id,
        saldo_apertura: 800,
        saldo_cierre: 800,
        conteo_fisico: 800,
        billetes: 800,
        monedas_fisicas: 0,
        diferencia: 0,
      },
    });
  }
  console.log("✅ Cuadres de caja iniciales creados");

  console.log("\n🎉 ¡Seed completo ejecutado exitosamente!");
  console.log("\n📊 Resumen de datos creados:");
  console.log(`   • 2 Puntos de atención:`);
  console.log(`     - ${puntoPrincipal.nombre} (1,000,000 por moneda)`);
  console.log(`     - ${puntoAmazonas.nombre} (800 por moneda)`);
  console.log(`   • ${monedasCreadas.length} Monedas configuradas`);
  console.log(`   • 2 Usuarios: admin (ADMIN), operador1 (OPERADOR)`);
  console.log(`   • ${monedasCreadas.length * 2} Saldos iniciales`);
  console.log(`   • 2 Cuadres de caja iniciales`);
  console.log("\n🔑 Credenciales de acceso:");
  console.log("   • Admin: admin / admin123");
  console.log("   • Operador: operador1 / operador123");
  console.log("\n🏢 Puntos de atención:");
  console.log("   • Principal: Rabida y Juan Leon Mera, Quito");
  console.log("   • amazonas1: Av. Amazonas y República, Quito");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());