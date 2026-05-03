const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET tous les fournisseurs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM fournisseurs ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer un fournisseur
router.post('/', async (req, res) => {
  const { nom, telephone, email, adresse, ice } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO fournisseurs (nom, telephone, email, adresse, ice)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nom, telephone, email, adresse, ice]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT modifier un fournisseur
router.put('/:id', async (req, res) => {
  const { nom, telephone, email, adresse, ice } = req.body;
  try {
    const result = await pool.query(
      `UPDATE fournisseurs SET nom=$1, telephone=$2, email=$3,
       adresse=$4, ice=$5 WHERE id=$6 RETURNING *`,
      [nom, telephone, email, adresse, ice, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE supprimer un fournisseur
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM fournisseurs WHERE id = $1', [req.params.id]);
    res.json({ message: 'Fournisseur supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;