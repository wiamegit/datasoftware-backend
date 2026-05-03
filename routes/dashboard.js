const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/dashboard/stats - Statistiques générales
router.get('/stats', async (req, res) => {
  console.log('📊 Récupération des statistiques dashboard');
  
  try {
    // 1. Chiffre d'affaires du mois en cours
    const caJour = await pool.query(`
      SELECT COALESCE(SUM(total_ttc), 0) as ca_jour
      FROM sales
      WHERE DATE_TRUNC('month', date_vente) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // 2. Nombre de ventes du mois en cours
    const ventesJour = await pool.query(`
      SELECT COUNT(*) as nb_ventes
      FROM sales
      WHERE DATE_TRUNC('month', date_vente) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // 3. Nombre total de produits
    const nbProduits = await pool.query(`
      SELECT COUNT(*) as total_produits
      FROM products
    `);

    // 4. Produits en stock faible
    const stocksFaibles = await pool.query(`
      SELECT COUNT(*) as nb_alertes
      FROM products
      WHERE stock_quantite <= stock_alerte
    `);

    const stats = {
      ca_jour: parseFloat(caJour.rows[0].ca_jour || 0),
      nb_ventes: parseInt(ventesJour.rows[0].nb_ventes || 0),
      total_produits: parseInt(nbProduits.rows[0].total_produits || 0),
      nb_alertes: parseInt(stocksFaibles.rows[0].nb_alertes || 0)
    };

    console.log('✅ Statistiques:', stats);
    res.json(stats);

  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/dashboard/top-products - Top 5 produits les plus vendus
router.get('/top-products', async (req, res) => {
  console.log('🔥 Récupération top produits');
  
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.nom,
        SUM(si.quantite) as quantite_vendue,
        SUM(si.subtotal) as total_ventes
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE_TRUNC('month', s.date_vente) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY p.id, p.nom
      ORDER BY quantite_vendue DESC
      LIMIT 5
    `);

    console.log('✅ Top produits:', result.rows.length);
    res.json(result.rows);

  } catch (error) {
    console.error('❌ Erreur top produits:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/dashboard/low-stock - Produits en stock faible
router.get('/low-stock', async (req, res) => {
  console.log('⚠️ Récupération stocks faibles');
  
  try {
    const result = await pool.query(`
      SELECT 
        id,
        nom,
        stock_quantite,
        stock_alerte
      FROM products
      WHERE stock_quantite <= stock_alerte
      ORDER BY stock_quantite ASC
      LIMIT 10
    `);

    console.log('✅ Stocks faibles:', result.rows.length);
    res.json(result.rows);

  } catch (error) {
    console.error('❌ Erreur stocks faibles:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/dashboard/sales-chart - Ventes des 30 derniers jours
router.get('/sales-chart', async (req, res) => {
  console.log('📈 Récupération données graphique');
  
  try {
    const result = await pool.query(`
      SELECT 
        DATE(date_vente) as date,
        COUNT(*) as nb_ventes,
        SUM(total_ttc) as ca
      FROM sales
      WHERE date_vente >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(date_vente)
      ORDER BY date ASC
    `);

    console.log('✅ Données graphique:', result.rows.length, 'jours');
    res.json(result.rows);

  } catch (error) {
    console.error('❌ Erreur graphique:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
// Ventes par jour sur 30 jours
router.get('/ventes-30j', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        DATE(date_vente) as jour,
        COUNT(*) as nb_ventes,
        COALESCE(SUM(total_ttc), 0) as ca
      FROM sales
      WHERE date_vente >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(date_vente)
      ORDER BY jour ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Répartition par catégorie
router.get('/ventes-categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.nom as categorie,
        COUNT(si.id) as nb_ventes,
        COALESCE(SUM(si.quantite * si.prix_unitaire), 0) as ca
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.date_vente >= NOW() - INTERVAL '30 days'
      GROUP BY c.nom
      ORDER BY ca DESC
      LIMIT 6
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Comparaison mois actuel vs mois précédent
router.get('/comparaison-mois', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', date_vente), 'Month YYYY') as mois,
        COUNT(*) as nb_ventes,
        COALESCE(SUM(total_ttc), 0) as ca
      FROM sales
      WHERE date_vente >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
      GROUP BY DATE_TRUNC('month', date_vente)
      ORDER BY DATE_TRUNC('month', date_vente) ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Top 5 produits
router.get('/top-produits-30j', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.nom,
        SUM(si.quantite) as total_vendu,
        SUM(si.quantite * si.prix_unitaire) as ca
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.date_vente >= NOW() - INTERVAL '30 days'
      GROUP BY p.nom
      ORDER BY total_vendu DESC
      LIMIT 5
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});