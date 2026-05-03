const bcrypt = require('bcrypt');
const db = require('./config/db');

async function updatePasswords() {
  try {
    console.log('🔐 Mise à jour des mots de passe...\n');
    
    // Liste des utilisateurs à mettre à jour
    const users = [
      { email: 'admin@bitstore.com', password: 'admin123' },
      { email: 'caissier@bitstore.com', password: 'caissier123' }
    ];

    for (const user of users) {
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      // Mettre à jour dans la base de données
      await db.query(
        'UPDATE users SET password = ? WHERE email = ?',
        [hashedPassword, user.email]
      );
      
      console.log(`✅ Mot de passe mis à jour pour: ${user.email}`);
    }
    
    console.log('\n📋 Informations de connexion:');
    console.log('──────────────────────────────');
    console.log('Admin:');
    console.log('  Email: admin@bitstore.com');
    console.log('  Mot de passe: admin123');
    console.log('\nCaissier:');
    console.log('  Email: caissier@bitstore.com');
    console.log('  Mot de passe: caissier123');
    console.log('──────────────────────────────\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

updatePasswords();