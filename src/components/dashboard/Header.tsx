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
    <header className="bg-white border-b px-2 sm:px-3 md:px-4 py-2 flex items-center justify-between min-h-[48px] sm:min-h-[56px]">
      {/* Izquierda: Logo + Título + Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden h-8 w-8 p-0"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">
            Sistema Punto Cambio
          </h1>
          {selectedPoint && (
            <p className="text-xs text-muted-foreground truncate">
              {selectedPoint.nombre} - {selectedPoint.ciudad}
            </p>
          )}
          {!selectedPoint && (
            <p className="text-xs text-orange-600">Sin punto seleccionado</p>
          )}
        </div>
      </div>

      {/* Derecha: Notificación + Usuario + Logout */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <TransferNotifications onNotificationClick={handleNotificationClick} />

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-gray-900 truncate">
              {user.nombre}
            </p>
            <p className="text-xs text-muted-foreground capitalize truncate">
              {user.rol ? user.rol.replace("_", " ").toLowerCase() : "Sin rol"}
            </p>
          </div>

          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getUserInitials(user.nombre)}
            </AvatarFallback>
          </Avatar>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
