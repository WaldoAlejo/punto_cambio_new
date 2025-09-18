import { useState, useEffect, useMemo } from "react";
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "sonner";
import { PuntoAtencion, VistaSaldosPorPunto } from "../../types";
import { pointService } from "../../services/pointService";
import { saldoInicialService } from "../../services/saldoInicialService";

const SaldoInicialManagement = () => {
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();

  // Data
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [vistaSaldos, setVistaSaldos] = useState<VistaSaldosPorPunto[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCity, setFilterCity] = useState("TODAS");
  const [filterProvince, setFilterProvince] = useState("TODAS");

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Punto y moneda seleccionados
  const [selectedPointId, setSelectedPointId] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [billetes, setBilletes] = useState<string>("");
  const [monedas, setMonedas] = useState<string>("");
  const [loadingAsignacion, setLoadingAsignacion] = useState(false);

  // Carga inicial
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      const [pointsResponse, vistaSaldosResponse] = await Promise.all([
        pointService.getPointsForBalanceManagement(),
        saldoInicialService.getVistaSaldosPorPunto(),
      ]);

      setPoints(pointsResponse.points || []);
      setVistaSaldos(vistaSaldosResponse.saldos || []);

      if (pointsResponse.points?.length > 0 && !selectedPointId) {
        setSelectedPointId(pointsResponse.points[0].id);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar datos"
      );
      setPoints([]);
      setVistaSaldos([]);
    } finally {
      setLoadingData(false);
    }
  };

  // Ciudades y provincias únicas para filtros
  const uniqueCities = useMemo(() => {
    const cities = points.map((p) => p.ciudad).filter(Boolean);
    return ["TODAS", ...Array.from(new Set(cities))];
  }, [points]);

  const uniqueProvinces = useMemo(() => {
    const provinces = points.map((p) => p.provincia).filter(Boolean);
    return ["TODAS", ...Array.from(new Set(provinces))];
  }, [points]);

  // Filtros locales
  const filteredPoints = useMemo(() => {
    return points.filter((p) => {
      const matchSearch = p.nombre
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchCity = filterCity === "TODAS" || p.ciudad === filterCity;
      const matchProvince =
        filterProvince === "TODAS" || p.provincia === filterProvince;
      return matchSearch && matchCity && matchProvince;
    });
  }, [points, searchTerm, filterCity, filterProvince]);

  // Paginación en frontend
  const totalPages = Math.ceil(filteredPoints.length / pageSize);
  const paginatedPoints = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPoints.slice(start, start + pageSize);
  }, [filteredPoints, page, pageSize]);

  // Selección de punto
  const handlePointChange = (pointId: string) => {
    setSelectedPointId(pointId);
    setSelectedCurrency("");
    setBilletes("");
    setMonedas("");
  };

  // Monedas por punto
  const getMonedasPorPunto = (puntoId: string) => {
    return vistaSaldos.filter((s) => s.punto_atencion_id === puntoId);
  };

  const selectedPoint = points.find((p) => p.id === selectedPointId);
  const monedasDelPuntoSeleccionado = selectedPointId
    ? getMonedasPorPunto(selectedPointId)
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          💱 Gestión de Saldos
        </h1>
        <Button variant="outline" size="sm" onClick={loadInitialData}>
          🔄 Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Input
            placeholder="Buscar punto..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={filterCity}
            onValueChange={(v) => {
              setFilterCity(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ciudad" />
            </SelectTrigger>
            <SelectContent>
              {uniqueCities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterProvince}
            onValueChange={(v) => {
              setFilterProvince(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Provincia" />
            </SelectTrigger>
            <SelectContent>
              {uniqueProvinces.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Por página" />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / página
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setFilterCity("TODAS");
              setFilterProvince("TODAS");
              setPage(1);
            }}
          >
            Limpiar
          </Button>
        </CardContent>
      </Card>

      {/* Lista Paginada */}
      <Card>
        <CardHeader>
          <CardTitle>Puntos de Atención</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {paginatedPoints.length === 0 && (
            <p className="text-gray-500">No hay puntos</p>
          )}
          {paginatedPoints.map((p) => (
            <div
              key={p.id}
              onClick={() => handlePointChange(p.id)}
              className={`p-3 border rounded cursor-pointer ${
                p.id === selectedPointId ? "bg-blue-50" : ""
              }`}
            >
              <div className="font-semibold">{p.nombre}</div>
              <div className="text-sm text-gray-600">
                {p.ciudad}, {p.provincia}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Controles de Paginación */}
      {filteredPoints.length > pageSize && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600">
            Página {page} de {totalPages} · {filteredPoints.length} resultados
          </div>
          <div className="space-x-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <ConfirmationDialog />
    </div>
  );
};

export default SaldoInicialManagement;
