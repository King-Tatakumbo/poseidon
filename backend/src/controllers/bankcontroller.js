const express = require('express');
const router = express.Router();
const banks = require('../data/nigeria_banks.json');
const axios = require('axios');

// Search banks for dropdown (q param)
router.get('/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const results = banks.filter(b => b.name.toLowerCase().includes(q) || b.code === q || b.slug.includes(q)).slice(0, 50);
  res.json(results);
});

// Resolve account — uses Flutterwave resolve endpoint
router.get('/resolve-account', async (req, res) => {
  try {
    const { account_number, account_bank } = req.query;
    if (!account_number || !account_bank) return res.status(400).json({ error: 'account_number & account_bank required' });

    const resp = await axios.get(
      `https://api.flutterwave.com/v3/accounts/resolve?account_number=${encodeURIComponent(account_number)}&account_bank=${encodeURIComponent(account_bank)}`,
      { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
    );

    // Forward Flutterwave response as-is
    res.json(resp.data);
  } catch (err) {
    console.error('resolve-account error', err?.response?.data || err.message);
    res.status(500).json({ error: 'resolve_failed', details: err?.response?.data || err.message });
  }
});

module.exports = router;
