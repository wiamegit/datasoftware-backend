const db = require('./config/db');

async function addSampleProducts() {
  try {
    console.log('📦 Ajout de produits de test...\n');

    const products = [
      { nom: 'Clavier Gaming RGB', prix_vente: 450, code_barre: '1234567890123', description: 'Clavier mécanique RGB avec rétroéclairage', stock_quantite: 5, stock_alerte: 2 },
      { nom: 'Souris Logitech G502', prix_vente: 350, code_barre: '2345678901234', description: 'Souris gaming haute précision', stock_quantite: 8, stock_alerte: 3 },
      { nom: 'Casque HyperX Cloud', prix_vente: 600, code_barre: '3456789012345', description: 'Casque gaming avec microphone', stock_quantite: 3, stock_alerte: 2 },
      { nom: 'SSD Samsung 1TB', prix_vente: 1200, code_barre: '4567890123456', description: 'SSD NVMe 1To haute vitesse', stock_quantite: 12, stock_alerte: 5 },
      { nom: 'RAM DDR4 16GB', prix_vente: 800, code_barre: '5678901234567', description: 'Barrette mémoire DDR4 16Go', stock_quantite: 10, stock_alerte: 3 },
      { nom: 'Webcam Logitech C920', prix_vente: 550, code_barre: '6789012345678', description: 'Webcam Full HD 1080p', stock_quantite: 4, stock_alerte: 2 },
      { nom: 'Écran Dell 24"', prix_vente: 2500, code_barre: '7890123456789', description: 'Écran Full HD 24 pouces', stock_quantite: 2, stock_alerte: 1 },
      { nom: 'Hub USB 3.0', prix_vente: 150, code_barre: '8901234567890', description: 'Hub USB 3.0 4 ports', stock_quantite: 15, stock_alerte: 5 }
    ];

    for (const product of products) {
      await db.query(
        `INSERT INTO products (nom, prix_vente, code_barre, description, stock_quantite, stock_alerte)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         nom = VALUES(nom),
         prix_vente = VALUES(prix_vente),
         description = VALUES(description),
         stock_quantite = VALUES(stock_quantite),
         stock_alerte = VALUES(stock_alerte)`,
        [product.nom, product.prix_vente, product.code_barre, product.description, product.stock_quantite, product.stock_alerte]
      );
      console.log(`✅ ${product.nom} - ${product.prix_vente} MAD`);
    }

    console.log('\n🎉 Produits ajoutés avec succès !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

addSampleProducts();