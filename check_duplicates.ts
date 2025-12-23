import prisma from "./server/lib/prisma.js";

async function checkDuplicates() {
  console.log("🔍 Verificando duplicados en ServientregaRemitente...");
  
  const remitentesDuplicados = await prisma.$queryRaw`
    SELECT cedula, nombre, direccion, COUNT(*) as count 
    FROM "ServientregaRemitente" 
    GROUP BY cedula, nombre, direccion 
    HAVING COUNT(*) > 1
  `;
  
  console.log("Remitentes duplicados:", remitentesDuplicados);
  
  console.log("\n🔍 Verificando duplicados en ServientregaDestinatario...");
  
  const destinatariosDuplicados = await prisma.$queryRaw`
    SELECT cedula, nombre, direccion, COUNT(*) as count 
    FROM "ServientregaDestinatario" 
    GROUP BY cedula, nombre, direccion 
    HAVING COUNT(*) > 1
  `;
  
  console.log("Destinatarios duplicados:", destinatariosDuplicados);
  
  if (Array.isArray(remitentesDuplicados) && remitentesDuplicados.length > 0) {
    console.log("\n⚠️ SE ENCONTRARON REMITENTES DUPLICADOS - La migración fallará");
  } else {
    console.log("\n✅ No hay remitentes duplicados");
  }
  
  if (Array.isArray(destinatariosDuplicados) && destinatariosDuplicados.length > 0) {
    console.log("⚠️ SE ENCONTRARON DESTINATARIOS DUPLICADOS - La migración fallará");
  } else {
    console.log("✅ No hay destinatarios duplicados");
  }
  
  await prisma.$disconnect();
}

checkDuplicates().catch(console.error);
