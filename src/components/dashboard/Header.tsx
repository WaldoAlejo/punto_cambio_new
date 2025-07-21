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
    <header className="bg-white border-b px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 min-h-[56px]">
      {/* Izquierda: Logo + Título + Info */}
      <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            Sistema Punto Cambio
          </h1>
          {selectedPoint && (
            <p className="text-xs sm:text-sm text-gray-500 truncate">
              📍 {selectedPoint.nombre} - {selectedPoint.ciudad}
            </p>
          )}
          {!selectedPoint && (
            <p className="text-xs sm:text-sm text-orange-600">
              ⚠️ Sin punto seleccionado
            </p>
          )}
        </div>
      </div>

      {/* Derecha: Notificación + Usuario + Logout */}
      <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
        <TransferNotifications onNotificationClick={handleNotificationClick} />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.nombre}
            </p>
            <p className="text-xs text-gray-500 capitalize truncate">
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
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
