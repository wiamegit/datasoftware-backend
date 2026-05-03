const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

/* ================================
   ROUTES PRINCIPALES
================================ */

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const dashboardRoutes = require('./routes/dashboard');
const categoryRoutes = require('./routes/categories');
const usersRoutes = require('./routes/users');
const chatbotRoutes = require('./routes/chatbot');
const predictionsRouter = require('./routes/predictions');
const clientsRouter = require('./routes/clients');
const fournisseursRouter = require('./routes/fournisseurs');
const devisRouter = require('./routes/devis');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/predictions', predictionsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/fournisseurs', fournisseursRouter);
app.use('/api/devis', devisRouter);

/* ================================
   ROUTE TEMPORAIRE SETUP USERS
================================ */

app.get('/api/setup-users', async (req, res) => {
  try {
    const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
    const admin = await db.query(
      `INSERT INTO users (nom, email, password, role, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       ON CONFLICT (email) 
       DO UPDATE SET password = EXCLUDED.password
       RETURNING id, nom, email, role`,
      ['Administrateur', 'admin@datasoftware.com', hashedPasswordAdmin, 'ADMIN']
    );

    const hashedPasswordCaissier = await bcrypt.hash('caissier123', 10);
    const caissier = await db.query(
      `INSERT INTO users (nom, email, password, role, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       ON CONFLICT (email) 
       DO UPDATE SET password = EXCLUDED.password
       RETURNING id, nom, email, role`,
      ['Caissier', 'caissier@datasoftware.com', hashedPasswordCaissier, 'CASHIER']
    );

    res.json({
      success: true,
      message: 'Utilisateurs créés avec succès !',
      users: [admin.rows[0], caissier.rows[0]]
    });

  } catch (error) {
    console.error('Erreur setup:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ================================
   LOG DES ROUTES
================================ */

console.log('⚡ Routes actives:');
console.log('   • POST /api/auth/login');
console.log('   • GET  /api/products');
console.log('   • POST /api/products');
console.log('   • PUT  /api/products/:id');
console.log('   • DELETE /api/products/:id');
console.log('   • POST /api/sales');
console.log('   • GET  /api/sales');
console.log('   • GET  /api/dashboard/stats');
console.log('   • GET  /api/dashboard/top-products');
console.log('   • GET  /api/dashboard/low-stock');
console.log('   • GET  /api/dashboard/sales-chart');
console.log('   • GET  /api/categories');
console.log('   • POST /api/categories');
console.log('   • PUT  /api/categories/:id');
console.log('   • DELETE /api/categories/:id');
console.log('   • GET  /api/users');
console.log('   • POST /api/chatbot');
console.log('   • GET  /api/setup-users (temporaire)');
console.log('   • GET  /api/clients');
console.log('   • POST /api/clients');
console.log('   • PUT  /api/clients/:id');
console.log('   • DELETE /api/clients/:id');
console.log('   • GET  /api/fournisseurs');
console.log('   • POST /api/fournisseurs');
console.log('   • PUT  /api/fournisseurs/:id');
console.log('   • DELETE /api/fournisseurs/:id');
console.log('   • GET  /api/devis');
console.log('   • POST /api/devis');
console.log('   • PUT  /api/devis/:id/statut');
console.log('   • DELETE /api/devis/:id');
console.log('');

/* ================================
   DEMARRAGE SERVEUR
================================ */

app.listen(PORT, () => {
  console.log(`🚀 Serveur Backend démarré sur http://localhost:${PORT}`);
});