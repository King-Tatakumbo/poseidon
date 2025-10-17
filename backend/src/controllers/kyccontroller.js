const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { Kyc, User } = require('../models');

// Tier 1: basic info
router.post('/tier1', async (req, res) => {
  try {
    const { userId, fullName, email, phone, dob } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await Kyc.create({ userId, tier: 1, documents: { fullName, email, phone, dob }, verified: false });
    await User.update({ kycStatus: 'tier1' }, { where: { id: userId } });
    res.json({ success: true, status: 'tier1_staged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'tier1_failed' });
  }
});

// Tier 2: upload id images
router.post('/tier2', upload.fields([{ name: 'id_front' }, { name: 'id_back' }]), async (req, res) => {
  try {
    const { userId, idType } = req.body;
    const docs = {};
    if (req.files['id_front']) docs.id_front = req.files['id_front'][0].path;
    if (req.files['id_back']) docs.id_back = req.files['id_back'][0].path;
    await Kyc.create({ userId, tier: 2, documents: { idType, ...docs }, verified: false });
    await User.update({ kycStatus: 'tier2' }, { where: { id: userId } });
    res.json({ success: true, status: 'tier2_staged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'tier2_failed' });
  }
});

// Tier 3: BVN and facial verification hooks (placeholder)
router.post('/tier3', async (req, res) => {
  try {
    const { userId, bvn } = req.body;
    // You should call BVN verification API here and a facial verification provider
    await Kyc.create({ userId, tier: 3, documents: { bvn }, verified: true });
    await User.update({ kycStatus: 'tier3', bvn }, { where: { id: userId } });
    res.json({ success: true, status: 'tier3_verified' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'tier3_failed' });
  }
});

module.exports = router;
