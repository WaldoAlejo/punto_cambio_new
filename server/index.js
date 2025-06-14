
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

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
