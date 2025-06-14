
import { prisma } from "@/lib/prisma";
import { Saldo } from '../types';

export const balanceService = {
  async getBalancesByPoint(puntoAtencionId: string): Promise<{ balances: Saldo[]; error: string | null }> {
    try {
      const balances = await prisma.saldo.findMany({
        where: {
          punto_atencion_id: puntoAtencionId
        },
        include: {
          moneda: true
        }
      });

      return { 
        balances: balances.map(balance => ({
          ...balance,
          cantidad: parseFloat(balance.cantidad.toString()),
          updated_at: balance.updated_at.toISOString()
        })), 
        error: null 
      };
    } catch (error) {
      console.error('Error en getBalancesByPoint:', error);
      return { balances: [], error: 'Error al obtener saldos' };
    }
  },

  async updateBalance(
    puntoAtencionId: string, 
    monedaId: string, 
    cantidad: number, 
    billetes: number = 0, 
    monedasFisicas: number = 0
  ): Promise<{ balance: Saldo | null; error: string | null }> {
    try {
      // Verificar si ya existe un saldo para este punto y moneda
      const existingBalance = await prisma.saldo.findFirst({
        where: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: monedaId
        }
      });

      let balance;
      if (existingBalance) {
        // Actualizar saldo existente
        balance = await prisma.saldo.update({
          where: {
            id: existingBalance.id
          },
          data: {
            cantidad,
            billetes,
            monedas_fisicas: monedasFisicas
          },
          include: {
            moneda: true
          }
        });
      } else {
        // Crear nuevo saldo
        balance = await prisma.saldo.create({
          data: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: monedaId,
            cantidad,
            billetes,
            monedas_fisicas: monedasFisicas
          },
          include: {
            moneda: true
          }
        });
      }

      return { 
        balance: {
          ...balance,
          cantidad: parseFloat(balance.cantidad.toString()),
          updated_at: balance.updated_at.toISOString()
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error en updateBalance:', error);
      return { balance: null, error: 'Error al actualizar saldo' };
    }
  }
};
