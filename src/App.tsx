import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import LoginForm from "./components/auth/LoginForm";
import PointSelection from "./components/auth/PointSelection";
import Index from "./pages/Index";
import "./App.css";
import { useEffect, useState } from "react";
import axios from "axios";
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
    };
  } | null;
}

function App() {
  const { user, selectedPoint, setSelectedPoint, isLoading, logout } =
    useAuth();

  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [verifyingJornada, setVerifyingJornada] = useState(false);

  // Verificar si existe jornada activa para el operador (backend = fuente de verdad)
  useEffect(() => {
    if (user && user.rol === "OPERADOR") {
      setVerifyingJornada(true);
      axios
        .get<JornadaActiveResponse>("/api/jornada/active")
        .then((res) => {
          const active = res.data?.schedule;
          if (!active) {
            setSelectedPoint(null);
            localStorage.removeItem("puntoAtencionSeleccionado");
          } else if (
            active.punto_atencion_id &&
            (!selectedPoint || selectedPoint.id !== active.punto_atencion_id)
          ) {
            // Reconstruir objeto con defaults si el backend no retorna todo
            setSelectedPoint({
              id: active.puntoAtencion?.id || active.punto_atencion_id,
              nombre: active.puntoAtencion?.nombre || "",
              direccion: active.puntoAtencion?.direccion || "",
              ciudad: active.puntoAtencion?.ciudad || "",
              provincia: active.puntoAtencion?.provincia || "",
              codigo_postal: active.puntoAtencion?.codigo_postal || "",
              telefono: active.puntoAtencion?.telefono || "",
              activo: true,
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
    // Solo debe correr al cambiar user (evita bucles)
    // eslint-disable-next-line
  }, [user]);

  // Cargar puntos de atención si es operador y no tiene punto seleccionado y terminó la verificación
  useEffect(() => {
    if (
      user &&
      user.rol === "OPERADOR" &&
      !selectedPoint &&
      !verifyingJornada
    ) {
      axios
        .get<{ points: PuntoAtencion[] }>("/api/puntos")
        .then((res) => setPoints(res.data.points || []))
        .catch(() => setPoints([]));
    }
  }, [user, selectedPoint, verifyingJornada]);

  // **¡CORRECCIÓN AQUÍ!**
  // Todo va dentro del <Router> para evitar errores de hooks de navegación
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
      ) : user.rol === "OPERADOR" && !selectedPoint ? (
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
