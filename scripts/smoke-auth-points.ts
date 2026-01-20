import axios from "axios";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BASE_URL = process.env.API_URL || "http://localhost:3001";

async function ensureData() {
  // Ensure secondary point exists
  const secundaria = await prisma.puntoAtencion.upsert({
    where: { nombre: "OFICINA SECUNDARIA" },
    update: { activo: true, es_principal: false, updated_at: new Date() },
    create: {
      nombre: "OFICINA SECUNDARIA",
      direccion: "Sucursal",
      ciudad: "Ciudad",
      provincia: "Provincia",
      es_principal: false,
      activo: true,
    },
  });

  const principal = await prisma.puntoAtencion.findFirst({
    where: { es_principal: true },
  });
  if (!principal) throw new Error("No existe punto principal");

  // Upsert administrativo user
  const adminisUser = await prisma.usuario.upsert({
    where: { username: "administrativo1" },
    update: {
      password: bcrypt.hashSync("Adminis123!", 10),
      rol: "ADMINISTRATIVO",
      nombre: "Administrativo Uno",
      activo: true,
      updated_at: new Date(),
      punto_atencion_id: null,
    },
    create: {
      username: "administrativo1",
      password: bcrypt.hashSync("Adminis123!", 10),
      rol: "ADMINISTRATIVO",
      nombre: "Administrativo Uno",
      activo: true,
    },
  });

  // Upsert operador user
  const operadorUser = await prisma.usuario.upsert({
    where: { username: "operador1" },
    update: {
      password: bcrypt.hashSync("Operador123!", 10),
      rol: "OPERADOR",
      nombre: "Operador Uno",
      activo: true,
      updated_at: new Date(),
      punto_atencion_id: null,
    },
    create: {
      username: "operador1",
      password: bcrypt.hashSync("Operador123!", 10),
      rol: "OPERADOR",
      nombre: "Operador Uno",
      activo: true,
    },
  });

  return { principal, secundaria, adminisUser, operadorUser };
}

async function login(username: string, password: string) {
  const { data } = await axios.post(`${BASE_URL}/auth/login`, {
    username,
    password,
  });
  return data as { token: string; user: any };
}

async function authedGet(token: string, path: string) {
  const { data } = await axios.get(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

async function authedPost(token: string, path: string, body: any) {
  const { data } = await axios.post(`${BASE_URL}${path}`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

async function run() {
  console.log("🔧 Preparando datos de prueba...");
  const { principal, secundaria } = await ensureData();
  console.log("✅ Principal:", principal?.nombre, principal?.id);
  console.log("✅ Secundaria:", secundaria?.nombre, secundaria?.id);

  console.log("👤 Login ADMIN desde seed...");
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const adminLogin = await login(adminUsername, adminPassword);
  console.log("✅ ADMIN punto_atencion_id:", adminLogin.user.punto_atencion_id);

  console.log("📍 /points (ADMIN)");
  const adminPoints = await authedGet(adminLogin.token, "/points");
  const hasPrincipalForAdmin = (adminPoints.points || []).some((p: any) => p.es_principal);
  console.log("✅ ADMIN ve principal:", hasPrincipalForAdmin);

  console.log("👤 Login ADMINISTRATIVO...");
  const adminisLogin = await login("administrativo1", "Adminis123!");
  const adminisPoints = await authedGet(adminisLogin.token, "/points");
  const adminisSeesPrincipal = (adminisPoints.points || []).some((p: any) => p.es_principal);
  console.log("✅ ADMINISTRATIVO ve principal:", adminisSeesPrincipal);

  console.log("🕒 ADMINISTRATIVO inicia jornada en principal...");
  const adminisSchedule = await authedPost(adminisLogin.token, "/schedules", {
    usuario_id: adminisLogin.user.id,
    punto_atencion_id: principal!.id,
    fecha_inicio: new Date().toISOString(),
  });
  console.log("✅ Jornada ADMINISTRATIVO creada en principal:", !!adminisSchedule?.success);

  console.log("👤 Login OPERADOR...");
  const operadorLogin = await login("operador1", "Operador123!");
  const operadorPoints = await authedGet(operadorLogin.token, "/points");
  const operadorSeesPrincipal = (operadorPoints.points || []).some((p: any) => p.es_principal);
  console.log("✅ OPERADOR NO ve principal:", !operadorSeesPrincipal);

  console.log("🛑 OPERADOR intenta iniciar jornada en principal (espera 403)...");
  try {
    await authedPost(operadorLogin.token, "/schedules", {
      usuario_id: operadorLogin.user.id,
      punto_atencion_id: principal!.id,
      fecha_inicio: new Date().toISOString(),
    });
    console.log("❌ ERROR: operador pudo iniciar en principal");
  } catch (e: any) {
    const status = e?.response?.status;
    console.log("✅ Bloqueado con status:", status);
  }

  console.log("✅ OPERADOR inicia jornada en secundaria...");
  const operSchedule = await authedPost(operadorLogin.token, "/schedules", {
    usuario_id: operadorLogin.user.id,
    punto_atencion_id: secundaria!.id,
    fecha_inicio: new Date().toISOString(),
  });
  console.log("✅ Jornada OPERADOR en secundaria:", !!operSchedule?.success);

  console.log("🎉 Smoke test completado");
}

run()
  .catch((err) => {
    console.error("❌ Smoke test fallo:", err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
