const bcrypt = require('bcrypt');
const db = require('./config/db');

async function createTestUser() {
  try {
    console.log('🔐 Création d\'un utilisateur de test...');
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    // Vérifier si l'utilisateur existe déjà
    const [existingUsers] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      ['caissier@bitstore.com']
    );

    if (existingUsers.length > 0) {
      console.log('⚠️  L\'utilisateur existe déjà');
      
      // Mettre à jour le mot de passe
      await db.query(
        'UPDATE users SET password = ? WHERE email = ?',
        [hashedPassword, 'caissier@bitstore.com']
      );
      console.log('✅ Mot de passe mis à jour');
    } else {
      // Insérer le nouvel utilisateur
      await db.query(
        'INSERT INTO users (email, password, role, full_name, created_at) VALUES (?, ?, ?, ?, NOW())',
        ['caissier@bitstore.com', hashedPassword, 'caissier', 'Caissier Test']
      );
      console.log('✅ Utilisateur créé avec succès');
    }
    
    console.log('\n📋 Informations de connexion:');
    console.log('   Email: caissier@bitstore.com');
    console.log('   Mot de passe: 123456');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

createTestUser();