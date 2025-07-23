"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "@/shared/hooks/use-user";
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

interface PuntosResponse {
  success: boolean;
  puntos: PuntoAtencion[];
}

export default function SaldoServientregaAdmin() {
  const { user } = useUser();
  const esAdmin = user?.rol === "ADMIN";

  const [puntos, setPuntos] = useState<PuntoAtencion[]>([]);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<string>("");
  const [saldos, setSaldos] = useState<Record<string, number>>({});
  const [nuevoMonto, setNuevoMonto] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialAsignacion[]>([]);
  const [filtroFecha, setFiltroFecha] = useState<string>("");
  const [filtroPunto, setFiltroPunto] = useState<string>("");

  const obtenerPuntosYSaldo = async () => {
    try {
      const { data } = await axios.get<PuntosResponse>(
        "/api/servientrega/remitente/puntos"
      );
      const puntosActivos = data.puntos || [];
      setPuntos(puntosActivos);
      if (puntosActivos.length > 0) {
        setPuntoSeleccionado(puntosActivos[0].id);
      }

      const saldosTemp: Record<string, number> = {};
      await Promise.all(
        puntosActivos.map(async (p) => {
          try {
            const res = await axios.get<SaldoResponse>(
              `/api/servientrega/saldo/${p.id}`
            );
            saldosTemp[p.id] = res.data?.disponible ?? 0;
          } catch {
            saldosTemp[p.id] = 0;
          }
        })
      );
      setSaldos(saldosTemp);
    } catch (error) {
      console.error("❌ Error al obtener puntos o saldos:", error);
    }
  };

  const obtenerHistorial = async () => {
    try {
      const { data } = await axios.get<HistorialAsignacion[]>(
        "/api/servientrega/saldo/historial"
      );
      setHistorial(data);
    } catch (error) {
      console.error("❌ Error al obtener historial:", error);
    }
  };

  const asignarSaldo = async () => {
    const monto = parseFloat(nuevoMonto);
    if (isNaN(monto) || monto <= 0 || !puntoSeleccionado) return;

    setLoading(true);
    setMensaje(null);

    try {
      await axios.post("/api/servientrega/saldo/add", {
        monto_total: monto,
        creado_por: user?.nombre ?? "admin",
        punto_atencion_id: puntoSeleccionado,
      });

      setMensaje("✅ Saldo asignado correctamente.");
      setNuevoMonto("");
      obtenerPuntosYSaldo();
      obtenerHistorial();
    } catch (error) {
      console.error("❌ Error al asignar saldo:", error);
      setMensaje("❌ Error al asignar saldo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerPuntosYSaldo();
    obtenerHistorial();
  }, []);

  const saldoActual = Number(saldos[puntoSeleccionado] ?? 0);
  const saldoBajo = saldoActual < UMBRAL_SALDO_BAJO;

  const historialFiltrado = historial.filter((h) => {
    const coincidePunto = filtroPunto
      ? h.punto_atencion_nombre
          .toLowerCase()
          .includes(filtroPunto.toLowerCase())
      : true;
    const coincideFecha = filtroFecha
      ? h.creado_en.startsWith(filtroFecha)
      : true;
    return coincidePunto && coincideFecha;
  });

  return (
    <div className="max-w-6xl mx-auto mt-10 space-y-6">
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="text-xl">
            Administrar saldos Servientrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Punto de atención</Label>
            <Select
              value={puntoSeleccionado}
              onValueChange={(val) => setPuntoSeleccionado(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar punto" />
              </SelectTrigger>
              <SelectContent>
                {puntos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} - {p.ciudad}, {p.provincia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {puntoSeleccionado && (
            <div className="text-sm font-semibold">
              <p
                className={`text-base ${
                  saldoBajo ? "text-red-600" : "text-green-700"
                }`}
              >
                Saldo disponible: ${saldoActual.toFixed(2)}
              </p>
              {saldoBajo && (
                <p className="text-red-500 text-sm mt-1">
                  ⚠️ Saldo bajo, considera recargar pronto.
                </p>
              )}
            </div>
          )}

          {esAdmin && (
            <>
              <div className="space-y-2">
                <Label>Monto a agregar</Label>
                <Input
                  type="number"
                  value={nuevoMonto}
                  onChange={(e) => setNuevoMonto(e.target.value)}
                  placeholder="Ej. 50.00"
                  min={0}
                />
              </div>

              <Button
                onClick={asignarSaldo}
                disabled={loading || !puntoSeleccionado || !nuevoMonto.trim()}
              >
                {loading ? "Asignando..." : "Agregar saldo"}
              </Button>

              {mensaje && (
                <p
                  className={`text-sm mt-2 ${
                    mensaje.includes("correctamente")
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {mensaje}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardHeader>
          <CardTitle className="text-lg">Saldos por punto</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {puntos.map((p) => {
              const saldo = Number(saldos[p.id] ?? 0);
              const isLow = saldo < UMBRAL_SALDO_BAJO;
              return (
                <li
                  key={p.id}
                  className={`text-sm font-medium flex justify-between items-center px-2 py-1 rounded-md border ${
                    isLow
                      ? "bg-red-50 text-red-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  <span>
                    {p.nombre} - {p.ciudad}, {p.provincia}
                  </span>
                  <span className="font-semibold">${saldo.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {esAdmin && (
        <Card className="p-4">
          <CardHeader>
            <CardTitle className="text-lg">Historial de asignaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="max-w-xs"
              />
              <Input
                type="text"
                placeholder="Buscar por punto"
                value={filtroPunto}
                onChange={(e) => setFiltroPunto(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <ul className="space-y-2">
              {historialFiltrado.map((h) => (
                <li
                  key={h.id}
                  className="text-sm border p-2 rounded-md flex flex-col sm:flex-row sm:justify-between sm:items-center"
                >
                  <div className="flex-1">
                    <p className="font-medium">{h.punto_atencion_nombre}</p>
                    <p className="text-xs text-gray-500">
                      Asignado por: {h.creado_por}
                    </p>
                  </div>
                  <div className="flex flex-col sm:items-end mt-2 sm:mt-0">
                    <span className="text-blue-600 font-semibold">
                      +${h.monto_total.toFixed(2)}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(h.creado_en).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
