const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/products - Récupérer tous les produits
router.get('/', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products ORDER BY nom');
    res.json(products);
  } catch (error) {
    console.error('❌ Erreur récupération produits:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/products/search - Rechercher un produit
router.get('/search', async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ message: 'Paramètre de recherche manquant' });
  }

  console.log('🔍 Recherche produit:', query);

  try {
    const [products] = await db.query(
      'SELECT * FROM products WHERE code_barre = ? OR nom LIKE ? LIMIT 10',
      [query, `%${query}%`]
    );

    console.log('✅ Produits trouvés:', products.length);
    res.json(products);
  } catch (error) {
    console.error('❌ Erreur recherche produit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/products/:id - Récupérer un produit par ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [products] = await db.query('SELECT * FROM products WHERE id = ?', [id]);

    if (products.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    res.json(products[0]);
  } catch (error) {
    console.error('❌ Erreur récupération produit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/products - Créer un nouveau produit
router.post('/', async (req, res) => {
  const { nom, prix_vente, code_barre, description, stock_quantite, stock_alerte } = req.body;

  if (!nom || !prix_vente) {
    return res.status(400).json({ message: 'Nom et prix requis' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO products (nom, prix_vente, code_barre, description, stock_quantite, stock_alerte) VALUES (?, ?, ?, ?, ?, ?)',
      [nom, prix_vente, code_barre || null, description || null, stock_quantite || 0, stock_alerte || 0]
    );

    res.status(201).json({
      message: 'Produit créé avec succès',
      id: result.insertId
    });
  } catch (error) {
    console.error('❌ Erreur création produit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;