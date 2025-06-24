import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Menu } from "lucide-react";
import { User, PuntoAtencion } from "../../types";
import TransferNotifications from "../notifications/TransferNotifications";

interface HeaderProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onLogout: () => void;
  onToggleSidebar: () => void;
  onNotificationClick?: () => void;
}

const Header = ({
  user,
  selectedPoint,
  onLogout,
  onToggleSidebar,
  onNotificationClick,
}: HeaderProps) => {
  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleNotificationClick = () => {
    if (onNotificationClick) {
      onNotificationClick();
    }
  };

  return (
    <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Sistema Punto Cambio
          </h1>
          {selectedPoint && (
            <p className="text-sm text-gray-500">
              {selectedPoint.nombre} - {selectedPoint.ciudad}
            </p>
          )}
          {!selectedPoint &&
            (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") && (
              <p className="text-sm text-blue-600">Panel Administrativo</p>
            )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <TransferNotifications onNotificationClick={handleNotificationClick} />

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.nombre}</p>
            <p className="text-xs text-gray-500 capitalize">
              {user.rol ? user.rol.replace("_", " ").toLowerCase() : "Sin rol"}
            </p>
          </div>

          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-600 text-white text-xs">
              {getUserInitials(user.nombre)}
            </AvatarFallback>
          </Avatar>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
