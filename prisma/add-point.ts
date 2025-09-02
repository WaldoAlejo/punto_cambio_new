import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Obtener argumentos de la línea de comandos
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.log(
      "❌ Uso: npm run add:point <nombre> <direccion> <ciudad> <provincia> [telefono] [codigo_postal]"
    );
    console.log(
      '📝 Ejemplo: npm run add:point "Casa de Cambios Norte" "Av. Principal 123" "Quito" "Pichincha" "0987654321" "170135"'
    );
    process.exit(1);
  }

  const [nombre, direccion, ciudad, provincia, telefono, codigo_postal] = args;

  try {
    console.log("🏗️  Creando nuevo punto de atención...");
    console.log(`📍 Nombre: ${nombre}`);
    console.log(`📍 Dirección: ${direccion}`);
    console.log(`📍 Ciudad: ${ciudad}`);
    console.log(`📍 Provincia: ${provincia}`);
    if (telefono) console.log(`📞 Teléfono: ${telefono}`);
    if (codigo_postal) console.log(`📮 Código Postal: ${codigo_postal}`);

    // Verificar si ya existe un punto con el mismo nombre
    const existingPoint = await prisma.puntoAtencion.findUnique({
      where: { nombre },
    });

    if (existingPoint) {
      console.log(
        `❌ Ya existe un punto de atención con el nombre "${nombre}"`
      );
      process.exit(1);
    }

    // Crear el nuevo punto de atención
    const nuevoPunto = await prisma.puntoAtencion.create({
      data: {
        nombre,
        direccion,
        ciudad,
        provincia,
        telefono: telefono || null,
        codigo_postal: codigo_postal || null,
        activo: true,
        es_principal: false,
      },
    });

    console.log("✅ Punto de atención creado exitosamente!");
    console.log(`🆔 ID: ${nuevoPunto.id}`);
    console.log(`📍 ${nuevoPunto.nombre}`);
    console.log(`📍 ${nuevoPunto.direccion}`);
    console.log(`🏙️ ${nuevoPunto.ciudad}, ${nuevoPunto.provincia}`);

    console.log(
      "\n💡 Ahora puedes asignar saldos a este punto desde la interfaz de administración."
    );
  } catch (error) {
    console.error("❌ Error al crear punto de atención:", error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
