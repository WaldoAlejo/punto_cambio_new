
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ExchangeManagement from '../exchange/ExchangeManagement';
import TransferManagement from '../transfer/TransferManagement';
import UserManagement from '../admin/UserManagement';
import PointManagement from '../admin/PointManagement';
import CurrencyManagement from '../admin/CurrencyManagement';
import Reports from '../reports/Reports';
import DailyClose from '../close/DailyClose';
import { User, PuntoAtencion } from '../../types';

interface DashboardProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onLogout: () => void;
}

const Dashboard = ({ user, selectedPoint, onLogout }: DashboardProps) => {
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'exchanges':
        return <ExchangeManagement user={user} selectedPoint={selectedPoint} />;
      case 'transfers':
        return <TransferManagement user={user} selectedPoint={selectedPoint} />;
      case 'users':
        return <UserManagement user={user} />;
      case 'points':
        return <PointManagement user={user} />;
      case 'currencies':
        return <CurrencyManagement user={user} />;
      case 'reports':
        return <Reports user={user} selectedPoint={selectedPoint} />;
      case 'daily-close':
        return <DailyClose user={user} selectedPoint={selectedPoint} />;
      default:
        return (
          <div className="p-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-blue-800 mb-4">
                Bienvenido al Sistema Punto Cambio
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-700 mb-2">Usuario Activo</h3>
                  <p className="text-blue-600">{user.nombre}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {user.rol ? user.rol.replace('_', ' ').toLowerCase() : 'Sin rol'}
                  </p>
                </div>
                {selectedPoint && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-700 mb-2">Punto de Atención</h3>
                    <p className="text-green-600">{selectedPoint.nombre}</p>
                    <p className="text-sm text-gray-600">{selectedPoint.direccion}</p>
                  </div>
                )}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-yellow-700 mb-2">Estado del Sistema</h3>
                  <p className="text-yellow-600">Operativo</p>
                  <p className="text-sm text-gray-600">Última actualización: Hoy</p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex relative">
      <Sidebar
        user={user}
        selectedPoint={selectedPoint}
        activeView={activeView}
        onViewChange={setActiveView}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
      />
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
      }`}>
        <Header
          user={user}
          selectedPoint={selectedPoint}
          onLogout={onLogout}
          onToggleSidebar={toggleSidebar}
        />
        
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
