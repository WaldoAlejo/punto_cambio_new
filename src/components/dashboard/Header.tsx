
import { Button } from "@/components/ui/button";
import { User, AttentionPoint } from '../../types';

interface HeaderProps {
  user: User;
  selectedPoint: AttentionPoint | null;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

const Header = ({ user, selectedPoint, onLogout }: HeaderProps) => {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedPoint ? selectedPoint.name : 'Panel Administrativo'}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{user.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
          </div>
          <Button 
            variant="outline"
            onClick={onLogout}
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
