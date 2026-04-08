"use client";

import React, { useEffect, useState, useMemo } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, CheckCircle2, User, Search, X } from "lucide-react";
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
    ciudad: "", provincia: "", codigo_postal: "", pais: "ECUADOR", codpais: 63,
  });
  const [direccionCompleta, setDireccionCompleta] = useState("");

  const esInternacional = useMemo(() => form.codpais !== 63, [form.codpais]);

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
    setForm((prev) => ({ ...prev, provincia: agencia.provincia, ciudad: agencia.ciudad }));
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
    const [ciudad, provincia] = value.split("|");
    setForm((prev) => ({ ...prev, ciudad, provincia }));
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

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-semibold">Datos del Destinatario</h2>
      </div>

      <div className="space-y-3">
        {/* País y Ciudad */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={String(form.codpais ?? "")} onValueChange={handlePaisChange} disabled={cargandoPaises}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="País" />
            </SelectTrigger>
            <SelectContent>
              {paises.map((p) => (
                <SelectItem key={p.codpais} value={String(p.codpais)} className="text-xs">
                  {p.pais}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={handleCiudadChange} value={form.ciudad && form.provincia ? `${form.ciudad}|${form.provincia}` : ""} disabled={cargandoCiudades || retiroEnOficina}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={cargandoCiudades ? "..." : "Ciudad"} />
            </SelectTrigger>
            <SelectContent>
              {ciudadesCanon.slice(0, 5).map((c, i) => (
                <SelectItem key={i} value={`${c.ciudad}|${c.provincia}`} className="text-xs">
                  {c.ciudad}
                </SelectItem>
              ))}
              {ciudadesCanon.length > 5 && (
                <div className="px-2 py-1 text-[10px] text-gray-400">+{ciudadesCanon.length - 5} más...</div>
              )}
            </SelectContent>
          </Select>
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
