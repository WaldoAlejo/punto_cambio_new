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

  // Verifica si existe jornada activa
  useEffect(() => {
    if (user && user.rol === "OPERADOR") {
      setVerifyingJornada(true);
      axiosInstance
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
    // eslint-disable-next-line
  }, [user]);

  // Carga los puntos de atención libres si corresponde
  useEffect(() => {
    if (
      user &&
      user.rol === "OPERADOR" &&
      !selectedPoint &&
      !verifyingJornada
    ) {
      axiosInstance
        .get<{ points: PuntoAtencion[] }>("/api/points")
        .then((res) => setPoints(res.data.points || []))
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
