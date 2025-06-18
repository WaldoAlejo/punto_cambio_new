
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import logger, { logRequest } from './utils/logger.js';
import { authenticateToken } from './middleware/auth.js';
import { sanitizeInput } from './middleware/validation.js';

// Import route modules
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import pointRoutes from './routes/points.js';
import currencyRoutes from './routes/currencies.js';
import balanceRoutes from './routes/balances.js';
import transferRoutes from './routes/transfers.js';
import scheduleRoutes from './routes/schedules.js';

const app = express();
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});
const PORT = process.env.PORT || 3001;

// Configuración de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting - Updated configuration for compatibility
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 100, // máximo 100 requests por IP por ventana (updated from 'max' to 'limit')
  message: { error: 'Demasiadas peticiones, intente más tarde' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api', limiter);

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

// Mount route modules
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/points', authenticateToken, pointRoutes);
app.use('/api/currencies', authenticateToken, currencyRoutes);
app.use('/api/balances', authenticateToken, balanceRoutes);
app.use('/api/transfers', authenticateToken, transferRoutes);
app.use('/api/schedules', authenticateToken, scheduleRoutes);

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
