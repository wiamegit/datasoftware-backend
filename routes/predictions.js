const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const axios = require('axios');

router.get('/', async (req, res) => {
  try {
    console.log('📊 Début récupération données...');

    const produitsResult = await pool.query(`
      SELECT p.nom, p.stock_quantite, p.stock_alerte,
             COALESCE(v.total_vendu_30j, 0) as total_vendu_30j,
             COALESCE(v.total_vendu_30j, 0) / 30.0 as moyenne_jour
      FROM products p
      LEFT JOIN (
        SELECT si.product_id,
               SUM(si.quantite) as total_vendu_30j
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.date_vente >= NOW() - INTERVAL '30 days'
        GROUP BY si.product_id
      ) v ON v.product_id = p.id
      ORDER BY total_vendu_30j DESC
      LIMIT 10
    `);
    console.log('✅ Produits OK:', produitsResult.rows.length);

    const tendancesResult = await pool.query(`
      SELECT p.nom,
        COALESCE(SUM(CASE 
          WHEN s.date_vente >= NOW() - INTERVAL '15 days' 
          THEN si.quantite ELSE 0 END), 0) as recent,
        COALESCE(SUM(CASE 
          WHEN s.date_vente BETWEEN NOW() - INTERVAL '30 days' 
          AND NOW() - INTERVAL '15 days' 
          THEN si.quantite ELSE 0 END), 0) as ancien
      FROM products p
      LEFT JOIN sale_items si ON si.product_id = p.id
      LEFT JOIN sales s ON si.sale_id = s.id
        AND s.date_vente >= NOW() - INTERVAL '30 days'
      GROUP BY p.id, p.nom
      ORDER BY p.nom
      LIMIT 10
    `);
    console.log('✅ Tendances OK:', tendancesResult.rows.length);

    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT s.id) as nb_ventes_30j,
        COALESCE(SUM(s.total_ttc), 0) as ca_30j
      FROM sales s
      WHERE s.date_vente >= NOW() - INTERVAL '30 days'
    `);
    console.log('✅ Stats OK');

    const alertesResult = await pool.query(`
      SELECT COUNT(*) as nb_alertes
      FROM products WHERE stock_quantite <= stock_alerte
    `);
    console.log('✅ Alertes OK');

    const produits = produitsResult.rows;
    const tendances = tendancesResult.rows;
    const stats = statsResult.rows[0];
    const nbAlertes = alertesResult.rows[0].nb_alertes;

    console.log('🤖 Appel Gemini 2.5 Flash...');

    const prompt = `Tu es un expert en gestion de stock pour un magasin informatique au Maroc.
Analyse ces données et génère des prédictions de stock.

PRODUITS ET VENTES (30 derniers jours) :
${produits.map(p =>
  `- ${p.nom} : stock=${p.stock_quantite} | seuil=${p.stock_alerte} | vendu_30j=${p.total_vendu_30j} | moy/jour=${parseFloat(p.moyenne_jour).toFixed(1)}`
).join('\n')}

TENDANCES :
${tendances.filter(p => parseInt(p.recent) > 0 || parseInt(p.ancien) > 0).map(p => {
  const recent = parseInt(p.recent);
  const ancien = parseInt(p.ancien);
  const tendance = recent > ancien ? 'hausse' : recent < ancien ? 'baisse' : 'stable';
  return `- ${p.nom} : ${tendance} (${ancien} -> ${recent})`;
}).join('\n') || '- Pas de ventes recentes'}

STATS : ventes=${stats.nb_ventes_30j} | CA=${parseFloat(stats.ca_30j).toFixed(2)} MAD | alertes=${nbAlertes}

Reponds UNIQUEMENT avec ce JSON valide, sans texte avant ou apres, sans backticks :
{"resume":"2 phrases sur la situation","predictions":[{"produit":"nom","risque":"eleve","jours_restants":5,"message":"explication","action":"action"}],"conseil_general":"conseil"}

Maximum 5 produits. JSON uniquement.`;

    try {
      console.log('🤖 Essai modèle: gemini-2.5-flash');

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.2
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );

      let texte = response.data.candidates[0]?.content?.parts[0]?.text || '';
      console.log('📝 Réponse brute:', texte.substring(0, 500));

      // Nettoyer le JSON
      texte = texte.replace(/```json/g, '').replace(/```/g, '').trim();

      // Extraire le JSON si du texte parasite est présent
      const jsonMatch = texte.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        texte = jsonMatch[0];
      }

      const resultat = JSON.parse(texte);
      console.log('✅ Prédictions générées avec succès !');
      return res.json(resultat);

    } catch (error) {
      console.log('❌ Gemini 2.5 Flash échoué:', 
        error.response?.data?.error?.message || error.message);
      
      // Retourner des prédictions basées sur les données SQL sans IA
      console.log('🔄 Génération prédictions manuelles...');
      
      const predictionsManuel = produits
        .filter(p => p.stock_quantite <= p.stock_alerte * 2)
        .slice(0, 5)
        .map(p => {
          const stock = parseInt(p.stock_quantite);
          const moy = parseFloat(p.moyenne_jour) || 0.1;
          const joursRestants = moy > 0 ? Math.floor(stock / moy) : 99;
          const risque = stock === 0 ? 'élevé' 
            : stock <= p.stock_alerte ? 'élevé' 
            : 'moyen';
          return {
            produit: p.nom,
            risque: risque,
            jours_restants: joursRestants,
            message: stock === 0 
              ? 'Rupture de stock totale' 
              : `Stock de ${stock} unités, sous le seuil d'alerte de ${p.stock_alerte}`,
            action: stock === 0 
              ? 'Commander immédiatement' 
              : 'Passer commande dans les prochains jours'
          };
        });

      return res.json({
        resume: `Le magasin a ${nbAlertes} produit(s) en alerte stock. ${stats.nb_ventes_30j} ventes effectuées ce mois pour un CA de ${parseFloat(stats.ca_30j).toFixed(2)} MAD.`,
        predictions: predictionsManuel,
        conseil_general: 'Vérifiez régulièrement les niveaux de stock et passez vos commandes fournisseurs en avance pour éviter les ruptures.'
      });
    }

  } catch (dbError) {
    console.error('❌ Erreur base de données:', dbError.message);
    return res.status(500).json({
      error: 'Erreur base de données',
      details: dbError.message
    });
  }
});

module.exports = router;