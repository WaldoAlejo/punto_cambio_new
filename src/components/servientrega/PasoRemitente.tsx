"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, User, Search, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { Usuario, PuntoAtencion } from "../../types";
import { Remitente } from "@/types/servientrega";
import { validarIdentificacion } from "@/utils/identificacion";

interface PasoRemitenteProps {
  user: Usuario;
  selectedPoint: PuntoAtencion;
  onNext: (remitente: Remitente) => void;
}

const clean = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

type Pais = { codpais: string; pais: string };
type CiudadCanon = { ciudad: string; provincia: string; raw: string };

// Componente de búsqueda tipo dropdown
interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
}

function SearchableSelect({ options, value, onChange, placeholder, disabled, loading }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return options.slice(0, 50);
    const q = clean(search);
    return options.filter(o => clean(o.label).includes(q)).slice(0, 50);
  }, [options, search]);

  const selectedLabel = options.find(o => o.value === value)?.label || value || placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled || loading}
        className={`w-full h-9 px-3 text-left text-sm border rounded-md flex items-center justify-between bg-white ${
          disabled ? "bg-gray-100 text-gray-400" : "hover:border-gray-400"
        }`}
      >
        <span className="truncate">{selectedLabel}</span>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-7 h-8 text-xs"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-44">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400 text-center">Sin resultados</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-100 ${
                    opt.value === value ? "bg-blue-50 text-blue-700 font-medium" : ""
                  }`}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PasoRemitente({
  selectedPoint,
  onNext,
}: PasoRemitenteProps) {
  const [paises, setPaises] = useState<Pais[]>([]);
  const [ciudadesCanon, setCiudadesCanon] = useState<CiudadCanon[]>([]);
  const [cargandoPaises, setCargandoPaises] = useState(true);
  const [cargandoCiudades, setCargandoCiudades] = useState(true);

  const [formData, setFormData] = useState<Remitente>({
    identificacion: "",
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    ciudad: "",
    provincia: "",
    codigo_postal: "170150",
    pais: "",
  });

  const [direccionCompleta, setDireccionCompleta] = useState("");
  const [loading, setLoading] = useState(false);
  const [ciudadValida, setCiudadValida] = useState(false);

  const [cedulaQuery, setCedulaQuery] = useState("");
  const [cedulaResultados, setCedulaResultados] = useState<Remitente[]>([]);
  const [buscandoCedula, setBuscandoCedula] = useState(false);
  const [remitenteExistente, setRemitenteExistente] = useState<Remitente | null>(null);

  // Cargar países
  useEffect(() => {
    const loadPaises = async () => {
      try {
        setCargandoPaises(true);
        const { data } = await axiosInstance.post("/servientrega/paises");
        const lista: Pais[] = (data?.fetch || []).map((p: { codpais?: string; pais?: string }) => ({
          codpais: String(p.codpais || ""),
          pais: String(p.pais || ""),
        })).filter((p: Pais) => p.codpais && p.pais);
        
        setPaises(lista);
        
        // Seleccionar Ecuador por defecto si existe
        const ecuador = lista.find(p => clean(p.pais) === "ECUADOR");
        if (ecuador) {
          setFormData(prev => ({ ...prev, pais: ecuador.codpais }));
        }
      } catch {
        toast.error("Error cargando países");
      } finally {
        setCargandoPaises(false);
      }
    };
    loadPaises();
  }, []);

  // Cargar ciudades cuando cambia el país
  useEffect(() => {
    if (!formData.pais) return;
    
    const loadCiudades = async () => {
      try {
        setCargandoCiudades(true);
        const { data } = await axiosInstance.post("/servientrega/ciudades", {
          codpais: formData.pais,
        });

        const lista: CiudadCanon[] = (data?.fetch || []).map(
          (it: { city: string }) => {
            const [ciu, prov] = (it.city || "").split("-");
            return {
              ciudad: (ciu || "").trim(),
              provincia: (prov || "").trim(),
              raw: it.city,
            };
          }
        );

        setCiudadesCanon(lista);

        // Si es Ecuador y tenemos punto seleccionado, intentar match
        const paisSeleccionado = paises.find(p => p.codpais === formData.pais);
        const esEcuador = paisSeleccionado && clean(paisSeleccionado.pais) === "ECUADOR";
        
        if (esEcuador && selectedPoint?.ciudad) {
          const spCiudad = clean(selectedPoint.ciudad);
          const spProv = clean(selectedPoint.provincia || "");

          let match = lista.find(
            (c) => clean(c.ciudad) === spCiudad && clean(c.provincia) === spProv
          ) || lista.find(
            (c) => clean(c.ciudad).includes(spCiudad) && clean(c.provincia).includes(spProv)
          ) || null;

          if (match) {
            setFormData((prev) => ({
              ...prev,
              ciudad: match.ciudad,
              provincia: match.provincia,
            }));
            setCiudadValida(true);
          } else {
            setCiudadValida(false);
          }
        } else {
          setCiudadValida(false);
        }
      } catch {
        toast.error("Error cargando ciudades");
      } finally {
        setCargandoCiudades(false);
      }
    };

    loadCiudades();
  }, [formData.pais, selectedPoint?.ciudad, selectedPoint?.provincia, paises]);

  useEffect(() => {
    const query = cedulaQuery.trim();
    if (query.length >= 3) {
      setBuscandoCedula(true);
      axiosInstance
        .get(`/servientrega/remitente/buscar/${encodeURIComponent(query)}`)
        .then((res) => setCedulaResultados(res.data.remitentes || []))
        .catch(() => setCedulaResultados([]))
        .finally(() => setBuscandoCedula(false));
    } else {
      setCedulaResultados([]);
    }
  }, [cedulaQuery]);

  const seleccionarRemitente = (rem: Remitente) => {
    setFormData((prev) => ({
      ...prev,
      identificacion: rem.cedula || rem.identificacion || "",
      nombre: rem.nombre || "",
      telefono: rem.telefono || "",
      email: rem.email || "",
      direccion: rem.direccion || "",
    }));

    if (rem.direccion) {
      setDireccionCompleta(rem.direccion);
    }

    setRemitenteExistente(rem);
    setCedulaResultados([]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePaisChange = (codpais: string) => {
    setFormData(prev => ({
      ...prev,
      pais: codpais,
      ciudad: "",
      provincia: "",
    }));
    setCiudadValida(false);
  };

  const handleCiudadChange = (ciudadRaw: string) => {
    const match = ciudadesCanon.find(c => c.raw === ciudadRaw);
    if (match) {
      setFormData(prev => ({
        ...prev,
        ciudad: match.ciudad,
        provincia: match.provincia,
      }));
      setCiudadValida(true);
    }
  };

  const handleContinue = async () => {
    if (cargandoPaises || cargandoCiudades) {
      toast.info("Cargando catálogo...");
      return;
    }
    if (!ciudadValida) {
      toast.error("Selecciona una ciudad válida.");
      return;
    }

    const { identificacion, nombre, telefono, email, ciudad, pais } = formData;
    if (!identificacion || !nombre || !telefono || !email || !ciudad || !pais) {
      toast.error("Completa todos los campos.");
      return;
    }
    if (!validarIdentificacion(identificacion)) {
      toast.error("Identificación inválida.");
      return;
    }

    const direccionFinal = direccionCompleta.trim();
    if (!direccionFinal) {
      toast.error("La dirección es requerida");
      return;
    }

    const paisNombre = paises.find(p => p.codpais === pais)?.pais || "ECUADOR";

    const remitenteFinal: Remitente = {
      identificacion: formData.identificacion.trim(),
      nombre: formData.nombre.trim(),
      direccion: direccionFinal.trim(),
      telefono: formData.telefono.trim(),
      email: formData.email?.trim() || "",
      ciudad: formData.ciudad.trim(),
      provincia: formData.provincia.trim(),
      codigo_postal: formData.codigo_postal?.trim() || "170150",
      pais: paisNombre,
    };

    const payload = {
      cedula: remitenteFinal.identificacion,
      nombre: remitenteFinal.nombre,
      direccion: remitenteFinal.direccion,
      telefono: remitenteFinal.telefono,
      email: remitenteFinal.email,
      codigo_postal: remitenteFinal.codigo_postal,
      ciudad: remitenteFinal.ciudad,
      provincia: remitenteFinal.provincia,
    };

    setLoading(true);
    try {
      if (remitenteExistente) {
        await axiosInstance.put(
          `/servientrega/remitente/actualizar/${remitenteFinal.identificacion}`,
          payload
        );
      } else {
        await axiosInstance.post("/servientrega/remitente/guardar", payload);
      }
      toast.success("Remitente guardado.");
      onNext(remitenteFinal);
    } catch {
      toast.error("Error al guardar remitente.");
    } finally {
      setLoading(false);
    }
  };

  const paisOptions = useMemo(() => 
    paises.map(p => ({ value: p.codpais, label: p.pais })),
    [paises]
  );

  const ciudadOptions = useMemo(() => 
    ciudadesCanon.map(c => ({ value: c.raw, label: c.raw })),
    [ciudadesCanon]
  );

  const selectedCiudadRaw = useMemo(() => {
    if (!formData.ciudad) return "";
    return ciudadesCanon.find(c => c.ciudad === formData.ciudad && c.provincia === formData.provincia)?.raw || "";
  }, [formData.ciudad, formData.provincia, ciudadesCanon]);

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-semibold">Datos del Remitente</h2>
      </div>

      <div className="space-y-3">
        {/* Identificación con búsqueda */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              name="identificacion"
              placeholder="Cédula, RUC o Pasaporte"
              value={formData.identificacion}
              onChange={(e) => {
                const value = e.target.value.trimStart();
                setFormData((prev) => ({ ...prev, identificacion: value }));
                setCedulaQuery(value);
              }}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {buscandoCedula && (
            <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-gray-400" />
          )}
          {cedulaResultados.length > 0 && (
            <div className="absolute bg-white border rounded-md shadow-md w-full max-h-32 overflow-y-auto z-10 mt-1">
              {cedulaResultados.slice(0, 3).map((r, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-xs border-b last:border-b-0"
                  onClick={() => seleccionarRemitente(r)}
                >
                  <span className="font-medium">{(r.cedula || r.identificacion)}</span>
                  <span className="text-gray-500 ml-2">{r.nombre}</span>
                </div>
              ))}
              {cedulaResultados.length > 3 && (
                <div className="px-3 py-1.5 text-[10px] text-gray-400 bg-gray-50 text-center">
                  +{cedulaResultados.length - 3} resultados más
                </div>
              )}
            </div>
          )}
        </div>

        <Input
          name="nombre"
          placeholder="Nombre completo"
          value={formData.nombre}
          onChange={handleChange}
          className="h-9 text-sm"
        />

        <div className="grid grid-cols-2 gap-2">
          <Input
            name="telefono"
            placeholder="Teléfono"
            value={formData.telefono}
            onChange={handleChange}
            className="h-9 text-sm"
          />
          <Input
            name="email"
            placeholder="Correo"
            value={formData.email}
            onChange={handleChange}
            className="h-9 text-sm"
          />
        </div>

        <textarea
          placeholder="Dirección completa"
          value={direccionCompleta}
          onChange={(e) => setDireccionCompleta(e.target.value)}
          className="w-full h-16 px-3 py-2 border rounded-md text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* País y Ciudad con búsqueda */}
        <div className="grid grid-cols-2 gap-2">
          <SearchableSelect
            options={paisOptions}
            value={formData.pais}
            onChange={handlePaisChange}
            placeholder="Seleccionar país..."
            loading={cargandoPaises}
          />
          <SearchableSelect
            options={ciudadOptions}
            value={selectedCiudadRaw}
            onChange={handleCiudadChange}
            placeholder={formData.pais ? "Buscar ciudad..." : "Primero elige país"}
            disabled={!formData.pais || cargandoCiudades}
            loading={cargandoCiudades}
          />
        </div>

        <Button
          disabled={loading || !ciudadValida}
          onClick={handleContinue}
          size="sm"
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
