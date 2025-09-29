"use client";

import React, { useEffect, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Usuario, PuntoAtencion } from "../../types";
import { Remitente } from "@/types/servientrega"; // Usa tu tipado global

interface PasoRemitenteProps {
  user: Usuario;
  selectedPoint: PuntoAtencion;
  onNext: (remitente: Remitente) => void;
}

// Helpers de normalización
const clean = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

type CiudadCanon = { ciudad: string; provincia: string; raw: string };

export default function PasoRemitente({
  selectedPoint,
  onNext,
}: PasoRemitenteProps) {
  // Catálogo oficial de ciudades (Servientrega)
  const [ciudadesCanon, setCiudadesCanon] = useState<CiudadCanon[]>([]);
  const [cargandoCiudades, setCargandoCiudades] = useState(true);

  // Usa SIEMPRE ciudad/provincia del punto de atención (validada contra catálogo)
  const [formData, setFormData] = useState<Remitente>({
    identificacion: "",
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    ciudad: selectedPoint?.ciudad || "",
    provincia: selectedPoint?.provincia || "",
    codigo_postal: selectedPoint?.codigo_postal || "170150",
    pais: "ECUADOR",
  });

  const [extraDireccion, setExtraDireccion] = useState({
    callePrincipal: "",
    numeracion: "",
    calleSecundaria: "",
    referencia: "",
  });

  const [loading, setLoading] = useState(false);
  const [ciudadValida, setCiudadValida] = useState(false);

  const [cedulaQuery, setCedulaQuery] = useState("");
  const [cedulaResultados, setCedulaResultados] = useState<Remitente[]>([]);
  const [buscandoCedula, setBuscandoCedula] = useState(false);
  const [remitenteExistente, setRemitenteExistente] =
    useState<Remitente | null>(null);

  // 1) Cargar ciudades (codpais: 63 Ecuador) y validar punto de atención
  useEffect(() => {
    const loadCiudades = async () => {
      try {
        setCargandoCiudades(true);
        const { data } = await axiosInstance.post("/servientrega/ciudades", {
          codpais: 63,
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

        // Validar/ajustar contra catálogo
        const spCiudad = clean(selectedPoint?.ciudad || "");
        const spProv = clean(selectedPoint?.provincia || "");

        // Match exacto (normalizado)
        let match =
          lista.find(
            (c) => clean(c.ciudad) === spCiudad && clean(c.provincia) === spProv
          ) || null;

        // Match aproximado si no hay exacto (contiene)
        if (!match) {
          match =
            lista.find(
              (c) =>
                clean(c.ciudad).includes(spCiudad) &&
                clean(c.provincia).includes(spProv)
            ) || null;
        }

        if (match) {
          setFormData((prev) => ({
            ...prev,
            ciudad: match!.ciudad,
            provincia: match!.provincia,
            pais: "ECUADOR",
          }));
          setCiudadValida(true);
        } else {
          setCiudadValida(false);
          setFormData((prev) => ({
            ...prev,
            ciudad: selectedPoint?.ciudad || "",
            provincia: selectedPoint?.provincia || "",
            pais: "ECUADOR",
          }));
          toast.error(
            "La ciudad/provincia del Punto de Atención no existe en el catálogo de Servientrega. Contacta a soporte para homologar el punto."
          );
        }
      } catch (e) {
        console.error("❌ Error cargando ciudades:", e);
        setCiudadValida(false);
        toast.error(
          "No se pudo validar ciudades con Servientrega. Verifica conexión."
        );
      } finally {
        setCargandoCiudades(false);
      }
    };

    loadCiudades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoint?.ciudad, selectedPoint?.provincia]);

  // 2) Búsqueda predictiva de remitente
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

  const seleccionarRemitente = (rem: any) => {
    setFormData((prev) => ({
      ...prev,
      identificacion: rem.cedula || rem.identificacion || "",
      nombre: rem.nombre || "",
      telefono: rem.telefono || "",
      email: rem.email || "",
      direccion: rem.direccion || "",
      // Fijar SIEMPRE la ciudad/provincia del punto (ya validadas contra catálogo)
      ciudad: prev.ciudad,
      provincia: prev.provincia,
      codigo_postal: prev.codigo_postal || "170150",
      pais: "ECUADOR",
    }));

    // Parseo de dirección
    if (rem.direccion) {
      const partes = String(rem.direccion)
        .split(",")
        .map((p: string) => p.trim());
      const referenciaIndex = partes.findIndex((p: string) =>
        p.toLowerCase().startsWith("ref:")
      );
      const referencia =
        referenciaIndex >= 0
          ? partes
              .slice(referenciaIndex)
              .join(", ")
              .replace(/^Ref:\s*/i, "")
              .trim()
          : "";

      const partesAntes =
        referenciaIndex >= 0 ? partes.slice(0, referenciaIndex) : partes;

      const callePrincipal = partesAntes[0]?.trim() || "";
      const segundaParte = partesAntes[1]?.trim() || "";
      let numeracion = "";
      let calleSecundaria = "";

      if (segundaParte.startsWith("#")) {
        numeracion = segundaParte.replace("#", "").trim();
        calleSecundaria = partesAntes[2]?.replace(/^y\s*/i, "").trim() || "";
      } else {
        calleSecundaria = segundaParte.replace(/^y\s*/i, "").trim();
      }

      setExtraDireccion({
        callePrincipal,
        numeracion,
        calleSecundaria,
        referencia,
      });
    }

    setRemitenteExistente(rem);
    setCedulaResultados([]);
  };

  // Validación identificación EC (cédula/RUC) + fallback pasaporte
  const validarIdentificacion = (id: string): boolean => {
    const cleanId = (id || "").trim();
    if (!cleanId) return false;
    if (/^\d{10}$/.test(cleanId)) {
      const provincia = parseInt(cleanId.substring(0, 2));
      if (provincia < 1 || provincia > 24) return false;
      const digitoVerificador = parseInt(cleanId[9]);
      const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
      let suma = 0;
      for (let i = 0; i < 9; i++) {
        let val = parseInt(cleanId[i]) * coef[i];
        if (val >= 10) val -= 9;
        suma += val;
      }
      return digitoVerificador === (10 - (suma % 10)) % 10;
    }
    if (/^\d{13}$/.test(cleanId))
      return validarIdentificacion(cleanId.substring(0, 10));
    return /^[A-Za-z0-9]{6,}$/.test(cleanId); // pasaporte genérico
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleExtraDireccionChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setExtraDireccion((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleContinue = async () => {
    if (cargandoCiudades) {
      toast.info("Cargando catálogo de ciudades...");
      return;
    }
    if (!ciudadValida) {
      toast.error(
        "La ciudad del Punto de Atención no está homologada. No se puede continuar."
      );
      return;
    }

    const { identificacion, nombre, telefono, email, ciudad, pais } = formData;
    if (!identificacion || !nombre || !telefono || !email || !ciudad || !pais) {
      toast.error("Completa todos los campos obligatorios.");
      return;
    }
    if (!validarIdentificacion(identificacion)) {
      toast.error("Número de identificación inválido.");
      return;
    }

    const direccionFinal = [
      extraDireccion.callePrincipal.trim(),
      extraDireccion.numeracion && `#${extraDireccion.numeracion.trim()}`,
      extraDireccion.calleSecundaria &&
        `y ${extraDireccion.calleSecundaria.trim()}`,
      extraDireccion.referencia && `Ref: ${extraDireccion.referencia.trim()}`,
    ]
      .filter(Boolean)
      .join(", ");

    if (!direccionFinal.trim()) {
      toast.error("La dirección es requerida");
      return;
    }

    // Construye el remitente canonizado
    const remitenteFinal: Remitente = {
      identificacion: formData.identificacion.trim(),
      nombre: formData.nombre.trim(),
      direccion: direccionFinal.trim(),
      telefono: formData.telefono.trim(),
      email: formData.email?.trim() || "",
      ciudad: formData.ciudad.trim(), // canon Servientrega
      provincia: formData.provincia.trim(), // canon Servientrega
      codigo_postal: formData.codigo_postal?.trim() || "170150",
      pais: "ECUADOR",
    };

    // Payload a BD (usa campos básicos por compatibilidad)
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
      toast.success("Remitente guardado correctamente.");
      onNext(remitenteFinal);
    } catch (err) {
      console.error(
        "❌ Error al guardar remitente:",
        err,
        "\nPayload:",
        payload
      );
      toast.error("Hubo un problema al guardar el remitente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Información del Remitente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Identificación (con búsqueda) */}
        <div className="relative">
          <Input
            name="identificacion"
            placeholder="Cédula, RUC o Pasaporte"
            value={formData.identificacion}
            onChange={(e) => {
              const value = e.target.value.trimStart();
              setFormData((prev) => ({ ...prev, identificacion: value }));
              setCedulaQuery(value);
            }}
          />
          {buscandoCedula && (
            <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-gray-400" />
          )}
          {cedulaResultados.length > 0 && (
            <div className="absolute bg-white border rounded-md shadow-md w-full max-h-40 overflow-y-auto z-10">
              {cedulaResultados.map((r, idx) => (
                <div
                  key={idx}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => seleccionarRemitente(r)}
                >
                  {(r.cedula || r.identificacion) + " - " + r.nombre}
                </div>
              ))}
            </div>
          )}
        </div>

        <Input
          name="nombre"
          placeholder="Nombre completo"
          value={formData.nombre}
          onChange={handleChange}
        />
        <Input
          name="telefono"
          placeholder="Teléfono"
          value={formData.telefono}
          onChange={handleChange}
        />
        <Input
          name="email"
          placeholder="Correo electrónico"
          value={formData.email}
          onChange={handleChange}
        />

        {/* Dirección desglosada */}
        <Input
          name="callePrincipal"
          placeholder="Calle principal"
          value={extraDireccion.callePrincipal}
          onChange={handleExtraDireccionChange}
        />
        <Input
          name="numeracion"
          placeholder="Numeración"
          value={extraDireccion.numeracion}
          onChange={handleExtraDireccionChange}
        />
        <Input
          name="calleSecundaria"
          placeholder="Calle secundaria"
          value={extraDireccion.calleSecundaria}
          onChange={handleExtraDireccionChange}
        />
        <Input
          name="referencia"
          placeholder="Referencia"
          value={extraDireccion.referencia}
          onChange={handleExtraDireccionChange}
        />

        {/* Ciudad y Provincia — SIEMPRE desde punto de atención y validadas contra catálogo */}
        <Input
          name="ciudad"
          value={
            cargandoCiudades
              ? "Validando ciudad del punto..."
              : `${formData.ciudad} - ${formData.provincia}`
          }
          readOnly
        />

        {/* País (fijo) */}
        <Input name="pais" placeholder="País" value={formData.pais} readOnly />

        <Button
          disabled={loading || !ciudadValida}
          onClick={handleContinue}
          className="w-full"
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
