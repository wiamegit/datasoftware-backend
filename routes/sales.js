const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// POST /api/sales - Enregistrer une nouvelle vente
router.post('/', async (req, res) => {
  const { user_id, items, total_ttc, mode_paiement, amount_received, change_amount } = req.body;

  if (!user_id || !items || items.length === 0 || !total_ttc) {
    return res.status(400).json({ message: 'Données de vente incomplètes' });
  }

  console.log('💳 Nouvelle vente:', { user_id, items, total_ttc, mode_paiement, amount_received, change_amount });

  const client = await pool.connect();

  try {
    // Démarrer une transaction
    await client.query('BEGIN');

    // 1. Insérer la vente
    const saleResult = await client.query(
      'INSERT INTO sales (user_id, total_ttc, mode_paiement, amount_received, change_amount, date_vente) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id',
      [user_id, total_ttc, mode_paiement || 'CASH', amount_received || total_ttc, change_amount || 0]
    );

    const saleId = saleResult.rows[0].id;

    // 2. Insérer les articles de la vente et mettre à jour les stocks
    for (const item of items) {
      // Le frontend envoie "quantite" pas "quantity"
      const quantity = item.quantite || item.quantity;
      
      await client.query(
        'INSERT INTO sale_items (sale_id, product_id, quantite, prix_unitaire, subtotal) VALUES ($1, $2, $3, $4, $5)',
        [saleId, item.product_id, quantity, item.prix_unitaire, item.subtotal]
      );

      await client.query(
        'UPDATE products SET stock_quantite = stock_quantite - $1 WHERE id = $2',
        [quantity, item.product_id]
      );
    }

    // Valider la transaction
    await client.query('COMMIT');

    console.log('✅ Vente enregistrée avec succès, ID:', saleId);

    res.status(201).json({
      message: 'Vente enregistrée avec succès',
      sale_id: saleId,
      total: total_ttc,
      mode_paiement: mode_paiement,
      rendu: change_amount
    });

  } catch (error) {
    // Annuler la transaction en cas d'erreur
    await client.query('ROLLBACK');
    console.error('❌ Erreur enregistrement vente:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  } finally {
    client.release();
  }
});

// GET /api/sales - Récupérer toutes les ventes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.nom 
      FROM sales s 
      JOIN users u ON s.user_id = u.id 
      ORDER BY s.date_vente DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Erreur récupération ventes:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/sales/:id - Récupérer une vente avec ses articles
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const saleResult = await pool.query(
      'SELECT s.*, u.nom FROM sales s JOIN users u ON s.user_id = u.id WHERE s.id = $1',
      [id]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ message: 'Vente non trouvée' });
    }

    const itemsResult = await pool.query(`
      SELECT si.*, p.nom 
      FROM sale_items si 
      JOIN products p ON si.product_id = p.id 
      WHERE si.sale_id = $1
    `, [id]);

    res.json(itemsResult.rows);

  } catch (error) {
    console.error('❌ Erreur récupération vente:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;