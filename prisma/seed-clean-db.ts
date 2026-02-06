import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type DelegateKey =
  | 'servicioExternoDetalleCierre'
  | 'detalleCuadreCaja'
  | 'recibo'
  | 'permiso'
  | 'solicitudSaldo'
  | 'servicioExternoMovimiento'
  | 'servicioExternoAsignacion'
  | 'servicioExternoSaldo'
  | 'servicioExternoCierreDiario'
  | 'cambioDivisa'
  | 'transferencia'
  | 'movimientoSaldo'
  | 'historialSaldo'
  | 'movimiento'
  | 'saldoInicial'
  | 'saldo'
  | 'servientregaGuia'
  | 'servientregaRemitente'
  | 'servientregaDestinatario'
  | 'servientregaSaldo'
  | 'servientregaSolicitudSaldo'
  | 'servientregaHistorialSaldo'
  | 'servientregaSolicitudAnulacion'
  | 'cierreDiario'
  | 'cuadreCaja'
  | 'historialAsignacionPunto'

// IMPORTANT: These models will be preserved: Usuario, PuntoAtencion, Moneda, Jornada
// We DO NOT delete those.

const deleteOrder: DelegateKey[] = [
  'servicioExternoDetalleCierre',
  'detalleCuadreCaja',
  'recibo',
  'permiso',
  'solicitudSaldo',
  'servicioExternoMovimiento',
  'servicioExternoAsignacion',
  'servicioExternoSaldo',
  'servicioExternoCierreDiario',
  'cambioDivisa',
  'transferencia',
  'movimientoSaldo',
  'historialSaldo',
  'movimiento',
  'saldoInicial',
  'saldo',
  'servientregaGuia',
  'servientregaRemitente',
  'servientregaDestinatario',
  'servientregaSaldo',
  'servientregaSolicitudSaldo',
  'servientregaHistorialSaldo',
  'servientregaSolicitudAnulacion',
  'cierreDiario',
  'cuadreCaja',
  'historialAsignacionPunto',
]

function parseArgs() {
  const args = new Set(process.argv.slice(2))
  const execute = args.has('--execute') || args.has('-x')
  const force = args.has('--force') || args.has('-f')
  const verbose = args.has('--verbose') || args.has('-v')
  return { execute, force, verbose }
}

async function countAll() {
  const counts: Record<string, number> = {}
  for (const key of deleteOrder) {
    // @ts-expect-error dynamic delegate access
    counts[key] = await prisma[key].count()
  }
  return counts
}

async function deleteAll(verbose: boolean) {
  await prisma.$transaction(async (tx) => {
    for (const key of deleteOrder) {
      // @ts-expect-error dynamic delegate access
      const res = await tx[key].deleteMany()
      if (verbose) {
         
        console.log(`[deleted] ${key}: ${res.count}`)
      }
    }
  })
}

async function main() {
  const { execute, force, verbose } = parseArgs()

  // Safety: prevent accidental production wipe unless explicitly forced
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && !force) {
    throw new Error('NODE_ENV=production detected. Use --force to proceed.')
  }

  if (!execute) {
    const counts = await countAll()
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    console.log('=== Dry-run: rows that would be deleted ===')
    for (const key of deleteOrder) {
      console.log(`${key}: ${counts[key]}`)
    }
    console.log(`Total rows to delete: ${total}`)
    console.log('\nRun with --execute to perform cleanup. Optional: --force in production, --verbose for per-table deletion logs.')
    return
  }

  console.log('Executing cleanup...')
  await deleteAll(verbose)
  console.log('Cleanup completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
