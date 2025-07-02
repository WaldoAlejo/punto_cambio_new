import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/components/dashboard/Dashboard";

export default function DashboardPage() {
  const { user, selectedPoint, logout } = useAuth();
  const navigate = useNavigate();

  // Redirección si no hay punto seleccionado
  useEffect(() => {
    if (!selectedPoint) {
      navigate("/select-point", { replace: true });
    }
  }, [selectedPoint, navigate]);

  // Mientras redirige, no renderiza nada
  if (!user || !selectedPoint) return null;

  return (
    <Dashboard user={user} selectedPoint={selectedPoint} onLogout={logout} />
  );
}
