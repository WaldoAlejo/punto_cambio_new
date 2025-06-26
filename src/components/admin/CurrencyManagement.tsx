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

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { currencies: fetchedCurrencies } =
        await currencyService.getAllCurrencies(); // <-- Quitamos "error"
      setCurrencies(fetchedCurrencies);
    } catch (error) {
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
      const { currency: newCurrency } = await currencyService.createCurrency({
        codigo: formData.codigo.toUpperCase(),
        nombre: formData.nombre.trim(),
        simbolo: formData.simbolo,
        orden_display: formData.orden_display || currencies.length + 1,
      }); // <-- Quitamos "error"

      if (!newCurrency) {
        toast({
          title: "Error",
          description: "Error al crear moneda",
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive",
      });
    }
  };

  if (user.rol !== "ADMIN" && user.rol !== "SUPER_USUARIO") {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">
            No tiene permisos para acceder a esta sección
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando monedas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">Error al cargar monedas</p>
          <p className="text-gray-500 mt-2">{error}</p>
          <Button onClick={loadCurrencies} className="mt-4" variant="outline">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Monedas</h1>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? "Cancelar" : "Nueva Moneda"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nueva Moneda</CardTitle>
            <CardDescription>
              Complete la información de la nueva moneda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código (3 letras)</Label>
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
                  />
                  {fieldError.codigo && (
                    <span className="text-xs text-red-600">
                      {fieldError.codigo}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="simbolo">Símbolo</Label>
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
                  />
                  {fieldError.simbolo && (
                    <span className="text-xs text-red-600">
                      {fieldError.simbolo}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orden">Orden (Opcional)</Label>
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
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  placeholder="Dólar Estadounidense"
                />
                {fieldError.nombre && (
                  <span className="text-xs text-red-600">
                    {fieldError.nombre}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Moneda
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monedas del Sistema</CardTitle>
          <CardDescription>
            Lista de todas las monedas registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currencies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No hay monedas registradas en la base de datos
              </p>
              <p className="text-gray-400 mt-2">
                Cree la primera moneda haciendo clic en "Nueva Moneda"
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Símbolo</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map((currency) => (
                  <TableRow key={currency.id}>
                    <TableCell className="font-medium">
                      {currency.codigo}
                    </TableCell>
                    <TableCell>{currency.nombre}</TableCell>
                    <TableCell>{currency.simbolo}</TableCell>
                    <TableCell>{currency.orden_display}</TableCell>
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
                    <TableCell>
                      {new Date(currency.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CurrencyManagement;
