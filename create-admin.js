const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bitstore_pos',
  password: 'votre_mot_de_passe_postgres', // ⚠️ Remplacez par votre mot de passe pgAdmin
  port: 5432,
});

async function createAdmin() {
  try {
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Insérer l'utilisateur
    const result = await pool.query(
      `INSERT INTO users (nom, email, password, role, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       ON CONFLICT (email) DO NOTHING
       RETURNING id, nom, email, role`,
      ['Administrateur', 'admin@datasoftware.com', hashedPassword, 'ADMIN']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Utilisateur admin créé avec succès !');
      console.log(result.rows[0]);
    } else {
      console.log('ℹ️  L\'utilisateur existe déjà');
    }
    
    // Créer aussi le caissier
    const hashedPassword2 = await bcrypt.hash('caissier123', 10);
    await pool.query(
      `INSERT INTO users (nom, email, password, role, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       ON CONFLICT (email) DO NOTHING`,
      ['Caissier', 'caissier@datasoftware.com', hashedPassword2, 'CASHIER']
    );
    
    console.log('✅ Utilisateur caissier créé avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    pool.end();
  }
}

createAdmin();