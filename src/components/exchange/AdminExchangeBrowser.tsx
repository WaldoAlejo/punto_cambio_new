import { useEffect, useMemo, useState, useCallback } from "react";
import { User, PuntoAtencion, CambioDivisa, Moneda, Usuario } from "@/types";
import { pointService } from "@/services/pointService";
import { exchangeService } from "@/services/exchangeService";
import { currencyService } from "@/services/currencyService";
import { userService } from "@/services/userService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ExchangeList from "./ExchangeList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

interface AdminExchangeBrowserProps {
  user: User;
}

/**
 * AdminExchangeBrowser
 * - Vista SOLO para ADMIN/SUPER_USUARIO
 * - Lista todas las transacciones de cambio de todos los puntos (o filtradas por punto)
 * - Permite eliminar cambios (solo del día actual; validación en backend)
 * - Dispara evento global "saldosUpdated" tras eliminar para refrescar contabilidad general y por punto
 * - Filtros: por punto (server-side), por operador (client-side), por valor (client-side, origen o destino)
 */
const AdminExchangeBrowser = ({ user }: AdminExchangeBrowserProps) => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>("ALL");
  const [exchanges, setExchanges] = useState<CambioDivisa[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [operators, setOperators] = useState<Usuario[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("ALL");
  const [valueMin, setValueMin] = useState<string>("");
  const [valueMax, setValueMax] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = useMemo(
    () => user?.rol === "ADMIN" || user?.rol === "SUPER_USUARIO",
    [user?.rol]
  );

  const loadCurrencies = useCallback(async () => {
    const { currencies, error } = await currencyService.getAllCurrencies();
    if (error) {
      toast.error(error);
      setCurrencies([]);
    } else {
      setCurrencies(currencies);
    }
  }, []);

  const loadPoints = useCallback(async () => {
    const { points, error } = await pointService.getAllPointsForAdmin();
    if (error) {
      toast.error(error);
      setPoints([]);
    } else {
      setPoints(points);
    }
  }, []);

  const loadOperators = useCallback(async () => {
    const { users, error } = await userService.getAllUsers();
    if (error) {
      toast.error(error);
      setOperators([]);
      return;
    }
    const activeOperators = (users || [])
      .filter((u) => u.rol === "OPERADOR" && u.activo)
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    setOperators(activeOperators);
  }, []);

  const loadExchanges = useCallback(async (pointId: string) => {
    setError(null);
    try {
      if (pointId && pointId !== "ALL") {
        const { exchanges, error } = await exchangeService.getExchangesByPoint(
          pointId
        );
        if (error) {
          setExchanges([]);
          setError(error);
        } else {
          setExchanges(exchanges);
        }
      } else {
        const { exchanges, error } = await exchangeService.getAllExchanges();
        if (error) {
          setExchanges([]);
          setError(error);
        } else {
          setExchanges(exchanges);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Error al cargar cambios");
      setExchanges([]);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsLoading(true);
        await Promise.all([loadCurrencies(), loadPoints(), loadOperators()]);
        if (!isMounted) return;
        await loadExchanges("ALL");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [loadCurrencies, loadPoints, loadOperators, loadExchanges]);

  useEffect(() => {
    // Cuando cambia el punto seleccionado, recargar lista
    (async () => {
      setIsRefreshing(true);
      await loadExchanges(selectedPointId);
      setIsRefreshing(false);
    })();
  }, [selectedPointId, loadExchanges]);

  const handleDeleted = (id: string) => {
    setExchanges((prev) => prev.filter((e) => e.id !== id));
  };

  const filteredExchanges = useMemo(() => {
    const min = valueMin.trim() !== "" ? Number(valueMin) : null;
    const max = valueMax.trim() !== "" ? Number(valueMax) : null;

    return exchanges.filter((e) => {
      // Filtro por operador
      if (selectedOperatorId !== "ALL" && e.usuario_id !== selectedOperatorId) {
        return false;
      }

      // Filtro por valor (coincide si monto_origen o monto_destino está dentro del rango)
      if (min !== null || max !== null) {
        const origin = Number(e.monto_origen || 0);
        const dest = Number(e.monto_destino || 0);
        const inRange = (v: number) => {
          if (Number.isNaN(v)) return false;
          if (min !== null && v < min) return false;
          if (max !== null && v > max) return false;
          return true;
        };
        const match = inRange(origin) || inRange(dest);
        if (!match) return false;
      }

      return true;
    });
  }, [exchanges, selectedOperatorId, valueMin, valueMax]);

  if (!isAdmin) {
    return (
      <div className="p-6 text-center py-12 text-red-500">
        Permisos insuficientes
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border/50">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-primary">
                Cambios de Divisas (Admin)
              </h1>
              <p className="text-sm text-muted-foreground">
                Visualiza y gestiona cambios de todos los puntos. Solo se pueden
                eliminar operaciones del día actual.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Punto selector */}
              <div className="min-w-[220px]">
                <Select
                  value={selectedPointId}
                  onValueChange={(v) => setSelectedPointId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un punto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los puntos</SelectItem>
                    {points.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operador selector */}
              <div className="min-w-[220px]">
                <Select
                  value={selectedOperatorId}
                  onValueChange={(v) => setSelectedOperatorId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Operador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los operadores</SelectItem>
                    {operators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.nombre || op.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por valor: rango min/max (aplica a origen o destino) */}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Valor min"
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value)}
                  className="w-[120px]"
                />
                <span className="text-muted-foreground text-xs">a</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Valor max"
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value)}
                  className="w-[120px]"
                />
              </div>

              <Button
                variant="outline"
                onClick={async () => {
                  setIsRefreshing(true);
                  await loadExchanges(selectedPointId);
                  setIsRefreshing(false);
                }}
                disabled={isLoading || isRefreshing}
                className="whitespace-nowrap"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Listado{" "}
                {selectedPointId === "ALL"
                  ? "(Todos los puntos)"
                  : "(Punto seleccionado)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-3 text-sm text-red-600">{error}</div>
              )}
              <ExchangeList
                exchanges={filteredExchanges}
                currencies={currencies}
                onDeleted={handleDeleted}
                onReprintReceipt={undefined}
                /* Mostrar punto y usuario al admin */
                showPointName
                showUserName
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminExchangeBrowser;
