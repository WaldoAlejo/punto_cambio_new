"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, MapPin, CheckCircle2 } from "lucide-react";

interface Agencia {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
}

interface ModalRetiroOficinaProps {
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: (agencia: Agencia) => void;
  agencias: Agencia[];
  cargando: boolean;
  error: string | null;
  onReintentar: () => void;
}

export default function ModalRetiroOficina({
  abierto,
  onCerrar,
  onConfirmar,
  agencias,
  cargando,
  error,
  onReintentar,
}: ModalRetiroOficinaProps) {
  const [provinciaFiltro, setProvinciaFiltro] = useState("");
  const [ciudadFiltro, setCiudadFiltro] = useState("");
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState<Agencia | null>(null);

  // Obtener provincias únicas
  const provincias = useMemo(() => {
    const lista = agencias.map((a) => a.provincia).filter(Boolean);
    return Array.from(new Set(lista)).sort();
  }, [agencias]);

  // Obtener ciudades según provincia seleccionada
  const ciudades = useMemo(() => {
    if (!provinciaFiltro) return [];
    const lista = agencias
      .filter((a) => a.provincia === provinciaFiltro)
      .map((a) => a.ciudad);
    return Array.from(new Set(lista)).sort();
  }, [agencias, provinciaFiltro]);

  // Obtener agencias según ciudad seleccionada
  const agenciasFiltradas = useMemo(() => {
    if (!ciudadFiltro) return [];
    return agencias.filter((a) => a.ciudad === ciudadFiltro);
  }, [agencias, ciudadFiltro]);

  const handleProvinciaChange = (value: string) => {
    setProvinciaFiltro(value);
    setCiudadFiltro("");
    setAgenciaSeleccionada(null);
  };

  const handleCiudadChange = (value: string) => {
    setCiudadFiltro(value);
    setAgenciaSeleccionada(null);
  };

  const handleAgenciaChange = (nombre: string) => {
    const agencia = agencias.find((a) => a.nombre === nombre);
    if (agencia) {
      setAgenciaSeleccionada(agencia);
    }
  };

  const handleConfirmar = () => {
    if (agenciaSeleccionada) {
      onConfirmar(agenciaSeleccionada);
    }
  };

  const handleCerrar = () => {
    // Limpiar selección al cerrar
    setProvinciaFiltro("");
    setCiudadFiltro("");
    setAgenciaSeleccionada(null);
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Seleccionar Punto de Retiro
          </DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <span className="text-sm text-gray-500">Cargando agencias...</span>
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <div className="text-sm text-red-500 mb-4">{error}</div>
            <Button variant="outline" onClick={onReintentar}>
              Reintentar
            </Button>
          </div>
        ) : agencias.length === 0 ? (
          <div className="py-6 text-center text-sm text-red-500">
            No hay agencias disponibles para retiro
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Paso 1: Provincia */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                1. Selecciona la Provincia
              </Label>
              <Select value={provinciaFiltro} onValueChange={handleProvinciaChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Provincia (${provincias.length} disponibles)`} />
                </SelectTrigger>
                <SelectContent>
                  {provincias.map((provincia, idx) => (
                    <SelectItem key={idx} value={provincia}>
                      {provincia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Paso 2: Ciudad */}
            {provinciaFiltro && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  2. Selecciona la Ciudad
                </Label>
                <Select value={ciudadFiltro} onValueChange={handleCiudadChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Ciudad (${ciudades.length} disponibles)`} />
                  </SelectTrigger>
                  <SelectContent>
                    {ciudades.map((ciudad, idx) => (
                      <SelectItem key={idx} value={ciudad}>
                        {ciudad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Paso 3: Agencia */}
            {ciudadFiltro && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  3. Selecciona el Punto de Retiro
                </Label>
                <div className="max-h-[200px] overflow-y-auto border rounded-md">
                  {agenciasFiltradas.map((agencia, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAgenciaChange(agencia.nombre)}
                      className={`w-full text-left p-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                        agenciaSeleccionada?.nombre === agencia.nombre
                          ? "bg-blue-50 border-blue-200"
                          : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {agenciaSeleccionada?.nombre === agencia.nombre ? (
                            <CheckCircle2 className="h-5 w-5 text-blue-600" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{agencia.nombre}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{agencia.direccion}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen de selección */}
            {agenciaSeleccionada && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 text-sm mb-2">
                  Punto de Retiro Seleccionado
                </h4>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{agenciaSeleccionada.nombre}</p>
                  <p className="text-gray-600">{agenciaSeleccionada.direccion}</p>
                  <p className="text-gray-500 text-xs">
                    {agenciaSeleccionada.ciudad}, {agenciaSeleccionada.provincia}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!agenciaSeleccionada || cargando}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Confirmar Selección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
