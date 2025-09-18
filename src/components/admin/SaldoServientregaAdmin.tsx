"use client";

import { useEffect, useState, useMemo } from "react";
import axiosInstance from "@/services/axiosInstance";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const UMBRAL_SALDO_BAJO = 5;

interface PuntoAtencion {
  id: string;
  nombre: string;
  ciudad: string;
  provincia: string;
}

interface SaldoResponse {
  disponible: number;
}

interface HistorialAsignacion {
  id: string;
  punto_atencion_nombre: string;
  monto_total: number;
  creado_por: string;
  creado_en: string;
}

interface SolicitudSaldo {
  id: string;
  punto_atencion_id: string;
  punto_atencion_nombre: string;
  monto_requerido: number;
  estado: string;
  observaciones?: string;
  creado_en: string;
  aprobado_por?: string;
  aprobado_en?: string;
}

interface PuntosResponse {
  success: boolean;
  puntos: PuntoAtencion[];
}

export default function SaldoServientregaAdmin() {
  const { user } = useAuth();
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const esAdmin = user?.rol === "ADMIN";

  const [puntos, setPuntos] = useState<PuntoAtencion[]>([]);
  const [saldos, setSaldos] = useState<Record<string, number>>({});
  const [historial, setHistorial] = useState<HistorialAsignacion[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudSaldo[]>([]);

  // Filtros
  const [filtroFecha, setFiltroFecha] = useState<string>("");
  const [filtroPunto, setFiltroPunto] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState<string>("");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("TODAS");
  const [orden, setOrden] = useState<string>("fecha");

  // Paginación
  const [pagina, setPagina] = useState(1);
  const [tamañoPagina, setTamañoPagina] = useState(10);

  // Monto asignado manual
  const [montosInput, setMontosInput] = useState<Record<string, string>>({});
  const [loadingPuntos, setLoadingPuntos] = useState<Record<string, boolean>>(
    {}
  );

  // ===================== Cargar datos =====================
  const obtenerPuntosYSaldo = async () => {
    try {
      const { data } = await axiosInstance.get<PuntosResponse>(
        "/servientrega/remitente/puntos"
      );
      if (!data.success) {
        toast.error("Error al obtener puntos");
        return;
      }
      setPuntos(data.puntos || []);

      const saldosTemp: Record<string, number> = {};
      await Promise.all(
        data.puntos.map(async (p) => {
          try {
            const res = await axiosInstance.get<SaldoResponse>(
              `/servientrega/saldo/${p.id}`
            );
            saldosTemp[p.id] = res.data?.disponible ?? 0;
          } catch {
            saldosTemp[p.id] = 0;
          }
        })
      );
      setSaldos(saldosTemp);
    } catch {
      toast.error("Error al cargar puntos y saldos");
      setPuntos([]);
      setSaldos({});
    }
  };

  const obtenerHistorial = async () => {
    try {
      const { data } = await axiosInstance.get("/servientrega/saldo/historial");
      setHistorial(Array.isArray(data) ? data : data?.data || []);
    } catch {
      setHistorial([]);
    }
  };

  const obtenerSolicitudes = async () => {
    try {
      const { data } = await axiosInstance.get(
        "/servientrega/solicitar-saldo/listar"
      );
      setSolicitudes(
        Array.isArray(data?.solicitudes) ? data.solicitudes : data || []
      );
    } catch {
      setSolicitudes([]);
    }
  };

  useEffect(() => {
    obtenerPuntosYSaldo();
    obtenerHistorial();
    if (esAdmin) obtenerSolicitudes();
  }, [esAdmin]);

  // ===================== Lógica de filtros =====================
  const historialFiltrado = useMemo(() => {
    if (!historial) return [];
    let datos = historial.filter((h) => {
      const coincidePunto =
        filtroPunto === "todos" ||
        puntos.find((p) => p.id === filtroPunto)?.nombre ===
          h.punto_atencion_nombre;

      const coincideFecha =
        !filtroFecha ||
        new Date(h.creado_en).toISOString().slice(0, 10) === filtroFecha;

      const coincideBusqueda = h.punto_atencion_nombre
        .toLowerCase()
        .includes(busqueda.toLowerCase());

      return coincidePunto && coincideFecha && coincideBusqueda;
    });

    // Ordenamiento
    if (orden === "fecha") {
      datos = datos.sort(
        (a, b) =>
          new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
      );
    } else if (orden === "punto") {
      datos = datos.sort((a, b) =>
        a.punto_atencion_nombre.localeCompare(b.punto_atencion_nombre)
      );
    } else if (orden === "monto") {
      datos = datos.sort((a, b) => b.monto_total - a.monto_total);
    }

    return datos;
  }, [historial, filtroPunto, filtroFecha, busqueda, puntos, orden]);

  const historialPaginado = useMemo(() => {
    const start = (pagina - 1) * tamañoPagina;
    return historialFiltrado.slice(start, start + tamañoPagina);
  }, [historialFiltrado, pagina, tamañoPagina]);

  const solicitudesFiltradas = useMemo(() => {
    return (solicitudes || []).filter((s) => {
      if (estadoFiltro === "TODAS") return true;
      return s.estado === estadoFiltro;
    });
  }, [solicitudes, estadoFiltro]);

  // ===================== Exportar CSV =====================
  const exportarCSV = () => {
    if (historialFiltrado.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const encabezado = "Punto,Monto,Creado Por,Fecha";
    const filas = historialFiltrado.map(
      (h) =>
        `${h.punto_atencion_nombre},${h.monto_total},${h.creado_por},${new Date(
          h.creado_en
        ).toLocaleString()}`
    );
    const csv = [encabezado, ...filas].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historial_saldos.csv";
    a.click();
    URL.revokeObjectURL(url);
    return true;
  };

  // ===================== Asignar saldo manual =====================
  const asignarSaldo = async (punto: PuntoAtencion) => {
    const monto = parseFloat(montosInput[punto.id] || "0");
    if (isNaN(monto) || monto <= 0) {
      toast.error("Monto inválido");
      return;
    }

    showConfirmation(
      "Confirmar asignación",
      `¿Asignar $${monto.toFixed(2)} a ${punto.nombre}?`,
      async () => {
        setLoadingPuntos((prev) => ({ ...prev, [punto.id]: true }));
        try {
          await axiosInstance.post("/servientrega/saldo", {
            monto_total: monto,
            creado_por: user?.nombre ?? "admin",
            punto_atencion_id: punto.id,
          });
          toast.success(`Saldo asignado a ${punto.nombre}`);
          setMontosInput((prev) => ({ ...prev, [punto.id]: "" }));
          await Promise.all([obtenerPuntosYSaldo(), obtenerHistorial()]);
        } catch {
          toast.error("Error al asignar saldo");
        } finally {
          setLoadingPuntos((prev) => ({ ...prev, [punto.id]: false }));
        }
      }
    );
  };

  // ===================== Render =====================
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          💰 Gestión de Saldos Servientrega
        </h1>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar punto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={String(tamañoPagina)}
            onValueChange={(v) => {
              setTamañoPagina(Number(v));
              setPagina(1);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Por página" />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / página
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportarCSV}>
            ⬇️ Exportar CSV
          </Button>
        </div>
      </div>

      {/* Puntos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {puntos.map((p) => {
          const saldo = saldos[p.id] ?? 0;
          return (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle>{p.nombre}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div
                  className={
                    saldo < UMBRAL_SALDO_BAJO
                      ? "text-red-600"
                      : "text-green-700"
                  }
                >
                  Saldo: ${saldo.toFixed(2)}
                </div>
                {esAdmin && (
                  <>
                    <Input
                      type="number"
                      placeholder="Monto"
                      value={montosInput[p.id] || ""}
                      onChange={(e) =>
                        setMontosInput((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                    />
                    <Button
                      onClick={() => asignarSaldo(p)}
                      disabled={loadingPuntos[p.id]}
                      className="w-full"
                    >
                      {loadingPuntos[p.id] ? "Asignando..." : "Asignar"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtros historial */}
      <Card>
        <CardHeader>
          <CardTitle>
            Historial de Asignaciones ({historialFiltrado.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={filtroPunto} onValueChange={setFiltroPunto}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los puntos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los puntos</SelectItem>
                {puntos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
            />
            <Select value={orden} onValueChange={setOrden}>
              <SelectTrigger>
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fecha">Fecha</SelectItem>
                <SelectItem value="punto">Punto</SelectItem>
                <SelectItem value="monto">Monto</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setFiltroPunto("todos");
                setFiltroFecha("");
                setBusqueda("");
              }}
            >
              Limpiar
            </Button>
          </div>

          {historialPaginado.map((h) => (
            <div key={h.id} className="p-2 border rounded flex justify-between">
              <span>{h.punto_atencion_nombre}</span>
              <span>+${h.monto_total.toFixed(2)}</span>
              <span>{new Date(h.creado_en).toLocaleString()}</span>
            </div>
          ))}

          {/* Controles paginación */}
          {historialFiltrado.length > tamañoPagina && (
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm">
                Página {pagina} de{" "}
                {Math.ceil(historialFiltrado.length / tamañoPagina)}
              </span>
              <div className="space-x-2">
                <Button
                  size="sm"
                  disabled={pagina === 1}
                  onClick={() => setPagina(pagina - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  disabled={pagina * tamañoPagina >= historialFiltrado.length}
                  onClick={() => setPagina(pagina + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Solicitudes */}
      {esAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>
              Solicitudes de Saldo ({solicitudesFiltradas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                {["TODAS", "PENDIENTE", "APROBADA", "RECHAZADA"].map(
                  (estado) => (
                    <SelectItem key={estado} value={estado}>
                      {estado}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            {solicitudesFiltradas.map((s) => (
              <div
                key={s.id}
                className="p-2 border rounded flex justify-between"
              >
                <span>{s.punto_atencion_nombre}</span>
                <span>${s.monto_requerido.toFixed(2)}</span>
                <span>{s.estado}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ConfirmationDialog />
    </div>
  );
}
