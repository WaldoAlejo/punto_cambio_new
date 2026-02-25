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
const TransferAcceptance = React.lazy(
  () => import("../admin/TransferAcceptance")
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
const SystemHealthDashboard = React.lazy(
  () => import("../admin/SystemHealthDashboard")
);
const AdminDashboard = React.lazy(
  () => import("../admin/AdminDashboard")
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
  "system-health",
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
  
  const isAdmin = useMemo(
    () => user.rol === "ADMIN" || user.rol === "SUPER_USUARIO",
    [user.rol]
  );
  const isOperador = useMemo(() => user.rol === "OPERADOR", [user.rol]);
  const isConcesion = useMemo(() => user.rol === "CONCESION", [user.rol]);
  
  const handleNotificationClick = useCallback(() => {
    // Admin/Super: ver transferencias pendientes de aprobación
    if (isAdmin || isConcesion) {
      setActiveView("transfer-approvals");
    } 
    // Operador: ver transferencias pendientes de aceptación
    else if (isOperador) {
      setActiveView("transfer-acceptance");
    }
  }, [isAdmin, isOperador, isConcesion]);

  const isAdministrativo = useMemo(
    () => user.rol === "ADMINISTRATIVO",
    [user.rol]
  );

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

      case "transfer-acceptance":
        if (!isOperador && !isConcesion)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <TransferAcceptance />;

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
        if (!isOperador)
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

      case "system-health":
        if (!isAdmin)
          return <Unauthorized onGoBack={() => setActiveView("dashboard")} />;
        return <SystemHealthDashboard />;

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

        // Admin Dashboard
        if (isAdmin) {
          return <AdminDashboard />;
        }

        // Bienvenida para otros roles
        return (
          <div className="w-full h-full animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Header de bienvenida */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Bienvenido al Sistema Punto Cambio
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Sistema integral para la gestión de cambio de divisas, transferencias y servicios externos
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Usuario */}
                <div className="card-modern p-6 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[hsl(217,100%,97%)] flex items-center justify-center">
                    <svg className="w-6 h-6 text-[hsl(217,70%,45%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Usuario Activo</h3>
                  <p className="text-lg font-medium text-[hsl(217,70%,45%)]">{user.nombre}</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(217,100%,97%)] text-[hsl(217,80%,35%)] mt-2">
                    {user.rol ? user.rol.replace("_", " ").toLowerCase() : "Sin rol"}
                  </span>
                </div>

                {/* Punto de Atención */}
                {selectedPoint ? (
                  <div className="card-modern p-6 text-center hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[hsl(145,60%,96%)] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[hsl(145,55%,42%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">Punto de Atención</h3>
                    <p className="text-lg font-medium text-[hsl(145,55%,42%)]">{selectedPoint.nombre}</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedPoint.direccion}</p>
                  </div>
                ) : (
                  <div className="card-modern p-6 text-center border-dashed border-2">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-muted-foreground mb-1">Sin Punto Asignado</h3>
                    <p className="text-sm text-muted-foreground">Seleccione un punto de atención para comenzar</p>
                  </div>
                )}

                {/* Estado del Sistema */}
                <div className="card-modern p-6 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[hsl(32,100%,96%)] flex items-center justify-center">
                    <svg className="w-6 h-6 text-[hsl(32,95%,55%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Estado del Sistema</h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(145,55%,42%)] animate-pulse" />
                    <p className="text-lg font-medium text-[hsl(145,55%,42%)]">Operativo</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Accesos Rápidos (solo para operadores) */}
              {(isOperador || isAdmin) && (
                <div className="card-modern p-6">
                  <h3 className="font-semibold text-foreground mb-4">Accesos Rápidos</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button 
                      onClick={() => setActiveView('exchanges')}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg bg-[hsl(217,100%,97%)] hover:bg-[hsl(217,100%,94%)] transition-colors text-center"
                    >
                      <svg className="w-6 h-6 text-[hsl(217,70%,45%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-[hsl(217,80%,35%)]">Cambio de Divisas</span>
                    </button>
                    <button 
                      onClick={() => setActiveView('transfers')}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg bg-[hsl(145,60%,96%)] hover:bg-[hsl(145,60%,92%)] transition-colors text-center"
                    >
                      <svg className="w-6 h-6 text-[hsl(145,55%,42%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <span className="text-sm font-medium text-[hsl(145,55%,32%)]">Transferencias</span>
                    </button>
                    <button 
                      onClick={() => setActiveView('daily-close')}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg bg-[hsl(32,100%,96%)] hover:bg-[hsl(32,100%,92%)] transition-colors text-center"
                    >
                      <svg className="w-6 h-6 text-[hsl(32,95%,55%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span className="text-sm font-medium text-[hsl(32,80%,35%)]">Cierre de Caja</span>
                    </button>
                    <button 
                      onClick={() => setActiveView('contabilidad-divisas')}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg bg-[hsl(200,85%,97%)] hover:bg-[hsl(200,85%,93%)] transition-colors text-center"
                    >
                      <svg className="w-6 h-6 text-[hsl(200,80%,50%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-sm font-medium text-[hsl(200,80%,40%)]">Contabilidad</span>
                    </button>
                  </div>
                </div>
              )}
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

        <main className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 lg:p-6">
          <div className="w-full h-full">
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
