import React, { useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ExchangeManagement from "../exchange/ExchangeManagement";
import PendingExchangesList from "../exchange/PendingExchangesList";
import TransferManagement from "../transfer/TransferManagement";
import OperatorTimeManagement from "../timeTracking/OperatorTimeManagement";
import AdminTimeManagement from "../timeTracking/AdminTimeManagement";
import { UserManagement } from "../management/UserManagement";
import { PointManagement } from "../management/PointManagement";
import { CurrencyManagement } from "../management/CurrencyManagement";
import Reports from "../reports/Reports";
import DailyClose from "../close/DailyClose";
import TransferApprovals from "../admin/TransferApprovals";
import SaldoInicialManagement from "../admin/SaldoInicialManagement";
import BalanceDashboard from "./BalanceDashboard";
import ServientregaMain from "../servientrega/ServientregaMain";
import SaldoServientregaAdmin from "../admin/SaldoServientregaAdmin";
import ServientregaAnulaciones from "../admin/ServientregaAnulaciones";
import ServientregaInformes from "../admin/ServientregaInformes";
import ContabilidadDashboard from "../contabilidad/ContabilidadDashboard";
import { Unauthorized } from "../ui/unauthorized";
import { PointSelector } from "./PointSelector";
import { User, PuntoAtencion } from "../../types";
import { useNavigate } from "react-router-dom";

interface DashboardProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onLogout: () => void;
}

const Dashboard = ({ user, selectedPoint, onLogout }: DashboardProps) => {
  const [activeView, setActiveView] = React.useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (
      (user.rol === "OPERADOR" || user.rol === "ADMINISTRATIVO") &&
      !selectedPoint
    ) {
      navigate("/seleccionar-punto", { replace: true });
    }
  }, [user, selectedPoint, navigate]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleNotificationClick = () => {
    setActiveView("transfer-approvals");
  };

  const renderContent = () => {
    // Verificar permisos por rol
    const isAdmin = user.rol === "ADMIN" || user.rol === "SUPER_USUARIO";
    const isOperador = user.rol === "OPERADOR";
    const isAdministrativo = user.rol === "ADMINISTRATIVO";
    const isConcesion = user.rol === "CONCESION";

    switch (activeView) {
      case "exchanges":
        if (!isOperador)
          return (
            <Unauthorized
              message="Solo los operadores pueden acceder al módulo de cambio de divisas"
              onGoBack={() => setActiveView("dashboard")}
            />
          );
        return (
          <ExchangeManagement
            user={user}
            selectedPoint={selectedPoint}
            onReturnToDashboard={() => setActiveView("dashboard")}
          />
        );
      case "pending-exchanges":
        if (!isOperador) return <div>Sin permisos</div>;
        return (
          <PendingExchangesList user={user} selectedPoint={selectedPoint} />
        );
      case "transfers":
        if (!isOperador) return <div>Sin permisos</div>;
        return <TransferManagement user={user} />;
      case "operator-time-management":
        if (!isOperador && !isAdministrativo) return <div>Sin permisos</div>;
        return (
          <OperatorTimeManagement user={user} selectedPoint={selectedPoint} />
        );
      case "daily-close":
        if (!isOperador) return <div>Sin permisos</div>;
        return <DailyClose user={user} selectedPoint={selectedPoint} />;
      case "servientrega":
        if (!isOperador && !isConcesion) return <div>Sin permisos</div>;
        return <ServientregaMain user={user} selectedPoint={selectedPoint} />;

      // Secciones de administrador
      case "admin-time-management":
        if (!isAdmin) return <div>Sin permisos</div>;
        return (
          <AdminTimeManagement user={user} selectedPoint={selectedPoint} />
        );
      case "transfer-approvals":
        if (!isAdmin && !isConcesion) return <div>Sin permisos</div>;
        return <TransferApprovals />;
      case "users":
        if (!isAdmin) return <div>Sin permisos</div>;
        return <UserManagement />;
      case "points":
        if (!isAdmin) return <div>Sin permisos</div>;
        return <PointManagement />;
      case "currencies":
        if (!isAdmin) return <div>Sin permisos</div>;
        return <CurrencyManagement />;
      case "reports":
        if (!isAdmin) return <div>Sin permisos</div>;
        return <Reports user={user} selectedPoint={selectedPoint} />;
      case "balance-management":
        if (!isAdmin) return <div>Sin permisos</div>;
        return <SaldoInicialManagement />;
      case "servientrega-saldo":
        if (!isAdmin) return <div>Sin permisos</div>;
        return <SaldoServientregaAdmin />;
      case "servientrega-anulaciones":
        if (!isAdmin) return <div>Sin permisos</div>;
        return (
          <ServientregaAnulaciones user={user} selectedPoint={selectedPoint} />
        );
      case "servientrega-informes":
        if (!isAdmin) return <div>Sin permisos</div>;
        return (
          <ServientregaInformes user={user} selectedPoint={selectedPoint} />
        );
      case "contabilidad-divisas":
        if (!isAdmin && !isOperador) return <div>Sin permisos</div>;
        return (
          <ContabilidadDashboard
            user={user}
            selectedPoint={selectedPoint}
            currencies={[]} // Se cargarán internamente
            isAdminView={isAdmin} // Nueva prop para vista de administrador
          />
        );

      default:
        // Dashboard por defecto según rol
        if (isOperador) {
          if (selectedPoint) {
            return (
              <BalanceDashboard user={user} selectedPoint={selectedPoint} />
            );
          } else {
            // Operador sin punto asignado - mostrar selector
            return (
              <PointSelector
                user={user}
                onPointSelected={(point) => {
                  // Esta función será manejada por el componente padre
                  window.location.reload(); // Temporal - recargar para actualizar el estado
                }}
              />
            );
          }
        }

        if (isConcesion) {
          // Para concesión, mostrar directamente Servientrega
          return <ServientregaMain user={user} selectedPoint={selectedPoint} />;
        }

        return (
          <div className="w-full h-full flex justify-center items-start">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 mx-auto max-w-4xl w-full">
              <h2 className="text-2xl font-bold text-blue-800 mb-4 text-center">
                Bienvenido al Sistema Punto Cambio
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <h3 className="font-semibold text-blue-700 mb-2">
                    Usuario Activo
                  </h3>
                  <p className="text-blue-600">{user.nombre}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {user.rol
                      ? user.rol.replace("_", " ").toLowerCase()
                      : "Sin rol"}
                  </p>
                </div>
                {selectedPoint && (
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <h3 className="font-semibold text-green-700 mb-2">
                      Punto de Atención
                    </h3>
                    <p className="text-green-600">{selectedPoint.nombre}</p>
                    <p className="text-sm text-gray-600">
                      {selectedPoint.direccion}
                    </p>
                  </div>
                )}
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <h3 className="font-semibold text-yellow-700 mb-2">
                    Estado del Sistema
                  </h3>
                  <p className="text-yellow-600">Operativo</p>
                  <p className="text-sm text-gray-600">
                    Última actualización: Hoy
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 relative">
      <Sidebar
        user={user}
        selectedPoint={selectedPoint}
        activeView={activeView}
        onViewChange={setActiveView}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          user={user}
          selectedPoint={selectedPoint}
          onLogout={onLogout}
          onToggleSidebar={toggleSidebar}
          onNotificationClick={handleNotificationClick}
        />

        <main className="flex-1 w-full max-w-full p-2 sm:p-4 md:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
