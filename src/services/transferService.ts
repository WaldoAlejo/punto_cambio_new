
import { apiService } from './apiService';
import { Transferencia } from '../types';

export interface CreateTransferData {
  origen_id?: string;
  destino_id: string;
  moneda_id: string;
  monto: number;
  tipo_transferencia: 'ENTRE_PUNTOS' | 'DEPOSITO_MATRIZ' | 'RETIRO_GERENCIA' | 'DEPOSITO_GERENCIA';
  descripcion?: string;
  detalle_divisas: {
    billetes: number;
    monedas: number;
    total: number;
  };
  responsable_movilizacion?: {
    nombre: string;
    documento: string;
    cedula: string;
    telefono: string;
  };
}

export const transferService = {
  async createTransfer(data: CreateTransferData): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      console.log('Creating transfer:', data);
      const response = await apiService.post<{ transfer: Transferencia; success: boolean }>('/transfers', data);
      
      if (response.success) {
        return { transfer: response.transfer, error: null };
      } else {
        return { transfer: null, error: 'Error al crear la transferencia' };
      }
    } catch (error) {
      console.error('Error creating transfer:', error);
      return { transfer: null, error: 'Error de conexión al crear la transferencia' };
    }
  },

  async getAllTransfers(): Promise<{ transfers: Transferencia[]; error: string | null }> {
    try {
      console.log('Fetching all transfers');
      const response = await apiService.get<{ transfers: Transferencia[]; success: boolean }>('/transfers');
      
      if (response.success) {
        return { transfers: response.transfers, error: null };
      } else {
        return { transfers: [], error: 'Error al obtener las transferencias' };
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
      return { transfers: [], error: 'Error de conexión al obtener transferencias' };
    }
  },

  async approveTransfer(transferId: string, observaciones?: string): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      console.log('Approving transfer:', transferId);
      const response = await apiService.patch<{ transfer: Transferencia; success: boolean }>(`/transfer-approvals/${transferId}/approve`, { observaciones });
      
      if (response.success) {
        return { transfer: response.transfer, error: null };
      } else {
        return { transfer: null, error: 'Error al aprobar la transferencia' };
      }
    } catch (error) {
      console.error('Error approving transfer:', error);
      return { transfer: null, error: 'Error de conexión al aprobar transferencia' };
    }
  },

  async rejectTransfer(transferId: string, observaciones?: string): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      console.log('Rejecting transfer:', transferId);
      const response = await apiService.patch<{ transfer: Transferencia; success: boolean }>(`/transfer-approvals/${transferId}/reject`, { observaciones });
      
      if (response.success) {
        return { transfer: response.transfer, error: null };
      } else {
        return { transfer: null, error: 'Error al rechazar la transferencia' };
      }
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      return { transfer: null, error: 'Error de conexión al rechazar transferencia' };
    }
  }
};
