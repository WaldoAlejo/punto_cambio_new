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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, MapPin, CheckCircle2, Search, X } from "lucide-react";

interface Agencia {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  latitud: number | null;
  longitud: number | null;
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
  const [busquedaDireccion, setBusquedaDireccion] = useState("");
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

  // Filtrar agencias
  const agenciasFiltradas = useMemo(() => {
    let filtradas = agencias;
    
    if (provinciaFiltro) {
      filtradas = filtradas.filter((a) => a.provincia === provinciaFiltro);
    }
    
    if (ciudadFiltro) {
      filtradas = filtradas.filter((a) => a.ciudad === ciudadFiltro);
    }
    
    if (busquedaDireccion.trim()) {
      const termino = busquedaDireccion.toLowerCase().trim();
      filtradas = filtradas.filter(
        (a) =>
          a.direccion.toLowerCase().includes(termino) ||
          a.nombre.toLowerCase().includes(termino) ||
          a.ciudad.toLowerCase().includes(termino)
      );
    }
    
    return filtradas;
  }, [agencias, ciudadFiltro, provinciaFiltro, busquedaDireccion]);

  const handleProvinciaChange = (value: string) => {
    setProvinciaFiltro(value);
    setCiudadFiltro("");
    setBusquedaDireccion("");
    setAgenciaSeleccionada(null);
  };

  const handleCiudadChange = (value: string) => {
    setCiudadFiltro(value);
    setBusquedaDireccion("");
    setAgenciaSeleccionada(null);
  };

  const handleAgenciaChange = (agencia: Agencia) => {
    setAgenciaSeleccionada(agencia);
  };

  const handleConfirmar = () => {
    if (agenciaSeleccionada) {
      onConfirmar(agenciaSeleccionada);
    }
  };

  const handleCerrar = () => {
    setProvinciaFiltro("");
    setCiudadFiltro("");
    setBusquedaDireccion("");
    setAgenciaSeleccionada(null);
    onCerrar();
  };

  const getMapUrl = (lat: number, lng: number) => {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`;
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  return (
    <Dialog open={abierto} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[80vh]">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-blue-600" />
            Seleccionar Punto de Retiro
          </DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
            <span className="text-xs text-gray-500">Cargando agencias...</span>
          </div>
        ) : error ? (
          <div className="py-6 text-center px-4">
            <div className="text-sm text-red-500 mb-3">{error}</div>
            <Button variant="outline" size="sm" onClick={onReintentar}>
              Reintentar
            </Button>
          </div>
        ) : agencias.length === 0 ? (
          <div className="py-6 text-center text-sm text-red-500 px-4">
            No hay agencias disponibles para retiro
          </div>
        ) : (
          <div className="flex flex-col overflow-hidden">
            {/* Filtros */}
            <div className="px-4 py-3 space-y-2 border-b shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <Select value={provinciaFiltro} onValueChange={handleProvinciaChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={`Provincia (${provincias.length})`} />
                  </SelectTrigger>
                  <SelectContent>
                    {provincias.map((provincia, idx) => (
                      <SelectItem key={idx} value={provincia} className="text-xs">
                        {provincia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={ciudadFiltro} onValueChange={handleCiudadChange} disabled={!provinciaFiltro}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={provinciaFiltro ? `Ciudad (${ciudades.length})` : "Ciudad"} />
                  </SelectTrigger>
                  <SelectContent>
                    {ciudades.map((ciudad, idx) => (
                      <SelectItem key={idx} value={ciudad} className="text-xs">
                        {ciudad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {ciudadFiltro && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <Input
                    placeholder="Buscar..."
                    value={busquedaDireccion}
                    onChange={(e) => setBusquedaDireccion(e.target.value)}
                    className="pl-7 pr-7 h-8 text-xs"
                  />
                  {busquedaDireccion && (
                    <button
                      onClick={() => setBusquedaDireccion("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Contenido principal */}
            {ciudadFiltro ? (
              <div className="flex flex-col overflow-hidden">
                {/* Contador */}
                <div className="px-3 py-1.5 bg-gray-50 border-b text-[10px] text-gray-500 flex justify-between items-center shrink-0">
                  <span>{agenciasFiltradas.length} punto{agenciasFiltradas.length !== 1 ? 's' : ''}</span>
                  {agenciaSeleccionada && (
                    <span className={agenciaSeleccionada.latitud != null ? "text-green-600" : "text-gray-400"}>
                      {agenciaSeleccionada.latitud != null ? "📍 Con mapa" : "Sin mapa"}
                    </span>
                  )}
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto">
                  {/* Mapa (si hay selección con coordenadas) */}
                  {agenciaSeleccionada && agenciaSeleccionada.latitud != null && agenciaSeleccionada.longitud != null && (
                    <div className="p-3 border-b bg-blue-50/50">
                      <div className="relative w-full h-[140px] rounded-lg overflow-hidden border mb-2">
                        <iframe
                          src={getMapUrl(agenciaSeleccionada.latitud, agenciaSeleccionada.longitud)}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Ubicación"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openInGoogleMaps(agenciaSeleccionada.latitud!, agenciaSeleccionada.longitud!)}
                        className="w-full h-7 text-[10px]"
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        Ver en Google Maps
                      </Button>
                    </div>
                  )}

                  {/* Lista de agencias - máximo 3 visibles */}
                  {agenciasFiltradas.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">
                      No se encontraron puntos
                    </div>
                  ) : (
                    <div>
                      {agenciasFiltradas.slice(0, 3).map((agencia, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAgenciaChange(agencia)}
                          className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                            agenciaSeleccionada?.nombre === agencia.nombre
                              ? "bg-blue-50 border-blue-200"
                              : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 shrink-0">
                              {agenciaSeleccionada?.nombre === agencia.nombre ? (
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs">{agencia.nombre}</p>
                              <p className="text-[10px] text-gray-500 line-clamp-1">{agencia.direccion}</p>
                              {agencia.latitud != null && agencia.longitud != null && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600">
                                  <MapPin className="h-2.5 w-2.5" />
                                  Mapa disponible
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                      {agenciasFiltradas.length > 3 && (
                        <div className="px-3 py-2 text-center text-[10px] text-gray-400 bg-gray-50 border-t">
                          +{agenciasFiltradas.length - 3} punto{agenciasFiltradas.length - 3 !== 1 ? 's' : ''} más. Usa la búsqueda para filtrar.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Info del seleccionado */}
                {agenciaSeleccionada && (
                  <div className="px-3 py-2 bg-blue-50 border-t shrink-0">
                    <p className="font-medium text-xs truncate">{agenciaSeleccionada.nombre}</p>
                    <p className="text-[10px] text-gray-600 line-clamp-1">{agenciaSeleccionada.direccion}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                <MapPin className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Selecciona provincia y ciudad</p>
                <p className="text-xs mt-1">para ver los puntos de retiro</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="px-4 py-3 border-t gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!agenciaSeleccionada || cargando}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
