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
        // Permitir USD aunque estuviera inactiva y mostrar todas para transferencias
        setCurrencies(
          [...fetchedCurrencies].sort((a, b) => {
            // Prioriza USD arriba y luego orden alfabético por código
            if (a.codigo === "USD" && b.codigo !== "USD") return -1;
            if (b.codigo === "USD" && a.codigo !== "USD") return 1;
            return a.codigo.localeCompare(b.codigo);
          })
        );
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
      toast.error("Error al crear la transferencia");
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
        <CardTitle>Nueva Transferencia</CardTitle>
        <CardDescription>
          Solicita una transferencia entre puntos. Todos los campos son
          obligatorios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Origen */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Punto de Origen</Label>
              <Input
                value={selectedPoint?.nombre || "No seleccionado"}
                disabled
                className="bg-muted h-9"
              />
            </div>

            {/* Destino */}
            <div className="space-y-1">
              <Label htmlFor="destinationPoint" className="text-sm font-medium">
                Punto de Destino *
              </Label>
              <Select
                value={destinationPointId}
                onValueChange={setDestinationPointId}
                name="destinationPoint"
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar destino" />
                </SelectTrigger>
                <SelectContent>
                  {availablePoints.map((point) => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.destinationPointId && (
                <span className="text-xs text-destructive">
                  {errors.destinationPointId}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Moneda */}
            <div className="space-y-1">
              <Label htmlFor="currency" className="text-sm font-medium">
                Moneda *
              </Label>
              <Select
                value={currencyId}
                onValueChange={setCurrencyId}
                name="currency"
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar moneda" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.codigo} - {currency.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currencyId && (
                <span className="text-xs text-destructive">
                  {errors.currencyId}
                </span>
              )}
            </div>

            {/* Monto */}
            <div className="space-y-1">
              <Label htmlFor="amount" className="text-sm font-medium">
                Monto *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                  {selectedCurrency?.simbolo || "$"}
                </span>
                <Input
                  id="amount"
                  className="pl-8 h-9"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  disabled={!currencyId}
                  autoComplete="off"
                />
              </div>
              {errors.amount && (
                <span className="text-xs text-destructive">
                  {errors.amount}
                </span>
              )}
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <Label htmlFor="description" className="text-sm font-medium">
              Descripción / Motivo *
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Transferencia de fondos para cambio de turno"
              rows={2}
              className="resize-none"
            />
            {errors.description && (
              <span className="text-xs text-destructive">
                {errors.description}
              </span>
            )}
          </div>

          {/* Resumen compacto */}
          {destinationPointId &&
            currencyId &&
            amount &&
            parseFloat(amount) > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <h4 className="font-medium mb-2 text-sm">Resumen</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Desde:</span>{" "}
                    {selectedPoint?.nombre}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hacia:</span>{" "}
                    {selectedDestinationPoint?.nombre}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monto:</span>{" "}
                    {selectedCurrency?.simbolo}
                    {amount} {selectedCurrency?.codigo}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Solicitante:</span>{" "}
                    {user.nombre}
                  </div>
                </div>
              </div>
            )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isLoading || Object.values(errors).some(Boolean)}
              className="h-9"
            >
              {isLoading ? "Creando..." : "Crear Transferencia"}
            </Button>
            {formHasData && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="h-9"
              >
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
