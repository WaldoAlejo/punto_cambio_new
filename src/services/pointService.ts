
import { prisma } from "@/lib/prisma";
import { PuntoAtencion } from '../types';

export const pointService = {
  async getAllPoints(): Promise<{ points: PuntoAtencion[]; error: string | null }> {
    try {
      const points = await prisma.puntoAtencion.findMany({
        where: {
          activo: true
        },
        orderBy: {
          nombre: 'asc'
        }
      });

      return { 
        points: points.map(point => ({
          ...point,
          created_at: point.created_at.toISOString(),
          updated_at: point.updated_at.toISOString()
        })), 
        error: null 
      };
    } catch (error) {
      console.error('Error en getAllPoints:', error);
      return { points: [], error: 'Error al obtener puntos de atención' };
    }
  },

  async getPointById(id: string): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    try {
      const point = await prisma.puntoAtencion.findUnique({
        where: {
          id: id
        }
      });

      if (!point) {
        return { point: null, error: 'Punto de atención no encontrado' };
      }

      return { 
        point: {
          ...point,
          created_at: point.created_at.toISOString(),
          updated_at: point.updated_at.toISOString()
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error en getPointById:', error);
      return { point: null, error: 'Error al obtener punto de atención' };
    }
  },

  async createPoint(pointData: Omit<PuntoAtencion, 'id' | 'created_at' | 'updated_at'>): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    try {
      const point = await prisma.puntoAtencion.create({
        data: pointData
      });

      return { 
        point: {
          ...point,
          created_at: point.created_at.toISOString(),
          updated_at: point.updated_at.toISOString()
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error en createPoint:', error);
      return { point: null, error: 'Error al crear punto de atención' };
    }
  },

  async updatePoint(id: string, pointData: Partial<PuntoAtencion>): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    try {
      const point = await prisma.puntoAtencion.update({
        where: {
          id: id
        },
        data: pointData
      });

      return { 
        point: {
          ...point,
          created_at: point.created_at.toISOString(),
          updated_at: point.updated_at.toISOString()
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error en updatePoint:', error);
      return { point: null, error: 'Error al actualizar punto de atención' };
    }
  }
};
