import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { User, PuntoAtencion } from "@/types";
import { useContabilidadDivisas } from "@/hooks/useContabilidadDivisas";
import { Loading } from "@/components/ui/loading";

interface SaldosDivisasEnTiempoRealProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  className?: string;
}

export const SaldosDivisasEnTiempoReal = ({
  user,
  selectedPoint,
  className = "",
}: SaldosDivisasEnTiempoRealProps) => {
  const { saldos, isLoading, error, refresh } = useContabilidadDivisas({
    user,
    selectedPoint,
  });

  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  const formatCurrency = (amount: number, codigo: string) => {
    if (codigo === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(amount);
    }

    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getSaldoStatus = (saldo: number) => {
    if (saldo <= 0)
      return { color: "destructive", icon: AlertTriangle, text: "Sin saldo" };
    if (saldo < 1000)
      return { color: "warning", icon: TrendingDown, text: "Saldo bajo" };
    return { color: "success", icon: TrendingUp, text: "Saldo normal" };
  };

  if (!selectedPoint) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          Seleccione un punto de atención para ver los saldos
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Saldos de Divisas - {selectedPoint.nombre}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="h-8"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            <Badge
              variant={autoRefresh ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              Auto-refresh {autoRefresh ? "ON" : "OFF"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && saldos.length === 0 ? (
          <Loading text="Cargando saldos..." className="py-8" />
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              Reintentar
            </Button>
          </div>
        ) : saldos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay saldos configurados para este punto</p>
            <p className="text-sm mt-2">
              Configure saldos iniciales desde el panel de administración
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Saldo principal (USD) primero */}
            {saldos
              .filter((saldo) => saldo.moneda_codigo === "USD")
              .map((saldo) => {
                const status = getSaldoStatus(saldo.saldo);
                const StatusIcon = status.icon;

                return (
                  <div
                    key={saldo.moneda_id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-full">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-800">
                          {saldo.moneda_codigo} (Principal)
                        </h3>
                        <p className="text-sm text-green-600">
                          Moneda base del sistema
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-800">
                        {formatCurrency(saldo.saldo, saldo.moneda_codigo)}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <StatusIcon className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600">
                          {status.text}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Otras monedas */}
            {saldos
              .filter((saldo) => saldo.moneda_codigo !== "USD")
              .sort((a, b) => a.moneda_codigo.localeCompare(b.moneda_codigo))
              .map((saldo) => {
                const status = getSaldoStatus(saldo.saldo);
                const StatusIcon = status.icon;

                return (
                  <div
                    key={saldo.moneda_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{saldo.moneda_codigo}</h3>
                        <p className="text-sm text-muted-foreground">
                          Moneda secundaria
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {formatCurrency(saldo.saldo, saldo.moneda_codigo)}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <StatusIcon
                          className={`h-4 w-4 ${
                            status.color === "destructive"
                              ? "text-red-500"
                              : status.color === "warning"
                              ? "text-yellow-500"
                              : "text-green-500"
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            status.color === "destructive"
                              ? "text-red-500"
                              : status.color === "warning"
                              ? "text-yellow-500"
                              : "text-green-500"
                          }`}
                        >
                          {status.text}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Resumen total */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Total de monedas configuradas:
                </span>
                <Badge variant="outline">
                  {saldos.length} moneda{saldos.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                Última actualización: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SaldosDivisasEnTiempoReal;
