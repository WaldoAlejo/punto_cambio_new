"use client";

import React, { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Destinatario } from "@/types/servientrega"; // Asegúrate de la ruta

// ----- TIPADOS AUXILIARES -----
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
interface PasoDestinatarioProps {
  onNext: (
    destinatario: Destinatario,
    retiro_oficina: boolean,
    nombre_agencia?: string
  ) => void;
}

// ----------- COMPONENTE PRINCIPAL -----------
export default function PasoDestinatario({ onNext }: PasoDestinatarioProps) {
  const [paises, setPaises] = useState<Pais[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [mostrarAgencias, setMostrarAgencias] = useState(false);
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState<string>("");
  const [ciudadEstablecidaPorAgencia, setCiudadEstablecidaPorAgencia] =
    useState(false);
  const [loading, setLoading] = useState(false);

  const [cedulaQuery, setCedulaQuery] = useState("");
  const [cedulaResultados, setCedulaResultados] = useState<any[]>([]);
  const [buscandoCedula, setBuscandoCedula] = useState(false);

  const [nombreQuery, setNombreQuery] = useState("");
  const [nombreResultados, setNombreResultados] = useState<any[]>([]);
  const [buscandoNombre, setBuscandoNombre] = useState(false);

  const [destinatarioExistente, setDestinatarioExistente] =
    useState<Destinatario | null>(null);

  // Incluye pais y codpais
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

  const [extraDireccion, setExtraDireccion] = useState({
    callePrincipal: "",
    numeracion: "",
    calleSecundaria: "",
    referencia: "",
  });

  const esInternacional = form.codpais !== 63;

  // ===============================
  // 1. Cargar países y Ecuador por defecto
  // ===============================
  useEffect(() => {
    axiosInstance
      .post("/servientrega/paises")
      .then((res) => {
        const lista: Pais[] = res.data.fetch || [];
        console.log("🌍 Países cargados de la API:", lista);
        setPaises(lista);
        const ecuador = lista.find((p) => p.codpais === 63);
        console.log("🇪🇨 Ecuador encontrado:", ecuador);
        if (ecuador) {
          console.log("🇪🇨 Estableciendo Ecuador por defecto directamente");
          // Establecer Ecuador directamente en el form
          setForm((prev) => ({
            ...prev,
            codpais: 63,
            pais: ecuador.pais,
          }));
          // Cargar ciudades de Ecuador
          axiosInstance
            .post("/servientrega/ciudades", { codpais: 63 })
            .then((res) => {
              const lista = res.data.fetch || [];
              console.log("🌍 Ciudades de Ecuador cargadas:", lista);
              const ciudadesProcesadas = lista.map((item: { city: string }) => {
                const [ciudad, provincia] = item.city.split("-");
                return {
                  ciudad: ciudad?.trim() ?? "",
                  provincia: provincia?.trim() ?? "",
                };
              });
              console.log(
                "🏙️ Ciudades de Ecuador procesadas:",
                ciudadesProcesadas
              );
              setCiudades(ciudadesProcesadas);
            })
            .catch((err) =>
              console.error("Error al obtener ciudades de Ecuador:", err)
            );
        }
      })
      .catch((err) => console.error("Error al obtener países:", err));
    // eslint-disable-next-line
  }, []);

  // ===============================
  // 2. Búsqueda predictiva de destinatario por cédula
  // ===============================
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

  // ===============================
  // 2.1. Búsqueda predictiva de destinatario por nombre
  // ===============================
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

  // ===============================
  // 3. Seleccionar destinatario existente
  // ===============================
  const seleccionarDestinatario = (dest: any) => {
    setForm({
      identificacion: dest.cedula || dest.identificacion,
      nombre: dest.nombre,
      telefono: dest.telefono,
      email: dest.email || "",
      direccion: dest.direccion || "",
      ciudad: dest.ciudad || "",
      provincia: dest.provincia || "",
      codigo_postal: dest.codigo_postal || "",
      pais: dest.pais || "ECUADOR",
      codpais: dest.codpais ?? 63,
    });
    if (dest.direccion) {
      const partes = dest.direccion.split(",").map((p: string) => p.trim());
      console.log("🏠 Parseando dirección:", dest.direccion);
      console.log("🏠 Partes divididas:", partes);

      // Buscar numeración en cualquier parte que contenga #
      let numeracion = "";
      let calleSecundaria = "";

      // Buscar la parte que contiene #
      const parteConNumeracion = partes.find((p) => p.includes("#"));
      if (parteConNumeracion) {
        numeracion = parteConNumeracion.trim();
      }

      // La calle secundaria es la parte que empieza con "y" (sin el "y")
      const parteCalleSecundaria = partes.find((p) =>
        p.toLowerCase().startsWith("y ")
      );
      if (parteCalleSecundaria) {
        calleSecundaria = parteCalleSecundaria.replace(/^y\s*/i, "").trim();
      }

      setExtraDireccion({
        callePrincipal: partes[0] || "",
        numeracion: numeracion,
        calleSecundaria: calleSecundaria,
        referencia:
          partes
            .find(
              (p) =>
                p.toLowerCase().startsWith("ref:") ||
                (!p.includes("#") &&
                  !p.toLowerCase().startsWith("y ") &&
                  p !== partes[0])
            )
            ?.replace(/^Ref:\s*/i, "")
            .trim() || "",
      });

      console.log("🏠 Dirección parseada:", {
        callePrincipal: partes[0] || "",
        numeracion: numeracion,
        calleSecundaria: calleSecundaria,
        referencia:
          partes
            .find(
              (p) =>
                p.toLowerCase().startsWith("ref:") ||
                (!p.includes("#") &&
                  !p.toLowerCase().startsWith("y ") &&
                  p !== partes[0])
            )
            ?.replace(/^Ref:\s*/i, "")
            .trim() || "",
      });
    }
    setDestinatarioExistente(dest);
    setCedulaResultados([]);
    setNombreResultados([]);
    setCedulaQuery("");
    setNombreQuery("");
  };

  // ===============================
  // 4. Cambio de país (siempre guarda pais y codpais)
  // ===============================
  const handlePaisChange = (value: string) => {
    console.log("🌍 País seleccionado - valor:", value);
    console.log("🌍 Array de países disponible:", paises.length, paises);
    const codpais = parseInt(value);
    const paisSeleccionado = paises.find((p) => p.codpais === codpais);
    console.log("🌍 País encontrado:", paisSeleccionado);

    const nuevoForm = {
      ...form,
      codpais,
      pais: paisSeleccionado ? paisSeleccionado.pais : "",
      ciudad: "",
      provincia: "",
    };
    console.log("🌍 Nuevo form después de seleccionar país:", nuevoForm);
    setForm(nuevoForm);
    axiosInstance
      .post("/servientrega/ciudades", { codpais })
      .then((res) => {
        const lista = res.data.fetch || [];
        console.log("🌍 Ciudades recibidas de la API:", lista);
        const ciudadesProcesadas = lista.map((item: { city: string }) => {
          const [ciudad, provincia] = item.city.split("-");
          return {
            ciudad: ciudad?.trim() ?? "",
            provincia: provincia?.trim() ?? "",
          };
        });
        console.log("🏙️ Ciudades procesadas:", ciudadesProcesadas);
        setCiudades(ciudadesProcesadas);
      })
      .catch((err) => console.error("Error al obtener ciudades:", err));
  };

  // ===============================
  // 5. Cambio de ciudad/provincia
  // ===============================
  const handleCiudadChange = (value: string) => {
    console.log("🏙️ Valor seleccionado:", value);
    const [ciudad, provincia] = value.split("|");
    console.log("🏙️ Ciudad:", ciudad, "Provincia:", provincia);
    setForm((prev) => ({ ...prev, ciudad, provincia }));
  };

  // ===============================
  // 6. Cambios generales del form
  // ===============================
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value.trimStart() });

  const handleExtraDireccionChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setExtraDireccion((prev) => ({
      ...prev,
      [e.target.name]: e.target.value.trimStart(),
    }));

  // ===============================
  // 7. Retiro en agencia
  // ===============================
  const handleCheckboxChange = async (checked: boolean) => {
    setMostrarAgencias(checked);
    if (checked) {
      try {
        const res = await axiosInstance.post("/servientrega/agencias");
        const data = res.data.fetch || [];
        setAgencias(
          data.map((a: any) => ({
            nombre: String(a.agencia ?? Object.values(a)[0] ?? "").trim(),
            tipo_cs: String(a.tipo_cs?.trim() ?? ""),
            direccion: String(a.direccion?.trim() ?? ""),
            ciudad: String(a.ciudad?.trim() ?? ""),
          }))
        );
      } catch (error) {
        console.error("Error al cargar agencias:", error);
      }
    } else {
      setAgenciaSeleccionada("");
      // Si la ciudad fue establecida por una agencia, limpiarla
      if (ciudadEstablecidaPorAgencia) {
        setForm((prev) => ({
          ...prev,
          ciudad: "",
          provincia: "",
        }));
        setCiudadEstablecidaPorAgencia(false);
        toast.info(
          "Ciudad y provincia limpiadas al deseleccionar retiro en oficina"
        );
      }
    }
  };

  // Manejar selección de agencia y actualizar ciudad automáticamente
  const handleAgenciaChange = async (nombreAgencia: string) => {
    setAgenciaSeleccionada(nombreAgencia);

    // Buscar la agencia seleccionada para obtener su ciudad
    const agenciaEncontrada = agencias.find((a) => a.nombre === nombreAgencia);
    if (agenciaEncontrada) {
      const ciudadAgencia = agenciaEncontrada.ciudad.trim();

      // Buscar la provincia correspondiente a esta ciudad
      try {
        const ciudadEncontrada = ciudades.find(
          (c) => c.ciudad.trim().toUpperCase() === ciudadAgencia.toUpperCase()
        );

        const provinciaAgencia = ciudadEncontrada?.provincia || "";

        // Actualizar la ciudad y provincia del formulario
        setForm((prev) => ({
          ...prev,
          ciudad: ciudadAgencia,
          provincia: provinciaAgencia,
        }));

        // Marcar que la ciudad fue establecida por una agencia
        setCiudadEstablecidaPorAgencia(true);

        console.log(`🏢 Agencia seleccionada: ${nombreAgencia}`);
        console.log(`🏙️ Ciudad actualizada a: ${ciudadAgencia}`);
        console.log(`🗺️ Provincia actualizada a: ${provinciaAgencia}`);

        // Mostrar toast informativo
        toast.success(
          `Ubicación actualizada: ${ciudadAgencia}${
            provinciaAgencia ? `, ${provinciaAgencia}` : ""
          }`
        );
      } catch (error) {
        console.error("Error al buscar provincia:", error);
        // Solo actualizar ciudad si hay error con provincia
        setForm((prev) => ({
          ...prev,
          ciudad: ciudadAgencia,
        }));
        setCiudadEstablecidaPorAgencia(true);
        toast.success(`Ciudad actualizada a: ${ciudadAgencia}`);
      }
    }
  };

  // ===============================
  // 8. Validar código postal (internacional)
  // ===============================
  const validarCodigoPostal = async (): Promise<boolean> => {
    if (!esInternacional) return true;
    if (!form.codigo_postal?.trim()) {
      toast.error(
        "El código postal es obligatorio para envíos internacionales."
      );
      return false;
    }
    return true;
  };

  // ===============================
  // 9. Guardar/actualizar y continuar
  // ===============================
  const handleContinue = async () => {
    console.log("🔍 Validando formulario:", {
      nombre: form.nombre,
      telefono: form.telefono,
      pais: form.pais,
      ciudad: form.ciudad,
      provincia: form.provincia,
    });

    if (
      !form.identificacion ||
      !form.nombre ||
      !form.telefono ||
      !form.pais ||
      !form.ciudad
    ) {
      console.log("❌ Campos faltantes:", {
        identificacion: !form.identificacion,
        nombre: !form.nombre,
        telefono: !form.telefono,
        pais: !form.pais,
        ciudad: !form.ciudad,
      });
      toast.error("Completa todos los campos obligatorios.");
      return;
    }
    if (!(await validarCodigoPostal())) return;

    let direccionFinal = "";
    if (mostrarAgencias) {
      const agencia = agencias.find((a) => a.nombre === agenciaSeleccionada);
      if (!agencia) {
        toast.error("Debes seleccionar una agencia.");
        return;
      }
      direccionFinal = agencia.direccion;
    } else {
      direccionFinal = [
        extraDireccion.callePrincipal.trim(),
        extraDireccion.numeracion && `#${extraDireccion.numeracion.trim()}`,
        extraDireccion.calleSecundaria &&
          `y ${extraDireccion.calleSecundaria.trim()}`,
        extraDireccion.referencia && `Ref: ${extraDireccion.referencia.trim()}`,
      ]
        .filter(Boolean)
        .join(", ");
    }

    // Objeto preparado para el backend y flujo interno
    const destinatarioFinal: Destinatario = {
      ...form,
      direccion: direccionFinal.trim(),
    };

    const datosParaEnviar = {
      ...destinatarioFinal,
      cedula: form.identificacion,
    };

    console.log("📤 Enviando datos del destinatario:", datosParaEnviar);

    setLoading(true);
    try {
      if (destinatarioExistente) {
        console.log("🔄 Actualizando destinatario existente");
        await axiosInstance.put(
          `/servientrega/destinatario/actualizar/${form.identificacion.trim()}`,
          datosParaEnviar
        );
      } else {
        console.log("➕ Creando nuevo destinatario");
        await axiosInstance.post(
          "/servientrega/destinatario/guardar",
          datosParaEnviar
        );
      }
      toast.success("Destinatario guardado correctamente.");

      // Preparar datos limpios para el siguiente paso
      const destinatarioLimpio: Destinatario = {
        identificacion: form.identificacion,
        nombre: form.nombre,
        direccion: direccionFinal.trim(),
        ciudad: form.ciudad,
        provincia: form.provincia,
        pais: form.pais,
        codpais: form.codpais,
        telefono: form.telefono,
        email: form.email,
        codigo_postal: form.codigo_postal,
      };

      console.log(
        "🧹 Datos limpios para el siguiente paso:",
        destinatarioLimpio
      );

      onNext(destinatarioLimpio, mostrarAgencias, agenciaSeleccionada.trim());
    } catch (err) {
      console.error("❌ Error al guardar destinatario:", err);
      toast.error("Hubo un problema al guardar el destinatario.");
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // ----------- RENDER ------------
  // ===============================
  return (
    <Card className="w-full max-w-2xl mx-auto mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>Datos del Destinatario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* --- UBICACIÓN --- */}
        <div className="p-4 border rounded-md bg-gray-50">
          <h4 className="font-semibold mb-2">📍 Ubicación</h4>
          <Label>País</Label>
          <Select
            value={form.codpais.toString()}
            onValueChange={handlePaisChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar país" />
            </SelectTrigger>
            <SelectContent>
              {paises.map((p) => (
                <SelectItem key={p.codpais} value={p.codpais.toString()}>
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
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar ciudad" />
            </SelectTrigger>
            <SelectContent>
              {ciudades.map((c, i) => (
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
        {/* --- RETIRO EN OFICINA --- */}
        <div className="p-4 border rounded-md bg-gray-50">
          <h4 className="font-semibold mb-2">🏢 Entrega</h4>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={mostrarAgencias}
              onCheckedChange={handleCheckboxChange}
            />
            <Label>¿Retiro en oficina Servientrega?</Label>
          </div>
          {mostrarAgencias && (
            <div className="mt-2">
              <Label>Seleccionar agencia</Label>
              <Select
                onValueChange={handleAgenciaChange}
                value={agenciaSeleccionada}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar agencia" />
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
          {!mostrarAgencias && (
            <div className="mt-6">
              <h4 className="font-semibold mb-4">🏠 Dirección</h4>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="callePrincipal">Calle principal</Label>
                  <Input
                    id="callePrincipal"
                    name="callePrincipal"
                    placeholder="Ingrese calle principal"
                    value={extraDireccion.callePrincipal}
                    onChange={handleExtraDireccionChange}
                  />
                </div>

                <div>
                  <Label htmlFor="numeracion">Numeración</Label>
                  <Input
                    id="numeracion"
                    name="numeracion"
                    placeholder="Ej: #123, Lote 35 A"
                    value={extraDireccion.numeracion}
                    onChange={handleExtraDireccionChange}
                  />
                </div>

                <div>
                  <Label htmlFor="calleSecundaria">Calle secundaria</Label>
                  <Input
                    id="calleSecundaria"
                    name="calleSecundaria"
                    placeholder="Ingrese calle secundaria"
                    value={extraDireccion.calleSecundaria}
                    onChange={handleExtraDireccionChange}
                  />
                </div>

                <div>
                  <Label htmlFor="referencia">Referencia</Label>
                  <Input
                    id="referencia"
                    name="referencia"
                    placeholder="Punto de referencia"
                    value={extraDireccion.referencia}
                    onChange={handleExtraDireccionChange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <Button
          onClick={handleContinue}
          disabled={loading || !form.ciudad}
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
