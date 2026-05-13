import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X, Menu, ChevronDown, ChevronRight, BarChart3, FolderOpen } from "lucide-react";
import { User, PuntoAtencion } from "../../types";

interface SidebarProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  navigationLock?: {
    enabled: boolean;
    allowedViews: string[];
    message: string;
  };
}

interface MenuItem {
  id: string;
  label: string;
  color: string;
  roles?: string[];
}

const Sidebar = ({
  user,
  selectedPoint,
  activeView,
  onViewChange,
  isOpen,
  onToggle,
  navigationLock,
}: SidebarProps) => {
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isAdmin = user.rol === "ADMIN" || user.rol === "SUPER_USUARIO";
  const _isConcesion = user.rol === "CONCESION";
  const navigationLockEnabled = navigationLock?.enabled === true;

  const isViewAllowed = (viewId: string) => {
    if (!navigationLockEnabled) {
      return true;
    }

    return navigationLock?.allowedViews.includes(viewId) ?? false;
  };

  const menuItems: MenuItem[] = [
    {
      id: "exchanges",
      label: "Cambio de Divisas",
      color: "text-blue-600",
      roles: ["OPERADOR"],
    },
    {
      id: "pending-exchanges",
      label: "Cambios Pendientes",
      color: "text-red-600",
      roles: ["OPERADOR"],
    },
    {
      id: "transfers",
      label: "Transferencias",
      color: "text-green-600",
      roles: ["OPERADOR"],
    },
    {
      id: "transfer-acceptance",
      label: "Recibir Transferencias",
      color: "text-blue-600",
      roles: ["OPERADOR", "CONCESION"],
    },
    {
      id: "operator-time-management",
      label: "Gestión de Horarios",
      color: "text-purple-600",
      roles: ["OPERADOR", "ADMINISTRATIVO"],
    },
    {
      id: "permission-request",
      label: "Permisos de Salida",
      color: "text-pink-600",
      roles: ["OPERADOR", "ADMINISTRATIVO"],
    },
    {
      id: "apertura-caja",
      label: "Apertura de Caja",
      color: "text-green-600",
      roles: ["OPERADOR"],
    },
    {
      id: "daily-close",
      label: "Cierre Diario",
      color: "text-orange-600",
      roles: ["OPERADOR"],
    },
    {
      id: "servientrega",
      label: "Guía Servientrega",
      color: "text-cyan-600",
      roles: ["OPERADOR", "CONCESION"],
    },
    {
      id: "contabilidad-divisas",
      label: "Contabilidad por Punto",
      color: "text-emerald-600",
      roles: ["OPERADOR"],
    },
    {
      id: "servicios-externos",
      label: "Servicios Externos",
      color: "text-emerald-700",
      roles: ["OPERADOR"],
    },
    {
      id: "transfer-approvals",
      label: "Aprobaciones",
      color: "text-yellow-600",
      roles: ["CONCESION"],
    },
    {
      id: "servientrega-informes",
      label: "Informes Servientrega",
      color: "text-purple-600",
      roles: ["ADMINISTRATIVO"],
    },
  ];

  const adminMenuGroups = [
    {
      label: "📊 Reportes e Informes",
      items: [
        { id: "contabilidad-general", label: "Contabilidad General", color: "text-emerald-600" },
        { id: "contabilidad-por-punto", label: "Control por Punto", color: "text-teal-600" },
        { id: "reporte-asignaciones", label: "Reporte de Asignaciones", color: "text-indigo-600" },
        { id: "servientrega-informes", label: "Informes Servientrega", color: "text-purple-600" },
        { id: "reporte-inconsistencias", label: "Inconsistencias", color: "text-red-600" },
      ],
    },
    {
      label: "👥 Usuarios y Horarios",
      items: [
        { id: "users", label: "Usuarios", color: "text-blue-600" },
        { id: "admin-time-management", label: "Control de Horarios", color: "text-purple-600" },
        { id: "permission-approvals", label: "Aprobación de Permisos", color: "text-pink-700" },
      ],
    },
    {
      label: "🏢 Puntos y Saldos",
      items: [
        { id: "points", label: "Puntos de Atención", color: "text-green-600" },
        { id: "balance-management", label: "Gestión de Saldos", color: "text-blue-600" },
        { id: "aperturas-pendientes", label: "Aperturas Pendientes", color: "text-green-600" },
        { id: "cierres-diarios", label: "Resumen Cierres Diarios", color: "text-orange-600" },
        { id: "validacion-cierre", label: "Validación Cierre vs Apertura", color: "text-blue-600" },
      ],
    },
    {
      label: "💱 Configuración de Divisas",
      items: [
        { id: "currencies", label: "Gestión de Monedas", color: "text-indigo-600" },
        { id: "currency-behaviors", label: "Comportamientos de Divisas", color: "text-indigo-500" },
      ],
    },
    {
      label: "📦 Servicios y Operaciones",
      items: [
        { id: "servicios-externos-admin", label: "Admin Servicios Externos", color: "text-emerald-700" },
        { id: "servientrega-saldo", label: "Saldo Servientrega", color: "text-cyan-600" },
        { id: "servientrega-anulaciones", label: "Anulaciones Servientrega", color: "text-orange-600" },
        { id: "transfer-approvals", label: "Aprobaciones Transferencias", color: "text-yellow-600" },
        { id: "exchanges", label: "Cambios (admin)", color: "text-blue-700" },
      ],
    },
    {
      label: "🔍 Validación y Control",
      items: [
        { id: "system-health", label: "Salud del Sistema", color: "text-red-600" },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    // Renderizar separadores
    if (item.id.startsWith("separator")) {
      return isOpen ? <Separator key={item.id} className="my-2" /> : null;
    }

    if (!isViewAllowed(item.id)) {
      return null;
    }

    const isActive = activeView === item.id;
    return (
      <Button
        key={item.id}
        variant={isActive ? "default" : "ghost"}
        className={`w-full justify-start h-8 px-3 text-sm ${
          isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        } ${!isOpen ? "px-2" : ""} transition-all`}
        onClick={() => onViewChange(item.id)}
      >
        {isOpen && <span className="font-medium truncate">{item.label}</span>}
        {!isOpen && (
          <span className="text-xs font-bold mx-auto">
            {item.label.charAt(0)}
          </span>
        )}
      </Button>
    );
  };

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen bg-white border-r z-50 transition-all duration-300
          flex flex-col
          ${isOpen ? "w-64 sm:w-72 lg:w-64" : "w-12 sm:w-14"}
          ${isMobile ? "shadow-xl" : ""}
          lg:relative lg:z-auto
        `}
      >
        <div className="flex items-center justify-between p-3 border-b">
          {isOpen && (
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-primary">PuntoCambio</h1>
              <p className="text-xs text-muted-foreground">
                Sistema de Gestión
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-1 h-8 w-8 ml-2"
          >
            {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-2 py-4">
          <div className="space-y-2">
            {isOpen && (
              <div className="mb-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="font-medium text-sm text-blue-900">
                    {user.nombre}
                  </p>
                  <p className="text-xs text-gray-600 capitalize">
                    {user.rol?.replace("_", " ").toLowerCase()}
                  </p>
                  {selectedPoint && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {selectedPoint.nombre}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isViewAllowed("dashboard") && (
              <Button
                variant={activeView === "dashboard" ? "default" : "ghost"}
                className={`w-full justify-start h-10 px-3 ${
                  activeView === "dashboard"
                    ? "bg-blue-700 text-white shadow"
                    : "hover:bg-gray-100"
                } ${!isOpen ? "px-2" : ""} transition-all`}
                onClick={() => onViewChange("dashboard")}
              >
                <BarChart3
                  className={`h-4 w-4 text-blue-700 ${
                    activeView === "dashboard" ? "text-white" : ""
                  } ${!isOpen ? "mx-auto" : "mr-3"}`}
                />
                {isOpen && <span className="text-sm font-medium">Dashboard</span>}
              </Button>
            )}

            <Separator className="my-2" />

            {navigationLockEnabled && isOpen && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {navigationLock?.message}
              </div>
            )}

            {menuItems
              .filter((item) => {
                // Filtrar por rol
                if (!item.roles?.includes(user.rol || "")) return false;

                // Para opciones de Servientrega, verificar que el punto tenga TODA la configuración requerida
                if (item.id === "servientrega") {
                  const tieneConfiguracionCompleta =
                    selectedPoint?.servientrega_agencia_codigo &&
                    selectedPoint?.servientrega_agencia_nombre &&
                    selectedPoint?.servientrega_alianza &&
                    selectedPoint?.servientrega_oficina_alianza;
                  return !!tieneConfiguracionCompleta;
                }

                return true;
              })
              .map(renderMenuItem)}

            {isAdmin && (
              <>
                <Separator className="my-3" />

                {isOpen && (
                  <div className="px-1 mb-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Administración
                    </p>
                  </div>
                )}

                <AdminMenuGroups
                  groups={adminMenuGroups}
                  activeView={activeView}
                  onViewChange={onViewChange}
                  isOpen={isOpen}
                  isViewAllowed={isViewAllowed}
                />
              </>
            )}
          </div>
        </ScrollArea>

        {isOpen && (
          <div className="p-3 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              © 2025 PuntoCambio
            </p>
          </div>
        )}
      </aside>
    </>
  );
};

/* Sub-componente: Grupos del menú admin */
interface AdminMenuGroupsProps {
  groups: Array<{
    label: string;
    items: MenuItem[];
  }>;
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  isViewAllowed: (viewId: string) => boolean;
}

const AdminMenuGroups: React.FC<AdminMenuGroupsProps> = ({
  groups,
  activeView,
  onViewChange,
  isOpen,
  isViewAllowed,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      groups.forEach((g) => {
        initial[g.label] = true;
      });
      return initial;
    }
  );

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const isExpanded = expandedGroups[group.label] ?? true;
        const hasActive = group.items.some((i) => i.id === activeView);

        return (
          <div key={group.label} className="space-y-0.5">
            {isOpen && (
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${
                  hasActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="w-3 h-3" />
                  {group.label}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            )}

            {(isExpanded || !isOpen) && (
              <div className={`space-y-0.5 ${isOpen ? "ml-2" : ""}`}>
                {group.items
                  .filter((item) => isViewAllowed(item.id))
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <Button
                        key={item.id}
                        variant={isActive ? "default" : "ghost"}
                        className={`w-full justify-start h-7 px-2 text-xs ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        } ${!isOpen ? "px-1" : ""} transition-all`}
                        onClick={() => onViewChange(item.id)}
                      >
                        {isOpen && (
                          <span className="font-medium truncate">
                            {item.label}
                          </span>
                        )}
                        {!isOpen && (
                          <span className="text-xs font-bold mx-auto">
                            {item.label.charAt(0)}
                          </span>
                        )}
                      </Button>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Sidebar;
