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
import GenerarGuia from "../servientrega/GenerarGuia";
import SaldoServientregaAdmin from "../admin/SaldoServientregaAdmin";
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
    if (user.rol === "OPERADOR" && !selectedPoint) {
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
    switch (activeView) {
      case "exchanges":
        return <ExchangeManagement user={user} selectedPoint={selectedPoint} />;
      case "pending-exchanges":
        return (
          <PendingExchangesList user={user} selectedPoint={selectedPoint} />
        );
      case "transfers":
        return <TransferManagement user={user} />;
      case "operator-time-management":
        return (
          <OperatorTimeManagement user={user} selectedPoint={selectedPoint} />
        );
      case "admin-time-management":
        return (
          <AdminTimeManagement user={user} selectedPoint={selectedPoint} />
        );
      case "transfer-approvals":
        return <TransferApprovals />;
      case "users":
        return <UserManagement />;
      case "points":
        return <PointManagement />;
      case "currencies":
        return <CurrencyManagement />;
      case "reports":
        return <Reports user={user} selectedPoint={selectedPoint} />;
      case "daily-close":
        return <DailyClose user={user} selectedPoint={selectedPoint} />;
      case "balance-management":
        return <SaldoInicialManagement />;
      case "servientrega":
        return <GenerarGuia user={user} selectedPoint={selectedPoint} />;
      case "servientrega-saldo":
        return <SaldoServientregaAdmin />;
      default:
        if (user.rol === "OPERADOR" && selectedPoint) {
          return <BalanceDashboard user={user} selectedPoint={selectedPoint} />;
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
