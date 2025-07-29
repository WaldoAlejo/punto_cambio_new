"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface Pais {
  codpais: number;
  pais: string;
  nombrecorto: string;
  phone_code: string;
}

interface Ciudad {
  ciudad: string;
  provincia: string;
}

interface Agencia {
  nombre: string;
  tipo_cs: string;
  direccion: string;
  ciudad: string;
}

interface Destinatario {
  identificacion: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  ciudad: string;
  provincia: string;
  codpais: number;
}

interface PasoDestinatarioProps {
  onNext: (destinatario: any) => void;
}

export default function PasoDestinatario({ onNext }: PasoDestinatarioProps) {
  const [paises, setPaises] = useState<Pais[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [mostrarAgencias, setMostrarAgencias] = useState(false);
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [cedulaQuery, setCedulaQuery] = useState("");
  const [cedulaResultados, setCedulaResultados] = useState<Destinatario[]>([]);
  const [buscandoCedula, setBuscandoCedula] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    identificacion: "",
    codpais: 0,
    ciudad: "",
    provincia: "",
  });

  useEffect(() => {
    axios
      .post("/api/servientrega/paises")
      .then((res) => {
        const data = res.data as { fetch: Pais[] };
        setPaises(data.fetch || []);
      })
      .catch((err) => console.error("Error al obtener países:", err));
  }, []);

  // ✅ Debounce para búsqueda de cédula
  useEffect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);

    if (cedulaQuery.length >= 3) {
      const timer = setTimeout(() => {
        setBuscandoCedula(true);
        axios
          .get(`/api/servientrega/destinatario/buscar/${cedulaQuery}`)
          .then((res) => setCedulaResultados(res.data.destinatarios || []))
          .catch(() => setCedulaResultados([]))
          .finally(() => setBuscandoCedula(false));
      }, 400);
      setDebounceTimer(timer);
    } else {
      setCedulaResultados([]);
    }
  }, [cedulaQuery]);

  const seleccionarDestinatario = (dest: Destinatario) => {
    setForm({
      nombre: dest.nombre,
      direccion: dest.direccion,
      telefono: dest.telefono,
      email: dest.email,
      identificacion: dest.identificacion,
      codpais: dest.codpais,
      ciudad: dest.ciudad,
      provincia: dest.provincia,
    });
    setCedulaResultados([]);
  };

  const highlightMatch = (text: string, query: string) => {
    const regex = new RegExp(`(${query})`, "gi");
    return text.split(regex).map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const handlePaisChange = (value: string) => {
    const codpais = parseInt(value);
    setForm((prev) => ({ ...prev, codpais, ciudad: "", provincia: "" }));

    axios
      .post("/api/servientrega/ciudades", { codpais })
      .then((res) => {
        const data = res.data as { fetch: { city: string }[] };
        const lista = Array.isArray(data.fetch) ? data.fetch : [];
        setCiudades(
          lista.map((item) => {
            const [ciudad, provincia] = item.city.split("-");
            return {
              ciudad: ciudad?.trim() ?? "",
              provincia: provincia?.trim() ?? "",
            };
          })
        );
      })
      .catch((err) => console.error("Error al obtener ciudades:", err));
  };

  const handleCiudadChange = (value: string) => {
    const [ciudad, provincia] = value.split("|");
    setForm((prev) => ({ ...prev, ciudad, provincia }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCheckboxChange = async (checked: boolean) => {
    setMostrarAgencias(checked);
    if (checked && agencias.length === 0) {
      try {
        const res = await axios.post("/api/servientrega/agencias");
        const data = res.data as { fetch: any[] };
        setAgencias(
          (data.fetch || []).map((a: any) => ({
            nombre: String(Object.values(a)[0] ?? ""),
            tipo_cs: String(a.tipo_cs?.trim() ?? ""),
            direccion: String(a.direccion?.trim() ?? ""),
            ciudad: String(a.ciudad?.trim() ?? ""),
          }))
        );
      } catch (error) {
        console.error("Error al cargar agencias:", error);
      }
    }
  };

  const handleContinue = () => {
    if (
      !form.nombre ||
      !form.direccion ||
      !form.telefono ||
      !form.codpais ||
      !form.ciudad
    ) {
      toast.error("Por favor, completa todos los campos obligatorios.");
      return;
    }

    if (!/^(09\d{8}|0[2-7]\d{7,8})$/.test(form.telefono)) {
      toast.error("Número de teléfono inválido.");
      return;
    }

    if (
      form.codpais === 63 &&
      form.identificacion &&
      !/^[0-9]{10}$/.test(form.identificacion)
    ) {
      toast.error("Cédula inválida.");
      return;
    }

    const destinatarioFinal = {
      ...form,
      entrega_en_oficina: mostrarAgencias,
      agencia_seleccionada: mostrarAgencias ? agenciaSeleccionada : null,
    };

    setLoading(true);
    onNext(destinatarioFinal);
  };

  return (
    <Card className="w-full max-w-lg mx-auto mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>Datos del Destinatario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 🔍 Identificación con búsqueda predictiva */}
        <div className="relative">
          <Input
            name="identificacion"
            placeholder="Cédula o Pasaporte"
            value={form.identificacion}
            onChange={(e) => {
              handleChange(e);
              setCedulaQuery(e.target.value);
            }}
          />
          {buscandoCedula && (
            <Loader2 className="absolute right-2 top-2 h-5 w-5 animate-spin text-gray-400" />
          )}
          {cedulaResultados.length > 0 && (
            <div className="absolute bg-white border rounded-md shadow-md w-full max-h-40 overflow-y-auto z-10">
              {cedulaResultados.map((d, idx) => (
                <div
                  key={idx}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => seleccionarDestinatario(d)}
                >
                  {highlightMatch(d.identificacion, cedulaQuery)} -{" "}
                  {highlightMatch(d.nombre, cedulaQuery)}
                </div>
              ))}
            </div>
          )}
        </div>

        <Input
          name="nombre"
          placeholder="Nombre completo"
          value={form.nombre}
          onChange={handleChange}
        />
        <Input
          name="direccion"
          placeholder="Dirección"
          value={form.direccion}
          onChange={handleChange}
        />
        <Input
          name="telefono"
          placeholder="Teléfono"
          value={form.telefono}
          onChange={handleChange}
        />
        <Input
          name="email"
          placeholder="Correo electrónico"
          value={form.email}
          onChange={handleChange}
        />

        {/* 🌍 País */}
        <Label>País</Label>
        <Select onValueChange={handlePaisChange}>
          <SelectTrigger>
            <SelectValue placeholder="Buscar o seleccionar país" />
          </SelectTrigger>
          <SelectContent>
            {paises.map((p) => (
              <SelectItem key={p.codpais} value={p.codpais.toString()}>
                {p.pais} (+{p.phone_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 🏙 Ciudad */}
        {form.codpais > 0 && (
          <>
            <Label>Ciudad y Provincia</Label>
            <Select onValueChange={handleCiudadChange}>
              <SelectTrigger>
                <SelectValue placeholder="Buscar o seleccionar ciudad" />
              </SelectTrigger>
              <SelectContent>
                {ciudades.map((c, i) => (
                  <SelectItem key={i} value={`${c.ciudad}|${c.provincia}`}>
                    {c.ciudad} - {c.provincia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {/* 🏢 Agencias */}
        <div className="flex items-center gap-2 mt-2">
          <Checkbox
            checked={mostrarAgencias}
            onCheckedChange={handleCheckboxChange}
          />
          <Label>¿Entrega en oficina?</Label>
        </div>
        {mostrarAgencias && (
          <div>
            <Label>Seleccionar agencia</Label>
            <Select onValueChange={setAgenciaSeleccionada}>
              <SelectTrigger>
                <SelectValue placeholder="Buscar o seleccionar agencia" />
              </SelectTrigger>
              <SelectContent>
                {agencias.map((a, i) => (
                  <SelectItem key={i} value={a.nombre}>
                    {a.nombre} - {a.ciudad} ({a.tipo_cs})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={handleContinue}
          disabled={loading || !form.ciudad}
          className="w-full mt-4"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
            </>
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
