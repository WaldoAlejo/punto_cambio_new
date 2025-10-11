import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  Suspense,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Unauthorized } from "../ui/unauthorized";
// ✅ Importa el selector correcto desde layout (no "./PointSelector")
import PointSelector from "../layout/PointSelector";
import { User, PuntoAtencion } from "../../types";
// ✅ Ruta correcta del helper de eventos (no "@/lib/events/pointEvents")
import { emitPointSelected } from "@/lib/pointEvents";

/** Lazy imports */
const ExchangeManagement = React.lazy(
  () => import("../exchange/ExchangeManagement")
);
const AdminExchangeBrowser = React.lazy(
  () => import("../exchange/AdminExchangeBrowser")
);
const PendingExchangesList = React.lazy(
  () => import("../exchange/PendingExchangesList")
);
const TransferManagement = React.lazy(
  () => import("../transfer/TransferManagement")
);
const OperatorTimeManagement = React.lazy(
  () => import("../timeTracking/OperatorTimeManagement")
);
const AdminTimeManagement = React.lazy(
  () => import("../timeTracking/AdminTimeManagement")
);
const PermissionRequest = React.lazy(
  () => import("../timeTracking/PermissionRequest")
);
const PermissionApprovals = React.lazy(
  () => import("../admin/PermissionApprovals")
);
const TransferApprovals = React.lazy(
  () => import("../admin/TransferApprovals")
);
const Reports = React.lazy(() => import("../reports/Reports"));
const DailyClose = React.lazy(() => import("../close/DailyClose"));
const SaldoInicialManagement = React.lazy(
  () => import("../admin/SaldoInicialManagement")
);
const BalanceDashboard = React.lazy(() => import("./BalanceDashboard"));
const ServientregaMain = React.lazy(
  () => import("../servientrega/ServientregaMain")
);
const SaldoServientregaAdmin = React.lazy(
  () => import("../admin/SaldoServientregaAdmin")
);
const ServientregaAnulaciones = React.lazy(
  () => import("../admin/ServientregaAnulaciones")
);
const ServientregaInformes = React.lazy(
  () => import("../admin/ServientregaInformes")
);
const ContabilidadDashboard = React.lazy(
  () => import("../contabilidad/ContabilidadDashboard")
);
const CurrencyBehaviorPage = React.lazy(
  () => import("../../pages/admin/CurrencyBehaviorPage")
);
const UserManagement = React.lazy(() =>
  import("../management/UserManagement").then((m) => ({
    default: m.UserManagement,
  }))
);
const PointManagement = React.lazy(() =>
  import("../management/PointManagement").then((m) => ({
    default: m.PointManagement,
  }))
);
const CurrencyManagement = React.lazy(() =>
  import("../management/CurrencyManagement").then((m) => ({
    default: m.CurrencyManagement,
  }))
);
const ServiciosExternosPage = React.lazy(
  () => import("../contabilidad/ServiciosExternosPage")
);
const ServiciosExternosAdmin = React.lazy(
  () => import("../admin/ServiciosExternosAdmin")
);
const CierresDiariosResumen = React.lazy(
  () => import("../admin/CierresDiariosResumen")
);
const ContabilidadPorPunto = React.lazy(
  () => import("../admin/ContabilidadPorPunto")
);

/** Utils */
const STORAGE_KEY_VIEW = "pc_active_view";
const STORAGE_KEY_POINT = "pc_selected_point_id";

const VALID_VIEWS = new Set<string>([
  "dashboard",
  "exchanges",
  "pending-exchanges",
  "transfers",
  "operator-time-management",
  "permission-request",
  "daily-close",
  "servientrega",
  "admin-time-management",
  "transfer-approvals",
  "permission-approvals",
  "users",
  "points",
  "currencies",
  "currency-behaviors",
  "reports",
  "balance-management",
  "servientrega-saldo",
  "servientrega-anulaciones",
  "servientrega-informes",
  "contabilidad-divisas",
  "contabilidad-general",
  "contabilidad-por-punto",
  "servicios-externos",
  "servicios-externos-admin",
  "cierres-diarios",
]);

