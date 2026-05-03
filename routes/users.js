const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

// GET /api/users - Récupérer tous les utilisateurs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nom, email, role, created_at FROM users ORDER BY nom'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/users/:id - Récupérer un utilisateur par ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nom, email, role, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/users - Créer un nouvel utilisateur
router.post('/', async (req, res) => {
  const { nom, email, password, role } = req.body;

  if (!nom || !email || !password) {
    return res.status(400).json({ message: 'Nom, email et mot de passe requis' });
  }

  try {
    // Vérifier si l'email existe déjà
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const result = await pool.query(
      'INSERT INTO users (nom, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, nom, email, role',
      [nom, email, hashedPassword, role || 'CAISSIER']
    );

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur création utilisateur:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/users/:id - Mettre à jour un utilisateur
router.put('/:id', async (req, res) => {
  const { nom, email, password, role } = req.body;

  if (!nom || !email) {
    return res.status(400).json({ message: 'Nom et email requis' });
  }

  try {
    // Si un nouveau mot de passe est fourni, le hasher
    let query, params;
    
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET nom = $1, email = $2, password = $3, role = $4 WHERE id = $5 RETURNING id, nom, email, role';
      params = [nom, email, hashedPassword, role || 'CAISSIER', req.params.id];
    } else {
      query = 'UPDATE users SET nom = $1, email = $2, role = $3 WHERE id = $4 RETURNING id, nom, email, role';
      params = [nom, email, role || 'CAISSIER', req.params.id];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json({
      message: 'Utilisateur mis à jour avec succès',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/users/:id - Supprimer un utilisateur
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;