import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Phone, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  Eye,
  Clock,
  MapPin,
  User,
  Banknote,
  ArrowRight
} from "lucide-react";
import { aperturaCajaService, AperturaCaja, ConteoServicioExterno } from "@/services/aperturaCajaService";
import { pointService } from "@/services/pointService";
import { PuntoAtencion } from "@/types";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatMoney(amount: number): string {
  return amount?.toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0.00";
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AperturasPendientes() {
  const { user } = useAuth();
  const [aperturas, setAperturas] = useState<AperturaCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApertura, setSelectedApertura] = useState<AperturaCaja | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [ajustarSaldos, setAjustarSaldos] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [puntos, setPuntos] = useState<PuntoAtencion[]>([]);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<string>("");

  // Cargar puntos de atención para filtro
  useEffect(() => {
    const loadPuntos = async () => {
      const result = await pointService.getAllPoints();
      if (result.points) {
        setPuntos(result.points.filter(p => p.activo));
      }
    };
    loadPuntos();
  }, []);

  const loadAperturas = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await aperturaCajaService.getAperturasPendientes(
        puntoSeleccionado ? { punto_atencion_id: puntoSeleccionado } : undefined
      );

      if (result.error) {
        setError(result.error);
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setAperturas(result.aperturas);
    } catch (e) {
      setError("Error al cargar aperturas");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAperturas();
  }, [puntoSeleccionado]);

  const handleAprobar = async () => {
    if (!selectedApertura) return;

    try {
      setProcessing(true);
      const result = await aperturaCajaService.aprobarApertura(selectedApertura.id, {
        observaciones,
        ajustar_saldos: ajustarSaldos,
      });

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Apertura aprobada",
        description: "La jornada puede iniciar correctamente.",
      });

      setDialogOpen(false);
      setSelectedApertura(null);
      setObservaciones("");
      setAjustarSaldos(false);
      loadAperturas();
    } catch (e) {
      toast({
        title: "Error",
        description: "No se pudo aprobar la apertura",
        variant: "destructive",
      });
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleRechazar = async () => {
    if (!selectedApertura) return;

    try {
      setProcessing(true);
      const result = await aperturaCajaService.rechazarApertura(
        selectedApertura.id,
        observaciones
      );

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Apertura rechazada",
        description: "El operador debe realizar un nuevo conteo.",
      });

      setDialogOpen(false);
      setSelectedApertura(null);
      setObservaciones("");
      loadAperturas();
    } catch (e) {
      toast({
        title: "Error",
        description: "No se pudo rechazar la apertura",
        variant: "destructive",
      });
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  const abrirDetalle = (apertura: AperturaCaja) => {
    setSelectedApertura(apertura);
    setObservaciones(apertura.observaciones_admin || "");
    setAjustarSaldos(false);
    setDialogOpen(true);
  };

  const abrirVideollamada = () => {
    const meetUrl = `https://meet.google.com/new`;
    window.open(meetUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Cargando aperturas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Aperturas de Caja Pendientes</h1>
          <p className="text-gray-500">
            Gestiona las aperturas que requieren verificación
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro por punto de atención */}
          <Select value={puntoSeleccionado} onValueChange={setPuntoSeleccionado}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Todos los puntos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los puntos</SelectItem>
              {puntos.map((punto) => (
                <SelectItem key={punto.id} value={punto.id}>
                  {punto.nombre} ({punto.ciudad})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAperturas} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Pendientes</p>
                <p className="text-3xl font-bold">{aperturas.length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Con Diferencias</p>
                <p className="text-3xl font-bold text-red-600">
                  {aperturas.filter((a) => a.estado === "CON_DIFERENCIA").length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">En Conteo</p>
                <p className="text-3xl font-bold text-amber-600">
                  {aperturas.filter((a) => a.estado === "EN_CONTEO").length}
                </p>
              </div>
              <Banknote className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de aperturas */}
      {aperturas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium">No hay aperturas pendientes</h3>
            <p className="text-gray-500 mt-1">
              Todas las aperturas han sido verificadas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {aperturas.map((apertura) => (
            <Card key={apertura.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Info principal */}
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-lg ${
                          apertura.estado === "CON_DIFERENCIA"
                            ? "bg-red-100"
                            : "bg-amber-100"
                        }`}
                      >
                        {apertura.estado === "CON_DIFERENCIA" ? (
                          <AlertTriangle className="h-6 w-6 text-red-600" />
                        ) : (
                          <Clock className="h-6 w-6 text-amber-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">
                            {apertura.puntoAtencion?.nombre}
                          </h3>
                          <Badge
                            variant={
                              apertura.estado === "CON_DIFERENCIA"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {apertura.estado === "CON_DIFERENCIA"
                              ? "Con Diferencia"
                              : "En Conteo"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {apertura.usuario?.nombre}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {apertura.puntoAtencion?.ciudad}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(apertura.hora_inicio_conteo)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Diferencias */}
                    {apertura.diferencias && apertura.diferencias.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-red-800 mb-1">
                          Diferencias detectadas:
                        </p>
                        {apertura.diferencias
                          .filter((d) => d.fuera_tolerancia)
                          .map((d) => (
                            <div
                              key={d.moneda_id}
                              className="text-sm text-red-700"
                            >
                              {d.codigo}: Esperado ${formatMoney(d.esperado)} vs{" "}
                              Físico ${formatMoney(d.fisico)} ={" "}
                              <span className="font-bold">
                                {d.diferencia > 0 ? "+" : ""}
                                ${formatMoney(d.diferencia)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirDetalle(apertura)}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        Ver Detalle
                      </Button>
                      {apertura.estado === "CON_DIFERENCIA" && (
                        <Button
                          size="sm"
                          onClick={abrirVideollamada}
                          className="gap-1"
                        >
                          <Phone className="h-4 w-4" />
                          Llamar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de detalle */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Apertura</DialogTitle>
            <DialogDescription>
              Revisa el conteo del operador y aprueba o rechaza la apertura
            </DialogDescription>
          </DialogHeader>

          {selectedApertura && (
            <div className="space-y-6">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Operador:</span>
                  <p className="font-medium">{selectedApertura.usuario?.nombre}</p>
                </div>
                <div>
                  <span className="text-gray-500">Punto:</span>
                  <p className="font-medium">
                    {selectedApertura.puntoAtencion?.nombre}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Inicio conteo:</span>
                  <p className="font-medium">
                    {formatDateTime(selectedApertura.hora_inicio_conteo)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Fin conteo:</span>
                  <p className="font-medium">
                    {formatDateTime(selectedApertura.hora_fin_conteo)}
                  </p>
                </div>
              </div>

              {/* Tabs para Efectivo y Servicios Externos */}
              <Tabs defaultValue="efectivo" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="efectivo">
                    Efectivo {selectedApertura.diferencias?.some(d => d.fuera_tolerancia) && "⚠️"}
                  </TabsTrigger>
                  <TabsTrigger value="servicios">
                    Servicios Externos {selectedApertura.conteo_servicios_externos?.some(s => (s.diferencia || 0) !== 0) && "⚠️"}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="efectivo" className="space-y-4">
                  {selectedApertura.diferencias && selectedApertura.diferencias.length > 0 && (
                    <div className={`p-3 rounded-lg ${selectedApertura.diferencias.some(d => d.fuera_tolerancia) ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                      <p className={`text-sm font-medium ${selectedApertura.diferencias.some(d => d.fuera_tolerancia) ? 'text-red-800' : 'text-green-800'}`}>
                        {selectedApertura.diferencias.some(d => d.fuera_tolerancia) 
                          ? "⚠️ Hay diferencias fuera de tolerancia" 
                          : "✅ Todo cuadrado"}
                      </p>
                    </div>
                  )}
              {selectedApertura.conteo_fisico?.map((conteo) => {
                  const diferencia = selectedApertura.diferencias?.find(
                    (d) => d.moneda_id === conteo.moneda_id
                  );
                  const saldoEsperado = selectedApertura.saldo_esperado?.find(
                    (s) => s.moneda_id === conteo.moneda_id
                  );

                  return (
                    <Card key={conteo.moneda_id} className="bg-gray-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">
                            {saldoEsperado?.codigo} - {saldoEsperado?.nombre}
                          </span>
                          {diferencia?.fuera_tolerancia ? (
                            <Badge variant="destructive">Diferencia</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-600">
                              Cuadrado
                            </Badge>
                          )}
                        </div>

                        {/* Desglose */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">Billetes:</p>
                            {conteo.billetes.length > 0 ? (
                              <div className="space-y-1">
                                {conteo.billetes.map((b) => (
                                  <div key={b.denominacion} className="flex justify-between">
                                    <span>${b.denominacion}</span>
                                    <span>x {b.cantidad}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">Ninguno</span>
                            )}
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Monedas:</p>
                            {conteo.monedas.length > 0 ? (
                              <div className="space-y-1">
                                {conteo.monedas.map((m) => (
                                  <div key={m.denominacion} className="flex justify-between">
                                    <span>
                                      {m.denominacion >= 1
                                        ? `$${m.denominacion}`
                                        : `${(m.denominacion * 100).toFixed(0)}¢`}
                                    </span>
                                    <span>x {m.cantidad}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">Ninguna</span>
                            )}
                          </div>
                        </div>

                        {/* Totales */}
                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                          <div className="text-sm">
                            <span className="text-gray-500">Esperado: </span>
                            <span className="font-medium">
                              ${formatMoney(saldoEsperado?.cantidad || 0)}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <div className="text-sm">
                            <span className="text-gray-500">Físico: </span>
                            <span className="font-medium">
                              ${formatMoney(conteo.total)}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <div className="text-sm">
                            <span className="text-gray-500">Diferencia: </span>
                            <span
                              className={`font-bold ${
                                (diferencia?.diferencia || 0) > 0
                                  ? "text-green-600"
                                  : (diferencia?.diferencia || 0) < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {(diferencia?.diferencia || 0) > 0 ? "+" : ""}
                              ${formatMoney(diferencia?.diferencia || 0)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                </TabsContent>

                <TabsContent value="servicios" className="space-y-4">
                  {!selectedApertura.conteo_servicios_externos || selectedApertura.conteo_servicios_externos.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No hay servicios externos registrados</p>
                  ) : (
                    selectedApertura.conteo_servicios_externos.map((servicio: ConteoServicioExterno, idx: number) => (
                      <Card key={idx} className={`${(servicio.diferencia || 0) !== 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{servicio.servicio_nombre}</span>
                            {(servicio.diferencia || 0) !== 0 && (
                              <Badge variant="destructive">Diferencia</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Saldo Sistema:</span>
                              <p className="font-medium">{servicio.simbolo} {formatMoney(servicio.saldo_sistema)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Saldo Validado:</span>
                              <p className="font-medium">{servicio.simbolo} {formatMoney(servicio.saldo_validado || 0)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Diferencia:</span>
                              <p className={`font-bold ${(servicio.diferencia || 0) > 0 ? 'text-green-600' : (servicio.diferencia || 0) < 0 ? 'text-red-600' : ''}`}>
                                {(servicio.diferencia || 0) > 0 ? '+' : ''}{formatMoney(servicio.diferencia || 0)}
                              </p>
                            </div>
                          </div>
                          {servicio.observaciones && (
                            <div className="mt-2 text-sm">
                              <span className="text-gray-500">Observaciones:</span>
                              <p className="text-gray-700">{servicio.observaciones}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>

              {/* Observaciones del operador */}
              {selectedApertura.observaciones_operador && (
                <div>
                  <Label className="text-gray-500">
                    Observaciones del operador:
                  </Label>
                  <p className="text-sm bg-gray-50 p-3 rounded mt-1">
                    {selectedApertura.observaciones_operador}
                  </p>
                </div>
              )}

              {/* Acciones de admin */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ajustar"
                    checked={ajustarSaldos}
                    onCheckedChange={(checked) =>
                      setAjustarSaldos(checked as boolean)
                    }
                  />
                  <Label htmlFor="ajustar" className="text-sm">
                    Ajustar saldos del sistema para que coincidan con el conteo
                    físico
                  </Label>
                </div>

                <div>
                  <Label htmlFor="observaciones">Tus observaciones:</Label>
                  <Textarea
                    id="observaciones"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Añade observaciones sobre la verificación..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRechazar}
              disabled={processing}
              className="gap-1"
            >
              {processing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Rechazar
            </Button>
            <Button
              onClick={handleAprobar}
              disabled={processing}
              className="gap-1 bg-green-600 hover:bg-green-700"
            >
              {processing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Aprobar Apertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
