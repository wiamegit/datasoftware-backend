-- Script de création de la base de données BitStore POS
-- À exécuter dans phpMyAdmin ou via la ligne de commande MySQL

-- Créer la base de données si elle n'existe pas
CREATE DATABASE IF NOT EXISTS bitstore_pos;
USE bitstore_pos;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'caissier', 'manager') DEFAULT 'caissier',
  nom VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des produits
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  prix_vente DECIMAL(10,2) NOT NULL,
  code_barre VARCHAR(255) UNIQUE,
  description TEXT,
  stock_quantite INT DEFAULT 0,
  stock_alerte INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table des ventes
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_ttc DECIMAL(10,2) NOT NULL,
  mode_paiement ENUM('CASH', 'CARD', 'TRANSFER') DEFAULT 'CASH',
  amount_received DECIMAL(10,2),
  change_amount DECIMAL(10,2),
  date_vente TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des articles de vente
CREATE TABLE IF NOT EXISTS sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  quantite INT NOT NULL,
  prix_unitaire DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_date ON sales(date_vente);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX idx_products_code_barre ON products(code_barre);

-- Insertion d'un utilisateur administrateur par défaut (mot de passe: admin123)
INSERT IGNORE INTO users (email, password, role, nom) VALUES
('admin@bitstore.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Administrateur');

-- Note: Le mot de passe hashé ci-dessus correspond à 'admin123'
-- Vous pouvez le changer en utilisant le script update-passwords.js
