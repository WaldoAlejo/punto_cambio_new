
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. Crear Punto de Atención "Matriz"
  let matriz = await prisma.puntoAtencion.findFirst({
    where: { nombre: "Matriz" },
  });

  if (!matriz) {
    matriz = await prisma.puntoAtencion.create({
      data: {
        nombre: "Matriz",
        direccion: "Av. Principal y 1ra. Calle",
        ciudad: "Quito",
        provincia: "Pichincha",
        telefono: "023456789",
        codigo_postal: "170101",
      },
    });
  }

  // 2. Crear monedas
  const monedas = [
    {
      nombre: "Dólar Estadounidense",
      simbolo: "$",
      codigo: "USD",
      orden_display: 1,
    },
    { nombre: "Euro", simbolo: "€", codigo: "EUR", orden_display: 2 },
    {
      nombre: "Peso Colombiano",
      simbolo: "$",
      codigo: "COP",
      orden_display: 3,
    },
  ];

  for (const moneda of monedas) {
    const existente = await prisma.moneda.findUnique({
      where: { codigo: moneda.codigo },
    });
    if (!existente) await prisma.moneda.create({ data: moneda });
  }

  // 3. Crear usuario admin
  let admin = await prisma.usuario.findUnique({ where: { username: "admin" } });
  if (!admin) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    admin = await prisma.usuario.create({
      data: {
        username: "admin",
        password: hashedPassword,
        rol: "ADMIN",
        nombre: "Administrador General",
        correo: "admin@punto.com",
        telefono: "0987654321",
        punto_atencion_id: matriz.id,
      },
    });
  }

  // 4. Crear saldos e historial
  const monedasEnBD = await prisma.moneda.findMany();

  for (const moneda of monedasEnBD) {
    const yaExiste = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: matriz.id,
          moneda_id: moneda.id,
        },
      },
    });

    if (!yaExiste) {
      await prisma.saldo.create({
        data: {
          punto_atencion_id: matriz.id,
          moneda_id: moneda.id,
          cantidad: 10000,
          billetes: 10000,
          monedas_fisicas: 0,
        },
      });

      await prisma.historialSaldo.create({
        data: {
          punto_atencion_id: matriz.id,
          moneda_id: moneda.id,
          usuario_id: admin.id,
          cantidad_anterior: 0,
          cantidad_incrementada: 10000,
          cantidad_nueva: 10000,
          tipo_movimiento: "INGRESO",
          descripcion: "Saldo inicial creado por semilla",
          numero_referencia: "INIT-001",
        },
      });
    }
  }

  // 5. Crear Cuadre de Caja inicial si no existe
  const existeCuadre = await prisma.cuadreCaja.findFirst({
    where: {
      usuario_id: admin.id,
      punto_atencion_id: matriz.id,
    },
  });

  if (!existeCuadre) {
    const cuadre = await prisma.cuadreCaja.create({
      data: {
        usuario_id: admin.id,
        punto_atencion_id: matriz.id,
        estado: "ABIERTO",
        fecha: new Date(),
        observaciones: "Cuadre inicial generado por semilla",
      },
    });

    // Crear detalles del cuadre por separado
    for (const moneda of monedasEnBD) {
      await prisma.detalleCuadreCaja.create({
        data: {
          cuadre_id: cuadre.id,
          moneda_id: moneda.id,
          saldo_apertura: 10000,
          saldo_cierre: 10000,
          conteo_fisico: 10000,
          billetes: 10000,
          monedas_fisicas: 0,
          diferencia: 0,
        },
      });
    }
  }

  console.log("✅ Semilla ejecutada correctamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando semilla:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
