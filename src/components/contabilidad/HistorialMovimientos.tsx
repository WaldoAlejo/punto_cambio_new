import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Filter,
  Calendar,
  DollarSign,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { User, PuntoAtencion, MovimientoSaldo, Moneda } from "@/types";
import { useContabilidadDivisas } from "@/hooks/useContabilidadDivisas";
import { Loading } from "@/components/ui/loading";

interface HistorialMovimientosProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies: Moneda[];
  className?: string;
}

export const HistorialMovimientos = ({
  user,
  selectedPoint,
  currencies,
  className = "",
}: HistorialMovimientosProps) => {
  const { movimientos, isLoading, error, cargarMovimientos } =
    useContabilidadDivisas({ user, selectedPoint });

  const [filtroMoneda, setFiltroMoneda] = useState<string>("TODAS");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [limite, setLimite] = useState(50);

  // Cargar movimientos cuando cambien los filtros
  useEffect(() => {
    if (selectedPoint) {
      const monedaId = filtroMoneda === "TODAS" ? undefined : filtroMoneda;
      cargarMovimientos(monedaId, limite);
    }
  }, [selectedPoint, filtroMoneda, limite, cargarMovimientos]);

  const getTipoMovimientoIcon = (tipo: string) => {
    switch (tipo) {
      case "INGRESO":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "EGRESO":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "CAMBIO_DIVISA":
        return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
      case "TRANSFERENCIA_ENTRANTE":
        return <TrendingUp className="h-4 w-4 text-purple-600" />;
      case "TRANSFERENCIA_SALIENTE":
        return <TrendingDown className="h-4 w-4 text-orange-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTipoMovimientoBadge = (tipo: string) => {
    const config = {
      INGRESO: {
        variant: "default" as const,
        color: "bg-green-100 text-green-800",
        label: "Ingreso",
      },
      EGRESO: {
        variant: "destructive" as const,
        color: "bg-red-100 text-red-800",
        label: "Egreso",
      },
      CAMBIO_DIVISA: {
        variant: "default" as const,
        color: "bg-blue-100 text-blue-800",
        label: "Cambio",
      },
      TRANSFERENCIA_ENTRANTE: {
        variant: "default" as const,
        color: "bg-purple-100 text-purple-800",
        label: "Transf. Entrada",
      },
      TRANSFERENCIA_SALIENTE: {
        variant: "outline" as const,
        color: "bg-orange-100 text-orange-800",
        label: "Transf. Salida",
      },
    };

    const conf = config[tipo as keyof typeof config] || {
      variant: "outline" as const,
      color: "bg-gray-100 text-gray-800",
      label: tipo,
    };

    return (
      <Badge variant={conf.variant} className={conf.color}>
        {conf.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, monedaCodigo?: string) => {
    if (monedaCodigo === "USD") {
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

  const movimientosFiltrados = movimientos.filter((mov) => {
    if (filtroTipo !== "TODOS" && mov.tipo_movimiento !== filtroTipo) {
      return false;
    }
    return true;
  });

  if (!selectedPoint) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          Seleccione un punto de atención para ver el historial
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          Historial de Movimientos - {selectedPoint.nombre}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Filtros */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-48">
            <Label className="text-sm">Moneda</Label>
            <Select value={filtroMoneda} onValueChange={setFiltroMoneda}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas las monedas</SelectItem>
                {currencies.map((currency) => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.codigo} - {currency.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-48">
            <Label className="text-sm">Tipo de Movimiento</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los tipos</SelectItem>
                <SelectItem value="INGRESO">Ingresos</SelectItem>
                <SelectItem value="EGRESO">Egresos</SelectItem>
                <SelectItem value="CAMBIO_DIVISA">Cambios de Divisa</SelectItem>
                <SelectItem value="TRANSFERENCIA_ENTRANTE">
                  Transferencias Entrantes
                </SelectItem>
                <SelectItem value="TRANSFERENCIA_SALIENTE">
                  Transferencias Salientes
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-32">
            <Label className="text-sm">Límite</Label>
            <Select
              value={limite.toString()}
              onValueChange={(value) => setLimite(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 registros</SelectItem>
                <SelectItem value="50">50 registros</SelectItem>
                <SelectItem value="100">100 registros</SelectItem>
                <SelectItem value="200">200 registros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() =>
              cargarMovimientos(
                filtroMoneda === "TODAS" ? undefined : filtroMoneda,
                limite
              )
            }
            disabled={isLoading}
            className="self-end"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        </div>

        {/* Tabla de movimientos */}
        {isLoading ? (
          <Loading text="Cargando movimientos..." className="py-8" />
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => cargarMovimientos()} variant="outline">
              Reintentar
            </Button>
          </div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay movimientos que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Saldo Anterior</TableHead>
                  <TableHead className="text-right">Saldo Nuevo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientosFiltrados.map((movimiento) => (
                  <TableRow key={movimiento.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTipoMovimientoIcon(movimiento.tipo_movimiento)}
                        <span className="text-sm">
                          {format(
                            parseISO(movimiento.fecha),
                            "yyyy-MM-dd HH:mm"
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getTipoMovimientoBadge(movimiento.tipo_movimiento)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {movimiento.moneda?.codigo || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-semibold ${
                          movimiento.tipo_movimiento === "INGRESO" ||
                          movimiento.tipo_movimiento ===
                            "TRANSFERENCIA_ENTRANTE"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {movimiento.tipo_movimiento === "INGRESO" ||
                        movimiento.tipo_movimiento === "TRANSFERENCIA_ENTRANTE"
                          ? "+"
                          : "-"}
                        {formatCurrency(
                          Math.abs(movimiento.monto),
                          movimiento.moneda?.codigo
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(
                        movimiento.saldo_anterior,
                        movimiento.moneda?.codigo
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(
                        movimiento.saldo_nuevo,
                        movimiento.moneda?.codigo
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {movimiento.usuario?.nombre || "Sistema"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {movimiento.descripcion || "Sin descripción"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Resumen */}
        {movimientosFiltrados.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Mostrando {movimientosFiltrados.length} de {movimientos.length}{" "}
                movimientos
              </span>
              <span className="text-gray-500">
                Última actualización: {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HistorialMovimientos;
