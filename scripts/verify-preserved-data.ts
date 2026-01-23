import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const usuarios = await prisma.usuario.count()
  const puntos = await prisma.puntoAtencion.count()
  const monedas = await prisma.moneda.count()
  const jornadas = await prisma.jornada.count()
  const salidasEspontaneas = await prisma.salidaEspontanea.count()
  
  console.log('=== Datos Preservados ===')
  console.log(`✅ Usuarios: ${usuarios}`)
  console.log(`✅ Puntos de Atención: ${puntos}`)
  console.log(`✅ Monedas: ${monedas}`)
  console.log(`✅ Jornadas: ${jornadas}`)
  console.log(`✅ Salidas Espontáneas: ${salidasEspontaneas}`)
  
  // Verificar que transaccionales están limpias
  const cambios = await prisma.cambioDivisa.count()
  const transferencias = await prisma.transferencia.count()
  const movimientos = await prisma.movimientoSaldo.count()
  const saldos = await prisma.saldo.count()
  
  console.log('\n=== Datos Limpiados ===')
  console.log(`🧹 Cambios de divisa: ${cambios}`)
  console.log(`🧹 Transferencias: ${transferencias}`)
  console.log(`🧹 Movimientos de saldo: ${movimientos}`)
  console.log(`🧹 Saldos: ${saldos}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
