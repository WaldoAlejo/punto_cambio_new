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

const initialForm = {
  codigo: "",
  nombre: "",
  simbolo: "",
  orden_display: 0,
};

interface Props {
  user: User;
}

const CurrencyManagement = ({ user }: Props) => {
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
      const { currencies: data, error } =
        await currencyService.getAllCurrencies();
      if (error) {
        setError(error);
        toast({ title: "Error", description: error, variant: "destructive" });
        return;
      }
      setCurrencies(data);
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
      errors.codigo = "El código debe tener 3 letras";
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
        description: `Moneda ${newCurrency.nombre} creada correctamente`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive",
      });
    }
  };

  const toggleCurrencyStatus = async (id: string) => {
    try {
      const { currency: updated, error } =
        await currencyService.toggleCurrencyStatus(id);
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" });
        return;
      }
      await loadCurrencies();
      toast({
        title: "Estado actualizado",
        description: `Moneda ${updated?.nombre} ${
          updated?.activo ? "activada" : "desactivada"
        }`,
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado",
        variant: "destructive",
      });
    }
  };

  if (user.rol !== "ADMIN" && user.rol !== "SUPER_USUARIO") {
    return (
      <p className="p-6 text-center text-red-500">
        No tiene permisos para acceder a esta sección
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando monedas...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Gestión de Monedas</h1>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? "Cancelar" : "Nueva Moneda"}
        </Button>
      </div>

      {/* Formulario Nueva Moneda */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nueva Moneda</CardTitle>
            <CardDescription>
              Complete la información de la moneda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Código (3 letras)</Label>
                  <Input
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
                <div className="space-y-1">
                  <Label>Símbolo</Label>
                  <Input
                    value={formData.simbolo}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        simbolo: e.target.value,
                      }))
                    }
                    placeholder="$"
                  />
                  {fieldError.simbolo && (
                    <span className="text-xs text-red-600">
                      {fieldError.simbolo}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Orden</Label>
                  <Input
                    type="number"
                    value={formData.orden_display}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        orden_display: parseInt(e.target.value) || 0,
                      }))
                    }
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nombre Completo</Label>
                <Input
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
                  Crear
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

      {/* Tabla de monedas */}
      <Card>
        <CardHeader>
          <CardTitle>Monedas Registradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Símbolo</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creación</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.codigo}</TableCell>
                    <TableCell>{c.nombre}</TableCell>
                    <TableCell>{c.simbolo}</TableCell>
                    <TableCell>{c.orden_display}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          c.activo
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {c.activo ? "Activa" : "Inactiva"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingCurrency(c)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={c.activo ? "destructive" : "default"}
                          onClick={() => toggleCurrencyStatus(c.id)}
                        >
                          {c.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
