
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { currencyService } from "@/services/currencyService";
import { Moneda, CreateCurrencyData } from "@/types";
import { Coins, Plus } from "lucide-react";

export const CurrencyManagement = () => {
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateCurrencyData>({
    nombre: "",
    simbolo: "",
    codigo: "",
    orden_display: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    setLoading(true);
    try {
      const result = await currencyService.getAllCurrencies();
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setCurrencies(result.currencies);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar monedas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await currencyService.createCurrency(formData);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: "Moneda creada correctamente",
        });
        setDialogOpen(false);
        setFormData({
          nombre: "",
          simbolo: "",
          codigo: "",
          orden_display: 0,
        });
        loadCurrencies();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al crear moneda",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2">Cargando monedas...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Coins className="h-5 w-5" />
            <CardTitle>Gestión de Monedas</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
              <form onSubmit={handleCreateCurrency} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Dólar Estadounidense"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="simbolo">Símbolo</Label>
                    <Input
                      id="simbolo"
                      value={formData.simbolo}
                      onChange={(e) => setFormData({ ...formData, simbolo: e.target.value })}
                      placeholder="$"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                      placeholder="USD"
                      maxLength={3}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="orden_display">Orden de Visualización</Label>
                  <Input
                    id="orden_display"
                    type="number"
                    value={formData.orden_display}
                    onChange={(e) => setFormData({ ...formData, orden_display: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Crear Moneda
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Símbolo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha Creación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currencies.map((currency) => (
              <TableRow key={currency.id}>
                <TableCell>{currency.orden_display}</TableCell>
                <TableCell className="font-medium">{currency.codigo}</TableCell>
                <TableCell>{currency.nombre}</TableCell>
                <TableCell>{currency.simbolo}</TableCell>
                <TableCell>
                  <Badge variant={currency.activo ? "default" : "destructive"}>
                    {currency.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(currency.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
