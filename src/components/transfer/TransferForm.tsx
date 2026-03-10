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
import { User, PuntoAtencion, Moneda } from "@/types";
import { transferService } from "@/services/transferService";
import { currencyService } from "@/services/currencyService";
import { pointService } from "@/services/pointService";
import { toast } from "sonner";
import { Search, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [currencySearch, setCurrencySearch] = useState("");
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingCurrencies(true);
      setLoadError(null);
      try {
        const { points } = await pointService.getActivePointsForTransfers();
        setAvailablePoints(
          points.filter((point) => point.id !== selectedPoint?.id)
        );

        const { currencies: fetchedCurrencies, error: currenciesError } =
          await currencyService.getAllCurrencies();
        
        if (currenciesError) {
          console.error("Error cargando monedas:", currenciesError);
          setLoadError(currenciesError);
          toast.error("Error al cargar monedas: " + currenciesError);
          setIsLoadingCurrencies(false);
          return;
        }

        // Verificar que USD esté presente
        const usdCurrency = fetchedCurrencies?.find(c => c.codigo === "USD");
        if (!usdCurrency) {
          console.warn("⚠️ USD no encontrado en la lista de monedas cargadas");
          toast.warning("No se encontró el dólar (USD) en la lista de monedas. Contacte al administrador.");
        } else {
          console.log("✅ USD encontrado:", usdCurrency);
        }

        // Ordenar: USD primero, luego activas, luego inactivas, todo alfabético
        const sortedCurrencies = [...(fetchedCurrencies || [])].sort((a, b) => {
          // USD siempre primero
          if (a.codigo === "USD" && b.codigo !== "USD") return -1;
          if (b.codigo === "USD" && a.codigo !== "USD") return 1;
          
          // Luego activas antes que inactivas
          if (a.activo && !b.activo) return -1;
          if (!a.activo && b.activo) return 1;
          
          // Finalmente orden alfabético
          return a.codigo.localeCompare(b.codigo);
        });

        console.log(`✅ ${sortedCurrencies.length} monedas cargadas`);
        setCurrencies(sortedCurrencies);
      } catch (error) {
        console.error("Error cargando datos:", error);
        setLoadError("Error al cargar datos necesarios");
        toast.error("Error al cargar datos necesarios");
      } finally {
        setIsLoadingCurrencies(false);
      }
    };

    loadData();
  }, [selectedPoint]);

  // Filtrar monedas según búsqueda
  const filteredCurrencies = currencySearch.trim() 
    ? currencies.filter(c => 
        c.codigo.toLowerCase().includes(currencySearch.toLowerCase()) ||
        c.nombre.toLowerCase().includes(currencySearch.toLowerCase())
      )
    : currencies;

  // Monedas activas para transferencias (incluye USD aunque esté inactivo)
  const activeCurrencies = currencies.filter(c => c.activo || c.codigo === "USD");

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
        via: "EFECTIVO" as const, // Por defecto, las transferencias son en efectivo
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
      setCurrencySearch("");
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

  // Encontrar USD para mostrarlo destacado si no está seleccionado
  const usdCurrency = currencies.find(c => c.codigo === "USD");

  if (loadError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{loadError}</p>
          </div>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
            variant="outline"
          >
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg">Nueva Transferencia</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Solicita transferencia entre puntos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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
              <Label htmlFor="currency" className="text-xs sm:text-sm font-medium">
                Moneda *
              </Label>
              
              {/* Input de búsqueda para monedas */}
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar moneda..."
                  value={currencySearch}
                  onChange={(e) => setCurrencySearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              <Select
                value={currencyId}
                onValueChange={setCurrencyId}
                name="currency"
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={isLoadingCurrencies ? "Cargando..." : "Seleccionar moneda"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {/* Mostrar USD primero si existe y no está filtrado */}
                  {usdCurrency && !currencySearch.trim() && (
                    <SelectItem 
                      key={usdCurrency.id} 
                      value={usdCurrency.id}
                      className="bg-primary/5 font-medium"
                    >
                      {usdCurrency.codigo} - {usdCurrency.nombre} ⭐
                    </SelectItem>
                  )}
                  
                  {/* Separador si hay USD y no hay búsqueda */}
                  {usdCurrency && !currencySearch.trim() && filteredCurrencies.length > 1 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground border-t my-1">
                      Otras monedas ({filteredCurrencies.length - 1})
                    </div>
                  )}
                  
                  {filteredCurrencies
                    .filter(c => !usdCurrency || c.id !== usdCurrency.id || currencySearch.trim())
                    .map((currency) => (
                    <SelectItem 
                      key={currency.id} 
                      value={currency.id}
                      className={!currency.activo ? "text-muted-foreground" : ""}
                    >
                      <span className="flex items-center gap-2">
                        {currency.codigo} - {currency.nombre}
                        {!currency.activo && (
                          <Badge variant="secondary" className="text-[10px]">inactiva</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                  
                  {filteredCurrencies.length === 0 && (
                    <div className="px-2 py-2 text-sm text-muted-foreground text-center">
                      No se encontraron monedas
                    </div>
                  )}
                </SelectContent>
              </Select>
              
              {/* Info de monedas disponibles */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{activeCurrencies.length} monedas disponibles</span>
                {usdCurrency && (
                  <span className="text-primary">
                    USD: {usdCurrency.activo ? "Activo" : "Inactivo pero usable"}
                  </span>
                )}
              </div>
              
              {errors.currencyId && (
                <span className="text-xs text-destructive">
                  {errors.currencyId}
                </span>
              )}
            </div>

            {/* Monto */}
            <div className="space-y-1">
              <Label htmlFor="amount" className="text-xs sm:text-sm font-medium">
                Monto *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-xs sm:text-sm">
                  {selectedCurrency?.simbolo || "$"}
                </span>
                <Input
                  id="amount"
                  className="pl-7 sm:pl-8 h-9 text-sm"
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
            <Label htmlFor="description" className="text-xs sm:text-sm font-medium">
              Descripción *
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Transferencia de fondos"
              rows={2}
              className="resize-none text-sm"
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
              <div className="p-2.5 sm:p-3 bg-muted/50 rounded-lg border">
                <h4 className="font-medium mb-2 text-xs sm:text-sm">Resumen</h4>
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
                    <span className="text-muted-foreground">Solicita:</span>{" "}
                    {user.nombre}
                  </div>
                </div>
              </div>
            )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="submit"
              disabled={isLoading || Object.values(errors).some(Boolean)}
              className="h-9 text-sm"
            >
              {isLoading ? "Creando..." : "Crear"}
            </Button>
            {formHasData && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="h-9 text-sm"
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
