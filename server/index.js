
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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
