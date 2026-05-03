const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('✅ Connexion PostgreSQL établie avec succès !');
});

pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL Pool:', err);
});

const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'CASHIER',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(200) NOT NULL,
        prix_vente DECIMAL(10,2) NOT NULL,
        code_barre VARCHAR(50),
        description TEXT,
        stock_quantite INTEGER DEFAULT 0,
        seuil_alerte INTEGER DEFAULT 5,
        categorie_id INTEGER REFERENCES categories(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        montant_total DECIMAL(10,2) NOT NULL,
        mode_paiement VARCHAR(20) DEFAULT 'CASH',
        statut VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantite INTEGER NOT NULL,
        prix_unitaire DECIMAL(10,2) NOT NULL,
        sous_total DECIMAL(10,2) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        telephone VARCHAR(20),
        email VARCHAR(150),
        adresse TEXT,
        ice VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS fournisseurs (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        telephone VARCHAR(20),
        email VARCHAR(150),
        adresse TEXT,
        ice VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devis (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(20) UNIQUE NOT NULL,
        client_id INTEGER REFERENCES clients(id),
        client_nom VARCHAR(100),
        client_adresse TEXT,
        client_ice VARCHAR(50),
        commercial VARCHAR(100),
        mode_reglement VARCHAR(50),
        echeance DATE,
        statut VARCHAR(20) DEFAULT 'brouillon',
        tva DECIMAL(5,2) DEFAULT 20,
        total_ht DECIMAL(10,2),
        total_tva DECIMAL(10,2),
        total_ttc DECIMAL(10,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devis_items (
        id SERIAL PRIMARY KEY,
        devis_id INTEGER REFERENCES devis(id) ON DELETE CASCADE,
        code_article VARCHAR(100),
        designation TEXT NOT NULL,
        quantite DECIMAL(10,2),
        prix_unitaire DECIMAL(10,2),
        montant_ht DECIMAL(10,2)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        message TEXT,
        is_read BOOLEAN DEFAULT false,
        product_id INTEGER REFERENCES products(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      const adminHash = bcrypt.hashSync('admin123', 10);
      const caissierHash = bcrypt.hashSync('caissier123', 10);
      await pool.query(
        'INSERT INTO users (nom, email, password, role) VALUES ($1, $2, $3, $4)',
        ['Admin BitStore', 'admin@bitstore.com', adminHash, 'ADMIN']
      );
      await pool.query(
        'INSERT INTO users (nom, email, password, role) VALUES ($1, $2, $3, $4)',
        ['Caissier 1', 'caissier@bitstore.com', caissierHash, 'CASHIER']
      );
      console.log('✅ Utilisateurs par défaut créés');
    }

  } catch (error) {
    console.error('❌ Erreur initialisation base de données:', error);
  }
};

initDatabase();

module.exports = pool;