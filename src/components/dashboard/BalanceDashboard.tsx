import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calculator,
  BarChart3,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, VistaSaldosPorPunto } from "../../types";
import { saldoInicialService } from "../../services/saldoInicialService";
import ContabilidadDiaria from "./ContabilidadDiaria";

interface BalanceDashboardProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const BalanceDashboard = ({ user, selectedPoint }: BalanceDashboardProps) => {
  const [saldos, setSaldos] = useState<VistaSaldosPorPunto[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (selectedPoint) {
      loadSaldos();

      // Configurar auto-refresh cada 30 segundos
      const interval = setInterval(() => {
        loadSaldos();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [selectedPoint]);

  // Escuchar eventos de cambios de divisas completados y transferencias aprobadas
  useEffect(() => {
    const handleExchangeCompleted = () => {
      console.log("🔄 Exchange completed, refreshing balances...");
      loadSaldos();
    };

    const handleTransferApproved = () => {
      console.log("🔄 Transfer approved, refreshing balances...");
      loadSaldos();
    };

    // Escuchar eventos personalizados
    window.addEventListener("exchangeCompleted", handleExchangeCompleted);
    window.addEventListener("transferApproved", handleTransferApproved);

    return () => {
      window.removeEventListener("exchangeCompleted", handleExchangeCompleted);
      window.removeEventListener("transferApproved", handleTransferApproved);
    };
  }, []);

  const loadSaldos = async () => {
    if (!selectedPoint) return;

    setLoading(true);
    try {
      console.log("Loading balances for point:", selectedPoint.id);
      const response = await saldoInicialService.getVistaSaldosPorPunto();
      console.log("Balance response:", response);

      if (response.error) {
        console.error("Balance service error:", response.error);
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive",
        });
      } else {
        // Filtrar solo los saldos del punto seleccionado y que tengan saldo inicial > 0
        const saldosPunto = response.saldos.filter(
          (s) =>
            s.punto_atencion_id === selectedPoint.id &&
            Number(s.saldo_inicial) > 0
        );
        console.log("Filtered balances:", saldosPunto);
        setSaldos(saldosPunto);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("Error loading balances:", error);
      toast({
        title: "Error",
        description: `Error inesperado: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getBalanceStatus = (saldo: VistaSaldosPorPunto) => {
    if (Number(saldo.saldo_inicial) === 0) return "Sin configurar";
    if (Number(saldo.diferencia) > 0) return "Excedente";
    if (Number(saldo.diferencia) < 0) return "Déficit";
    return "Equilibrado";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Sin configurar":
        return "secondary";
      case "Excedente":
        return "default";
      case "Déficit":
        return "destructive";
      case "Equilibrado":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getBalanceIcon = (diferencia: number) => {
    if (diferencia > 0)
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (diferencia < 0)
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <DollarSign className="h-4 w-4 text-gray-600" />;
  };

  if (!selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            Debe seleccionar un punto de atención para ver los saldos
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Saldos por Moneda
            </h2>
            <p className="text-gray-600">
              {selectedPoint.nombre} - {selectedPoint.ciudad}
            </p>
          </div>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando saldos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Dashboard Operativo
          </h2>
          <div className="flex items-center gap-2 text-gray-600">
            <span>
              {selectedPoint.nombre} - {selectedPoint.ciudad}
            </span>
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                • Actualizado: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="saldos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="saldos" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Saldos por Moneda
          </TabsTrigger>
          <TabsTrigger value="contabilidad" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Contabilidad Diaria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="saldos" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                🔄 Auto-actualización: 30s
              </div>
              <Button
                onClick={loadSaldos}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Actualizar
              </Button>
            </div>
          </div>

          {/* Resumen General */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Monedas
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{saldos.length}</div>
                <p className="text-xs text-muted-foreground">
                  Monedas configuradas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Balance General
                </CardTitle>
                {getBalanceIcon(
                  saldos.reduce(
                    (total, saldo) => total + Number(saldo.diferencia),
                    0
                  )
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {saldos.reduce(
                    (total, saldo) => total + Number(saldo.diferencia),
                    0
                  ) >= 0
                    ? "+"
                    : ""}
                  $
                  {Number(
                    saldos.reduce(
                      (total, saldo) => total + Number(saldo.diferencia),
                      0
                    )
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Diferencia total vs inicial
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Última Actualización
                </CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {lastUpdate ? lastUpdate.toLocaleTimeString() : "--:--"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastUpdate
                    ? lastUpdate.toLocaleDateString()
                    : "No actualizado"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detalle por Moneda */}
          <div className="grid gap-4">
            {saldos.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">
                      No hay saldos configurados
                    </p>
                    <p className="text-gray-400 text-sm">
                      Contacte al administrador para configurar los saldos
                      iniciales
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              saldos.map((saldo) => (
                <Card
                  key={`${saldo.punto_atencion_id}-${saldo.moneda_id}`}
                  className="transition-all duration-200 hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {saldo.moneda_codigo} - {saldo.moneda_nombre}
                        </CardTitle>
                        <p className="text-sm text-gray-500">
                          Símbolo: {saldo.moneda_simbolo}
                        </p>
                      </div>
                      <Badge variant={getStatusColor(getBalanceStatus(saldo))}>
                        {getBalanceStatus(saldo)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-600 font-medium">
                          Saldo Inicial
                        </p>
                        <p className="text-lg font-bold text-blue-800">
                          {saldo.moneda_simbolo}
                          {Number(saldo.saldo_inicial).toFixed(2)}
                        </p>
                      </div>

                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">
                          Saldo Actual
                        </p>
                        <p className="text-lg font-bold text-green-800">
                          {saldo.moneda_simbolo}
                          {Number(saldo.saldo_actual).toFixed(2)}
                        </p>
                      </div>

                      <div
                        className={`p-3 rounded-lg ${
                          Number(saldo.diferencia) >= 0
                            ? "bg-green-50"
                            : "bg-red-50"
                        }`}
                      >
                        <p
                          className={`text-sm font-medium ${
                            Number(saldo.diferencia) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          Diferencia
                        </p>
                        <p
                          className={`text-lg font-bold ${
                            Number(saldo.diferencia) >= 0
                              ? "text-green-800"
                              : "text-red-800"
                          }`}
                        >
                          {Number(saldo.diferencia) >= 0 ? "+" : ""}
                          {saldo.moneda_simbolo}
                          {Number(saldo.diferencia).toFixed(2)}
                        </p>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 font-medium">
                          Físico
                        </p>
                        <p className="text-sm text-gray-800">
                          {saldo.billetes} billetes
                        </p>
                        <p className="text-sm text-gray-800">
                          {saldo.monedas_fisicas} monedas
                        </p>
                      </div>
                    </div>

                    {saldo.ultima_actualizacion && (
                      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                        Última actualización:{" "}
                        {new Date(saldo.ultima_actualizacion).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="contabilidad">
          <ContabilidadDiaria user={user} selectedPoint={selectedPoint} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BalanceDashboard;
