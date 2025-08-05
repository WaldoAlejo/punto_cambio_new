import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Eye,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Coins,
} from "lucide-react";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  PuntoAtencion,
  Moneda,
  VistaSaldosPorPunto,
  MovimientoSaldo,
} from "../../types";
import { pointService } from "../../services/pointService";
import { currencyService } from "../../services/currencyService";
import { saldoInicialService } from "../../services/saldoInicialService";

const SaldoInicialManagement = () => {
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [vistaSaldos, setVistaSaldos] = useState<VistaSaldosPorPunto[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movimientosDialog, setMovimientosDialog] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoSaldo[]>([]);
  const [selectedPointForMovements, setSelectedPointForMovements] =
    useState<string>("");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [pointsResponse, currenciesResponse, vistaSaldosResponse] =
        await Promise.all([
          pointService.getAllPoints(),
          currencyService.getAllCurrencies(),
          saldoInicialService.getVistaSaldosPorPunto(),
        ]);

      if (pointsResponse.error) {
        toast.error(`Error al cargar puntos: ${pointsResponse.error}`);
      } else {
        setPoints(pointsResponse.points);
      }

      if (currenciesResponse.error) {
        toast.error(`Error al cargar monedas: ${currenciesResponse.error}`);
      } else {
        setCurrencies(currenciesResponse.currencies);
      }

      if (vistaSaldosResponse.error) {
        toast.error(`Error al cargar saldos: ${vistaSaldosResponse.error}`);
      } else {
        setVistaSaldos(vistaSaldosResponse.saldos);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error(
        `Error inesperado: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAsignarSaldo = () => {
    if (!selectedPoint || !selectedCurrency || !cantidad) {
      toast.error("Debe completar todos los campos obligatorios");
      return;
    }

    const cantidadNum = parseFloat(cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast.error("La cantidad debe ser un número positivo");
      return;
    }

    const punto = points.find((p) => p.id === selectedPoint);
    const moneda = currencies.find((c) => c.id === selectedCurrency);

    showConfirmation(
      "Confirmar asignación de saldo",
      `¿Está seguro de asignar ${cantidadNum.toLocaleString()} ${
        moneda?.codigo
      } al punto "${punto?.nombre}"?`,
      async () => {
        setLoading(true);
        try {
          const response = await saldoInicialService.asignarSaldoInicial({
            punto_atencion_id: selectedPoint,
            moneda_id: selectedCurrency,
            cantidad_inicial: cantidadNum,
            observaciones: observaciones || undefined,
          });

          if (response.error) {
            toast.error(`Error al asignar saldo: ${response.error}`);
          } else {
            toast.success(
              `✅ Saldo de ${cantidadNum.toLocaleString()} ${
                moneda?.codigo
              } asignado exitosamente`
            );
            setDialogOpen(false);
            resetForm();
            loadInitialData();
          }
        } catch (error) {
          console.error("Error assigning initial balance:", error);
          toast.error("Error inesperado al asignar saldo");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const resetForm = () => {
    setSelectedPoint("");
    setSelectedCurrency("");
    setCantidad("");
    setObservaciones("");
  };

  const handleVerMovimientos = async (pointId: string) => {
    setSelectedPointForMovements(pointId);
    setLoading(true);

    try {
      const response = await saldoInicialService.getMovimientosSaldo(pointId);

      if (response.error) {
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive",
        });
      } else {
        setMovimientos(response.movimientos);
        setMovimientosDialog(true);
      }
    } catch (error) {
      console.error("Error loading movements:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBalanceColor = (diferencia: number) => {
    if (diferencia > 0) return "text-green-600";
    if (diferencia < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getMovementIcon = (tipo: string) => {
    const isIncoming = [
      "COMPRA",
      "TRANSFERENCIA_ENTRADA",
      "SALDO_INICIAL",
    ].includes(tipo);
    return isIncoming ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    );
  };

  const groupedSaldos = vistaSaldos.reduce((acc, saldo) => {
    if (!acc[saldo.punto_atencion_id]) {
      acc[saldo.punto_atencion_id] = {
        punto: saldo,
        monedas: [],
      };
    }
    acc[saldo.punto_atencion_id].monedas.push(saldo);
    return acc;
  }, {} as Record<string, { punto: VistaSaldosPorPunto; monedas: VistaSaldosPorPunto[] }>);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            Gestión de Saldos Iniciales
          </h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Gestión de Saldos Iniciales
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Asignar Saldo Inicial
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar Saldo Inicial</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Punto de Atención</Label>
                <Select value={selectedPoint} onValueChange={setSelectedPoint}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar punto" />
                  </SelectTrigger>
                  <SelectContent>
                    {points.map((point) => (
                      <SelectItem key={point.id} value={point.id}>
                        {point.nombre} - {point.ciudad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Moneda</Label>
                <Select
                  value={selectedCurrency}
                  onValueChange={setSelectedCurrency}
                >
                  <SelectTrigger>
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
              </div>

              <div>
                <Label>Cantidad Inicial</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label>Observaciones</Label>
                <Textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Observaciones adicionales..."
                />
              </div>

              <Button
                onClick={handleAsignarSaldo}
                className="w-full"
                disabled={loading}
              >
                {loading ? "Asignando..." : "Asignar Saldo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {Object.values(groupedSaldos).map(({ punto, monedas }) => (
          <Card key={punto.punto_atencion_id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{punto.punto_nombre}</CardTitle>
                  <p className="text-sm text-gray-500">{punto.ciudad}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerMovimientos(punto.punto_atencion_id)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Movimientos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {monedas.map((saldo) => (
                  <div
                    key={`${saldo.punto_atencion_id}-${saldo.moneda_id}`}
                    className="border rounded-lg p-4"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                      <div>
                        <p className="font-semibold">{saldo.moneda_codigo}</p>
                        <p className="text-sm text-gray-500">
                          {saldo.moneda_nombre}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm text-gray-500">Saldo Inicial</p>
                        <p className="font-semibold">
                          {saldo.moneda_simbolo}
                          {Number(saldo.saldo_inicial).toFixed(2)}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm text-gray-500">Saldo Actual</p>
                        <p className="font-semibold">
                          {saldo.moneda_simbolo}
                          {Number(saldo.saldo_actual).toFixed(2)}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm text-gray-500">Diferencia</p>
                        <p
                          className={`font-semibold ${getBalanceColor(
                            Number(saldo.diferencia)
                          )}`}
                        >
                          {Number(saldo.diferencia) >= 0 ? "+" : ""}
                          {saldo.moneda_simbolo}
                          {Number(saldo.diferencia).toFixed(2)}
                        </p>
                      </div>

                      <div className="text-center">
                        <div className="flex flex-col space-y-2">
                          <Badge
                            variant={
                              Number(saldo.saldo_inicial) > 0
                                ? "default"
                                : "secondary"
                            }
                          >
                            {Number(saldo.saldo_inicial) > 0
                              ? "Configurado"
                              : "Sin configurar"}
                          </Badge>
                          {punto.punto_nombre === "Casa de Cambios Principal" &&
                            Number(saldo.saldo_inicial) > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPoint(punto.punto_atencion_id);
                                  setSelectedCurrency(saldo.moneda_id);
                                  setCantidad(String(saldo.saldo_inicial));
                                  setDialogOpen(true);
                                }}
                              >
                                Editar
                              </Button>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog para ver movimientos */}
      <Dialog open={movimientosDialog} onOpenChange={setMovimientosDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Movimientos de Saldo -{" "}
              {points.find((p) => p.id === selectedPointForMovements)?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {movimientos.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No hay movimientos registrados
              </p>
            ) : (
              <div className="space-y-2">
                {movimientos.map((movimiento) => (
                  <div key={movimiento.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getMovementIcon(movimiento.tipo_movimiento)}
                        <div>
                          <p className="font-semibold">
                            {movimiento.tipo_movimiento.replace("_", " ")}
                          </p>
                          <p className="text-sm text-gray-500">
                            {movimiento.descripcion}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {movimiento.moneda?.simbolo}
                          {Math.abs(Number(movimiento.monto)).toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(movimiento.fecha).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Saldo Anterior: </span>
                        <span>
                          {movimiento.moneda?.simbolo}
                          {Number(movimiento.saldo_anterior).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Monto: </span>
                        <span
                          className={
                            Number(movimiento.monto) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {Number(movimiento.monto) >= 0 ? "+" : ""}
                          {movimiento.moneda?.simbolo}
                          {Number(movimiento.monto).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Saldo Nuevo: </span>
                        <span>
                          {movimiento.moneda?.simbolo}
                          {Number(movimiento.saldo_nuevo).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog />
    </div>
  );
};

export default SaldoInicialManagement;
