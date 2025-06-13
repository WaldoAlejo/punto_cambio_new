
import { Button } from "@/components/ui/button";
import { 
  ArrowUpDown, 
  Users, 
  User, 
  DollarSign,
  FileText,
  Settings,
  BarChart3,
  Calendar,
  Menu,
  X
} from "lucide-react";
import { User as UserType, AttentionPoint } from '../../types';

interface SidebarProps {
  user: UserType;
  selectedPoint: AttentionPoint | null;
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar = ({ user, selectedPoint, activeView, onViewChange, isOpen, onToggle }: SidebarProps) => {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      roles: ['super_usuario', 'administrador', 'operador', 'concesion']
    },
    {
      id: 'exchanges',
      label: 'Cambio de Divisas',
      icon: ArrowUpDown,
      roles: ['operador', 'concesion']
    },
    {
      id: 'transfers',
      label: 'Transferencias',
      icon: DollarSign,
      roles: ['super_usuario', 'administrador', 'operador', 'concesion']
    },
    {
      id: 'daily-close',
      label: 'Cierre Diario',
      icon: Calendar,
      roles: ['operador', 'concesion']
    },
    {
      id: 'reports',
      label: 'Informes',
      icon: FileText,
      roles: ['super_usuario', 'administrador', 'operador', 'concesion']
    },
    {
      id: 'users',
      label: 'Gestión de Usuarios',
      icon: Users,
      roles: ['super_usuario', 'administrador']
    },
    {
      id: 'points',
      label: 'Puntos de Atención',
      icon: Settings,
      roles: ['super_usuario', 'administrador']
    },
    {
      id: 'currencies',
      label: 'Gestión de Monedas',
      icon: DollarSign,
      roles: ['super_usuario', 'administrador']
    }
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user.role)
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      <div className={`
        fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-30 transition-all duration-300
        ${isOpen ? 'w-64' : 'w-16'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {isOpen && (
              <div>
                <h1 className="text-xl font-bold text-blue-800">Punto Cambio</h1>
                <p className="text-xs text-gray-500">Sistema de Casa de Cambios</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="p-2"
            >
              {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {isOpen && selectedPoint && (
          <div className="p-4 bg-blue-50 border-b border-gray-200">
            <p className="text-sm font-medium text-blue-700">Punto Activo:</p>
            <p className="text-xs text-blue-600">{selectedPoint.name}</p>
          </div>
        )}

        <nav className="p-2">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                className={`
                  w-full justify-start mb-1 h-12
                  ${isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}
                  ${!isOpen ? 'px-3' : ''}
                `}
                onClick={() => onViewChange(item.id)}
              >
                <Icon className={`h-5 w-5 ${isOpen ? 'mr-3' : ''}`} />
                {isOpen && <span>{item.label}</span>}
              </Button>
            );
          })}
        </nav>

        {isOpen && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p className="font-medium">{user.name}</p>
              <p className="capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
