import axios from "axios";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BASE_URL = process.env.API_URL || "http://localhost:3001/api"; // ensure /api

async function ensureUserAndPoint() {
  // Ensure a principal point exists
  let principal = await prisma.puntoAtencion.findFirst({
    where: { es_principal: true },
  });
  if (!principal) {
    principal = await prisma.puntoAtencion.create({
      data: {
        nombre: "OFICINA PRINCIPAL",
        direccion: "Matriz",
        ciudad: "Ciudad",
        provincia: "Provincia",
        es_principal: true,
        activo: true,
      },
    });
  }

  // Ensure a test operator exists
  let operador = await prisma.usuario.findFirst({ where: { username: "operador_worktime" } });
  if (!operador) {
    operador = await prisma.usuario.create({
      data: {
        username: "operador_worktime",
        password: bcrypt.hashSync("Operador123!", 10),
        rol: "OPERADOR",
        nombre: "Operador Worktime",
        activo: true,
      },
    });
  }

  return { principal, operador };
}

function todayYMD() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function seedWorkday(usuarioId: string, puntoId: string) {
  // Create a jornada today with lunch and spontaneous exit
  const now = new Date();
  const start = new Date(now);
  start.setHours(9, 0, 0, 0);
  const lunchStart = new Date(start);
  lunchStart.setHours(13, 0, 0, 0);
  const lunchEnd = new Date(lunchStart);
  lunchEnd.setMinutes(lunchEnd.getMinutes() + 45);
  const exit = new Date(start);
  exit.setHours(18, 0, 0, 0);

  const jornada = await prisma.jornada.create({
    data: {
      usuario_id: usuarioId,
      punto_atencion_id: puntoId,
      fecha_inicio: start,
      fecha_almuerzo: lunchStart,
      fecha_regreso: lunchEnd,
      fecha_salida: exit,
      estado: "COMPLETADO",
    },
  });

  // Spontaneous exit of 10 minutes during afternoon
  const spStart = new Date(start);
  spStart.setHours(16, 0, 0, 0);
  const spEnd = new Date(spStart);
  spEnd.setMinutes(spEnd.getMinutes() + 10);
  await prisma.salidaEspontanea.create({
    data: {
      usuario_id: usuarioId,
      punto_atencion_id: puntoId,
      motivo: "DILIGENCIA_PERSONAL",
      fecha_salida: spStart,
      fecha_regreso: spEnd,
      duracion_minutos: 10,
      estado: "COMPLETADO",
    },
  });

  return jornada;
}

async function login(username: string, password: string) {
  const { data } = await axios.post(`${BASE_URL}/auth/login`, { username, password });
  return data as { token: string; user: any };
}

async function run() {
  console.log("🔧 Preparando datos de prueba de worktime...");
  const { principal, operador } = await ensureUserAndPoint();
  console.log("✅ Punto principal:", principal.nombre, principal.id);
  console.log("✅ Usuario operador:", operador.username, operador.id);

  console.log("🧪 Sembrando jornada y salidas del día...");
  await seedWorkday(operador.id, principal.id);
  console.log("✅ Jornada y salida espontánea creadas");

  console.log("👤 Login OPERADOR para consumir /reports...");
  const operadorLogin = await login("operador_worktime", "Operador123!");

  const ymd = todayYMD();
  const body = {
    reportType: "worktime",
    dateFrom: ymd,
    dateTo: ymd,
    userId: operador.id,
    pointId: principal.id,
  };
  console.log("📤 POST /reports body:", body);

  const { data } = await axios.post(
    `${BASE_URL}/reports`,
    body,
    { headers: { Authorization: `Bearer ${operadorLogin.token}` } }
  );

  console.log("📥 Respuesta /reports:", {
    success: data?.success,
    count: Array.isArray(data?.data) ? data.data.length : 0,
    sample: Array.isArray(data?.data) ? data.data[0] : data,
  });

  console.log("🎉 Smoke de worktime OK");
}

run()
  .catch((err) => {
    console.error("❌ Smoke de worktime falló:", err?.response?.data || err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
