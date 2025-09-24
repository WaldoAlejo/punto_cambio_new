"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
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

interface PuntoAtencion {
  id: string;
  nombre: string;
  ciudad: string;
  provincia: string;
}

interface MovimientoServicioExterno {
  id: string;
  servicio: string;
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  descripcion?: string;
  punto_atencion_nombre: string;
  creado_por: string;
  creado_en: string;
}

interface SaldoServicioExterno {
  servicio: string;
  saldo_actual: number;
  ultimo_movimiento?: string;
}

const SERVICIOS_EXTERNOS = [
  "YAGANASTE",
  "BANCO_GUAYAQUIL",
  "WESTERN",
  "PRODUBANCO",
  "BANCO_PACIFICO",
  "INSUMOS_OFICINA",
  "INSUMOS_LIMPIEZA",
  "OTROS",
] as const;

type ServicioExterno = (typeof SERVICIOS_EXTERNOS)[number];

export default function ServiciosExternosAdmin() {
  const { user } = useAuth();
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const esAdmin = user?.rol === "ADMIN" || user?.rol === "SUPER_USUARIO";

  const [puntos, setPuntos] = useState<PuntoAtencion[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoServicioExterno[]>(
    []
  );
  const [saldos, setSaldos] = useState<SaldoServicioExterno[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulario para nuevo movimiento
  const [nuevoMovimiento, setNuevoMovimiento] = useState({
    punto_atencion_id: "",
    servicio: "" as ServicioExterno | "",
    tipo: "" as "INGRESO" | "EGRESO" | "",
    monto: "",
    descripcion: "",
  });

  // Filtros
  const [filtros, setFiltros] = useState({
    punto_id: "todos",
    servicio: "todos",
    fecha_desde: "",
    fecha_hasta: "",
  });

  const obtenerPuntos = async () => {
    try {
      const { data } = await axiosInstance.get("/puntos-atencion");
      setPuntos(data.puntos || []);
    } catch (error) {
      console.error("Error al obtener puntos:", error);
      toast.error("Error al cargar puntos de atención");
    }
  };

  const obtenerMovimientos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filtros.punto_id !== "todos")
        params.append("punto_id", filtros.punto_id);
      if (filtros.servicio !== "todos")
        params.append("servicio", filtros.servicio);
      if (filtros.fecha_desde)
        params.append("fecha_desde", filtros.fecha_desde);
      if (filtros.fecha_hasta)
        params.append("fecha_hasta", filtros.fecha_hasta);

      const { data } = await axiosInstance.get(
        `/servicios-externos/movimientos?${params}`
      );
      setMovimientos(data.movimientos || []);
    } catch (error) {
      console.error("Error al obtener movimientos:", error);
      toast.error("Error al cargar movimientos");
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  };

  const obtenerSaldos = async () => {
    try {
      const { data } = await axiosInstance.get("/servicios-externos/saldos");
      setSaldos(data.saldos || []);
    } catch (error) {
      console.error("Error al obtener saldos:", error);
      toast.error("Error al cargar saldos");
      setSaldos([]);
    }
  };

  const crearMovimiento = async () => {
    if (
      !nuevoMovimiento.punto_atencion_id ||
      !nuevoMovimiento.servicio ||
      !nuevoMovimiento.tipo ||
      !nuevoMovimiento.monto
    ) {
      toast.error("Todos los campos son obligatorios");
      return;
    }

    const monto = parseFloat(nuevoMovimiento.monto);
    if (isNaN(monto) || monto <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    const punto = puntos.find(
      (p) => p.id === nuevoMovimiento.punto_atencion_id
    );
    const mensaje = `¿Confirma crear un ${nuevoMovimiento.tipo.toLowerCase()} de $${monto.toFixed(
      2
    )} para ${nuevoMovimiento.servicio} en ${punto?.nombre}?`;

    showConfirmation("Confirmar movimiento", mensaje, async () => {
      try {
        setSaving(true);
        await axiosInstance.post("/servicios-externos", {
          punto_atencion_id: nuevoMovimiento.punto_atencion_id,
          servicio: nuevoMovimiento.servicio,
          tipo: nuevoMovimiento.tipo,
          monto: monto,
          descripcion: nuevoMovimiento.descripcion || undefined,
        });

        toast.success("Movimiento creado correctamente");

        // Limpiar formulario
        setNuevoMovimiento({
          punto_atencion_id: "",
          servicio: "",
          tipo: "",
          monto: "",
          descripcion: "",
        });

        // Recargar datos
        await Promise.all([obtenerMovimientos(), obtenerSaldos()]);
      } catch (error: any) {
        console.error("Error al crear movimiento:", error);
        const mensaje =
          error.response?.data?.error || "Error al crear el movimiento";
        toast.error(mensaje);
      } finally {
        setSaving(false);
      }
    });
  };

  useEffect(() => {
    if (esAdmin) {
      obtenerPuntos();
      obtenerSaldos();
    }
  }, [esAdmin]);

  useEffect(() => {
    if (esAdmin) {
      obtenerMovimientos();
    }
  }, [filtros, esAdmin]);

  if (!esAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Acceso Restringido
            </h3>
            <p className="text-gray-500">
              Solo los administradores pueden acceder a esta sección
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">
          💼 Administración de Servicios Externos
        </h1>
        <Button
          variant="outline"
          onClick={() => {
            obtenerMovimientos();
            obtenerSaldos();
          }}
        >
          🔄 Actualizar
        </Button>
      </div>

      {/* Resumen de Saldos */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Saldos Actuales por Servicio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {saldos.map((saldo) => (
              <div key={saldo.servicio} className="p-4 border rounded-lg">
                <h3 className="font-semibold text-sm text-gray-600 mb-1">
                  {saldo.servicio}
                </h3>
                <p className="text-2xl font-bold text-green-600">
                  ${saldo.saldo_actual.toFixed(2)}
                </p>
                {saldo.ultimo_movimiento && (
                  <p className="text-xs text-gray-500 mt-1">
                    Último:{" "}
                    {new Date(saldo.ultimo_movimiento).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Formulario para Nuevo Movimiento */}
      <Card>
        <CardHeader>
          <CardTitle>➕ Crear Nuevo Movimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Punto de Atención</Label>
              <Select
                value={nuevoMovimiento.punto_atencion_id}
                onValueChange={(value) =>
                  setNuevoMovimiento((prev) => ({
                    ...prev,
                    punto_atencion_id: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar punto" />
                </SelectTrigger>
                <SelectContent>
                  {puntos.map((punto) => (
                    <SelectItem key={punto.id} value={punto.id}>
                      {punto.nombre} - {punto.ciudad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Servicio</Label>
              <Select
                value={nuevoMovimiento.servicio}
                onValueChange={(value) =>
                  setNuevoMovimiento((prev) => ({
                    ...prev,
                    servicio: value as ServicioExterno,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar servicio" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICIOS_EXTERNOS.map((servicio) => (
                    <SelectItem key={servicio} value={servicio}>
                      {servicio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo</Label>
              <Select
                value={nuevoMovimiento.tipo}
                onValueChange={(value) =>
                  setNuevoMovimiento((prev) => ({
                    ...prev,
                    tipo: value as "INGRESO" | "EGRESO",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INGRESO">INGRESO</SelectItem>
                  <SelectItem value="EGRESO">EGRESO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Monto (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={nuevoMovimiento.monto}
                onChange={(e) =>
                  setNuevoMovimiento((prev) => ({
                    ...prev,
                    monto: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Descripción</Label>
              <Input
                value={nuevoMovimiento.descripcion}
                onChange={(e) =>
                  setNuevoMovimiento((prev) => ({
                    ...prev,
                    descripcion: e.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </div>
          </div>

          <Button
            onClick={crearMovimiento}
            disabled={saving}
            className="w-full md:w-auto"
          >
            {saving ? "Guardando..." : "💾 Crear Movimiento"}
          </Button>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Punto de Atención</Label>
              <Select
                value={filtros.punto_id}
                onValueChange={(value) =>
                  setFiltros((prev) => ({ ...prev, punto_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los puntos</SelectItem>
                  {puntos.map((punto) => (
                    <SelectItem key={punto.id} value={punto.id}>
                      {punto.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Servicio</Label>
              <Select
                value={filtros.servicio}
                onValueChange={(value) =>
                  setFiltros((prev) => ({ ...prev, servicio: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los servicios</SelectItem>
                  {SERVICIOS_EXTERNOS.map((servicio) => (
                    <SelectItem key={servicio} value={servicio}>
                      {servicio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) =>
                  setFiltros((prev) => ({
                    ...prev,
                    fecha_desde: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={filtros.fecha_hasta}
                onChange={(e) =>
                  setFiltros((prev) => ({
                    ...prev,
                    fecha_hasta: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historial de Movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Historial de Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p>Cargando movimientos...</p>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No se encontraron movimientos con los filtros aplicados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Punto</th>
                    <th className="px-3 py-2 text-left">Servicio</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-left">Creado por</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov) => (
                    <tr key={mov.id} className="border-t">
                      <td className="px-3 py-2">
                        {new Date(mov.creado_en).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{mov.punto_atencion_nombre}</td>
                      <td className="px-3 py-2">{mov.servicio}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            mov.tipo === "INGRESO"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {mov.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        ${mov.monto.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">{mov.descripcion || "-"}</td>
                      <td className="px-3 py-2">{mov.creado_por}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog />
    </div>
  );
}
