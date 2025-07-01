import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightLeft,
  Send,
  Clock,
  Users,
  MapPin,
  Coins,
  BarChart3,
  Calculator,
  CheckSquare,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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
  icon: React.ElementType;
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

  const menuItems: MenuItem[] = [
    {
      id: "exchanges",
      label: "Cambio de Divisas",
      icon: ArrowRightLeft,
      color: "text-blue-600",
      roles: ["OPERADOR"],
    },
    {
      id: "pending-exchanges",
      label: "Cambios Pendientes",
      icon: Clock,
      color: "text-red-600",
      roles: ["OPERADOR"],
    },
    {
      id: "transfers",
      label: "Transferencias",
      icon: Send,
      color: "text-green-600",
      roles: ["OPERADOR", "ADMIN", "SUPER_USUARIO"],
    },
    {
      id: "operator-time-management",
      label: "Gestión de Horarios",
      icon: Clock,
      color: "text-purple-600",
      roles: ["OPERADOR"],
    },
    {
      id: "daily-close",
      label: "Cierre Diario",
      icon: Calculator,
      color: "text-orange-600",
      roles: ["OPERADOR"],
    },
  ];

  const adminMenuItems: MenuItem[] = [
    {
      id: "admin-time-management",
      label: "Control de Horarios",
      icon: Clock,
      color: "text-purple-600",
    },
    {
      id: "transfer-approvals",
      label: "Aprobaciones",
      icon: CheckSquare,
      color: "text-yellow-600",
    },
    {
      id: "users",
      label: "Usuarios",
      icon: Users,
      color: "text-blue-600",
    },
    {
      id: "points",
      label: "Puntos de Atención",
      icon: MapPin,
      color: "text-green-600",
    },
    {
      id: "currencies",
      label: "Monedas",
      icon: Coins,
      color: "text-yellow-600",
    },
    {
      id: "reports",
      label: "Reportes",
      icon: BarChart3,
      color: "text-red-600",
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;
    return (
      <Button
        key={item.id}
        variant={isActive ? "default" : "ghost"}
        className={`w-full justify-start h-10 px-3 ${
          isActive ? "bg-blue-700 text-white shadow" : "hover:bg-gray-100"
        } ${!isOpen ? "px-2" : ""} transition-all`}
        onClick={() => onViewChange(item.id)}
      >
        <Icon
          className={`h-4 w-4 ${item.color} ${isActive ? "text-white" : ""} ${
            !isOpen ? "mx-auto" : "mr-3"
          }`}
        />
        {isOpen && (
          <span className="text-sm font-medium truncate">{item.label}</span>
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
          fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50 transition-all duration-300
          flex flex-col
          ${isOpen ? "w-64" : "w-16"}
          ${isMobile ? "shadow-xl" : ""}
          lg:relative lg:z-auto
        `}
        style={{
          transitionProperty: "width",
          transitionDuration: "300ms",
        }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {isOpen && (
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-blue-800 tracking-tight">
                PuntoCambio
              </h1>
              <p className="text-xs text-gray-500">Sistema de Gestión</p>
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
              .filter((item) => item.roles?.includes(user.rol || ""))
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
