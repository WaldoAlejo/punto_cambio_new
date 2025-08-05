import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, X } from "lucide-react";
import { User, PuntoAtencion, Moneda } from "../../types";
import { transferService } from "../../services/transferService";
import { currencyService } from "../../services/currencyService";
import { pointService } from "../../services/pointService";
import { toast } from "sonner";

interface TransferFormProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onTransferCreated: () => void;
  onCancel: () => void;
}

const TIPO_TRANSFERENCIA_ENTRE_PUNTOS = "ENTRE_PUNTOS" as const;

const initialErrorState = {
  destinationPointId: "",
  currencyId: "",
  amount: "",
  description: "",
};

const TransferForm = ({
  user,
  selectedPoint,
  onTransferCreated,
  onCancel,
}: TransferFormProps) => {
  const [destinationPointId, setDestinationPointId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availablePoints, setAvailablePoints] = useState<PuntoAtencion[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [errors, setErrors] = useState(initialErrorState);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { points } = await pointService.getActivePointsForTransfers();
        setAvailablePoints(
          points.filter((point) => point.id !== selectedPoint?.id)
        );

        const { currencies: fetchedCurrencies } =
          await currencyService.getAllCurrencies();
        setCurrencies(fetchedCurrencies.filter((currency) => currency.activo));
      } catch {
        toast.error("Error al cargar datos necesarios");
      }
    };

    loadData();
  }, [selectedPoint]);

  // Validación en tiempo real
  useEffect(() => {
    setErrors({
      destinationPointId: destinationPointId ? "" : "Selecciona el destino",
      currencyId: currencyId ? "" : "Selecciona la moneda",
      amount: !amount
        ? "Ingresa un monto"
        : parseFloat(amount) <= 0
        ? "El monto debe ser mayor a 0"
        : "",
      description: description.trim() ? "" : "Describe el motivo",
    });
  }, [destinationPointId, currencyId, amount, description]);

  const formHasData = destinationPointId || currencyId || amount || description;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Chequeo rápido antes de enviar
    if (
      !destinationPointId ||
      !currencyId ||
      !amount ||
      !description.trim() ||
      parseFloat(amount) <= 0
    ) {
      toast.error("Completa todos los campos requeridos correctamente");
      return;
    }

    if (!selectedPoint) {
      toast.error("No hay punto de origen seleccionado");
      return;
    }

    try {
      setIsLoading(true);

      const transferData = {
        origen_id: selectedPoint.id,
        destino_id: destinationPointId,
        moneda_id: currencyId,
        monto: parseFloat(amount),
        descripcion: description.trim(),
        tipo_transferencia: TIPO_TRANSFERENCIA_ENTRE_PUNTOS,
        solicitado_por: user.id,
      };

      const { transfer, error } = await transferService.createTransfer(
        transferData
      );

      if (error || !transfer) {
        toast.error(error || "Error al crear la transferencia");
        return;
      }

      toast.success(
        `✅ Solicitud de transferencia por ${transfer.monto.toLocaleString()} creada con éxito.`
      );

      setDestinationPointId("");
      setCurrencyId("");
      setAmount("");
      setDescription("");
      onTransferCreated();
    } catch {
      toast({
        title: "Error",
        description: "Error al crear la transferencia",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCurrency = currencies.find((c) => c.id === currencyId);
  const selectedDestinationPoint = availablePoints.find(
    (p) => p.id === destinationPointId
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Nueva Transferencia
        </CardTitle>
        <CardDescription>
          Solicita una transferencia entre puntos. Todos los campos son
          obligatorios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Origen */}
            <div className="space-y-1">
              <Label>Punto de Origen</Label>
              <Input
                value={selectedPoint?.nombre || "No seleccionado"}
                disabled
                className="bg-gray-50"
              />
            </div>

            {/* Destino */}
            <div className="space-y-1">
              <Label htmlFor="destinationPoint">
                Punto de Destino <span className="text-red-600">*</span>
              </Label>
              <Select
                value={destinationPointId}
                onValueChange={setDestinationPointId}
                name="destinationPoint"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione punto de destino" />
                </SelectTrigger>
                <SelectContent>
                  {availablePoints.map((point) => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.nombre} — {point.direccion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.destinationPointId && (
                <span className="text-xs text-red-600">
                  {errors.destinationPointId}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Moneda */}
            <div className="space-y-1">
              <Label htmlFor="currency">
                Moneda <span className="text-red-600">*</span>
              </Label>
              <Select
                value={currencyId}
                onValueChange={setCurrencyId}
                name="currency"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione moneda" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.codigo} — {currency.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currencyId && (
                <span className="text-xs text-red-600">
                  {errors.currencyId}
                </span>
              )}
            </div>

            {/* Monto */}
            <div className="space-y-1">
              <Label htmlFor="amount">
                Monto <span className="text-red-600">*</span>
              </Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  {selectedCurrency?.simbolo || "$"}
                </span>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="rounded-l-none"
                  disabled={!currencyId}
                  autoComplete="off"
                />
              </div>
              {errors.amount && (
                <span className="text-xs text-red-600">{errors.amount}</span>
              )}
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <Label htmlFor="description">
              Descripción / Motivo <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Transferencia de fondos para cambio de turno"
              rows={2}
            />
            {errors.description && (
              <span className="text-xs text-red-600">{errors.description}</span>
            )}
          </div>

          {/* Resumen */}
          {destinationPointId &&
            currencyId &&
            amount &&
            parseFloat(amount) > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="font-medium text-blue-900 mb-2">
                  Resumen de Transferencia
                </h4>
                <div className="space-y-1 text-sm text-blue-800">
                  <p>
                    <strong>Desde:</strong> {selectedPoint?.nombre}
                  </p>
                  <p>
                    <strong>Hacia:</strong> {selectedDestinationPoint?.nombre}
                  </p>
                  <p>
                    <strong>Monto:</strong> {selectedCurrency?.simbolo}
                    {amount} {selectedCurrency?.codigo}
                  </p>
                  <p>
                    <strong>Solicitante:</strong> {user.nombre}
                  </p>
                </div>
              </div>
            )}

          <div className="flex gap-2 pt-3">
            <Button
              type="submit"
              disabled={isLoading || Object.values(errors).some(Boolean)}
            >
              <Send className="mr-2 h-4 w-4" />
              {isLoading ? "Creando..." : "Crear Transferencia"}
            </Button>
            {formHasData && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TransferForm;
