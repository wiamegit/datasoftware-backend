const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/categories - Récupérer toutes les catégories avec hiérarchie
router.get('/', async (req, res) => {
  try {
    // Récupérer toutes les catégories
    const result = await pool.query(`
      SELECT 
        c.id,
        c.nom,
        c.description,
        c.parent_id,
        COUNT(p.id) as nb_produits
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.nom, c.description, c.parent_id
      ORDER BY c.parent_id NULLS FIRST, c.nom
    `);

    // Organiser en hiérarchie
    const categories = result.rows;
    const hierarchy = [];
    const categoryMap = {};

    // Première passe : créer un map de toutes les catégories
    categories.forEach(cat => {
      categoryMap[cat.id] = { ...cat, children: [] };
    });

    // Deuxième passe : construire la hiérarchie
    categories.forEach(cat => {
      if (cat.parent_id === null) {
        // Catégorie parente
        hierarchy.push(categoryMap[cat.id]);
      } else {
        // Sous-catégorie
        if (categoryMap[cat.parent_id]) {
          categoryMap[cat.parent_id].children.push(categoryMap[cat.id]);
        }
      }
    });

    res.json(hierarchy);
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/categories/flat - Récupérer toutes les catégories (liste plate)
router.get('/flat', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.nom,
        c.description,
        c.parent_id,
        p.nom as parent_nom,
        COUNT(pr.id) as nb_produits
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      LEFT JOIN products pr ON pr.category_id = c.id
      GROUP BY c.id, c.nom, c.description, c.parent_id, p.nom
      ORDER BY c.parent_id NULLS FIRST, c.nom
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/categories/:id - Récupérer une catégorie
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/categories - Créer une catégorie
router.post('/', async (req, res) => {
  try {
    const { nom, description, parent_id } = req.body;

    const result = await pool.query(
      'INSERT INTO categories (nom, description, parent_id) VALUES ($1, $2, $3) RETURNING *',
      [nom, description || null, parent_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/categories/:id - Modifier une catégorie
router.put('/:id', async (req, res) => {
  try {
    const { nom, description, parent_id } = req.body;

    const result = await pool.query(
      'UPDATE categories SET nom = $1, description = $2, parent_id = $3 WHERE id = $4 RETURNING *',
      [nom, description || null, parent_id || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/categories/:id - Supprimer une catégorie
router.delete('/:id', async (req, res) => {
  try {
    // Vérifier s'il y a des produits
    const productsCheck = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
      [req.params.id]
    );

    if (parseInt(productsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer une catégorie contenant des produits' 
      });
    }

    // Vérifier s'il y a des sous-catégories
    const childrenCheck = await pool.query(
      'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1',
      [req.params.id]
    );

    if (parseInt(childrenCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer une catégorie ayant des sous-catégories' 
      });
    }

    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    res.json({ message: 'Catégorie supprimée avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;