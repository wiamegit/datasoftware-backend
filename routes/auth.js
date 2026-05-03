const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// POST /api/auth/login - Connexion utilisateur
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('🔐 Tentative de connexion:', email);

  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      console.log('❌ Utilisateur non trouvé:', email);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log('❌ Mot de passe incorrect pour:', email);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      'votre_secret_jwt_super_secret_123',
      { expiresIn: '24h' }
    );

    console.log('✅ Connexion réussie:', user.nom);

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Erreur login:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;