
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import logger, { logRequest } from './utils/logger.js';
import { authenticateToken, requireRole, generateToken } from './middleware/auth.js';
import { validate, sanitizeInput } from './middleware/validation.js';
import { 
  loginSchema, 
  createUserSchema, 
  createPointSchema, 
  createCurrencySchema,
  uuidSchema,
  type LoginRequest,
  type CreateUserRequest,
  type CreatePointRequest,
  type CreateCurrencyRequest
} from './schemas/validation.js';

const app = express();
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});
const PORT = process.env.PORT || 3001;

// Configuración de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por ventana
  message: { error: 'Demasiadas peticiones, intente más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Rate limiting estricto para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login por IP
  message: { error: 'Demasiados intentos de login, intente más tarde' },
  skipSuccessfulRequests: true,
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(sanitizeInput);
app.use(logRequest);

// Health check
app.get('/health', (req: Request, res: Response): void => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint
app.get('/api/test', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Testing database connection');
    const userCount = await prisma.usuario.count();
    res.json({ 
      message: 'Server running', 
      userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database test error', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Endpoint para login con validación y rate limiting
app.post('/api/auth/login', 
  loginLimiter,
  validate(loginSchema),
  async (req: Request<Record<string, unknown>, Record<string, unknown>, LoginRequest>, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;
      
      logger.info('Intento de login', { username, ip: req.ip });
      
      const user = await prisma.usuario.findFirst({
        where: {
          username: username,
          activo: true
        }
      });

      if (!user) {
        logger.warn('Usuario no encontrado', { username, ip: req.ip });
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        logger.warn('Contraseña incorrecta', { username, ip: req.ip });
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }

      const token = generateToken(user.id);
      const { password: _, ...userWithoutPassword } = user;
      
      logger.info('Login exitoso', { userId: user.id, username, ip: req.ip });
      
      res.json({ 
        user: {
          ...userWithoutPassword,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString()
        },
        token
      });
    } catch (error) {
      logger.error('Error en login', { error: error instanceof Error ? error.message : 'Unknown error', ip: req.ip });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// Endpoints protegidos con autenticación
app.use('/api/users', authenticateToken);
app.use('/api/points', authenticateToken);
app.use('/api/currencies', authenticateToken);
app.use('/api/balances', authenticateToken);
app.use('/api/transfers', authenticateToken);
app.use('/api/schedules', authenticateToken);

// Obtener usuarios (solo admins)
app.get('/api/users', 
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.usuario.findMany({
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true
        }
      });

      logger.info('Usuarios obtenidos', { count: users.length, requestedBy: req.user?.id });

      res.json({ 
        users: users.map(user => ({
          ...user,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString()
        }))
      });
    } catch (error) {
      logger.error('Error al obtener usuarios', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
      res.status(500).json({ error: 'Error al obtener usuarios' });
    }
  }
);

// Crear usuario (solo admins)
app.post('/api/users',
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createUserSchema),
  async (req: Request<Record<string, unknown>, Record<string, unknown>, CreateUserRequest>, res: Response): Promise<void> => {
    try {
      const { username, password, nombre, correo, rol, punto_atencion_id } = req.body;
      
      // Verificar duplicados
      const [existingUser, existingEmail] = await Promise.all([
        prisma.usuario.findFirst({ where: { username } }),
        correo ? prisma.usuario.findFirst({ where: { correo } }) : null
      ]);

      if (existingUser) {
        res.status(400).json({ error: 'El nombre de usuario ya existe' });
        return;
      }

      if (existingEmail) {
        res.status(400).json({ error: 'El correo electrónico ya existe' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = await prisma.usuario.create({
        data: {
          username,
          password: hashedPassword,
          nombre,
          correo,
          rol,
          punto_atencion_id,
          activo: true
        },
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true
        }
      });

      logger.info('Usuario creado', { 
        newUserId: newUser.id, 
        username: newUser.username,
        createdBy: req.user?.id 
      });

      res.status(201).json({ 
        user: {
          ...newUser,
          created_at: newUser.created_at.toISOString(),
          updated_at: newUser.updated_at.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error al crear usuario', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  }
);

// Activar/desactivar usuario (solo admins)
app.patch('/api/users/:userId/toggle',
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(uuidSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      
      const currentUser = await prisma.usuario.findUnique({
        where: { id: userId }
      });

      if (!currentUser) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      const updatedUser = await prisma.usuario.update({
        where: { id: userId },
        data: { activo: !currentUser.activo },
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true
        }
      });

      logger.info('Usuario actualizado', { 
        userId, 
        newStatus: updatedUser.activo,
        updatedBy: req.user?.id 
      });

      res.json({ 
        user: {
          ...updatedUser,
          created_at: updatedUser.created_at.toISOString(),
          updated_at: updatedUser.updated_at.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error al actualizar usuario', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
      res.status(500).json({ error: 'Error al actualizar usuario' });
    }
  }
);

// Endpoint para obtener puntos de atención
app.get('/api/points', async (req: Request, res: Response): Promise<void> => {
  try {
    const points = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });

    logger.info('Puntos obtenidos', { count: points.length, requestedBy: req.user?.id });

    res.json({ 
      points: points.map(point => ({
        ...point,
        created_at: point.created_at.toISOString(),
        updated_at: point.updated_at.toISOString()
      }))
    });
  } catch (error) {
    logger.error('Error al obtener puntos', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
    res.status(500).json({ error: 'Error al obtener puntos de atención' });
  }
});

// Crear punto de atención (solo admins)
app.post('/api/points',
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createPointSchema),
  async (req: Request<Record<string, unknown>, Record<string, unknown>, CreatePointRequest>, res: Response): Promise<void> => {
    try {
      const newPoint = await prisma.puntoAtencion.create({
        data: { ...req.body, activo: true }
      });

      logger.info('Punto creado', { pointId: newPoint.id, createdBy: req.user?.id });

      res.status(201).json({ 
        point: {
          ...newPoint,
          created_at: newPoint.created_at.toISOString(),
          updated_at: newPoint.updated_at.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error al crear punto', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
      res.status(500).json({ error: 'Error al crear punto de atención' });
    }
  }
);

// Endpoint para obtener monedas
app.get('/api/currencies', async (req: Request, res: Response): Promise<void> => {
  try {
    const currencies = await prisma.moneda.findMany({
      where: {
        activo: true
      },
      orderBy: {
        orden_display: 'asc'
      }
    });

    res.json({ 
      currencies: currencies.map(currency => ({
        ...currency,
        created_at: currency.created_at.toISOString(),
        updated_at: currency.updated_at.toISOString()
      }))
    });
  } catch (error) {
    logger.error('Error al obtener monedas', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Error al obtener monedas' });
  }
});

// Crear moneda (solo admins)
app.post('/api/currencies',
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createCurrencySchema),
  async (req: Request<Record<string, unknown>, Record<string, unknown>, CreateCurrencyRequest>, res: Response): Promise<void> => {
    try {
      const { nombre, simbolo, codigo, orden_display } = req.body;
      
      // Verificar si el código ya existe
      const existingCurrency = await prisma.moneda.findUnique({
        where: { codigo }
      });

      if (existingCurrency) {
        res.status(400).json({ error: 'El código de moneda ya existe' });
        return;
      }

      const newCurrency = await prisma.moneda.create({
        data: {
          nombre,
          simbolo,
          codigo,
          orden_display: orden_display || 0,
          activo: true
        }
      });

      logger.info('Moneda creada', { 
        newCurrencyId: newCurrency.id, 
        nombre: newCurrency.nombre,
        createdBy: req.user?.id 
      });

      res.status(201).json({ 
        currency: {
          ...newCurrency,
          created_at: newCurrency.created_at.toISOString(),
          updated_at: newCurrency.updated_at.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error al crear moneda', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
      res.status(500).json({ error: 'Error al crear moneda' });
    }
  }
);

// Endpoint para obtener saldos por punto
app.get('/api/balances/:pointId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pointId } = req.params;
    
    const balances = await prisma.saldo.findMany({
      where: {
        punto_atencion_id: pointId
      },
      include: {
        moneda: true
      }
    });

    res.json({ 
      balances: balances.map(balance => ({
        ...balance,
        cantidad: parseFloat(balance.cantidad.toString()),
        updated_at: balance.updated_at.toISOString()
      }))
    });
  } catch (error) {
    logger.error('Error al obtener saldos', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Error al obtener saldos' });
  }
});

// Endpoint para obtener transferencias
app.get('/api/transfers', async (req: Request, res: Response): Promise<void> => {
  try {
    const transfers = await prisma.transferencia.findMany({
      include: {
        origen: true,
        destino: true,
        moneda: true,
        usuarioSolicitante: {
          select: {
            id: true,
            nombre: true,
            username: true
          }
        },
        usuarioAprobador: {
          select: {
            id: true,
            nombre: true,
            username: true
          }
        }
      },
      orderBy: {
        fecha: 'desc'
      }
    });

    res.json({ 
      transfers: transfers.map(transfer => ({
        ...transfer,
        monto: parseFloat(transfer.monto.toString()),
        fecha: transfer.fecha.toISOString(),
        fecha_aprobacion: transfer.fecha_aprobacion?.toISOString() || null
      }))
    });
  } catch (error) {
    logger.error('Error al obtener transferencias', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Error al obtener transferencias' });
  }
});

// Endpoint para obtener jornadas/horarios
app.get('/api/schedules', async (req: Request, res: Response): Promise<void> => {
  try {
    const schedules = await prisma.jornada.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            username: true
          }
        },
        puntoAtencion: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      orderBy: {
        fecha_inicio: 'desc'
      }
    });

    res.json({ 
      schedules: schedules.map(schedule => ({
        ...schedule,
        fecha_inicio: schedule.fecha_inicio.toISOString(),
        fecha_almuerzo: schedule.fecha_almuerzo?.toISOString() || null,
        fecha_regreso: schedule.fecha_regreso?.toISOString() || null,
        fecha_salida: schedule.fecha_salida?.toISOString() || null
      }))
    });
  } catch (error) {
    logger.error('Error al obtener horarios', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
});

// Manejo de errores global
app.use((error: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Error no manejado', { 
    error: error.message, 
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({ 
    error: 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

// Manejo de rutas no encontradas
app.use('*', (req: Request, res: Response): void => {
  logger.warn('Ruta no encontrada', { url: req.originalUrl, ip: req.ip });
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Manejo graceful de shutdown
process.on('SIGTERM', async (): Promise<void> => {
  logger.info('SIGTERM recibido, cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async (): Promise<void> => {
  logger.info('SIGINT recibido, cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, (): void => {
  logger.info('Servidor iniciado', { 
    port: PORT, 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});
