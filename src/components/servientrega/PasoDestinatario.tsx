"use client";

import React, { useEffect, useState, useMemo } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { Destinatario } from "@/types/servientrega";
import { validarIdentificacion } from "@/utils/identificacion";

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
}

interface PasoDestinatarioProps {
  onNext: (
    destinatario: Destinatario,
    retiro_oficina: boolean,
    nombre_agencia?: string
  ) => void;
}

const clean = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

export default function PasoDestinatario({ onNext }: PasoDestinatarioProps) {
  const [paises, setPaises] = useState<Pais[]>([]);
  const [ciudadesCanon, setCiudadesCanon] = useState<CiudadCanon[]>([]);
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [cargandoPaises, setCargandoPaises] = useState(true);
  const [cargandoCiudades, setCargandoCiudades] = useState(true);
  const [cargandoAgencias, setCargandoAgencias] = useState(false);
  const [errorAgencias, setErrorAgencias] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [cedulaQuery, setCedulaQuery] = useState("");
  const [cedulaResultados, setCedulaResultados] = useState<Destinatario[]>([]);
  const [buscandoCedula, setBuscandoCedula] = useState(false);

  const [nombreQuery, setNombreQuery] = useState("");
  const [nombreResultados, setNombreResultados] = useState<Destinatario[]>([]);
  const [buscandoNombre, setBuscandoNombre] = useState(false);

  const [destinatarioExistente, setDestinatarioExistente] =
    useState<Destinatario | null>(null);

  // Retiro en oficina
  const [retiroEnOficina, setRetiroEnOficina] = useState(false);
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState<string>("");
  const [provinciaFiltro, setProvinciaFiltro] = useState<string>("");
  const [ciudadFiltro, setCiudadFiltro] = useState<string>("");

  const [form, setForm] = useState<Destinatario>({
    identificacion: "",
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    ciudad: "",
    provincia: "",
    codigo_postal: "",
    pais: "ECUADOR",
    codpais: 63,
  });

  // Campo único para dirección completa (consolidado de 4 campos)
  const [direccionCompleta, setDireccionCompleta] = useState("");

  const esInternacional = useMemo(() => form.codpais !== 63, [form.codpais]);
  const ciudadSeleccionValida = useMemo(
    () =>
      !!form.ciudad &&
      !!form.provincia &&
      ciudadesCanon.some(
        (c) => c.ciudad === form.ciudad && c.provincia === form.provincia
      ),
    [form.ciudad, form.provincia, ciudadesCanon]
  );

  // 1) Cargar países y setear Ecuador por defecto
  useEffect(() => {
    const loadPaises = async () => {
      try {
        setCargandoPaises(true);
        const { data } = await axiosInstance.post("/servientrega/paises");
        const lista: Pais[] = data?.fetch || [];
        setPaises(lista);

        // Ecuador por defecto
        const ec = lista.find((p) => p.codpais === 63);
        if (ec) {
          setForm((prev) => ({ ...prev, codpais: 63, pais: ec.pais }));
        }
      } catch (e) {
        console.error("❌ Error al obtener países:", e);
        toast.error("No se pudo cargar el listado de países.");
      } finally {
        setCargandoPaises(false);
      }
    };
    loadPaises();
  }, []);

  // 1.1) Cargar agencias para retiro en oficina (usando endpoint de retiro)
  const loadAgencias = async () => {
    try {
      setCargandoAgencias(true);
      setErrorAgencias(null);
      const { data } = await axiosInstance.post("/servientrega/agencias-retiro");
      console.log("📦 Respuesta agencias-retiro:", data);
      const lista: Agencia[] = data?.data || [];
      setAgencias(lista);
      if (lista.length === 0) {
        setErrorAgencias("No se encontraron agencias con servicio de retiro");
      }
    } catch (e: any) {
      console.error("❌ Error al obtener agencias de retiro:", e);
      setErrorAgencias(e?.response?.data?.error || e?.message || "Error al cargar agencias");
      setAgencias([]);
    } finally {
      setCargandoAgencias(false);
    }
  };

  useEffect(() => {
    loadAgencias();
  }, []);

  // Obtener lista única de provincias para el filtro
  const provinciasDisponibles = useMemo(() => {
    const provincias = agencias.map((a) => a.provincia).filter(Boolean);
    return Array.from(new Set(provincias)).sort();
  }, [agencias]);

  // Obtener ciudades disponibles según la provincia seleccionada
  const ciudadesDisponibles = useMemo(() => {
    let filtered = agencias;
    if (provinciaFiltro) {
      filtered = filtered.filter((a) => a.provincia === provinciaFiltro);
    }
    const ciudades = filtered.map((a) => a.ciudad).filter(Boolean);
    return Array.from(new Set(ciudades)).sort();
  }, [agencias, provinciaFiltro]);

  // Filtrar agencias por provincia y ciudad seleccionadas
  const agenciasFiltradas = useMemo(() => {
    let filtered = agencias;
    if (provinciaFiltro) {
      filtered = filtered.filter((a) => a.provincia === provinciaFiltro);
    }
    if (ciudadFiltro) {
      filtered = filtered.filter((a) => a.ciudad === ciudadFiltro);
    }
    return filtered;
  }, [agencias, provinciaFiltro, ciudadFiltro]);

  // 2) Cargar ciudades por país (codpais)
  const cargarCiudadesPorPais = async (codpais: number) => {
    try {
      setCargandoCiudades(true);
      const { data } = await axiosInstance.post("/servientrega/ciudades", {
        codpais,
      });
      const lista: CiudadCanon[] = (data?.fetch || []).map(
        (item: { city: string }) => {
          const [ciu, prov] = String(item.city || "").split("-");
          return {
            ciudad: (ciu || "").trim(),
            provincia: (prov || "").trim(),
            raw: item.city,
          };
        }
      );
      setCiudadesCanon(lista);

      // Si la ciudad actual no existe en el nuevo catálogo, limpiar selección
      const match = lista.find(
        (c) => c.ciudad === form.ciudad && c.provincia === form.provincia
      );
      if (!match) {
        setForm((prev) => ({ ...prev, ciudad: "", provincia: "" }));
      }
    } catch (e) {
      console.error("❌ Error al obtener ciudades:", e);
      setCiudadesCanon([]);
      toast.error("No se pudo cargar el listado de ciudades.");
    } finally {
      setCargandoCiudades(false);
    }
  };

  // 2.1) Cuando cambia el país, recargar ciudades
  useEffect(() => {
    if (form.codpais) {
      cargarCiudadesPorPais(form.codpais);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.codpais]);

  // 3) Búsqueda predictiva de destinatario por cédula
  useEffect(() => {
    if (cedulaQuery.trim().length >= 3) {
      setBuscandoCedula(true);
      axiosInstance
        .get(`/servientrega/destinatario/buscar/${cedulaQuery.trim()}`)
        .then((res) => setCedulaResultados(res.data.destinatarios || []))
        .catch(() => setCedulaResultados([]))
        .finally(() => setBuscandoCedula(false));
    } else {
      setCedulaResultados([]);
    }
  }, [cedulaQuery]);

  // 3.1) Búsqueda predictiva por nombre
  useEffect(() => {
    if (nombreQuery.trim().length >= 3) {
      setBuscandoNombre(true);
      axiosInstance
        .get(`/servientrega/destinatario/buscar-nombre/${nombreQuery.trim()}`)
        .then((res) => setNombreResultados(res.data.destinatarios || []))
        .catch(() => setNombreResultados([]))
        .finally(() => setBuscandoNombre(false));
    } else {
      setNombreResultados([]);
    }
  }, [nombreQuery]);

  // 4) Seleccionar destinatario existente (homologa la ciudad si coincide en el catálogo de país actual)
  const seleccionarDestinatario = (dest: Destinatario) => {
    // Buscar match canónico en el catálogo actual
    const ciu = clean(dest.ciudad || "");
    const prov = clean(dest.provincia || "");
    const match =
      ciudadesCanon.find(
        (c) => clean(c.ciudad) === ciu && clean(c.provincia) === prov
      ) || null;

    setForm({
      identificacion: dest.cedula || dest.identificacion || "",
      nombre: dest.nombre || "",
      telefono: dest.telefono || "",
      email: dest.email || "",
      direccion: dest.direccion || "",
      ciudad: match ? match.ciudad : "",
      provincia: match ? match.provincia : "",
      codigo_postal: dest.codigo_postal || "",
      pais: dest.pais || form.pais,
      codpais: Number.isFinite(dest.codpais) ? dest.codpais : form.codpais,
    });

    // Parseo de dirección y reconstrucción en campo único
    if (dest.direccion) {
      const partes = String(dest.direccion)
        .split(",")
        .map((p: string) => p.trim());

      let numeracion = "";
      let calleSecundaria = "";
      const parteConNumeracion = partes.find((p: string) => p.includes("#"));
      if (parteConNumeracion)
        numeracion = parteConNumeracion.replace("#", "").trim();

      const parteCalleSecundaria = partes.find((p: string) =>
        p.toLowerCase().startsWith("y ")
      );
      if (parteCalleSecundaria) {
        calleSecundaria = parteCalleSecundaria.replace(/^y\s*/i, "").trim();
      }

      const referencia =
        partes
          .find(
            (p: string) =>
              p.toLowerCase().startsWith("ref:") ||
              (!p.includes("#") &&
                !p.toLowerCase().startsWith("y ") &&
                p !== partes[0])
          )
          ?.replace(/^Ref:\s*/i, "")
          .trim() || "";

      // Reconstruir dirección completa en formato legible
      let direccionReconstruida = partes[0] || "";
      if (numeracion) {
        direccionReconstruida += ` #${numeracion}`;
      }
      if (calleSecundaria) {
        direccionReconstruida += ` y ${calleSecundaria}`;
      }
      if (referencia) {
        direccionReconstruida += `, Ref: ${referencia}`;
      }

      setDireccionCompleta(direccionReconstruida.trim());
    } else {
      setDireccionCompleta("");
    }

    setDestinatarioExistente(dest);
    setCedulaResultados([]);
    setNombreResultados([]);
    setCedulaQuery("");
    setNombreQuery("");
  };

  // 5) Cambio de país
  const handlePaisChange = (value: string) => {
    const codpais = parseInt(value, 10);
    const paisSeleccionado = paises.find((p) => p.codpais === codpais);
    setForm((prev) => ({
      ...prev,
      codpais,
      pais: paisSeleccionado ? paisSeleccionado.pais : "",
      ciudad: "",
      provincia: "",
      codigo_postal: "", // limpiar CP al cambiar país
    }));
  };

  // 6) Cambio de ciudad (siempre viene canónica desde el catálogo)
  const handleCiudadChange = (value: string) => {
    const [ciudad, provincia] = value.split("|");
    setForm((prev) => ({ ...prev, ciudad, provincia }));
  };

  // 7) Cambios generales del form
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value.trimStart() });

  // 8) Validar código postal (internacional)
  const validarCodigoPostal = (): boolean => {
    if (!esInternacional) return true;
    if (!form.codigo_postal?.trim()) {
      toast.error(
        "El código postal es obligatorio para envíos internacionales."
      );
      return false;
    }
    return true;
  };


  // 9) Guardar/continuar (requiere ciudad/provincia canónicas del catálogo)
  const handleContinue = async () => {
    if (cargandoPaises || cargandoCiudades) {
      toast.info("Cargando catálogos...");
      return;
    }

    if (
      !form.identificacion ||
      !form.nombre ||
      !form.telefono ||
      !form.pais ||
      !form.ciudad ||
      !form.provincia
    ) {
      toast.error("Completa todos los campos obligatorios.");
      return;
    }

    // Validar identificación si es Ecuador (codpais 63)
    if (form.codpais === 63 && !validarIdentificacion(form.identificacion)) {
      toast.error("Número de identificación inválido.");
      return;
    }

    if (!ciudadSeleccionValida) {
      toast.error("Selecciona una ciudad válida del catálogo.");
      return;
    }

    if (!validarCodigoPostal()) return;

    // Validar retiro en oficina
    if (retiroEnOficina) {
      if (!provinciaFiltro) {
        toast.error("Selecciona una provincia para el retiro en oficina.");
        return;
      }
      if (!ciudadFiltro) {
        toast.error("Selecciona una ciudad para el retiro en oficina.");
        return;
      }
      if (!agenciaSeleccionada) {
        toast.error("Selecciona una agencia para retiro en oficina.");
        return;
      }
    }

    const direccionFinal = direccionCompleta.trim();

    if (!direccionFinal) {
      toast.error("La dirección es requerida");
      return;
    }

    const destinatarioFinal: Destinatario = {
      identificacion: form.identificacion.trim(),
      nombre: form.nombre.trim(),
      direccion: direccionFinal,
      telefono: form.telefono.trim(),
      email: form.email?.trim() || "",
      ciudad: form.ciudad, // canónica
      provincia: form.provincia, // canónica
      pais: form.pais,
      codpais: form.codpais,
      codigo_postal: form.codigo_postal?.trim() || "",
    };

    const datosParaEnviar = {
      ...destinatarioFinal,
      cedula: form.identificacion.trim(),
    };

    setLoading(true);
    try {
      if (destinatarioExistente) {
        await axiosInstance.put(
          `/servientrega/destinatario/actualizar/${form.identificacion.trim()}`,
          datosParaEnviar
        );
      } else {
        await axiosInstance.post(
          "/servientrega/destinatario/guardar",
          datosParaEnviar
        );
      }
      toast.success("Destinatario guardado correctamente.");
      onNext(
        destinatarioFinal,
        retiroEnOficina,
        retiroEnOficina ? agenciaSeleccionada : undefined
      );
    } catch (err) {
      console.error("❌ Error al guardar destinatario:", err);
      toast.error("Hubo un problema al guardar el destinatario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto mt-4 sm:mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>Datos del Destinatario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* --- UBICACIÓN --- */}
        <div className="p-4 border rounded-md bg-gray-50">
          <h4 className="font-semibold mb-2">📍 Ubicación</h4>

          <Label>País</Label>
          <Select
            value={String(form.codpais ?? "")}
            onValueChange={handlePaisChange}
            disabled={cargandoPaises}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar país" />
            </SelectTrigger>
            <SelectContent>
              {paises.map((p) => (
                <SelectItem key={p.codpais} value={String(p.codpais)}>
                  {p.pais} (+{p.phone_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label className="mt-3">Ciudad y Provincia</Label>
          <Select
            onValueChange={handleCiudadChange}
            value={
              form.ciudad && form.provincia
                ? `${form.ciudad}|${form.provincia}`
                : ""
            }
            disabled={cargandoCiudades}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  cargandoCiudades
                    ? "Cargando ciudades..."
                    : "Seleccionar ciudad"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {ciudadesCanon.map((c, i) => (
                <SelectItem key={i} value={`${c.ciudad}|${c.provincia}`}>
                  {c.ciudad} - {c.provincia}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {esInternacional && (
            <>
              <Label className="mt-3">Código Postal (Obligatorio)</Label>
              <Input
                name="codigo_postal"
                placeholder="Ej: 110111"
                value={form.codigo_postal}
                onChange={handleChange}
              />
            </>
          )}
        </div>

        {/* --- DATOS PERSONALES --- */}
        <div className="p-4 border rounded-md bg-white">
          <h4 className="font-semibold mb-4">👤 Datos Personales</h4>
          <div className="space-y-4">
            <div className="relative">
              <Label htmlFor="identificacion">Cédula o Pasaporte</Label>
              <Input
                id="identificacion"
                name="identificacion"
                placeholder="Ingrese cédula o pasaporte"
                value={form.identificacion}
                onChange={(e) => {
                  const value = e.target.value.trimStart();
                  setForm((prev) => ({ ...prev, identificacion: value }));
                  setCedulaQuery(value);
                }}
              />
              {buscandoCedula && (
                <div className="flex items-center mt-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400 mr-2" />
                  <span className="text-sm text-gray-500">Buscando...</span>
                </div>
              )}
              {cedulaResultados.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto z-50 mt-1">
                  {cedulaResultados.map((d, idx) => (
                    <div
                      key={idx}
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 text-sm"
                      onClick={() => seleccionarDestinatario(d)}
                    >
                      <div className="font-medium text-gray-900">
                        {d.cedula || d.identificacion}
                      </div>
                      <div className="text-gray-600">{d.nombre}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                name="nombre"
                placeholder="Ingrese nombre completo"
                value={form.nombre}
                onChange={(e) => {
                  const value = e.target.value.trimStart();
                  setForm((prev) => ({ ...prev, nombre: value }));
                  setNombreQuery(value);
                }}
              />
              {buscandoNombre && (
                <div className="flex items-center mt-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400 mr-2" />
                  <span className="text-sm text-gray-500">Buscando...</span>
                </div>
              )}
              {nombreResultados.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto z-50 mt-1">
                  {nombreResultados.map((d, idx) => (
                    <div
                      key={idx}
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 text-sm"
                      onClick={() => seleccionarDestinatario(d)}
                    >
                      <div className="font-medium text-gray-900">
                        {d.nombre}
                      </div>
                      <div className="text-gray-600">
                        {d.cedula || d.identificacion}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                placeholder="Ingrese número de teléfono"
                value={form.telefono}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                placeholder="Ingrese correo electrónico"
                value={form.email}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Dirección manual - Campo único consolidado */}
          <div className="mt-6">
            <h4 className="font-semibold mb-4">🏠 Dirección completa</h4>
            <div>
              <Label htmlFor="direccionCompleta">Dirección</Label>
              <textarea
                id="direccionCompleta"
                name="direccionCompleta"
                placeholder="Ingrese la dirección completa (calle principal, numeración, calle secundaria, referencia...)"
                value={direccionCompleta}
                onChange={(e) => setDireccionCompleta(e.target.value)}
                className="w-full min-h-[80px] p-3 border rounded-md text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* --- RETIRO EN OFICINA --- */}
        <div className="p-4 border rounded-md bg-blue-50">
          <h4 className="font-semibold mb-4">📦 Retiro en Oficina</h4>

          {/* Toggle para retiro en oficina */}
          <div
            onClick={() => {
              setRetiroEnOficina(!retiroEnOficina);
              if (!retiroEnOficina) {
                // Se va a activar - limpiar selecciones previas
                setAgenciaSeleccionada("");
                setCiudadFiltro("");
                setProvinciaFiltro("");
              }
            }}
            className="flex items-center gap-3 cursor-pointer p-3 rounded-md hover:bg-blue-100 transition-colors"
          >
            {retiroEnOficina ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <Circle className="h-6 w-6 text-gray-400" />
            )}
            <span className="text-sm font-medium">
              {retiroEnOficina
                ? "Retiro en oficina habilitado"
                : "Habilitar retiro en oficina"}
            </span>
          </div>

          {/* Filtro por provincia, ciudad y selección de agencia (solo si retiro_oficina = true) */}
          {retiroEnOficina && (
            <div className="mt-4 space-y-4">
              {/* Filtro de provincia */}
              <div>
                <Label htmlFor="provinciaFiltro">Provincia *</Label>
                {cargandoAgencias ? (
                  <div className="flex items-center mt-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400 mr-2" />
                    <span className="text-sm text-gray-500">
                      Cargando agencias...
                    </span>
                  </div>
                ) : errorAgencias ? (
                  <div className="mt-2">
                    <div className="text-sm text-red-500">
                      {errorAgencias}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={loadAgencias}
                      className="mt-2"
                      type="button"
                    >
                      Reintentar
                    </Button>
                  </div>
                ) : agencias.length === 0 ? (
                  <div className="text-sm text-red-500 mt-2">
                    No hay agencias disponibles para retiro
                  </div>
                ) : (
                  <Select
                    value={provinciaFiltro}
                    onValueChange={(value) => {
                      setProvinciaFiltro(value);
                      setCiudadFiltro(""); // Limpiar ciudad al cambiar provincia
                      setAgenciaSeleccionada(""); // Limpiar agencia
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Seleccionar provincia (${provinciasDisponibles.length} disponibles)`} />
                    </SelectTrigger>
                    <SelectContent>
                      {provinciasDisponibles.map((provincia, idx) => (
                        <SelectItem key={idx} value={provincia}>
                          {provincia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Filtro de ciudad */}
              {provinciaFiltro && (
                <div>
                  <Label htmlFor="ciudadFiltro">Ciudad *</Label>
                  <Select
                    value={ciudadFiltro}
                    onValueChange={(value) => {
                      setCiudadFiltro(value);
                      setAgenciaSeleccionada(""); // Limpiar agencia al cambiar ciudad
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ciudad" />
                    </SelectTrigger>
                    <SelectContent>
                      {ciudadesDisponibles.map((ciudad, idx) => (
                        <SelectItem key={idx} value={ciudad}>
                          {ciudad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dropdown de agencias filtradas */}
              {ciudadFiltro && (
                <div>
                  <Label htmlFor="agencia">Punto de Retiro *</Label>
                  <Select
                    value={agenciaSeleccionada}
                    onValueChange={setAgenciaSeleccionada}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar punto de retiro" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {agenciasFiltradas.map((agencia, idx) => (
                        <SelectItem
                          key={idx}
                          value={agencia.nombre}
                          className="py-3"
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{agencia.nombre}</span>
                            <span className="text-xs text-gray-500">
                              {agencia.direccion}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Resumen de la selección */}
              {agenciaSeleccionada && (
                <div className="mt-4 p-3 bg-white rounded-md border border-blue-200">
                  <h5 className="font-semibold text-blue-800 mb-2 text-sm">
                    Punto de Retiro Seleccionado
                  </h5>
                  {(() => {
                    const agencia = agencias.find(
                      (a) => a.nombre === agenciaSeleccionada
                    );
                    if (!agencia) return null;
                    return (
                      <div className="space-y-1 text-sm">
                        <p className="font-medium">{agencia.nombre}</p>
                        <p className="text-gray-600">{agencia.direccion}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        <Button
          onClick={handleContinue}
          disabled={
            loading ||
            cargandoPaises ||
            cargandoCiudades ||
            !ciudadSeleccionValida
          }
          className="w-full mt-4"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
