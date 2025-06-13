
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { User, AttentionPoint, Currency, Transfer } from '../../types';

interface TransferManagementProps {
  user: User;
  selectedPoint: AttentionPoint | null;
}

const TransferManagement = ({ user, selectedPoint }: TransferManagementProps) => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [points, setPoints] = useState<AttentionPoint[]>([]);
  const [formData, setFormData] = useState({
    type: '',
    toPointId: '',
    currencyId: '',
    amount: '',
    notes: ''
  });

  // Mock data
  const mockCurrencies: Currency[] = [
    { id: '1', code: 'USD', name: 'Dólar Estadounidense', symbol: '$', is_active: true, created_at: new Date().toISOString() },
    { id: '2', code: 'EUR', name: 'Euro', symbol: '€', is_active: true, created_at: new Date().toISOString() },
    { id: '3', code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs', is_active: true, created_at: new Date().toISOString() }
  ];

  const mockPoints: AttentionPoint[] = [
    { id: '1', name: 'Punto Centro', address: 'Centro', phone: '', is_active: true, created_at: '', balances: [] },
    { id: '2', name: 'Punto Norte', address: 'Norte', phone: '', is_active: true, created_at: '', balances: [] },
    { id: '3', name: 'Punto Sur', address: 'Sur', phone: '', is_active: true, created_at: '', balances: [] }
  ];

  useEffect(() => {
    setCurrencies(mockCurrencies);
    setPoints(mockPoints.filter(p => p.id !== selectedPoint?.id));
    setTransfers([]);
  }, [selectedPoint]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.type || !formData.currencyId || !formData.amount) {
      toast({
        title: "Error",
        description: "Todos los campos obligatorios deben completarse",
        variant: "destructive"
      });
      return;
    }

    if ((formData.type === 'entre_puntos') && !formData.toPointId) {
      toast({
        title: "Error", 
        description: "Debe seleccionar el punto de destino",
        variant: "destructive"
      });
      return;
    }

    const newTransfer: Transfer = {
      id: Date.now().toString(),
      from_point_id: formData.type === 'entre_puntos' ? selectedPoint?.id : undefined,
      to_point_id: formData.type === 'entre_puntos' ? formData.toPointId : selectedPoint?.id || '',
      currency_id: formData.currencyId,
      amount: parseFloat(formData.amount),
      transfer_type: formData.type as any,
      status: 'pendiente',
      requested_by: user.id,
      date: new Date().toISOString(),
      notes: formData.notes,
      receipt_number: `TR-${Date.now()}`
    };

    setTransfers(prev => [newTransfer, ...prev]);
    
    // Reset form
    setFormData({
      type: '',
      toPointId: '',
      currencyId: '',
      amount: '',
      notes: ''
    });

    toast({
      title: "Transferencia solicitada",
      description: "La transferencia ha sido enviada para aprobación",
    });
  };

  const approveTransfer = (transferId: string) => {
    if (user.role !== 'administrador' && user.role !== 'super_usuario') {
      toast({
        title: "Sin permisos",
        description: "Solo los administradores pueden aprobar transferencias",
        variant: "destructive"
      });
      return;
    }

    setTransfers(prev => prev.map(t => 
      t.id === transferId 
        ? { ...t, status: 'aprobado', approved_by: user.id }
        : t
    ));

    toast({
      title: "Transferencia aprobada",
      description: "La transferencia ha sido aprobada exitosamente",
    });
  };

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find(c => c.id === currencyId);
    return currency ? currency.code : '';
  };

  const getPointName = (pointId: string) => {
    const point = [...points, selectedPoint].find(p => p?.id === pointId);
    return point ? point.name : '';
  };

  const getTransferTypeLabel = (type: string) => {
    const types = {
      'entre_puntos': 'Entre Puntos',
      'deposito_matriz': 'Depósito Matriz',
      'retiro_gerencia': 'Retiro Gerencia',
      'deposito_gerencia': 'Depósito Gerencia'
    };
    return types[type as keyof typeof types] || type;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Transferencias</h1>
        <div className="text-sm text-gray-500">
          {selectedPoint ? `Punto: ${selectedPoint.name}` : 'Panel Administrativo'}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Nueva Transferencia</CardTitle>
            <CardDescription>Solicitar una nueva transferencia</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Transferencia</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(user.role === 'operador' || user.role === 'concesion') && (
                      <>
                        <SelectItem value="entre_puntos">Transferencia entre Puntos</SelectItem>
                        <SelectItem value="deposito_matriz">Solicitar Depósito de Matriz</SelectItem>
                        <SelectItem value="retiro_gerencia">Retiro de Gerencia</SelectItem>
                        <SelectItem value="deposito_gerencia">Depósito de Gerencia</SelectItem>
                      </>
                    )}
                    {(user.role === 'administrador' || user.role === 'super_usuario') && (
                      <>
                        <SelectItem value="deposito_matriz">Depósito de Matriz</SelectItem>
                        <SelectItem value="entre_puntos">Transferencia entre Puntos</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'entre_puntos' && (
                <div className="space-y-2">
                  <Label>Punto de Destino</Label>
                  <Select 
                    value={formData.toPointId} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, toPointId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar punto" />
                    </SelectTrigger>
                    <SelectContent>
                      {points.map(point => (
                        <SelectItem key={point.id} value={point.id}>
                          {point.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select 
                    value={formData.currencyId} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, currencyId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map(currency => (
                        <SelectItem key={currency.id} value={currency.id}>
                          {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas (Opcional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Comentarios adicionales..."
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Solicitar Transferencia
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Transfers List */}
        <Card>
          <CardHeader>
            <CardTitle>Transferencias Recientes</CardTitle>
            <CardDescription>Últimas transferencias solicitadas</CardDescription>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay transferencias registradas
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {transfers.map(transfer => (
                  <div key={transfer.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        transfer.status === 'pendiente' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : transfer.status === 'aprobado'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transfer.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(transfer.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">
                        {getTransferTypeLabel(transfer.transfer_type)}
                      </p>
                      <p className="text-gray-600">
                        Monto: {transfer.amount} {getCurrencyName(transfer.currency_id)}
                      </p>
                      {transfer.transfer_type === 'entre_puntos' && (
                        <p className="text-gray-600">
                          De: {getPointName(transfer.from_point_id || '')} → A: {getPointName(transfer.to_point_id)}
                        </p>
                      )}
                      {transfer.notes && (
                        <p className="text-gray-600 text-xs">
                          Notas: {transfer.notes}
                        </p>
                      )}
                    </div>
                    {transfer.status === 'pendiente' && (user.role === 'administrador' || user.role === 'super_usuario') && (
                      <Button
                        size="sm"
                        onClick={() => approveTransfer(transfer.id)}
                        className="mt-2 bg-green-600 hover:bg-green-700"
                      >
                        Aprobar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TransferManagement;
