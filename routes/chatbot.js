const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const axios = require('axios');

async function getLiveContext() {
  try {
    const statsResult = await pool.query(`
      SELECT COUNT(*) as nb_ventes, COALESCE(SUM(total_ttc), 0) as ca_jour
      FROM sales WHERE DATE(date_vente) = CURRENT_DATE
    `);

    const lowStockResult = await pool.query(`
      SELECT p.nom, p.stock_quantite, p.stock_alerte, c.nom as categorie
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.stock_quantite <= p.stock_alerte ORDER BY p.stock_quantite ASC LIMIT 10
    `);

    const topProductsResult = await pool.query(`
      SELECT p.nom, SUM(si.quantite) as total_vendu
      FROM sale_items si JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.date_vente >= NOW() - INTERVAL '7 days'
      GROUP BY p.nom ORDER BY total_vendu DESC LIMIT 5
    `);

    const inventoryResult = await pool.query(`
      SELECT COUNT(*) as total_produits, SUM(stock_quantite) as stock_total 
      FROM products
    `);

    const paymentResult = await pool.query(`
      SELECT mode_paiement, COUNT(*) as nb, SUM(total_ttc) as montant
      FROM sales WHERE DATE(date_vente) = CURRENT_DATE 
      GROUP BY mode_paiement
    `);

    const allProductsResult = await pool.query(`
      SELECT p.nom, p.prix_vente, p.stock_quantite, p.stock_alerte, 
             p.code_barre, c.nom as categorie
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY c.nom, p.nom
    `);

    const salesDetailResult = await pool.query(`
      SELECT p.nom, 
             SUM(si.quantite) as total_vendu_30j,
             SUM(si.prix_unitaire * si.quantite) as ca_30j
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.date_vente >= NOW() - INTERVAL '30 days'
      GROUP BY p.nom
      ORDER BY total_vendu_30j DESC
    `);

    const recentSalesResult = await pool.query(`
      SELECT s.id, s.total_ttc, s.mode_paiement, s.date_vente,
             u.nom as caissier,
             COUNT(si.id) as nb_articles
      FROM sales s
      JOIN users u ON s.user_id = u.id
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.date_vente >= NOW() - INTERVAL '7 days'
      GROUP BY s.id, s.total_ttc, s.mode_paiement, s.date_vente, u.nom
      ORDER BY s.date_vente DESC
      LIMIT 10
    `);

    return {
      stats_jour: statsResult.rows[0],
      produits_alerte: lowStockResult.rows,
      top_produits_7j: topProductsResult.rows,
      inventaire: inventoryResult.rows[0],
      paiements_jour: paymentResult.rows,
      tous_produits: allProductsResult.rows,
      ventes_30j: salesDetailResult.rows,
      ventes_recentes: recentSalesResult.rows
    };
  } catch (error) {
    console.error('Erreur contexte BDD:', error);
    return null;
  }
}

