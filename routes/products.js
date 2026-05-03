const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/products - Récupérer tous les produits AVEC les noms de catégories
router.get('/', async (req, res) => {
  console.log('GET /api/products');
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        c.nom as category_nom
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.nom
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur récupération produits:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/products/search - Rechercher un produit
router.get('/search', async (req, res) => {
  const query = req.query.q;
  
  console.log('=== RECHERCHE PRODUIT ===');
  console.log('Query reçue:', query);

  if (!query) {
    return res.status(400).json({ message: 'Paramètre de recherche manquant' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE code_barre = $1 OR nom ILIKE $2 LIMIT 10',
      [query, `%${query}%`]
    );

    console.log('Produits trouvés:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur recherche produit:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/products/:id - Récupérer un produit par ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log('GET /api/products/' + id);

  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur récupération produit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/products - Créer un nouveau produit
router.post('/', async (req, res) => {
  const { nom, prix_vente, code_barre, description, stock_quantite, stock_alerte, category_id } = req.body;
  
  console.log('POST /api/products - Données reçues:', req.body);

  if (!nom || !prix_vente) {
    return res.status(400).json({ message: 'Nom et prix requis' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO products (nom, prix_vente, code_barre, description, stock_quantite, stock_alerte, category_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [nom, prix_vente, code_barre || null, description || null, stock_quantite || 0, stock_alerte || 0, category_id || null]
    );

    console.log('✅ Produit créé avec ID:', result.rows[0].id);
    res.status(201).json({
      message: 'Produit créé avec succès',
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('❌ Erreur création produit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/products/:id - Mettre à jour un produit
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nom, prix_vente, code_barre, description, stock_quantite, stock_alerte, category_id } = req.body;
  
  console.log('PUT /api/products/' + id + ' - Données reçues:', req.body);

  if (!nom || !prix_vente) {
    return res.status(400).json({ message: 'Nom et prix requis' });
  }

  try {
    const result = await pool.query(
      'UPDATE products SET nom = $1, prix_vente = $2, code_barre = $3, description = $4, stock_quantite = $5, stock_alerte = $6, category_id = $7 WHERE id = $8',
      [nom, prix_vente, code_barre || null, description || null, stock_quantite || 0, stock_alerte || 0, category_id || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    console.log('✅ Produit mis à jour:', id);
    res.json({ message: 'Produit mis à jour avec succès' });
  } catch (error) {
    console.error('❌ Erreur mise à jour produit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/products/:id - Supprimer un produit
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log('DELETE /api/products/' + id);

  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    console.log('✅ Produit supprimé:', id);
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    console.error('❌ Erreur suppression produit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;