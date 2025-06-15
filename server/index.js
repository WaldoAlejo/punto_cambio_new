
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Endpoint para login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await prisma.usuario.findFirst({
      where: {
        username: username,
        activo: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ 
      user: {
        ...userWithoutPassword,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString()
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener todos los usuarios
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.usuario.findMany({
      orderBy: {
        created_at: 'desc'
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

    res.json({ 
      users: users.map(user => ({
        ...user,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Endpoint para crear usuario
app.post('/api/users', async (req, res) => {
  try {
    const { username, password, nombre, correo, rol, punto_atencion_id } = req.body;
    
    // Verificar si el username ya existe
    const existingUser = await prisma.usuario.findFirst({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }

    // Verificar si el correo ya existe (si se proporciona)
    if (correo) {
      const existingEmail = await prisma.usuario.findFirst({
        where: { correo }
      });

      if (existingEmail) {
        return res.status(400).json({ error: 'El correo electrónico ya existe' });
      }
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
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

    res.json({ 
      user: {
        ...newUser,
        created_at: newUser.created_at.toISOString(),
        updated_at: newUser.updated_at.toISOString()
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// Endpoint para activar/desactivar usuario
app.patch('/api/users/:userId/toggle', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Obtener usuario actual
    const currentUser = await prisma.usuario.findUnique({
      where: { id: userId }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actualizar estado
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

    res.json({ 
      user: {
        ...updatedUser,
        created_at: updatedUser.created_at.toISOString(),
        updated_at: updatedUser.updated_at.toISOString()
      }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Endpoint para obtener puntos de atención
app.get('/api/points', async (req, res) => {
  try {
    const points = await prisma.puntoAtencion.findMany({
      where: {
        activo: true
      },
      orderBy: {
        nombre: 'asc'
      }
    });

    res.json({ 
      points: points.map(point => ({
        ...point,
        created_at: point.created_at.toISOString(),
        updated_at: point.updated_at.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error al obtener puntos:', error);
    res.status(500).json({ error: 'Error al obtener puntos de atención' });
  }
});

// Endpoint para crear punto de atención
app.post('/api/points', async (req, res) => {
  try {
    const { nombre, direccion, ciudad, provincia, codigo_postal, telefono } = req.body;
    
    const newPoint = await prisma.puntoAtencion.create({
      data: {
        nombre,
        direccion,
        ciudad,
        provincia,
        codigo_postal,
        telefono,
        activo: true
      }
    });

    res.json({ 
      point: {
        ...newPoint,
        created_at: newPoint.created_at.toISOString(),
        updated_at: newPoint.updated_at.toISOString()
      }
    });
  } catch (error) {
    console.error('Error al crear punto:', error);
    res.status(500).json({ error: 'Error al crear punto de atención' });
  }
});

// Endpoint para obtener monedas
app.get('/api/currencies', async (req, res) => {
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
    console.error('Error al obtener monedas:', error);
    res.status(500).json({ error: 'Error al obtener monedas' });
  }
});

// Endpoint para crear moneda
app.post('/api/currencies', async (req, res) => {
  try {
    const { nombre, simbolo, codigo, orden_display } = req.body;
    
    // Verificar si el código ya existe
    const existingCurrency = await prisma.moneda.findUnique({
      where: { codigo }
    });

    if (existingCurrency) {
      return res.status(400).json({ error: 'El código de moneda ya existe' });
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

    res.json({ 
      currency: {
        ...newCurrency,
        created_at: newCurrency.created_at.toISOString(),
        updated_at: newCurrency.updated_at.toISOString()
      }
    });
  } catch (error) {
    console.error('Error al crear moneda:', error);
    res.status(500).json({ error: 'Error al crear moneda' });
  }
});

// Endpoint para obtener saldos por punto
app.get('/api/balances/:pointId', async (req, res) => {
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
    console.error('Error al obtener saldos:', error);
    res.status(500).json({ error: 'Error al obtener saldos' });
  }
});

// Endpoint para obtener transferencias
app.get('/api/transfers', async (req, res) => {
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
    console.error('Error al obtener transferencias:', error);
    res.status(500).json({ error: 'Error al obtener transferencias' });
  }
});

// Endpoint para obtener jornadas/horarios
app.get('/api/schedules', async (req, res) => {
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
    console.error('Error al obtener horarios:', error);
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
