const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'admin123',  // ← METTEZ VOTRE MOT DE PASSE PostgreSQL ICI
  database: 'bitstore_pos',
  port: 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('✅ Connexion PostgreSQL établie avec succès !');
  console.log('   📍 Host: localhost:5432');
  console.log('   📦 Database: bitstore_pos');
  console.log('');
});

pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL Pool:', err);
});

// Initialiser la base de données
const initDatabase = async () => {
  try {
    // Créer les tables
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
        stock_alerte INTEGER DEFAULT 5,
        category_id INTEGER REFERENCES categories(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total_ttc DECIMAL(10,2) NOT NULL,
        mode_paiement VARCHAR(20) DEFAULT 'CASH',
        amount_received DECIMAL(10,2),
        change_amount DECIMAL(10,2),
        date_vente TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantite INTEGER NOT NULL,
        prix_unitaire DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL
      );
    `);

    // Créer les index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_products_code_barre ON products(code_barre);
      CREATE INDEX IF NOT EXISTS idx_products_nom ON products(nom);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date_vente);
      CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
    `);

    // Vérifier si les utilisateurs existent
    const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
    
    if (parseInt(userCheck.rows[0].count) === 0) {
      // Créer les utilisateurs par défaut
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
      console.log('   👤 Admin: admin@bitstore.com / admin123');
      console.log('   👤 Caissier: caissier@bitstore.com / caissier123');
    }

    // Vérifier si les produits existent
    const productCheck = await pool.query('SELECT COUNT(*) as count FROM products');
    
    if (parseInt(productCheck.rows[0].count) === 0) {
      // Créer les produits de test
      const products = [
        ['Clavier Gaming RGB', 450, '123456789012', 5, 2],
        ['Souris Logitech G502', 350, '234567890123', 8, 3],
        ['Casque HyperX Cloud', 600, '345678901234', 3, 2],
        ['Écran Dell 24"', 2500, '789012345678', 2, 1],
        ['Hub USB 3.0', 150, '890123456789', 15, 5],
        ['RAM DDR4 16GB', 800, '567890123456', 10, 3],
        ['SSD Samsung 1TB', 1200, '678901234567', 6, 2],
        ['Webcam Logitech C920', 550, '456789012345', 4, 2]
      ];
      
      for (const product of products) {
        await pool.query(
          'INSERT INTO products (nom, prix_vente, code_barre, stock_quantite, stock_alerte) VALUES ($1, $2, $3, $4, $5)',
          product
        );
      }
      
      console.log('✅ Produits de test créés');
    }

  } catch (error) {
    console.error('❌ Erreur initialisation base de données:', error);
  }
};

// Initialiser au démarrage
initDatabase();

module.exports = pool;