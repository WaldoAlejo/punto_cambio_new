import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { User, PuntoAtencion, CuadreCaja } from "../../types";
// import ExternalServicesClose from "./ExternalServicesClose"; // Ya no se requiere cierre separado
import { contabilidadDiariaService } from "../../services/contabilidadDiariaService";
import cuatreCajaService from "@/services/cuatreCajaService";

function getCantidad(val: any): number {
  if (typeof val === "number") return val;
  if (val && typeof val.cantidad === "number") return val.cantidad;
  return 0;
}

interface DailyCloseProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface CuadreDetalle {
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  billetes: number;
  monedas: number;
  ingresos_periodo: number;
  egresos_periodo: number;
  movimientos_periodo: number;
}

const DailyClose = ({ user, selectedPoint }: DailyCloseProps) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [cuadreData, setCuadreData] = useState<{
    detalles: CuadreDetalle[];
    observaciones: string;
    cuadre_id?: string;
    periodo_inicio?: string;
    totales?: {
      cambios: number | { cantidad: number };
      servicios_externos?: number | { cantidad: number };
      transferencias_entrada: number | { cantidad: number };
      transferencias_salida: number | { cantidad: number };
    };
  } | null>(null);
  const [userAdjustments, setUserAdjustments] = useState<{
    [key: string]: { bills: string; coins: string; note?: string };
  }>({});
  const [todayClose, setTodayClose] = useState<CuadreCaja | null>(null);
  const [hasActiveJornada, setHasActiveJornada] = useState<boolean | null>(
    null
  );
  const [jornadaFinalizada, setJornadaFinalizada] = useState(false);
  const [loading, setLoading] = useState(false); // carga de cuadre
  const [closing, setClosing] = useState(false); // estado de cierre en progreso
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const [validacionCierres, setValidacionCierres] = useState<
    | {
        cierres_requeridos: {
          servicios_externos: boolean;
          cambios_divisas: boolean;
          cierre_diario: boolean;
        };
        estado_cierres: {
          servicios_externos: boolean;
          cambios_divisas: boolean;
          cierre_diario: boolean;
        };
        cierres_completos: boolean;
        conteos?: {
          cambios_divisas: number;
          servicios_externos: number;
        };
      }
    | null
  >(null);

  // Verificar jornada activa
  useEffect(() => {
    const checkActiveJornada = async (): Promise<void> => {
      try {
        const token = localStorage.getItem("authToken");
        console.log(
          "🔍 DailyClose - localStorage keys:",
          Object.keys(localStorage)
        );
        console.log("🔍 DailyClose - token check:", {
          tokenExists: !!token,
          tokenPreview: token ? token.substring(0, 30) + "..." : "No token",
          userInfo: { id: user.id, rol: user.rol, nombre: user.nombre },
        });

        if (!token) {
          console.log("❌ No token found for jornada check");
          setHasActiveJornada(false);
          return;
        }

        console.log("🔍 Checking active jornada for user:", user.rol);
        const response = await fetch(
          `${(import.meta as any).env.VITE_API_URL || "http://35.238.95.118/api"}/schedules/active`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("🕒 Active jornada response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("🕒 Active jornada response data:", data);

          // Verificar que tenga schedule y que esté ACTIVO
          const hasJornada =
            data.success &&
            data.schedule &&
            (data.schedule.estado === "ACTIVO" ||
              data.schedule.estado === "ALMUERZO");
          console.log("🕒 Has active jornada:", hasJornada);
          setHasActiveJornada(hasJornada);
        } else {
              console.log("❌ No active jornada or error:", response.status);
          setHasActiveJornada(false);
        }
      } catch (error) {
        console.error("💥 Error checking active jornada:", error);
        setHasActiveJornada(false);
      }
    };

    if (user.rol === "OPERADOR") {
      checkActiveJornada();
      const interval = setInterval(checkActiveJornada, 30000);
      return () => clearInterval(interval);
    } else {
      setHasActiveJornada(true);
    }
    // Ensure all code paths return void
    return;
  }, [user]);

  // Obtener datos de cuadre automático
  useEffect(() => {
    const fetchCuadreData = async () => {
      try {
        setLoading(true);
        console.log("🔄 Fetching automated cuadre data...");
        console.log("📍 Selected point:", selectedPoint?.id, selectedPoint?.nombre);
        const token = localStorage.getItem("authToken");
        if (!token) {
          console.error("❌ No token found in localStorage");
          toast({
            title: "Sesión Expirada",
            description: "Por favor, inicie sesión nuevamente.",
            variant: "destructive",
          });
          return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || "http://35.238.95.118/api";
        const endpoint = `${apiUrl}/cuadre-caja`;
        console.log("🌐 Calling endpoint:", endpoint);

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("📡 Response status:", response.status);
        console.log("📡 Response headers:", {
          contentType: response.headers.get("content-type"),
          contentLength: response.headers.get("content-length"),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("📊 Cuadre data received:", data);

          if (data.success && data.data) {
            console.log("✅ Cuadre data details:", {
              detallesCount: data.data.detalles?.length || 0,
              detalles: data.data.detalles,
              mensaje: data.data.mensaje,
              periodoInicio: data.data.periodo_inicio,
            });

            setCuadreData(data.data);

            // Inicializar ajustes del usuario con valores esperados (saldo de cierre)
            const initialAdjustments: {
              [key: string]: { bills: string; coins: string; note?: string };
            } = {};
            if (data.data.detalles && data.data.detalles.length > 0) {
              data.data.detalles.forEach((detalle: CuadreDetalle) => {
                // Inicializar con el saldo esperado dividido entre billetes y monedas
                // Por defecto asumimos todo en billetes, pero el usuario puede ajustar
                initialAdjustments[detalle.moneda_id] = {
                  bills: detalle.saldo_cierre.toFixed(2),
                  coins: "0.00",
                  note: "",
                };
              });
              console.log("💰 Initial adjustments set for", Object.keys(initialAdjustments).length, "currencies");
            }
            setUserAdjustments(initialAdjustments);
          } else if (data.data?.mensaje) {
            // No hay movimientos hoy
            console.log("⚠️ No hay movimientos:", data.data.mensaje);
            setCuadreData({ detalles: [], observaciones: "" });
            setUserAdjustments({});
          }
        } else {
          const errorText = await response.text();
          console.error(
            "❌ Error response from cuadre API:",
            response.status,
            response.statusText,
            errorText
          );
          throw new Error(`Error al obtener datos de cuadre: ${response.status}`);
        }
      } catch (error) {
        console.error("❌ Error al obtener datos de cuadre:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "No se pudo cargar los datos de cuadre automático.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (selectedPoint) {
      console.log("🔄 useEffect triggered: selectedPoint changed", selectedPoint?.id);
      fetchCuadreData();
      setTodayClose(null);
    } else {
      console.log("⚠️ selectedPoint is null, skipping fetchCuadreData");
    }
  }, [selectedPoint]);

  const handleUserAdjustment = (
    monedaId: string,
    type: "bills" | "coins" | "note",
    value: string
  ) => {
    if (type === "note") {
      setUserAdjustments((prev) => ({
        ...prev,
        [monedaId]: {
          ...prev[monedaId],
          note: value,
        },
      }));
      return;
    }

    // No permitir valores negativos
    const numValue = parseFloat(value);
    if (numValue < 0) return;

    setUserAdjustments((prev) => ({
      ...prev,
      [monedaId]: {
        ...prev[monedaId],
        [type]: value,
      },
    }));
  };

  const calculateUserTotal = (monedaId: string) => {
    const bills = parseFloat(userAdjustments[monedaId]?.bills || "0");
    const coins = parseFloat(userAdjustments[monedaId]?.coins || "0");
    return bills + coins;
  };

  // Permitir hasta ±1.00 USD de ajuste; otras divisas deben cuadrar (±0.01)
  const getTolerance = (detalle: CuadreDetalle) =>
    detalle.codigo === "USD" ? 1.0 : 0.01;

  const validateBalance = (detalle: CuadreDetalle, userTotal: number) => {
    const difference = Math.abs(userTotal - detalle.saldo_cierre);
    const tolerance = getTolerance(detalle);
    return difference <= tolerance;
  };

  // Validar cierres requeridos
  const validarCierresRequeridos = async () => {
    if (!selectedPoint) return;

    try {
      const fechaHoy = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const validacion =
        await contabilidadDiariaService.validarCierresRequeridos(
          selectedPoint.id,
          fechaHoy
        );

      if (validacion.success) {
        setValidacionCierres(validacion);
      } else {
        console.error("Error validando cierres:", validacion.error);
      }
    } catch (error) {
      console.error("Error validando cierres:", error);
    }
  };

  // Cargar validación de cierres cuando cambie el punto seleccionado
  useEffect(() => {
    if (selectedPoint) {
      validarCierresRequeridos();
    }
  }, [selectedPoint]);

  // Obtener datos de cuadre automático (reusable + retry)
  const fetchCuadreData = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      console.log("🔄 Fetching automated cuadre data...");
      console.log("📍 Selected point:", selectedPoint?.id, selectedPoint?.nombre);

      const token = localStorage.getItem("authToken");
      if (!token) {
        console.error("❌ No token found in localStorage");
        const msg = "Por favor, inicie sesión nuevamente.";
        toast({
          title: "Sesión Expirada",
          description: msg,
          variant: "destructive",
        });
        setFetchError(msg);
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || "http://35.238.95.118/api";
      const endpoint = `${apiUrl}/cuadre-caja`;
      console.log("🌐 Calling endpoint:", endpoint);

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("📡 Response status:", response.status);
      console.log("📡 Response headers:", {
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📊 Cuadre data received:", data);

        if (data.success && data.data) {
          console.log("✅ Cuadre data details:", {
            detallesCount: data.data.detalles?.length || 0,
            detalles: data.data.detalles,
            mensaje: data.data.mensaje,
            periodoInicio: data.data.periodo_inicio,
          });

          setCuadreData(data.data);

          // Inicializar ajustes del usuario con valores esperados (saldo de cierre)
          const initialAdjustments: {
            [key: string]: { bills: string; coins: string; note?: string };
          } = {};
          if (data.data.detalles && data.data.detalles.length > 0) {
            data.data.detalles.forEach((detalle: CuadreDetalle) => {
              initialAdjustments[detalle.moneda_id] = {
                bills: detalle.saldo_cierre.toFixed(2),
                coins: "0.00",
                note: "",
              };
            });
            console.log("💰 Initial adjustments set for", Object.keys(initialAdjustments).length, "currencies");
          }
          setUserAdjustments(initialAdjustments);
          setFetchError(null);
        } else if (data.data?.mensaje) {
          // No hay movimientos hoy
          console.log("⚠️ No hay movimientos:", data.data.mensaje);
          setCuadreData({ detalles: [], observaciones: "" });
          setUserAdjustments({});
          setFetchError(null);
        }
      } else {
        const errorText = await response.text();
        console.error(
          "❌ Error response from cuadre API:",
          response.status,
          response.statusText,
          errorText
        );
        throw new Error(`Error al obtener datos de cuadre: ${response.status}`);
      }
    } catch (error) {
      console.error("❌ Error al obtener datos de cuadre:", error);
      const msg = error instanceof Error ? error.message : "No se pudo cargar los datos de cuadre automático.";
      setFetchError(msg);

      // Fallback: si el backend de cuadre falla, intentar detectar "sin movimientos"
      try {
        if (selectedPoint) {
          const fechaHoy = new Date().toISOString().split("T")[0];
          const valid = await contabilidadDiariaService.validarCierresRequeridos(
            selectedPoint.id,
            fechaHoy
          );
          if (
            valid?.success &&
            typeof valid.conteos?.cambios_divisas === "number" &&
            valid.conteos.cambios_divisas === 0
          ) {
            // Proceder como "sin movimientos de divisas": permitir cierre
            setCuadreData({ detalles: [], observaciones: "" });
            setUserAdjustments({});
            setFetchError(null);
            toast({
              title: "Sin movimientos de divisas",
              description:
                "No se pudo obtener el cuadre automático, pero se detecta 0 cambios. Puede realizar el cierre diario sin conteo.",
            });
          }
        }
      } catch (fbErr) {
        console.warn("Fallback sin movimientos no disponible:", fbErr);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedPoint]);

  useEffect(() => {
    if (selectedPoint) {
      console.log("🔄 useEffect triggered: selectedPoint changed", selectedPoint?.id);
      fetchCuadreData();
      setTodayClose(null);
    } else {
      console.log("⚠️ selectedPoint is null, skipping fetchCuadreData");
    }
  }, [selectedPoint, fetchCuadreData]);

  // Construir y mostrar tarjeta de "Cierre Completado" a partir del cuadre/totales
  const fetchTodayClose = useCallback(async () => {
    try {
      const fechaHoy = new Date().toISOString().split("T")[0];
      const resp = await cuatreCajaService.getCuadre({ fecha: fechaHoy });
      if (resp?.success && resp.data) {
        const tot = resp.data.totales || {};
        const cierre: CuadreCaja = {
          id: resp.data.cuadre_id || "cuadre-hoy",
          usuario_id: user.id,
          punto_atencion_id: selectedPoint?.id || "",
          fecha: fechaHoy,
          estado: "CERRADO",
          total_cambios: (tot as any).cambios ?? 0,
          total_transferencias_entrada: (tot as any).transferencias_entrada ?? 0,
          total_transferencias_salida: (tot as any).transferencias_salida ?? 0,
          fecha_cierre: new Date().toISOString(),
          observaciones: (resp.data as any).observaciones ?? null,
        };
        setTodayClose(cierre);
      } else {
        setTodayClose(null);
      }
    } catch (e) {
      console.warn("No se pudo obtener cierre de hoy:", e);
      setTodayClose(null);
    }
  }, [selectedPoint?.id, user.id]);

  // Si ya existe un cierre para hoy, mostrar tarjeta de "Cierre Completado"
  useEffect(() => {
    const checkTodayClose = async () => {
      if (!selectedPoint) return;
      try {
        const fechaHoy = new Date().toISOString().split("T")[0];
        const res = await contabilidadDiariaService.getCierreDiario(
          selectedPoint.id,
          fechaHoy
        );
        if (res.success && res.cierre) {
          await fetchTodayClose();
        } else {
          setTodayClose(null);
        }
      } catch (e) {
        // Si falla, no bloquear la vista principal
        console.warn("Error verificando cierre del día:", e);
        setTodayClose(null);
      }
    };

    checkTodayClose();
  }, [selectedPoint, fetchTodayClose]);

  const performDailyClose = async () => {
    console.log("🔄 performDailyClose START");
    setClosing(true);
    console.log("📋 State check:", {
      selectedPoint: selectedPoint?.id,
      cuadreData: !!cuadreData,
      detalles: cuadreData?.detalles?.length || 0,
      userAdjustments: Object.keys(userAdjustments || {}).length,
    });

    if (!selectedPoint) {
      console.error("❌ Missing selectedPoint for closing");
      toast({ title: "Error", description: "Debe seleccionar un punto de atención", variant: "destructive" });
      setClosing(false);
      return;
    }

    try {
      // 1. Validar saldos solo si hay detalles de divisas
      const tieneDetalles = (cuadreData?.detalles?.length ?? 0) > 0;
      if (tieneDetalles) {
        console.log("🔍 Validating balances for", cuadreData.detalles.length, "currencies");
        const incompleteBalances = cuadreData.detalles.some(
          (detalle) =>
            userAdjustments[detalle.moneda_id]?.bills === undefined ||
            userAdjustments[detalle.moneda_id]?.bills === "" ||
            userAdjustments[detalle.moneda_id]?.coins === undefined ||
            userAdjustments[detalle.moneda_id]?.coins === ""
        );
        if (incompleteBalances) {
          console.error("❌ Incomplete balances found");
          toast({
            title: "Error",
            description: "Debe completar todos los saldos antes del cierre",
            variant: "destructive",
          });
          setClosing(false);
          return;
        }

        // Validación estricta con tolerancia
        const invalidBalances = cuadreData.detalles.filter((detalle) => {
          const bills = parseFloat(userAdjustments[detalle.moneda_id]?.bills || "0");
          const coins = parseFloat(userAdjustments[detalle.moneda_id]?.coins || "0");
          const total = bills + coins;
          const diff = Math.abs(total - detalle.saldo_cierre);
          const tol = detalle.codigo === "USD" ? 1.0 : 0.01;
          return diff > tol;
        });
        if (invalidBalances.length > 0) {
          const msg = `Los siguientes saldos no cuadran con los movimientos del día:\n\n${invalidBalances
            .map((d) => {
              const bills = parseFloat(userAdjustments[d.moneda_id]?.bills || "0");
              const coins = parseFloat(userAdjustments[d.moneda_id]?.coins || "0");
              const total = bills + coins;
              const tolerance = (d.codigo === "USD" ? 1.0 : 0.01).toFixed(2);
              return `${d.codigo}: Esperado ${d.saldo_cierre.toFixed(2)}, Ingresado ${total.toFixed(2)} (tolerancia ±${tolerance})`;
            })
            .join("\n")}\n\n⚠️ Verifique que todos los movimientos estén registrados correctamente.`;
          toast({ title: "No cuadra", description: msg, variant: "destructive" });
          setClosing(false);
          return;
        }
      }

      // 2. Preparar detalles para enviar
      const detalles = (cuadreData?.detalles || []).map((detalle) => {
        const bills = parseFloat(userAdjustments[detalle.moneda_id]?.bills || "0");
        const coins = parseFloat(userAdjustments[detalle.moneda_id]?.coins || "0");
        const conteo = bills + coins;
        return {
          moneda_id: detalle.moneda_id,
          saldo_apertura: detalle.saldo_apertura,
          saldo_cierre: detalle.saldo_cierre,
          conteo_fisico: conteo,
          billetes: bills,
          monedas: coins,
          ingresos_periodo: detalle.ingresos_periodo || 0,
          egresos_periodo: detalle.egresos_periodo || 0,
          movimientos_periodo: detalle.movimientos_periodo || 0,
          observaciones_detalle: userAdjustments[detalle.moneda_id]?.note || "",
        };
      });

      // 3. Ejecutar cierre
      const token = localStorage.getItem("authToken");
      const fechaHoy = new Date().toISOString().split("T")[0];
      const apiUrl = import.meta.env.VITE_API_URL || "http://35.238.95.118/api";
      const endpoint = `${apiUrl}/contabilidad-diaria/${selectedPoint.id}/${fechaHoy}/cerrar`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      let resultado: any;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ detalles, observaciones: cuadreData?.observaciones || "" }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        resultado = await response.json();
        if (!response.ok || !resultado?.success) {
          throw new Error(resultado?.error || "Error al realizar el cierre diario");
        }
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }

      console.log("✅ Cierre completado exitosamente", {
        cierre_id: (resultado as any)?.cierre_id || (resultado as any)?.cierre?.id,
        cuadre_id: (resultado as any)?.cuadre_id,
        jornada_finalizada: (resultado as any)?.jornada_finalizada,
      });
      const mensaje = (resultado as any)?.jornada_finalizada
        ? "✅ El cierre diario se ha completado correctamente y su jornada fue finalizada automáticamente."
        : "✅ El cierre diario se ha completado correctamente.";
      toast({ title: "Cierre realizado", description: mensaje });
      // Marcar flags locales
      if ((resultado as any)?.jornada_finalizada) {
        setJornadaFinalizada(true);
        setHasActiveJornada(false);
      }
      // Requerimiento: tras cerrar, cerrar sesión y salir a Login
      // Evita llamadas posteriores (como GET /cuadre-caja?fecha) en esta vista
      handleLogout();
      return;
    } catch (error) {
      console.error("💥 Error en performDailyClose:", error);
      const errorMessage = error instanceof Error ? error.message : "Error inesperado";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
      setClosing(false);
    }
  };

  // Confirmación antes de cerrar
  const confirmDailyClose = () => {
    const isSinMovimientos = (cuadreData?.detalles?.length ?? 0) === 0;
    showConfirmation(
      "Confirmar Cierre Diario",
      isSinMovimientos
        ? "No hay movimientos de divisas hoy. ¿Desea realizar el cierre diario de todas formas?"
        : "Está a punto de realizar el cierre diario. Verifique que los conteos físicos coincidan con los saldos esperados.",
      () => performDailyClose(),
      "default"
    );
  };

  const generateCloseReport = () => {
    if (!todayClose) return;

    toast({
      title: "Reporte generado",
      description: "El reporte de cierre diario se ha generado",
    });
  };

  const handleLogout = () => {
    // Limpiar datos de autenticación
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    // Limpiar selección y vista activa para forzar selección de punto al reingresar
    localStorage.removeItem("puntoAtencionSeleccionado");
    localStorage.removeItem("pc_selected_point_id");
    localStorage.removeItem("pc_active_view");
    
    toast({
      title: "Sesión cerrada",
      description: "Ha cerrado sesión exitosamente",
    });

    // Redirigir al login
    try {
      logout();
    } catch {}
    navigate("/login", { replace: true });
  };

  if (!selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            Debe seleccionar un punto de atención para realizar el cierre
          </p>
        </div>
      </div>
    );
  }

  if (user.rol !== "OPERADOR") {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">
            Solo operadores pueden realizar cierres diarios
          </p>
        </div>
      </div>
    );
  }

  if (hasActiveJornada === false) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">
            Debe tener una jornada activa para realizar el cierre diario
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Inicie su jornada desde "Gestión de Horarios" para continuar
          </p>
        </div>
      </div>
    );
  }

  if (hasActiveJornada === null) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando jornada activa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Cierre Diario</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            Punto: {selectedPoint.nombre} - {new Date().toLocaleDateString()}
          </div>
          <Button
            variant="outline"
            className="border-gray-300"
            onClick={fetchCuadreData}
            disabled={loading}
            title="Actualizar datos de cuadre"
          >
            Actualizar
          </Button>
        </div>
      </div>

      {/* NOTA: El cierre de servicios externos ya NO es necesario como paso separado.
          Los movimientos de servicios externos se incluyen automáticamente en el cierre diario. */}

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                Cargando datos de cuadre automático...
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !todayClose ? (
        <Card>
          <CardHeader>
            <CardTitle>Cuadre de Caja Automático</CardTitle>
            <CardDescription>
              {(cuadreData?.detalles?.length ?? 0) === 0
                ? "No se han registrado movimientos de divisas hoy"
                : "Revise y ajuste los conteos físicos. Los valores están pre-calculados según los movimientos del día."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fetchError && (
              <div className="mb-4 p-4 rounded-md border border-red-200 bg-red-50 text-red-700 flex items-center justify-between gap-3">
                <span className="text-sm">
                  Ocurrió un problema al cargar el cuadre: {fetchError}
                </span>
                <Button onClick={fetchCuadreData} variant="destructive">
                  Reintentar
                </Button>
              </div>
            )}
            {/* Mostrar totales del día */}
            {cuadreData?.totales && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <h4 className="font-semibold text-blue-700">Total Cambios</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {getCantidad(cuadreData.totales.cambios)}
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-purple-700">
                    Servicios Externos
                  </h4>
                  <p className="text-2xl font-bold text-purple-600">
                    {getCantidad(cuadreData.totales.servicios_externos)}
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-green-700">
                    Transferencias Entrada
                  </h4>
                  <p className="text-2xl font-bold text-green-600">
                    {getCantidad(cuadreData.totales.transferencias_entrada)}
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-orange-700">
                    Transferencias Salida
                  </h4>
                  <p className="text-2xl font-bold text-orange-600">
                    {getCantidad(cuadreData.totales.transferencias_salida)}
                  </p>
                </div>
              </div>
            )}

            {(cuadreData?.detalles?.length ?? 0) === 0 ? (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">
                      ✅ Cierre sin Movimientos de Divisas
                    </h3>
                    <p className="text-blue-700 mb-4">
                      No se registraron cambios de divisas hoy, pero puede
                      proceder con el cierre.
                    </p>
                    <p className="text-sm text-blue-600">
                      El cierre incluirá todos los movimientos del día
                      (servicios externos, transferencias, etc.).
                    </p>
                  </div>
                </div>

                {/* Botón de cierre para días sin movimientos */}
                <Button
                  onClick={confirmDailyClose}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  size="lg"
                  disabled={loading || closing || !cuadreData}
                >
                  {closing ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white border-b-transparent animate-spin"></span>
                      Cerrando...
                    </span>
                  ) : (
                    "Realizar Cierre Diario"
                  )}
                </Button>

                <div className="mt-3 text-xs text-gray-600 text-center">
                  El cierre se realizará sin detalles de cuadre de caja, ya que
                  no hubo movimientos de divisas.
                </div>
              </div>
            ) : (
              <div className="grid gap-6">
                {(cuadreData?.detalles ?? []).map((detalle) => {
                  const userTotal = calculateUserTotal(detalle.moneda_id);
                  const isValid = validateBalance(detalle, userTotal);

                  return (
                    <Card
                      key={detalle.moneda_id}
                      className={`${
                        !isValid
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200"
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-xl flex items-center gap-2">
                            <span className="text-2xl">{detalle.simbolo}</span>
                            {detalle.codigo} - {detalle.nombre}
                          </CardTitle>
                          {!isValid && (
                            <Badge variant="destructive" className="text-xs">
                              ⚠️ No cuadra
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Resumen de movimientos */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="p-3">
                              <div className="text-blue-700 font-medium text-xs">
                                Saldo Apertura
                              </div>
                              <div className="text-blue-800 font-bold text-lg">
                                {detalle.simbolo}
                                {detalle.saldo_apertura.toFixed(2)}
                              </div>
                              <div className="text-xs text-blue-600">
                                Dinero al inicio
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-green-50 border-green-200">
                            <CardContent className="p-3">
                              <div className="text-green-700 font-medium text-xs">
                                Ingresos (+)
                              </div>
                              <div className="text-green-800 font-bold text-lg">
                                +{detalle.simbolo}
                                {detalle.ingresos_periodo.toFixed(2)}
                              </div>
                              <div className="text-xs text-green-600">
                                Divisas recibidas
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-red-50 border-red-200">
                            <CardContent className="p-3">
                              <div className="text-red-700 font-medium text-xs">
                                Egresos (-)
                              </div>
                              <div className="text-red-800 font-bold text-lg">
                                -{detalle.simbolo}
                                {detalle.egresos_periodo.toFixed(2)}
                              </div>
                              <div className="text-xs text-red-600">
                                Divisas entregadas
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-purple-50 border-purple-200">
                            <CardContent className="p-3">
                              <div className="text-purple-700 font-medium text-xs">
                                Saldo Esperado
                              </div>
                              <div className="text-purple-800 font-bold text-lg">
                                {detalle.simbolo}
                                {detalle.saldo_cierre.toFixed(2)}
                              </div>
                              <div className="text-xs text-purple-600">
                                Lo que debe quedar
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Instrucciones claras */}
                        <Card className="bg-yellow-50 border-yellow-200">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-600 text-lg">
                                📝
                              </span>
                              <div>
                                <h4 className="font-medium text-yellow-800 mb-1">
                                  Instrucciones de Conteo
                                </h4>
                                <p className="text-sm text-yellow-700">
                                  Cuente físicamente el dinero que tiene en caja
                                  y registre los valores. Debe tener exactamente{" "}
                                  <strong>
                                    {detalle.simbolo}
                                    {detalle.saldo_cierre.toFixed(2)}
                                  </strong>{" "}
                                  en total.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Conteo físico del usuario */}
                        <Card className="border-gray-300">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">
                              💰 Conteo Físico
                            </CardTitle>
                            <CardDescription>
                              Registre el dinero que tiene físicamente en caja
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-1">
                                  💵 Billetes
                                  <span className="text-xs text-gray-500">
                                    ({detalle.simbolo})
                                  </span>
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={
                                    userAdjustments[detalle.moneda_id]?.bills ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleUserAdjustment(
                                      detalle.moneda_id,
                                      "bills",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                  className={!isValid ? "border-red-300" : ""}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-1">
                                  🪙 Monedas
                                  <span className="text-xs text-gray-500">
                                    ({detalle.simbolo})
                                  </span>
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={
                                    userAdjustments[detalle.moneda_id]?.coins ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleUserAdjustment(
                                      detalle.moneda_id,
                                      "coins",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                  className={!isValid ? "border-red-300" : ""}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                  💰 Total Contado
                                </Label>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`h-10 px-3 py-2 border rounded-md flex items-center font-bold text-lg ${
                                      !isValid
                                        ? "bg-red-50 border-red-300 text-red-700"
                                        : "bg-green-50 border-green-300 text-green-700"
                                    }`}
                                  >
                                    {detalle.simbolo}
                                    {userTotal.toFixed(2)}
                                  </div>
                                  {(() => {
                                    const diff = parseFloat(
                                      (
                                        userTotal - detalle.saldo_cierre
                                      ).toFixed(2)
                                    );
                                    const abs = Math.abs(diff);
                                    const tol = getTolerance(detalle);
                                    const within = abs <= tol;
                                    const sign =
                                      diff > 0 ? "+" : diff < 0 ? "-" : "";
                                    const color = within
                                      ? diff === 0
                                        ? "bg-gray-200 text-gray-800 border-gray-300"
                                        : "bg-green-100 text-green-800 border-green-300"
                                      : "bg-red-100 text-red-800 border-red-300";
                                    const label = `${sign}${abs.toFixed(2)}`;
                                    return (
                                      <Badge
                                        className={`border ${color} whitespace-nowrap`}
                                        variant={
                                          within ? "secondary" : "destructive"
                                        }
                                        title={`Diferencia vs esperado (tolerancia ±${tol.toFixed(
                                          2
                                        )})`}
                                      >
                                        Diff: {label}
                                      </Badge>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Observaciones */}
                            <div className="mt-4 space-y-2">
                              <Label className="text-sm font-medium">
                                📝 Observaciones (opcional)
                              </Label>
                              <Textarea
                                rows={2}
                                placeholder="Ej: Diferencia por redondeo, conteo manual, etc."
                                value={
                                  userAdjustments[detalle.moneda_id]?.note || ""
                                }
                                onChange={(e) =>
                                  handleUserAdjustment(
                                    detalle.moneda_id,
                                    "note",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Sección de validación de cierres */}
                {validacionCierres && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-blue-800">
                        📋 Validación de Cierres Requeridos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2">
                        {/* Servicios Externos */}
                        {validacionCierres.cierres_requeridos
                          .servicios_externos && (
                          <div className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-sm font-medium">
                              Cierre de Servicios Externos
                              <span className="text-xs text-gray-500 ml-1">
                                (
                                {validacionCierres.conteos
                                  ?.servicios_externos || 0}{" "}
                                movimientos)
                              </span>
                            </span>
                            <Badge
                              variant={
                                validacionCierres.estado_cierres
                                  .servicios_externos
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {validacionCierres.estado_cierres
                                .servicios_externos
                                ? "✅ Completado"
                                : "⏳ Pendiente"}
                            </Badge>
                          </div>
                        )}

                        {/* Cambios de Divisas */}
                        {validacionCierres.cierres_requeridos
                          .cambios_divisas && (
                          <div className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-sm font-medium">
                              Cambios de Divisas
                              <span className="text-xs text-gray-500 ml-1">
                                (
                                {validacionCierres.conteos?.cambios_divisas ||
                                  0}{" "}
                                movimientos)
                              </span>
                            </span>
                            <Badge
                              variant={
                                validacionCierres.estado_cierres.cambios_divisas
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {validacionCierres.estado_cierres.cambios_divisas
                                ? "✅ Incluido en cierre diario"
                                : "⏳ Pendiente"}
                            </Badge>
                          </div>
                        )}

                        {/* Cierre Diario */}
                        <div className="flex items-center justify-between p-2 bg-white rounded border">
                          <span className="text-sm font-medium">
                            Cierre Diario
                          </span>
                          <Badge
                            variant={
                              validacionCierres.estado_cierres.cierre_diario
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {validacionCierres.estado_cierres.cierre_diario
                              ? "✅ Completado"
                              : "📝 Por realizar"}
                          </Badge>
                        </div>
                      </div>

                      {/* Estado general */}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-800">
                            Estado General:
                          </span>
                          <Badge
                            variant={
                              validacionCierres.cierres_completos
                                ? "default"
                                : "secondary"
                            }
                          >
                            {validacionCierres.cierres_completos
                              ? "✅ Todos los cierres completos"
                              : "⏳ Cierres pendientes"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button
                  onClick={confirmDailyClose}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  size="lg"
                  disabled={loading || closing || !cuadreData}
                >
                  {closing ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white border-b-transparent animate-spin"></span>
                      Cerrando...
                    </span>
                  ) : (
                    "Realizar Cierre Diario"
                  )}
                </Button>

                {/* Sugerencia: accesos rápidos para cuadrar */}
                <div className="mt-3 text-xs text-gray-600 text-center">
                  Si no cuadra, registre un movimiento en Servicios Externos
                  (USD) o agregue el Cambio de Divisa faltante.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Cierre Completado</CardTitle>
            <CardDescription>
              Cierre diario realizado el{" "}
              {todayClose.fecha_cierre &&
                new Date(todayClose.fecha_cierre).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-700">Total Cambios</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {getCantidad(todayClose.total_cambios)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-700">
                    Transferencias Entrada
                  </h4>
                  <p className="text-2xl font-bold text-green-600">
                    {getCantidad(todayClose.total_transferencias_entrada)}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-700">
                    Transferencias Salida
                  </h4>
                  <p className="text-2xl font-bold text-orange-600">
                    {getCantidad(todayClose.total_transferencias_salida)}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center gap-4">
                <Button
                  onClick={generateCloseReport}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  Generar Reporte
                </Button>
                
                {jornadaFinalizada && (
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm text-orange-600 font-medium">
                      ⚠️ Su jornada ha sido finalizada
                    </p>
                    <Button
                      onClick={handleLogout}
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Cerrar Sesión
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <ConfirmationDialog />
    </div>
  );
};

export default DailyClose;
