
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Moneda, Transferencia } from '../../types';

interface TransferManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const TransferManagement = ({ user, selectedPoint }: TransferManagementProps) => {
  const [transfers, setTransfers] = useState<Transferencia[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [formData, setFormData] = useState({
    type: '',
    toPointId: '',
    currencyId: '',
    amount: '',
    notes: ''
  });

  // Mock data
  const mockCurrencies: Moneda[] = [
    { id: '1', codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '2', codigo: 'EUR', nombre: 'Euro', simbolo: '€', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '3', codigo: 'VES', nombre: 'Bolívar Venezolano', simbolo: 'Bs', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  const mockPoints: PuntoAtencion[] = [
    { id: '1', nombre: 'Punto Centro', direccion: 'Centro', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '', saldos: [] },
    { id: '2', nombre: 'Punto Norte', direccion: 'Norte', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '', saldos: [] },
    { id: '3', nombre: 'Punto Sur', direccion: 'Sur', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '', saldos: [] }
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

    if ((formData.type === 'ENTRE_PUNTOS') && !formData.toPointId) {
      toast({
        title: "Error", 
        description: "Debe seleccionar el punto de destino",
        variant: "destructive"
      });
      return;
    }

    const newTransfer: Transferencia = {
      id: Date.now().toString(),
      origenId: formData.type === 'ENTRE_PUNTOS' ? selectedPoint?.id : undefined,
      destinoId: formData.type === 'ENTRE_PUNTOS' ? formData.toPointId : selectedPoint?.id || '',
      monedaId: formData.currencyId,
      monto: parseFloat(formData.amount),
      tipoTransferencia: formData.type as any,
      estado: 'PENDIENTE',
      solicitadoPor: user.id,
      fecha: new Date().toISOString(),
      descripcion: formData.notes,
      numeroRecibo: `TR-${Date.now()}`
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
    if (user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
      toast({
        title: "Sin permisos",
        description: "Solo los administradores pueden aprobar transferencias",
        variant: "destructive"
      });
      return;
    }

    setTransfers(prev => prev.map(t => 
      t.id === transferId 
        ? { ...t, estado: 'APROBADO', aprobadoPor: user.id }
        : t
    ));

    toast({
      title: "Transferencia aprobada",
      description: "La transferencia ha sido aprobada exitosamente",
    });
  };

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find(c => c.id === currencyId);
    return currency ? currency.codigo : '';
  };

  const getPointName = (pointId: string) => {
    const point = [...points, selectedPoint].find(p => p?.id === pointId);
    return point ? point.nombre : '';
  };

  const getTransferTypeLabel = (type: string) => {
    const types = {
      'ENTRE_PUNTOS': 'Entre Puntos',
      'DEPOSITO_MATRIZ': 'Depósito Matriz',
      'RETIRO_GERENCIA': 'Retiro Gerencia',
      'DEPOSITO_GERENCIA': 'Depósito Gerencia'
    };
    return types[type as keyof typeof types] || type;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Transferencias</h1>
        <div className="text-sm text-gray-500">
          {selectedPoint ? `Punto: ${selectedPoint.nombre}` : 'Panel Administrativo'}
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
                    {(user.rol === 'OPERADOR' || user.rol === 'CONCESION') && (
                      <>
                        <SelectItem value="ENTRE_PUNTOS">Transferencia entre Puntos</SelectItem>
                        <SelectItem value="DEPOSITO_MATRIZ">Solicitar Depósito de Matriz</SelectItem>
                        <SelectItem value="RETIRO_GERENCIA">Retiro de Gerencia</SelectItem>
                        <SelectItem value="DEPOSITO_GERENCIA">Depósito de Gerencia</SelectItem>
                      </>
                    )}
                    {(user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO') && (
                      <>
                        <SelectItem value="DEPOSITO_MATRIZ">Depósito de Matriz</SelectItem>
                        <SelectItem value="ENTRE_PUNTOS">Transferencia entre Puntos</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'ENTRE_PUNTOS' && (
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
                          {point.nombre}
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
                          {currency.codigo} - {currency.nombre}
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
                        transfer.estado === 'PENDIENTE' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : transfer.estado === 'APROBADO'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transfer.estado}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(transfer.fecha).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">
                        {getTransferTypeLabel(transfer.tipoTransferencia)}
                      </p>
                      <p className="text-gray-600">
                        Monto: {transfer.monto} {getCurrencyName(transfer.monedaId)}
                      </p>
                      {transfer.tipoTransferencia === 'ENTRE_PUNTOS' && (
                        <p className="text-gray-600">
                          De: {getPointName(transfer.origenId || '')} → A: {getPointName(transfer.destinoId)}
                        </p>
                      )}
                      {transfer.descripcion && (
                        <p className="text-gray-600 text-xs">
                          Notas: {transfer.descripcion}
                        </p>
                      )}
                    </div>
                    {transfer.estado === 'PENDIENTE' && (user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO') && (
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