function getInitialView(
  user: User,
  selectedPoint: PuntoAtencion | null,
  viewParam?: string | null
): string {
  if (viewParam && VALID_VIEWS.has(viewParam)) return viewParam;
  const saved = localStorage.getItem(STORAGE_KEY_VIEW);
  if (saved && VALID_VIEWS.has(saved)) return saved;

  const isAdmin = user.rol === "ADMIN" || user.rol === "SUPER_USUARIO";
  const isOperador = user.rol === "OPERADOR";
  const isConcesion = user.rol === "CONCESION";
  // Cambio: Los administradores ahora van al dashboard por defecto
  if (isAdmin) return "dashboard";
  if (isConcesion) return "servientrega";
  if (isOperador && selectedPoint) return "dashboard";
  return "dashboard";
}

interface DashboardProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onLogout: () => void;
}

const Dashboard = ({ user, selectedPoint, onLogout }: DashboardProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const requiresPoint = useMemo(
    () => user.rol === "OPERADOR" || user.rol === "ADMINISTRATIVO",
    [user.rol]
  );

  /** Estado principal sincronizado con ?view */
  const [activeView, setActiveView] = useState<string>(() =>
    getInitialView(user, selectedPoint, searchParams.get("view"))
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /** Helpers para query params */
  const setQueryParam = useCallback(
    (key: string, value?: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (value === undefined || value === null || value === "")
        params.delete(key);
      else params.set(key, value);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  /** VIEW -> URL y localStorage */
  useEffect(() => {
    if (!activeView || !VALID_VIEWS.has(activeView)) return;
    localStorage.setItem(STORAGE_KEY_VIEW, activeView);
    if (searchParams.get("view") !== activeView)
      setQueryParam("view", activeView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  /** Back/forward: URL -> VIEW (only when URL changes) */
  useEffect(() => {
    const qp = searchParams.get("view");
    if (qp && VALID_VIEWS.has(qp)) {
      setActiveView((prev) => (prev !== qp ? qp : prev));
    }
  }, [searchParams]);

  /** Sync de selectedPoint -> URL & localStorage (sin reload) */
  useEffect(() => {
    const urlPoint = searchParams.get("point");
    const selectedId = selectedPoint?.id || null;

    if (selectedId) localStorage.setItem(STORAGE_KEY_POINT, selectedId);
    else localStorage.removeItem(STORAGE_KEY_POINT);

    if ((selectedId || "") !== (urlPoint || ""))
      setQueryParam("point", selectedId || null);
  }, [selectedPoint, searchParams, setQueryParam]);

  /** Llegó ?point=... diferente: guarda en LS y, si hace falta punto, ve al selector */
  useEffect(() => {
    const urlPoint = searchParams.get("point");
    const selectedId = selectedPoint?.id || null;
    if (urlPoint && urlPoint !== selectedId) {
      localStorage.setItem(STORAGE_KEY_POINT, urlPoint);
      if (requiresPoint && !selectedPoint)
        navigate("/seleccionar-punto", { replace: false });
    }
  }, [searchParams, selectedPoint, navigate, requiresPoint]);

  /** Si operador/administrativo no tiene punto, forzar selector */
  useEffect(() => {
    if (requiresPoint && !selectedPoint)
      navigate("/seleccionar-punto", { replace: false });
  }, [requiresPoint, selectedPoint, navigate]);

  const toggleSidebar = useCallback(() => setSidebarOpen((s) => !s), []);
  const handleNotificationClick = useCallback(
    () => setActiveView("transfer-approvals"),
    []
  );

  const isAdmin = useMemo(
    () => user.rol === "ADMIN" || user.rol === "SUPER_USUARIO",
    [user.rol]
  );
  const isOperador = useMemo(() => user.rol === "OPERADOR", [user.rol]);
  const isAdministrativo = useMemo(
    () => user.rol === "ADMINISTRATIVO",
    [user.rol]
  );
  const isConcesion = useMemo(() => user.rol === "CONCESION", [user.rol]);

  const renderContent = useCallback(() => {
    switch (activeView) {
      case "exchanges":
        if (!isOperador && !isAdmin)
          return (
            <Unauthorized
              message="Solo los operadores o administradores pueden acceder al módulo de cambio de divisas"
              onGoBack={() => setActiveView("dashboard")}
            />
          );
        if (isAdmin) {
          return <AdminExchangeBrowser user={user} />;
        }
        return (
          <ExchangeManagement
            user={user}
            selectedPoint={selectedPoint}
            onReturnToDashboard={() => setActiveView("dashboard")}
          />
        );

      case "pending-exchanges":
        if (!isOperador)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return (
          <PendingExchangesList user={user} selectedPoint={selectedPoint} />
        );

      case "transfers":
        if (!isOperador)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <TransferManagement user={user} />;

      case "operator-time-management":
        if (!isOperador && !isAdministrativo)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return (
          <OperatorTimeManagement user={user} selectedPoint={selectedPoint} />
        );

      case "permission-request":
        if (!isOperador && !isAdministrativo)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <PermissionRequest />;

      case "daily-close":
        if (!isOperador)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <DailyClose user={user} selectedPoint={selectedPoint} />;

      case "servientrega":
        if (!isOperador && !isConcesion)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <ServientregaMain user={user} selectedPoint={selectedPoint} />;

      // Admin
      case "admin-time-management":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return (
          <AdminTimeManagement user={user} selectedPoint={selectedPoint} />
        );

      case "transfer-approvals":
        if (!isAdmin && !isConcesion)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <TransferApprovals />;

      case "permission-approvals":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <PermissionApprovals />;

      case "users":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <UserManagement />;

      case "points":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <PointManagement />;

      case "currencies":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <CurrencyManagement />;

      case "currency-behaviors":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <CurrencyBehaviorPage />;

      case "reports":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <Reports user={user} selectedPoint={selectedPoint} />;

      case "balance-management":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <SaldoInicialManagement />;

      case "servientrega-saldo":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <SaldoServientregaAdmin />;

      case "servientrega-anulaciones":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return (
          <ServientregaAnulaciones user={user} selectedPoint={selectedPoint} />
        );

      case "servientrega-informes":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return (
          <ServientregaInformes user={user} selectedPoint={selectedPoint} />
        );

      case "contabilidad-divisas":
        if (!isOperador && !isAdministrativo)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        if (!selectedPoint) return <div>Seleccione un punto de atención</div>;
        return (
          <ContabilidadDashboard
            user={user}
            selectedPoint={selectedPoint}
            currencies={[]}
            isAdminView={false}
          />
        );

      case "contabilidad-general":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return (
          <ContabilidadDashboard
            user={user}
            selectedPoint={selectedPoint}
            currencies={[]}
            isAdminView={true}
          />
        );

      case "contabilidad-por-punto":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <ContabilidadPorPunto user={user} />;

      case "servicios-externos":
        if (!isOperador)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <ServiciosExternosPage />;

      case "servicios-externos-admin":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <ServiciosExternosAdmin />;

      case "cierres-diarios":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <CierresDiariosResumen />;

      default:
        if (isOperador) {
          if (selectedPoint)
            return (
              <BalanceDashboard user={user} selectedPoint={selectedPoint} />
            );
          const urlPoint = searchParams.get("point") || undefined;
          return (
            <PointSelector
              user={user}
              defaultSelectedPointId={urlPoint}
              onPointSelected={(point) => {
                // Persistir y reflejar en URL
                localStorage.setItem(STORAGE_KEY_POINT, point.id);
                setQueryParam("point", point.id);
                // Emitir evento para que el provider global haga el setSelectedPoint
                emitPointSelected(point);
              }}
            />
          );
        }

        if (isConcesion)
          return <ServientregaMain user={user} selectedPoint={selectedPoint} />;

        // Bienvenida
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
  }, [
    activeView,
    isAdmin,
    isOperador,
    isAdministrativo,
    isConcesion,
    user,
    selectedPoint,
    searchParams,
    setQueryParam,
  ]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        user={user}
        selectedPoint={selectedPoint}
        activeView={activeView}
        onViewChange={setActiveView}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          user={user}
          selectedPoint={selectedPoint}
          onLogout={onLogout}
          onToggleSidebar={toggleSidebar}
          onNotificationClick={handleNotificationClick}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-[1920px] mx-auto h-full">
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Cargando módulo…</p>
                  </div>
                </div>
              }
            >
              {renderContent()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
