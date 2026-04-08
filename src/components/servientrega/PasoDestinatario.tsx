"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, CheckCircle2, User, Search, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Destinatario } from "@/types/servientrega";
import { validarIdentificacion } from "@/utils/identificacion";
import ModalRetiroOficina from "./ModalRetiroOficina";

interface Pais {
  codpais: number;
  pais: string;
  nombrecorto: string;
  phone_code: string;
}
interface CiudadCanon {
  ciudad: string;
  provincia: string;
  raw: string;
}

interface Agencia {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  latitud: number | null;
  longitud: number | null;
}

interface PasoDestinatarioProps {
  onNext: (destinatario: Destinatario, retiro_oficina: boolean, nombre_agencia?: string) => void;
}

const clean = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

// Componente de búsqueda tipo dropdown (igual que en PasoRemitente)
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

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
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-7 pr-7 h-8 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

export default function PasoDestinatario({ onNext }: PasoDestinatarioProps) {
  const [paises, setPaises] = useState<Pais[]>([]);
  const [ciudadesCanon, setCiudadesCanon] = useState<CiudadCanon[]>([]);
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [cargandoPaises, setCargandoPaises] = useState(true);
  const [cargandoCiudades, setCargandoCiudades] = useState(true);
  const [loading, setLoading] = useState(false);

  const [cedulaQuery, setCedulaQuery] = useState("");
  const [cedulaResultados, setCedulaResultados] = useState<Destinatario[]>([]);
  const [buscandoCedula, setBuscandoCedula] = useState(false);

  const [retiroEnOficina, setRetiroEnOficina] = useState(false);
  const [modalRetiroAbierto, setModalRetiroAbierto] = useState(false);
  const [agenciaSeleccionadaData, setAgenciaSeleccionadaData] = useState<Agencia | null>(null);

  const [form, setForm] = useState<Destinatario>({
    identificacion: "", nombre: "", direccion: "", telefono: "", email: "",
    ciudad: "", provincia: "", codigo_postal: "", pais: "", codpais: 0,
  });
  const [direccionCompleta, setDireccionCompleta] = useState("");

  const esInternacional = useMemo(() => form.codpais !== 63, [form.codpais]);

  // Cargar países
  useEffect(() => {
    axiosInstance.post("/servientrega/paises").then(({ data }) => {
      const lista: Pais[] = data?.fetch || [];
      setPaises(lista);
      const ec = lista.find((p) => p.codpais === 63);
      if (ec) setForm((prev) => ({ ...prev, codpais: 63, pais: ec.pais }));
      setCargandoPaises(false);
    }).catch(() => setCargandoPaises(false));
  }, []);

  useEffect(() => {
    axiosInstance.post("/servientrega/agencias-retiro").then(({ data }) => {
      setAgencias(data?.data || []);
    }).catch(() => setAgencias([]));
  }, []);

  // Cargar ciudades cuando cambia el país
  useEffect(() => {
    if (!form.codpais) return;
    setCargandoCiudades(true);
    axiosInstance.post("/servientrega/ciudades", { codpais: form.codpais })
      .then(({ data }) => {
        const lista: CiudadCanon[] = (data?.fetch || []).map((item: { city: string }) => {
          const [ciu, prov] = String(item.city || "").split("-");
          return { ciudad: (ciu || "").trim(), provincia: (prov || "").trim(), raw: item.city };
        });
        setCiudadesCanon(lista);
        setCargandoCiudades(false);
      }).catch(() => setCargandoCiudades(false));
  }, [form.codpais]);

  useEffect(() => {
    const query = cedulaQuery.trim();
    if (query.length < 3) { setCedulaResultados([]); return; }
    setBuscandoCedula(true);
    axiosInstance.get(`/servientrega/destinatario/buscar/${query}`)
      .then((res) => setCedulaResultados(res.data.destinatarios || []))
      .catch(() => setCedulaResultados([]))
      .finally(() => setBuscandoCedula(false));
  }, [cedulaQuery]);

  const handleConfirmarRetiro = (agencia: Agencia) => {
    setAgenciaSeleccionadaData(agencia);
    const paisEcuador = paises.find((p) => p.codpais === 63);
    setForm((prev) => ({ 
      ...prev, 
      codpais: 63,
      pais: paisEcuador?.pais || "ECUADOR",
      provincia: agencia.provincia, 
      ciudad: agencia.ciudad 
    }));
    setDireccionCompleta(agencia.direccion);
    setModalRetiroAbierto(false);
    toast.success("Punto de retiro seleccionado");
  };

  const handleLimpiarRetiro = () => {
    setRetiroEnOficina(false);
    setAgenciaSeleccionadaData(null);
    setForm((prev) => ({ ...prev, ciudad: "", provincia: "" }));
    setDireccionCompleta("");
  };

  const handlePaisChange = (value: string) => {
    const codpais = parseInt(value, 10);
    const paisSeleccionado = paises.find((p) => p.codpais === codpais);
    setForm((prev) => ({ ...prev, codpais, pais: paisSeleccionado?.pais || "", ciudad: "", provincia: "", codigo_postal: "" }));
  };

  const handleCiudadChange = (value: string) => {
    const match = ciudadesCanon.find(c => c.raw === value);
    if (match) {
      setForm((prev) => ({ ...prev, ciudad: match.ciudad, provincia: match.provincia }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value.trimStart() });

  const seleccionarDestinatario = (dest: Destinatario) => {
    const ciu = clean(dest.ciudad || "");
    const prov = clean(dest.provincia || "");
    const match = ciudadesCanon.find((c) => clean(c.ciudad) === ciu && clean(c.provincia) === prov) || null;

    setForm({
      identificacion: dest.cedula || dest.identificacion || "",
      nombre: dest.nombre || "", telefono: dest.telefono || "", email: dest.email || "",
      direccion: dest.direccion || "", ciudad: match ? match.ciudad : "", provincia: match ? match.provincia : "",
      codigo_postal: dest.codigo_postal || "", pais: dest.pais || form.pais, codpais: Number.isFinite(dest.codpais) ? dest.codpais : form.codpais,
    });
    setDireccionCompleta(dest.direccion || "");
    setCedulaResultados([]);
    setCedulaQuery("");
  };

  const handleContinue = async () => {
    if (cargandoPaises || cargandoCiudades) { toast.info("Cargando..."); return; }
    if (!form.identificacion || !form.nombre || !form.telefono || !form.pais) {
      toast.error("Completa todos los campos."); return;
    }
    if (form.codpais === 63 && !validarIdentificacion(form.identificacion)) {
      toast.error("Identificación inválida."); return;
    }
    if (!retiroEnOficina && (!form.ciudad || !form.provincia)) {
      toast.error("Selecciona ciudad."); return;
    }
    if (esInternacional && !form.codigo_postal?.trim()) {
      toast.error("Código postal requerido."); return;
    }
    if (retiroEnOficina && !agenciaSeleccionadaData) {
      toast.error("Selecciona punto de retiro."); return;
    }
    const direccionFinal = direccionCompleta.trim();
    if (!direccionFinal) { toast.error("Dirección requerida"); return; }

    const destinatarioFinal: Destinatario = {
      identificacion: form.identificacion.trim(), nombre: form.nombre.trim(), direccion: direccionFinal,
      telefono: form.telefono.trim(), email: form.email?.trim() || "", ciudad: form.ciudad, provincia: form.provincia,
      pais: form.pais, codpais: form.codpais, codigo_postal: form.codigo_postal?.trim() || "",
    };

    setLoading(true);
    try {
      await axiosInstance.post("/servientrega/destinatario/guardar", { ...destinatarioFinal, cedula: form.identificacion.trim() });
      toast.success("Destinatario guardado.");
      onNext(destinatarioFinal, retiroEnOficina, retiroEnOficina ? agenciaSeleccionadaData?.nombre : undefined);
    } catch { toast.error("Error al guardar."); }
    finally { setLoading(false); }
  };

  const paisOptions = useMemo(() => 
    paises.map(p => ({ value: String(p.codpais), label: p.pais })),
    [paises]
  );

  const ciudadOptions = useMemo(() => 
    ciudadesCanon.map(c => ({ value: c.raw, label: c.raw })),
    [ciudadesCanon]
  );

  const selectedCiudadRaw = useMemo(() => {
    if (!form.ciudad || !form.provincia) return "";
    return ciudadesCanon.find(c => c.ciudad === form.ciudad && c.provincia === form.provincia)?.raw || "";
  }, [form.ciudad, form.provincia, ciudadesCanon]);

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-semibold">Datos del Destinatario</h2>
      </div>

      <div className="space-y-3">
        {/* País y Ciudad con búsqueda */}
        <div className="grid grid-cols-2 gap-2">
          <SearchableSelect
            options={paisOptions}
            value={String(form.codpais || "")}
            onChange={handlePaisChange}
            placeholder="Seleccionar país..."
            loading={cargandoPaises}
          />
          <SearchableSelect
            options={ciudadOptions}
            value={selectedCiudadRaw}
            onChange={handleCiudadChange}
            placeholder={form.codpais ? "Buscar ciudad..." : "Primero elige país"}
            disabled={!form.codpais || cargandoCiudades || retiroEnOficina}
            loading={cargandoCiudades}
          />
        </div>

        {/* Identificación con búsqueda */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input name="identificacion" placeholder="Cédula o Pasaporte" value={form.identificacion}
              onChange={(e) => { const v = e.target.value.trimStart(); setForm((p) => ({ ...p, identificacion: v })); setCedulaQuery(v); }}
              className="pl-8 h-9 text-sm" />
          </div>
          {buscandoCedula && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-gray-400" />}
          {cedulaResultados.length > 0 && (
            <div className="absolute bg-white border rounded-md shadow-md w-full max-h-32 overflow-y-auto z-10 mt-1">
              {cedulaResultados.slice(0, 3).map((d, i) => (
                <div key={i} className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-xs border-b last:border-b-0" onClick={() => seleccionarDestinatario(d)}>
                  <span className="font-medium">{d.cedula || d.identificacion}</span>
                  <span className="text-gray-500 ml-2">{d.nombre}</span>
                </div>
              ))}
              {cedulaResultados.length > 3 && (
                <div className="px-3 py-1.5 text-[10px] text-gray-400 bg-gray-50 text-center">+{cedulaResultados.length - 3} más</div>
              )}
            </div>
          )}
        </div>

        <Input name="nombre" placeholder="Nombre completo" value={form.nombre} onChange={handleChange} className="h-9 text-sm" />

        <div className="grid grid-cols-2 gap-2">
          <Input name="telefono" placeholder="Teléfono" value={form.telefono} onChange={handleChange} className="h-9 text-sm" />
          <Input name="email" placeholder="Correo" value={form.email} onChange={handleChange} className="h-9 text-sm" />
        </div>

        <textarea placeholder="Dirección completa" value={direccionCompleta}
          onChange={(e) => setDireccionCompleta(e.target.value)}
          className="w-full h-16 px-3 py-2 border rounded-md text-sm resize-none focus:ring-2 focus:ring-blue-500" />

        {esInternacional && (
          <Input name="codigo_postal" placeholder="Código Postal" value={form.codigo_postal} onChange={handleChange} className="h-9 text-sm" />
        )}

        {/* Retiro en oficina */}
        <div className="border rounded-md p-2 bg-gray-50">
          {!retiroEnOficina ? (
            <Button variant="outline" size="sm" onClick={() => setModalRetiroAbierto(true)} className="w-full h-8 text-xs justify-start gap-2">
              <MapPin className="h-3.5 w-3.5" />
              Habilitar retiro en oficina
            </Button>
          ) : agenciaSeleccionadaData ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium">Retiro en oficina</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLimpiarRetiro} className="h-6 text-[10px] text-red-600 hover:text-red-700 px-2">
                  Cambiar
                </Button>
              </div>
              <div className="text-[10px] text-gray-600">
                <p className="font-medium">{agenciaSeleccionadaData.nombre}</p>
                <p className="line-clamp-1">{agenciaSeleccionadaData.direccion}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Retiro habilitado</span>
              </div>
              <Button size="sm" onClick={() => setModalRetiroAbierto(true)} className="w-full h-8 text-xs">
                <MapPin className="h-3.5 w-3.5 mr-1" />
                Seleccionar punto
              </Button>
            </div>
          )}
        </div>

        <Button disabled={loading} onClick={handleContinue} size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
        </Button>
      </div>

      <ModalRetiroOficina
        abierto={modalRetiroAbierto}
        onCerrar={() => setModalRetiroAbierto(false)}
        onConfirmar={handleConfirmarRetiro}
        agencias={agencias}
        cargando={cargandoPaises}
        error={null}
        onReintentar={() => {}}
      />
    </div>
  );
}
