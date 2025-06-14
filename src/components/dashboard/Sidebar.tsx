
import { Button } from "@/components/ui/button";
import { HomeIcon, UsersIcon, StoreIcon, CoinsIcon, FileTextIcon, CheckIcon, ArrowRightLeftIcon, Clock, ClockIcon, CalendarDays } from "lucide-react";
import { User, PuntoAtencion } from '../../types';

interface SidebarProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar = ({ user, selectedPoint, activeView, onViewChange, isOpen, onToggle }: SidebarProps) => {
  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: HomeIcon },
    { key: 'exchanges', label: 'Cambios de Divisas', icon: CoinsIcon, operatorOnly: true },
    { key: 'transfers', label: 'Transferencias', icon: ArrowRightLeftIcon },
    { key: 'time-tracker', label: 'Control de Horarios', icon: Clock, operatorOnly: true },
    { key: 'operator-time-management', label: 'Gestión de Horarios', icon: CalendarDays, operatorOnly: true },
    { key: 'users', label: 'Usuarios', icon: UsersIcon, adminOnly: true },
    { key: 'points', label: 'Puntos de Atención', icon: StoreIcon, adminOnly: true },
    { key: 'currencies', label: 'Monedas', icon: CoinsIcon, adminOnly: true },
    { key: 'admin-time-management', label: 'Gestión de Horarios', icon: ClockIcon, adminOnly: true },
    { key: 'reports', label: 'Reportes', icon: FileTextIcon, adminOnly: true },
    { key: 'daily-close', label: 'Cierre Diario', icon: FileTextIcon, operatorOnly: true },
    { key: 'transfer-approvals', label: 'Aprobar Transferencias', icon: CheckIcon, adminOnly: true }
  ];

  const filteredMenuItems = menuItems.filter(item => {
    // Si es solo para admin y el usuario no es admin/super usuario, no mostrar
    if (item.adminOnly && user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
      return false;
    }
    // Si es solo para operador y el usuario es admin/super usuario, no mostrar
    if (item.operatorOnly && (user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO')) {
      return false;
    }
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 z-20 h-full w-64 flex-col bg-white border-r overflow-y-auto flex">
      <div className="flex items-center justify-center h-16 border-b">
        <span className="text-lg font-semibold">Punto Cambio</span>
      </div>
      <div className="py-4 px-2">
        <div className="space-y-2">
          {filteredMenuItems.map(item => (
            <Button
              key={item.key}
              variant={activeView === item.key ? "secondary" : "ghost"}
              onClick={() => onViewChange(item.key)}
              className="w-full justify-start"
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