function buildFallbackReply(context, message) {
  if (!context) {
    return 'Je suis temporairement indisponible. Veuillez réessayer dans quelques minutes.';
  }

  const msg = message.toLowerCase();

  if (msg.includes('stock') || msg.includes('produit') || msg.includes('inventaire')) {
    const alertes = context.produits_alerte || [];
    const ruptures = alertes.filter(p => parseInt(p.stock_quantite) === 0);
    const faibles = alertes.filter(p => parseInt(p.stock_quantite) > 0);

    let reply = `📦 **Résumé du stock actuel**\n\n`;
    reply += `• Total produits : ${context.inventaire?.total_produits || 0}\n`;
    reply += `• Total unités en stock : ${context.inventaire?.stock_total || 0}\n\n`;

    if (ruptures.length > 0) {
      reply += `🔴 **Ruptures de stock :**\n`;
      ruptures.forEach(p => {
        reply += `• ${p.nom} [${p.categorie}] — 0 unité\n`;
      });
      reply += '\n';
    }

    if (faibles.length > 0) {
      reply += `⚠️ **Stock faible :**\n`;
      faibles.forEach(p => {
        reply += `• ${p.nom} [${p.categorie}] — ${p.stock_quantite} unité(s) (seuil: ${p.stock_alerte})\n`;
      });
    }

    if (alertes.length === 0) {
      reply += '✅ Tous les produits ont un stock suffisant.';
    }
    return reply;
  }

  if (msg.includes('vente') || msg.includes('chiffre') || msg.includes('ca') || msg.includes('aujourd')) {
    const stats = context.stats_jour;
    const paiements = context.paiements_jour || [];

    let reply = `📊 **Ventes du jour**\n\n`;
    reply += `• Nombre de ventes : ${stats?.nb_ventes || 0}\n`;
    reply += `• Chiffre d'affaires : ${parseFloat(stats?.ca_jour || 0).toFixed(2)} MAD\n\n`;

    if (paiements.length > 0) {
      reply += `💳 **Modes de paiement :**\n`;
      paiements.forEach(p => {
        reply += `• ${p.mode_paiement} : ${p.nb} vente(s) → ${parseFloat(p.montant).toFixed(2)} MAD\n`;
      });
    } else {
      reply += '📭 Aucune vente enregistrée aujourd\'hui.';
    }
    return reply;
  }

  if (msg.includes('top') || msg.includes('meilleur') || msg.includes('populaire')) {
    const top = context.top_produits_7j || [];

    if (top.length === 0) {
      return '📊 Aucune vente enregistrée cette semaine.';
    }

    let reply = `🏆 **Top produits (7 derniers jours)**\n\n`;
    top.forEach((p, i) => {
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      reply += `${medals[i] || `${i + 1}.`} ${p.nom} — ${p.total_vendu} vendu(s)\n`;
    });
    return reply;
  }

  if (msg.includes('alert') || msg.includes('commander') || msg.includes('priorité')) {
    const alertes = context.produits_alerte || [];

    if (alertes.length === 0) {
      return '✅ Aucune alerte de stock. Tous les produits sont bien approvisionnés !';
    }

    let reply = `⚠️ **Produits à commander en priorité**\n\n`;
    alertes.forEach((p, i) => {
      const urgence = parseInt(p.stock_quantite) === 0 ? '🔴 URGENT' : '🟡 Attention';
      reply += `${i + 1}. ${urgence} — ${p.nom}\n`;
      reply += `   Stock : ${p.stock_quantite} unité(s) | Seuil : ${p.stock_alerte}\n\n`;
    });
    return reply;
  }

  const stats = context.stats_jour;
  const alertes = context.produits_alerte || [];
  return `👋 **Bonjour ! Voici un résumé rapide :**\n\n` +
    `📊 Ventes du jour : ${stats?.nb_ventes || 0} vente(s) | ${parseFloat(stats?.ca_jour || 0).toFixed(2)} MAD\n` +
    `📦 Stock total : ${context.inventaire?.stock_total || 0} unités (${context.inventaire?.total_produits || 0} produits)\n` +
    `⚠️ Alertes stock : ${alertes.length} produit(s)\n\n` +
    `💡 Vous pouvez me demander :\n` +
    `• "État du stock"\n• "Ventes du jour"\n• "Top produits"\n• "Alertes stock"`;
}

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Message requis' });

  const context = await getLiveContext();

  const systemPrompt = `Tu es DataBot, un assistant intelligent pour le logiciel de Point de Vente "DataSoftware POS", utilisé par un magasin informatique au Maroc. Tu réponds en français, de manière concise et professionnelle.

DONNÉES EN TEMPS RÉEL (${new Date().toLocaleDateString('fr-FR')}) :

📊 VENTES DU JOUR :
- Nombre de ventes : ${context?.stats_jour?.nb_ventes || 0}
- Chiffre d'affaires : ${parseFloat(context?.stats_jour?.ca_jour || 0).toFixed(2)} MAD
- Modes de paiement : ${context?.paiements_jour?.map(p => `${p.mode_paiement}: ${p.nb} vente(s) → ${parseFloat(p.montant).toFixed(2)} MAD`).join(', ') || 'Aucune vente'}

📦 INVENTAIRE COMPLET :
${context?.tous_produits?.map(p =>
  `- ${p.nom} [${p.categorie}] : ${p.stock_quantite} unités (seuil: ${p.stock_alerte}) | Prix: ${parseFloat(p.prix_vente).toFixed(2)} MAD`
).join('\n') || '- Aucun produit'}

📈 VENTES PAR PRODUIT (30 derniers jours) :
${context?.ventes_30j?.length > 0
  ? context.ventes_30j.map(p =>
      `- ${p.nom} : ${p.total_vendu_30j} unités vendues → ${parseFloat(p.ca_30j).toFixed(2)} MAD`
    ).join('\n')
  : '- Aucune vente ce mois'}

⚠️ PRODUITS EN STOCK FAIBLE :
${context?.produits_alerte?.length > 0
  ? context.produits_alerte.map(p =>
      `- ${p.nom} [${p.categorie}] : ${p.stock_quantite} unités (seuil: ${p.stock_alerte})`
    ).join('\n')
  : '- Aucun produit en alerte'}

🏆 TOP 5 PRODUITS (7 derniers jours) :
${context?.top_produits_7j?.length > 0
  ? context.top_produits_7j.map((p, i) =>
      `${i + 1}. ${p.nom} : ${p.total_vendu} unités vendues`
    ).join('\n')
  : '- Données insuffisantes'}

🕐 VENTES RÉCENTES :
${context?.ventes_recentes?.length > 0
  ? context.ventes_recentes.map(s =>
      `- Ticket #${s.id} | ${new Date(s.date_vente).toLocaleDateString('fr-FR')} | ${parseFloat(s.total_ttc).toFixed(2)} MAD | ${s.mode_paiement} | Caissier: ${s.caissier}`
    ).join('\n')
  : '- Aucune vente récente'}

TOTAL STOCK : ${context?.inventaire?.stock_total || 0} unités | ${context?.inventaire?.total_produits || 0} produits

INSTRUCTIONS :
- Réponds précisément aux questions sur les stocks et les ventes
- Pour les questions générales (prix iPhone, conseils tech, etc.), réponds avec tes connaissances générales
- Suggère des actions concrètes
- Réponds toujours en français`;

  try {
    console.log('🤖 Appel Groq API...');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        max_tokens: 1024,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const reply = response.data.choices[0]?.message?.content
      || 'Désolé, je n\'ai pas pu générer une réponse.';

    console.log('✅ Réponse Groq obtenue !');
    return res.json({ reply });

  } catch (groqError) {
    const code = groqError.response?.data?.error?.code;
    const msg = groqError.response?.data?.error?.message;
    console.log(`❌ Groq échoué (code: ${code}) - ${msg?.substring(0, 100)}`);

    // Fallback SQL direct sans Gemini
    console.log('🔄 Utilisation du fallback SQL...');
    const fallbackReply = buildFallbackReply(context, message);
    return res.json({ reply: fallbackReply });
  }
});

module.exports = router;