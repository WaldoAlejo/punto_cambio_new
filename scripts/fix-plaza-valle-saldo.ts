import { PrismaClient } from '@prisma/client';
import { registrarMovimientoSaldo, TipoMovimiento, TipoReferencia } from '../server/services/movimientoSaldoService.js';

const prisma = new PrismaClient();

const SALDO_ESPERADO = 1996.24;

/**
 * Script para corregir el saldo de PLAZA DEL VALLE
 * 
 * Este script:
 * 1. Verifica el saldo actual
 * 2. Calcula la diferencia con el saldo esperado
 * 3. Crea un ajuste manual si es necesario
 * 
 * USO:
 * - Primero ejecutar audit-plaza-valle.ts para ver el problema
 * - Luego ejecutar este script con --confirm para aplicar la corrección
 */

async function corregirSaldoPlazaValle() {
  const confirmar = process.argv.includes('--confirm');

  try {
    console.log('🔧 CORRECCIÓN DE SALDO - PLAZA DEL VALLE');
    console.log('='.repeat(80));

    if (!confirmar) {
      console.log('⚠️  MODO SIMULACIÓN (usa --confirm para aplicar cambios)\n');
    } else {
      console.log('✅ MODO CONFIRMADO - Se aplicarán los cambios\n');
    }

    // 1. Encontrar el punto
    const punto = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          contains: 'PLAZA',
          mode: 'insensitive'
        }
      }
    });

    if (!punto) {
      console.error('❌ No se encontró el punto PLAZA DEL VALLE');
      return;
    }

    console.log(`Punto: ${punto.nombre} (ID: ${punto.id})\n`);

    // 2. Obtener moneda USD
    const usd = await prisma.moneda.findUnique({
      where: { codigo: 'USD' }
    });

    if (!usd) {
      console.error('❌ No se encontró la moneda USD');
      return;
    }

    // 3. Obtener el saldo actual
    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id
        }
      }
    });

    if (!saldoActual) {
      console.error('❌ No se encontró el saldo USD del punto');
      return;
    }

    const saldoActualCantidad = Number(saldoActual.cantidad);
    const diferencia = SALDO_ESPERADO - saldoActualCantidad;

    console.log('💰 ANÁLISIS DE SALDO');
    console.log('-'.repeat(80));
    console.log(`Saldo actual:  $${saldoActualCantidad.toFixed(2)}`);
    console.log(`Saldo esperado: $${SALDO_ESPERADO.toFixed(2)}`);
    console.log(`Diferencia:     $${diferencia.toFixed(2)}`);
    console.log();

    if (Math.abs(diferencia) < 0.01) {
      console.log('✅ El saldo ya está correcto. No se requiere ajuste.');
      return;
    }

    // 4. Buscar usuario SYSTEM o administrador
    const usuarioSystem = await prisma.usuario.findFirst({
      where: {
        OR: [
          { correo: 'system@puntocambio.com' },
          { username: 'system' },
          { rol: 'ADMIN' }
        ]
      }
    });

    if (!usuarioSystem) {
      console.error('❌ No se encontró usuario SYSTEM o ADMIN para registrar el ajuste');
      return;
    }

    console.log(`Usuario para el ajuste: ${usuarioSystem.nombre} (${usuarioSystem.username})\n`);

    // 5. Mostrar lo que se hará
    console.log('📝 AJUSTE PROPUESTO');
    console.log('-'.repeat(80));
    
    if (diferencia > 0) {
      console.log(`Tipo: INGRESO (ajuste positivo)`);
      console.log(`Se SUMARÁ $${diferencia.toFixed(2)} al saldo`);
      console.log(`Razón: Corrección por movimientos mal registrados`);
    } else {
      console.log(`Tipo: EGRESO (ajuste negativo)`);
      console.log(`Se RESTARÁ $${Math.abs(diferencia).toFixed(2)} del saldo`);
      console.log(`Razón: Corrección por movimientos mal registrados`);
    }
    
    console.log(`\nSaldo resultante: $${SALDO_ESPERADO.toFixed(2)}`);
    console.log();

    if (!confirmar) {
      console.log('⚠️  Esta es una simulación. Para aplicar los cambios, ejecuta:');
      console.log('   npx tsx scripts/fix-plaza-valle-saldo.ts --confirm\n');
      return;
    }

    // 6. Aplicar el ajuste
    console.log('⏳ Aplicando ajuste...\n');

    await prisma.$transaction(async (tx) => {
      // Actualizar el saldo
      await tx.saldo.update({
        where: { id: saldoActual.id },
        data: {
          cantidad: SALDO_ESPERADO,
          updated_at: new Date()
        }
      });

      // Registrar el movimiento de saldo
      await registrarMovimientoSaldo(
        {
          puntoAtencionId: punto.id,
          monedaId: usd.id,
          tipoMovimiento: diferencia > 0 ? TipoMovimiento.INGRESO : TipoMovimiento.EGRESO,
          monto: Math.abs(diferencia),
          saldoAnterior: saldoActualCantidad,
          saldoNuevo: SALDO_ESPERADO,
          tipoReferencia: TipoReferencia.AJUSTE_MANUAL,
          descripcion: `Ajuste manual de saldo - Corrección por servicio Western Union mal registrado. Diferencia: $${diferencia.toFixed(2)}`,
          usuarioId: usuarioSystem.id,
        },
        tx
      );
    });

    console.log('✅ AJUSTE APLICADO EXITOSAMENTE');
    console.log('-'.repeat(80));
    console.log(`Saldo anterior: $${saldoActualCantidad.toFixed(2)}`);
    console.log(`Saldo nuevo:    $${SALDO_ESPERADO.toFixed(2)}`);
    console.log(`Ajuste:         $${diferencia > 0 ? '+' : ''}${diferencia.toFixed(2)}`);
    console.log();

    console.log('📋 ACCIONES RECOMENDADAS:');
    console.log('1. Verificar que el operador registre correctamente los servicios Western Union como EGRESO');
    console.log('2. Explicar al operador la diferencia entre INGRESO y EGRESO');
    console.log('3. Revisar el cierre de caja para confirmar que ahora cuadra en $1,996.24');
    console.log();

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

corregirSaldoPlazaValle();
