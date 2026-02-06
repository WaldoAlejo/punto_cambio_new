import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import LoginForm from "./components/auth/LoginForm";
import PointSelection from "./components/auth/PointSelection";
import Index from "./pages/Index";
import "./App.css";
import { useEffect, useState } from "react";
// Cambia este import:
import axiosInstance from "@/services/axiosInstance";
import { pointService } from "@/services/pointService";
import { PuntoAtencion } from "./types";

interface JornadaActiveResponse {
  success: boolean;
  schedule: {
    punto_atencion_id?: string;
    puntoAtencion?: {
      id: string;
      nombre: string;
      direccion: string;
      ciudad: string;
      provincia: string;
      codigo_postal?: string;
      telefono?: string;
      servientrega_agencia_codigo?: string;
      servientrega_agencia_nombre?: string;
    };
  } | null;
}

function App() {
  const { user, selectedPoint, setSelectedPoint, isLoading, logout } =
    useAuth();
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [verifyingJornada, setVerifyingJornada] = useState(false);

  // Verifica si existe jornada activa para OPERADOR
  useEffect(() => {
    if (user && user.rol === "OPERADOR") {
      setVerifyingJornada(true);
      axiosInstance
        .get<JornadaActiveResponse>("/schedules/active")
        .then(({ data }) => {
          const active = data?.schedule;
          if (!active) {
            setSelectedPoint(null);
            localStorage.removeItem("puntoAtencionSeleccionado");
          } else if (
            active.punto_atencion_id &&
            (!selectedPoint || selectedPoint.id !== active.punto_atencion_id)
          ) {
            setSelectedPoint({
              id: active.puntoAtencion?.id || active.punto_atencion_id,
              nombre: active.puntoAtencion?.nombre || "",
              direccion: active.puntoAtencion?.direccion || "",
              ciudad: active.puntoAtencion?.ciudad || "",
              provincia: active.puntoAtencion?.provincia || "",
              codigo_postal: active.puntoAtencion?.codigo_postal || "",
              telefono: active.puntoAtencion?.telefono || "",
              servientrega_agencia_codigo:
                active.puntoAtencion?.servientrega_agencia_codigo,
              servientrega_agencia_nombre:
                active.puntoAtencion?.servientrega_agencia_nombre,
              activo: true,
              es_principal: false,
              created_at: "",
              updated_at: "",
            });
          }
          setVerifyingJornada(false);
        })
        .catch(() => {
          setSelectedPoint(null);
          localStorage.removeItem("puntoAtencionSeleccionado");
          setVerifyingJornada(false);
        });
    }
    // eslint-disable-next-line
  }, [user]);

  // Para ADMIN: preselecciona automáticamente el punto principal
  useEffect(() => {
    if (
      user &&
      (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") &&
      !selectedPoint
    ) {
      pointService
        .getAllPointsForAdmin()
        .then((result) => {
          const points = result.points || [];
          const puntoPrincipal =
            points.find((p) => p.es_principal) ||
            points.find((p) => p.id === user.punto_atencion_id) ||
            points.find(
              (p) =>
                p.nombre.toLowerCase().includes("principal") ||
                p.nombre.toLowerCase().includes("matriz") ||
                p.nombre.toLowerCase().includes("central")
            ) ||
            points[0];
          if (puntoPrincipal) setSelectedPoint(puntoPrincipal);
        })
        .catch((error) => {
          console.error("Error al cargar punto principal para admin:", error);
        });
    }
  }, [user, selectedPoint, setSelectedPoint]);

  // Carga los puntos de atención libres si corresponde (para OPERADOR y ADMINISTRATIVO)
  useEffect(() => {
    if (
      user &&
      (user.rol === "OPERADOR" || user.rol === "ADMINISTRATIVO") &&
      !selectedPoint &&
      !verifyingJornada
    ) {
      axiosInstance
        .get<{ points: PuntoAtencion[] }>("/points")
        .then(({ data }) => setPoints(data.points || []))
        .catch(() => setPoints([]));
    }
  }, [user, selectedPoint, verifyingJornada]);

  return (
    <Router>
      {isLoading || verifyingJornada ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando aplicación...</p>
          </div>
        </div>
      ) : !user ? (
        <>
          <LoginForm />
          <Toaster />
        </>
      ) : (user.rol === "OPERADOR" || user.rol === "ADMINISTRATIVO") && !selectedPoint ? (
        <>
          <PointSelection user={user} points={points} onLogout={logout} />
          <Toaster />
        </>
      ) : (
        <div className="App">
          <Routes>
            <Route path="/*" element={<Index />} />
          </Routes>
          <Toaster />
        </div>
      )}
    </Router>
  );
}

export default App;
