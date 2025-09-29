import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X, Menu, ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import { User, PuntoAtencion } from "../../types";

interface SidebarProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
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
  const isConcesion = user.rol === "CONCESION";

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
      roles: ["OPERADOR", "ADMINISTRATIVO"],
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
  ];

  const adminMenuItems: MenuItem[] = [
    // Supervisión y contabilidad
    {
      id: "contabilidad-general",
      label: "Contabilidad General",
      color: "text-emerald-600",
    },
    {
      id: "reports",
      label: "Reportes Generales",
      color: "text-red-600",
    },
    // Acceso a cambios para ver/eliminar
    {
      id: "exchanges",
      label: "Cambios (admin)",
      color: "text-blue-700",
    },
    // Separador visual
    {
      id: "separator-1",
      label: "---",
      color: "",
    },
    // Gestión de usuarios y puntos
    {
      id: "users",
      label: "Usuarios",
      color: "text-blue-600",
    },
    {
      id: "points",
      label: "Puntos de Atención",
      color: "text-green-600",
    },
    {
      id: "admin-time-management",
      label: "Control de Horarios",
      color: "text-purple-600",
    },
    // Separador visual
    {
      id: "separator-2",
      label: "---",
      color: "",
    },
    // Gestión financiera
    {
      id: "currencies",
      label: "Gestión de Monedas",
      color: "text-indigo-600",
    },
    {
      id: "currency-behaviors",
      label: "Comportamientos de Divisas",
      color: "text-indigo-500",
    },
    {
      id: "balance-management",
      label: "Gestión de Saldos",
      color: "text-blue-600",
    },
    {
      id: "transfer-approvals",
      label: "Aprobaciones",
      color: "text-yellow-600",
    },
    {
      id: "permission-approvals",
      label: "Aprobación de Permisos",
      color: "text-pink-700",
    },
    // Separador visual
    {
      id: "separator-3",
      label: "---",
      color: "",
    },
    // Gestión de Servientrega
    {
      id: "servientrega-saldo",
      label: "Saldo Servientrega",
      color: "text-cyan-600",
    },
    {
      id: "servientrega-anulaciones",
      label: "Anulaciones Servientrega",
      color: "text-orange-600",
    },
    {
      id: "servientrega-informes",
      label: "Informes Servientrega",
      color: "text-purple-600",
    },
    // Separador visual
    {
      id: "separator-4",
      label: "---",
      color: "",
    },
    // Administración de servicios externos
    {
      id: "servicios-externos-admin",
      label: "Admin Servicios Externos",
      color: "text-emerald-700",
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    // Renderizar separadores
    if (item.id.startsWith("separator")) {
      return isOpen ? <Separator key={item.id} className="my-2" /> : null;
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
          fixed top-0 left-0 h-full bg-white border-r z-50 transition-all duration-300
          flex flex-col
          ${isOpen ? "w-56" : "w-14"}
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

            <Separator className="my-2" />

            {menuItems
              .filter((item) => {
                // Filtrar por rol
                if (!item.roles?.includes(user.rol || "")) return false;

                // Para opciones de Servientrega, verificar que el punto tenga agencia asignada
                if (item.id === "servientrega") {
                  return selectedPoint?.servientrega_agencia_codigo
                    ? true
                    : false;
                }

                return true;
              })
              .map(renderMenuItem)}

            {isAdmin && (
              <>
                <Separator className="my-3" />

                {isOpen && (
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-8 px-3 text-blue-900 hover:bg-gray-100"
                    onClick={() => setAdminExpanded(!adminExpanded)}
                  >
                    <span className="text-sm font-medium">Administración</span>
                    {adminExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {(adminExpanded || !isOpen) && (
                  <div className={`space-y-1 ${isOpen ? "ml-2" : ""}`}>
                    {adminMenuItems.map(renderMenuItem)}
                  </div>
                )}
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

export default Sidebar;
