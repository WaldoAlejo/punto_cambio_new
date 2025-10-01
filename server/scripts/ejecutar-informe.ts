import { generarInformeSantaFe } from "./generar-informe-santa-fe.js";

async function main() {
  try {
    console.log("🚀 Iniciando generación de informe...");
    const resultado = await generarInformeSantaFe();
    console.log("✅ Informe generado exitosamente:", resultado.archivo);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
