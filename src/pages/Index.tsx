
import { useState, useEffect } from 'react';
import LoginForm from '../components/auth/LoginForm';
import Dashboard from '../components/dashboard/Dashboard';
import PointSelection from '../components/auth/PointSelection';
import { User, PuntoAtencion } from '../types';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PuntoAtencion | null>(null);
  const [showPointSelection, setShowPointSelection] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('punto_cambio_user');
    const savedPoint = localStorage.getItem('punto_cambio_point');
    
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      if (parsedUser.rol === 'ADMIN' || parsedUser.rol === 'SUPER_USUARIO') {
        // Admin doesn't need point selection
        setSelectedPoint(null);
      } else if (savedPoint) {
        setSelectedPoint(JSON.parse(savedPoint));
      } else {
        setShowPointSelection(true);
      }
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('punto_cambio_user', JSON.stringify(userData));
    
    if (userData.rol === 'ADMIN' || userData.rol === 'SUPER_USUARIO') {
      // Admin and super user go directly to dashboard
      setShowPointSelection(false);
    } else {
      // Operator and concession need to select point
      setShowPointSelection(true);
    }
  };

  const handlePointSelection = (point: PuntoAtencion) => {
    setSelectedPoint(point);
    setShowPointSelection(false);
    localStorage.setItem('punto_cambio_point', JSON.stringify(point));
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedPoint(null);
    setShowPointSelection(false);
    localStorage.removeItem('punto_cambio_user');
    localStorage.removeItem('punto_cambio_point');
  };

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (showPointSelection && user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
    return (
      <PointSelection
        user={user}
        onPointSelect={handlePointSelection}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      selectedPoint={selectedPoint}
      onLogout={handleLogout}
    />
  );
};

export default Index;
