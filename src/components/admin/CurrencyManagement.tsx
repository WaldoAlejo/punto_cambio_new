import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User, Moneda } from "../../types";
import { currencyService } from "../../services/currencyService";
import EditCurrencyDialog from "@/components/admin/EditCurrencyDialog";
import { Edit } from "lucide-react";

interface CurrencyManagementProps {
  user: User;
}

const initialForm = {
  codigo: "",
  nombre: "",
  simbolo: "",
  orden_display: 0,
};

const CurrencyManagement = ({ user }: CurrencyManagementProps) => {
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialForm);
  const [fieldError, setFieldError] = useState<{ [key: string]: string }>({});
  const [editingCurrency, setEditingCurrency] = useState<Moneda | null>(null);

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { currencies: fetchedCurrencies, error } =
        await currencyService.getAllCurrencies();
      if (error) {
        setError(error);
        toast({ title: "Error", description: error, variant: "destructive" });
        return;
      }
      setCurrencies(fetchedCurrencies);
    } catch {
      setError("Error al cargar monedas");
      toast({
        title: "Error",
        description: "Error al cargar monedas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateFields = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.codigo || formData.codigo.length !== 3)
      errors.codigo = "El código debe ser de 3 letras";
    if (!formData.simbolo) errors.simbolo = "El símbolo es obligatorio";
    if (!formData.nombre) errors.nombre = "El nombre es obligatorio";
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateFields();
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const { currency: newCurrency, error } =
        await currencyService.createCurrency({
          codigo: formData.codigo.toUpperCase(),
          nombre: formData.nombre.trim(),
          simbolo: formData.simbolo,
          orden_display: formData.orden_display || currencies.length + 1,
        });
      if (!newCurrency || error) {
        toast({
          title: "Error",
          description: error || "Error al crear moneda",
          variant: "destructive",
        });
        return;
      }
      setFormData(initialForm);
      setShowForm(false);
      await loadCurrencies();
      toast({
        title: "Moneda creada",
        description: `Moneda ${newCurrency.nombre} creada exitosamente`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive",
      });
    }
  };

  const toggleCurrencyStatus = async (currencyId: string) => {
    try {
      const { currency: updatedCurrency, error } =
        await currencyService.toggleCurrencyStatus(currencyId);
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" });
        return;
      }
      await loadCurrencies();
      toast({
        title: "Estado actualizado",
        description: `Moneda ${updatedCurrency?.nombre} ${
          updatedCurrency?.activo ? "activada" : "desactivada"
        }`,
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado de la moneda",
        variant: "destructive",
      });
    }
  };

  if (user.rol !== "ADMIN" && user.rol !== "SUPER_USUARIO") {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-500 text-base">
          No tiene permisos para acceder a esta sección
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600">Cargando monedas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-base">Error al cargar monedas</p>
          <p className="text-gray-500 text-sm mt-2">{error}</p>
          <Button
            onClick={loadCurrencies}
            className="mt-3"
            variant="outline"
            size="sm"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header - Siempre visible */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Gestión de Monedas</h1>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          {showForm ? "Cancelar" : "Nueva Moneda"}
        </Button>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {showForm && (
          <Card className="flex-shrink-0">
            <CardHeader className="p-3">
              <CardTitle className="text-sm">Crear Nueva Moneda</CardTitle>
              <CardDescription className="text-xs">
                Complete la información de la nueva moneda
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="codigo" className="text-xs">
                      Código (3 letras)
                    </Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          codigo: e.target.value
                            .replace(/[^A-Za-z]/g, "")
                            .toUpperCase(),
                        }))
                      }
                      placeholder="USD"
                      maxLength={3}
                      className="h-8 text-xs"
                    />
                    {fieldError.codigo && (
                      <span className="text-xs text-red-600">
                        {fieldError.codigo}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="simbolo" className="text-xs">
                      Símbolo
                    </Label>
                    <Input
                      id="simbolo"
                      value={formData.simbolo}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          simbolo: e.target.value,
                        }))
                      }
                      placeholder="$"
                      maxLength={5}
                      className="h-8 text-xs"
                    />
                    {fieldError.simbolo && (
                      <span className="text-xs text-red-600">
                        {fieldError.simbolo}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="orden" className="text-xs">
                      Orden (Opcional)
                    </Label>
                    <Input
                      id="orden"
                      type="number"
                      value={formData.orden_display}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          orden_display: parseInt(e.target.value) || 0,
                        }))
                      }
                      placeholder="1"
                      min="0"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nombre" className="text-xs">
                    Nombre Completo
                  </Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        nombre: e.target.value,
                      }))
                    }
                    placeholder="Dólar Estadounidense"
                    className="h-8 text-xs"
                  />
                  {fieldError.nombre && (
                    <span className="text-xs text-red-600">
                      {fieldError.nombre}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                    size="sm"
                  >
                    Crear Moneda
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    size="sm"
                    className="h-8 text-xs"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="flex-shrink-0">
          <CardHeader className="p-3">
            <CardTitle className="text-sm">Monedas del Sistema</CardTitle>
            <CardDescription className="text-xs">
              Lista de todas las monedas registradas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            {currencies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  No hay monedas registradas en la base de datos
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Cree la primera moneda haciendo clic en "Nueva Moneda"
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs">Símbolo</TableHead>
                      <TableHead className="text-xs">Orden</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs">Fecha Creación</TableHead>
                      <TableHead className="text-xs">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((currency) => (
                      <TableRow key={currency.id}>
                        <TableCell className="font-medium text-xs">
                          {currency.codigo}
                        </TableCell>
                        <TableCell className="text-xs">
                          {currency.nombre}
                        </TableCell>
                        <TableCell className="text-xs">
                          {currency.simbolo}
                        </TableCell>
                        <TableCell className="text-xs">
                          {currency.orden_display}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              currency.activo
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {currency.activo ? "Activa" : "Inactiva"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(currency.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCurrency(currency)}
                              title="Editar moneda"
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                currency.activo ? "destructive" : "default"
                              }
                              onClick={() => toggleCurrencyStatus(currency.id)}
                              className="h-7 text-xs"
                            >
                              {currency.activo ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {editingCurrency && (
        <EditCurrencyDialog
          currency={editingCurrency}
          isOpen={!!editingCurrency}
          onClose={() => setEditingCurrency(null)}
          onCurrencyUpdated={loadCurrencies}
        />
      )}
    </div>
  );
};

export default CurrencyManagement;
