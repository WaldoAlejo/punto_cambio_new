
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { currencyService } from '../../services/currencyService';
import { Moneda } from '../../types';
import { Plus, Coins, ToggleLeft, ToggleRight } from 'lucide-react';

export const CurrencyManagement = () => {
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    simbolo: '',
    orden_display: 0
  });

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    setLoading(true);
    try {
      const { currencies: currenciesData, error } = await currencyService.getAllCurrencies();
      
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
      } else {
        setCurrencies(currenciesData);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCurrency = async () => {
    if (!formData.codigo || !formData.nombre || !formData.simbolo) {
      toast({
        title: "Error",
        description: "Complete los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    const { currency, error } = await currencyService.createCurrency(formData);
    
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      });
    } else if (currency) {
      setCurrencies([...currencies, currency]);
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Moneda creada",
        description: "La moneda se creó exitosamente"
      });
    }
  };

  const handleToggleCurrency = async (currencyId: string) => {
    const { currency, error } = await currencyService.toggleCurrencyStatus(currencyId);
    
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      });
    } else if (currency) {
      setCurrencies(currencies.map(c => c.id === currencyId ? currency : c));
      toast({
        title: "Estado actualizado",
        description: `Moneda ${currency.activo ? 'activada' : 'desactivada'} exitosamente`
      });
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nombre: '',
      simbolo: '',
      orden_display: 0
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Cargando monedas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Monedas</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Moneda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Moneda</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({...formData, codigo: e.target.value.toUpperCase()})}
                  placeholder="USD, EUR, COP..."
                  maxLength={3}
                />
              </div>
              <div>
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  placeholder="Dólar Americano, Euro..."
                />
              </div>
              <div>
                <Label htmlFor="simbolo">Símbolo *</Label>
                <Input
                  id="simbolo"
                  value={formData.simbolo}
                  onChange={(e) => setFormData({...formData, simbolo: e.target.value})}
                  placeholder="$, €, ₡..."
                  maxLength={5}
                />
              </div>
              <div>
                <Label htmlFor="orden">Orden de Display</Label>
                <Input
                  id="orden"
                  type="number"
                  value={formData.orden_display}
                  onChange={(e) => setFormData({...formData, orden_display: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCurrency}>
                  Crear Moneda
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Monedas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {currencies.map(currency => (
              <div key={currency.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <Coins className="h-5 w-5 text-gray-400" />
                    <div>
                      <h3 className="font-medium">{currency.nombre}</h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span>{currency.codigo}</span>
                        <span>•</span>
                        <span>{currency.simbolo}</span>
                        <span>•</span>
                        <span>Orden: {currency.orden_display}</span>
                      </div>
                    </div>
                    <Badge variant={currency.activo ? "default" : "secondary"}>
                      {currency.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleCurrency(currency.id)}
                  >
                    {currency.activo ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
