
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { User } from '../../types';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock users for demonstration - In production this would come from your backend
  const mockUsers: User[] = [
    {
      id: '1',
      username: 'admin',
      email: 'admin@puntocambio.com',
      role: 'administrador',
      name: 'Administrador Principal',
      created_at: new Date().toISOString(),
      is_active: true
    },
    {
      id: '2',
      username: 'operador1',
      email: 'operador1@puntocambio.com',
      role: 'operador',
      name: 'Operador Punto 1',
      created_at: new Date().toISOString(),
      is_active: true
    },
    {
      id: '3',
      username: 'concesion1',
      email: 'concesion1@puntocambio.com',
      role: 'concesion',
      name: 'Concesión Principal',
      created_at: new Date().toISOString(),
      is_active: true
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Find user (in production, this would be a real API call)
      const user = mockUsers.find(u => u.username === username);
      
      if (!user) {
        toast({
          title: "Error de autenticación",
          description: "Usuario no encontrado",
          variant: "destructive"
        });
        return;
      }

      if (password !== 'admin123') { // Mock password validation
        toast({
          title: "Error de autenticación", 
          description: "Contraseña incorrecta",
          variant: "destructive"
        });
        return;
      }

      if (!user.is_active) {
        toast({
          title: "Error de autenticación",
          description: "Usuario inactivo",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Bienvenido",
        description: `Hola ${user.name}`,
      });

      onLogin(user);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-blue-800">Punto Cambio</CardTitle>
          <CardDescription>Sistema de Casa de Cambios</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingrese su usuario"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su contraseña"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Verificando..." : "Iniciar Sesión"}
            </Button>
          </form>
          <div className="mt-4 text-xs text-gray-500 text-center">
            <p>Usuarios de prueba:</p>
            <p>admin / operador1 / concesion1</p>
            <p>Contraseña: admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
