import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import currencyCodes from 'currency-codes'
import getSymbolFromCurrency from 'currency-symbol-map'

const prisma = new PrismaClient()

async function main() {
  console.log('Seed: creating unique index for principal PuntoAtencion if not exists...')
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_principal_on_puntoatencion ON "PuntoAtencion" (es_principal) WHERE es_principal = true;`
  )

  const principalName = process.env.PRINCIPAL_OFFICE_NAME ?? 'OFICINA PRINCIPAL'

  console.log('Seed: upserting principal PuntoAtencion ->', principalName)
  const principal = await prisma.puntoAtencion.upsert({
    where: { nombre: principalName },
    update: {
      es_principal: true,
      activo: true,
      updated_at: new Date(),
    },
    create: {
      nombre: principalName,
      direccion: 'Sede principal',
      ciudad: 'Ciudad',
      provincia: 'Provincia',
      codigo_postal: null,
      telefono: null,
      es_principal: true,
      activo: true,
    },
  })

  console.log('Seed: creating protection triggers for principal PuntoAtencion (prevents update/delete)')
  const fnSql = `
  CREATE OR REPLACE FUNCTION prevent_principal_modification()
  RETURNS trigger AS $$
  BEGIN
    IF (OLD.es_principal = true) THEN
      RAISE EXCEPTION 'Modification or deletion of principal PuntoAtencion is not allowed';
    END IF;
    RETURN OLD;
  END;
  $$ LANGUAGE plpgsql;
  `

  await prisma.$executeRawUnsafe(fnSql)

  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS trg_prevent_principal_delete ON "PuntoAtencion";`
  )
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER trg_prevent_principal_delete BEFORE DELETE ON "PuntoAtencion" FOR EACH ROW EXECUTE FUNCTION prevent_principal_modification();`
  )

  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS trg_prevent_principal_update ON "PuntoAtencion";`
  )
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER trg_prevent_principal_update BEFORE UPDATE ON "PuntoAtencion" FOR EACH ROW EXECUTE FUNCTION prevent_principal_modification();`
  )

  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin123!'
  const hashed = bcrypt.hashSync(adminPassword, 10)

  console.log('Seed: upserting admin user ->', adminUsername)
  const admin = await prisma.usuario.upsert({
    where: { username: adminUsername },
    update: {
      password: hashed,
      rol: 'ADMIN',
      nombre: 'Administrador',
      punto_atencion_id: principal.id,
      activo: true,
      updated_at: new Date(),
    },
    create: {
      username: adminUsername,
      password: hashed,
      rol: 'ADMIN',
      nombre: 'Administrador',
      correo: null,
      telefono: null,
      activo: true,
      punto_atencion_id: principal.id,
    },
  })

  console.log('Seed: inserting currencies from `currency-codes` package')
  const codes: string[] = typeof currencyCodes.codes === 'function' ? currencyCodes.codes() : []

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]
    const data = currencyCodes.code(code) as any
    const name = (data && data.currency) || code
    const symbol = getSymbolFromCurrency(code) || code

    await prisma.moneda.upsert({
      where: { codigo: code },
      update: {
        nombre: name,
        simbolo: symbol,
        activo: true,
        updated_at: new Date(),
      },
      create: {
        nombre: name,
        simbolo: symbol,
        codigo: code,
        activo: true,
      },
    })
  }

  console.log('Seed completed successfully.')
  console.log(`Admin user: ${adminUsername}`)
  console.log(`Admin password: ${adminPassword}`)
  console.log(`Principal PuntoAtencion id: ${principal.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
