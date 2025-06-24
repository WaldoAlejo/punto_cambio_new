
import { apiService } from './apiService';
import { Transferencia, ResponsableMovilizacion } from '../types';

export interface CreateTransferData {
  origen_id?: string | null;
  destino_id: string;
  moneda_id: string;
  monto: number;
  tipo_transferencia: 'ENTRE_PUNTOS' | 'DEPOSITO_MATRIZ' | 'RETIRO_GERENCIA' | 'DEPOSITO_GERENCIA';
  descripcion?: string | null;
  detalle_divisas?: {
    billetes: number;
    monedas: number;
    total: number;
  };
  responsable_movilizacion?: ResponsableMovilizacion;
}

export const transferService = {
  async createTransfer(data: CreateTransferData): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      console.log('=== TRANSFER SERVICE - CREATE TRANSFER ===');
      console.log('Datos enviados al servidor:', JSON.stringify(data, null, 2));
      
      // Validaciones básicas antes de enviar
      if (!data.destino_id) {
        console.error('destino_id es requerido');
        return { transfer: null, error: 'Punto de destino es requerido' };
      }
      
      if (!data.moneda_id) {
        console.error('moneda_id es requerido');
        return { transfer: null, error: 'Moneda es requerida' };
      }
      
      if (!data.monto || data.monto <= 0) {
        console.error('monto inválido:', data.monto);
        return { transfer: null, error: 'Monto debe ser mayor a 0' };
      }
      
      if (!data.tipo_transferencia) {
        console.error('tipo_transferencia es requerido');
        return { transfer: null, error: 'Tipo de transferencia es requerido' };
      }

      console.log('Enviando petición POST a /transfers...');
      const response = await apiService.post<{ transfer: Transferencia; success: boolean; message?: string }>('/transfers', data);
      
      console.log('Respuesta recibida del servidor:', response);
      
      if (response && response.success && response.transfer) {
        console.log('✅ Transferencia creada y guardada exitosamente:', response.transfer);
        return { transfer: response.transfer, error: null };
      } else {
        const errorMsg = response?.message || 'Error al crear la transferencia';
        console.error('❌ Error en respuesta del servidor:', errorMsg);
        return { transfer: null, error: errorMsg };
      }
    } catch (error) {
      console.error('=== ERROR EN TRANSFER SERVICE ===');
      console.error('Error completo:', error);
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('Status HTTP:', axiosError.response?.status);
        console.error('Data del error:', axiosError.response?.data);
        
        if (axiosError.response?.data?.error) {
          return { transfer: null, error: axiosError.response.data.error };
        }
      }
      
      return { transfer: null, error: 'Error de conexión al crear la transferencia' };
    }
  },

  async getAllTransfers(): Promise<{ transfers: Transferencia[]; error: string | null }> {
    try {
      console.log('Obteniendo todas las transferencias desde el servidor...');
      const response = await apiService.get<{ transfers: Transferencia[]; success: boolean }>('/transfers');
      
      console.log('Respuesta de transferencias:', response);
      
      if (response && response.success) {
        console.log(`✅ ${response.transfers.length} transferencias obtenidas desde BD`);
        return { transfers: response.transfers, error: null };
      } else {
        console.error('❌ Error obteniendo transferencias');
        return { transfers: [], error: 'Error al obtener las transferencias' };
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
      return { transfers: [], error: 'Error de conexión al obtener transferencias' };
    }
  },

  async getPendingTransfers(): Promise<{ transfers: Transferencia[]; error: string | null }> {
    try {
      console.log('Obteniendo transferencias pendientes...');
      const response = await apiService.get<{ transfers: Transferencia[]; success: boolean }>('/transfer-approvals');
      
      console.log('Respuesta de transferencias pendientes:', response);
      
      if (response && response.success) {
        console.log(`✅ ${response.transfers.length} transferencias pendientes obtenidas`);
        return { transfers: response.transfers, error: null };
      } else {
        console.error('❌ Error obteniendo transferencias pendientes');
        return { transfers: [], error: 'Error al obtener las transferencias pendientes' };
      }
    } catch (error) {
      console.error('Error fetching pending transfers:', error);
      return { transfers: [], error: 'Error de conexión al obtener transferencias pendientes' };
    }
  },

  async approveTransfer(transferId: string, observaciones?: string): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      console.log('Aprobando transferencia:', transferId);
      const response = await apiService.patch<{ transfer: Transferencia; success: boolean }>(`/transfer-approvals/${transferId}/approve`, { observaciones });
      
      if (response && response.success) {
        console.log('✅ Transferencia aprobada exitosamente');
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
      console.log('Rechazando transferencia:', transferId);
      const response = await apiService.patch<{ transfer: Transferencia; success: boolean }>(`/transfer-approvals/${transferId}/reject`, { observaciones });
      
      if (response && response.success) {
        console.log('✅ Transferencia rechazada exitosamente');
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
