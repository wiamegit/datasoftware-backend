const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Générer numéro devis automatique (ex: 096/42026)
async function genererNumero() {
  const result = await pool.query(
    'SELECT COUNT(*) FROM devis WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())'
  );
  const count = parseInt(result.rows[0].count) + 1;
  const year = new Date().getFullYear().toString().slice(2);
  const numero = String(count).padStart(3, '0');
  return `${numero}/4${year}`;
}

// GET tous les devis
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM devis ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET un devis avec ses lignes
router.get('/:id', async (req, res) => {
  try {
    const devis = await pool.query(
      'SELECT * FROM devis WHERE id = $1', [req.params.id]
    );
    const items = await pool.query(
      'SELECT * FROM devis_items WHERE devis_id = $1', [req.params.id]
    );
    res.json({ ...devis.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer un devis
router.post('/', async (req, res) => {
  const {
    client_id, client_nom, client_adresse, client_ice,
    commercial, mode_reglement, echeance, tva, notes, items
  } = req.body;

  try {
    const numero = await genererNumero();

    // Calculs
    const total_ht = items.reduce((sum, item) =>
      sum + (item.quantite * item.prix_unitaire), 0
    );
    const tvaRate = tva || 20;
    const total_tva = total_ht * (tvaRate / 100);
    const total_ttc = total_ht + total_tva;

    // Insérer devis
    const devisResult = await pool.query(
      `INSERT INTO devis 
       (numero, client_id, client_nom, client_adresse, client_ice,
        commercial, mode_reglement, echeance, tva, total_ht, 
        total_tva, total_ttc, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [numero, client_id, client_nom, client_adresse, client_ice,
       commercial, mode_reglement, echeance, tvaRate,
       total_ht, total_tva, total_ttc, notes]
    );

    const devisId = devisResult.rows[0].id;

    // Insérer lignes
    for (const item of items) {
      const montant_ht = item.quantite * item.prix_unitaire;
      await pool.query(
        `INSERT INTO devis_items 
         (devis_id, code_article, designation, quantite, prix_unitaire, montant_ht)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [devisId, item.code_article, item.designation,
         item.quantite, item.prix_unitaire, montant_ht]
      );
    }

    res.status(201).json({ ...devisResult.rows[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT modifier statut
router.put('/:id/statut', async (req, res) => {
  const { statut } = req.body;
  try {
    const result = await pool.query(
      'UPDATE devis SET statut=$1 WHERE id=$2 RETURNING *',
      [statut, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE supprimer devis
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM devis WHERE id=$1', [req.params.id]);
    res.json({ message: 'Devis supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;