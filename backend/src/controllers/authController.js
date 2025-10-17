const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { v4: uuidv4 } = require('uuid');

router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ error: 'fullName, email & password required' });

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'email_taken' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ fullName, email, phone, passwordHash: hash });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '30d' });

    res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, balances: user.balances } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'signup_failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'invalid_credentials' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, balances: user.balances } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'login_failed' });
  }
});

module.exports = router;
