
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from '../hooks/useAuth';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!username.trim()) {
      const errorMessage = 'El usuario es obligatorio';
      setError(errorMessage);
      toast({
        title: "Error de validación",
        description: errorMessage,
        variant: "destructive"
      });
      return;
    }

    if (!password.trim()) {
      const errorMessage = 'La contraseña es obligatoria';
      setError(errorMessage);
      toast({
        title: "Error de validación",
        description: errorMessage,
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      const errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      setError(errorMessage);
      toast({
        title: "Error de validación",
        description: errorMessage,
        variant: "destructive"
      });
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      console.log('Iniciando sesión...');
      const result = await login(username, password);
      
      if (result.success) {
        toast({
          title: "Inicio de sesión exitoso",
          description: `Bienvenido al sistema`,
        });
        console.log('Login exitoso, redirigiendo...');
        navigate('/dashboard');
      } else {
        const errorMessage = result.error || 'Error al iniciar sesión';
        setError(errorMessage);
        toast({
          title: "Error de autenticación",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMessage = 'Error de conexión con el servidor';
      setError(errorMessage);
      console.error('Error en login:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor. Verifique su conexión.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center text-blue-800">
            Sistema Punto Cambio
          </CardTitle>
          <CardDescription className="text-center">
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(''); // Limpiar error al escribir
                }}
                required
                disabled={isLoading}
                className={error && !username ? 'border-red-500' : ''}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(''); // Limpiar error al escribir
                  }}
                  required
                  disabled={isLoading}
                  className={error && !password ? 'border-red-500 pr-10' : 'pr-10'}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              disabled={isLoading || !username.trim() || !password.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center text-sm text-gray-600">
              <p className="font-semibold mb-2">Credenciales de prueba:</p>
              <div className="space-y-1">
                <p><span className="font-medium">Usuario:</span> admin</p>
                <p><span className="font-medium">Contraseña:</span> admin123</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
