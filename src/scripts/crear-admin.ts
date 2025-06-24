
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function crearAdmin() {
  const admin = await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: await bcrypt.hash("admin123", 10),
      rol: "ADMIN",
      nombre: "Administrador",
      activo: true,
    },
  });

  console.log("Administrador creado:", admin);
}

crearAdmin().finally(() => prisma.$disconnect());
