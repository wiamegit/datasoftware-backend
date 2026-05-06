const express = require('express');
const router = express.Router();
const pool = require('../config/db');

async function genererNumero() {
  const year = new Date().getFullYear().toString().slice(2);
  const result = await pool.query(
    `SELECT MAX(CAST(SPLIT_PART(numero, '/', 1) AS INTEGER)) as max_num FROM devis WHERE numero LIKE '%/4${year}'`
  );
  const maxNum = result.rows[0].max_num || 0;
  const count = maxNum + 1;
  const numero = String(count).padStart(3, '0');
  return `${numero}/4${year}`;
}

module.exports = router;
