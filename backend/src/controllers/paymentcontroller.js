const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Transaction, User } = require('../models');
const { enforceLimits } = require('../middleware/limits');
const { v4: uuidv4 } = require('uuid');

// helper to build a receipt
function buildReceipt({ sender, senderAccount, receiver, receiverAccount, receiverBank, amount, currency, reference }) {
  return {
    sender_name: sender,
    sender_account: senderAccount,
    reference_id: reference,
    date_time: new Date().toISOString(),
    receiver_name: receiver,
    receiver_account: receiverAccount,
    receiver_bank: receiverBank,
    session_id: uuidv4(),
    amount,
    currency
  };
}

// Bank transfer endpoint (debited from user's selected currency)
// This is a simplified flow: convert amounts client-side or server-side using ratesService and then call Flutterwave transfers.
router.post('/transfer/bank', enforceLimits, async (req, res) => {
  try {
    const { userId, fromCurrency, amount, toAccountNumber, toBankCode } = req.body;
    if (!userId || !amount || !toAccountNumber || !toBankCode) return res.status(400).json({ error: 'missing_parameters' });

    // Lookup user
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    // Create transaction record (pending)
    const reference = 'BTX-' + Date.now();
    const tx = await Transaction.create({
      userId,
      type: 'bank_transfer',
      amount,
      currency: fromCurrency || 'NGN',
      status: 'pending',
      referenceId: reference,
      meta: {}
    });

    // Build Flutterwave transfer payload (example). Adapt to actual partner payload & flow (you may need to create transfer recipient first).
    const body = {
      account_bank: toBankCode,
      account_number: toAccountNumber,
      amount: Number(amount),
      narration: `Transfer to ${toAccountNumber}`,
      currency: fromCurrency || 'NGN',
      reference
    };

    const resp = await axios.post('https://api.flutterwave.com/v3/transfers', body, {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' }
    });

    // On success, update tx and user balances (simplified)
    const success = resp.data && (resp.data.status === 'success' || resp.status === 200);
    tx.status = success ? 'success' : 'failed';
    tx.meta = { provider_response: resp.data };
    await tx.save();

    // Deduct from user's balance (server-side conversion not handled here)
    const balances = user.balances || {};
    const cur = (fromCurrency || 'NGN').toUpperCase();
    balances[cur] = (Number(balances[cur] || 0) - Number(amount));
    user.balances = balances;
    await user.save();

    // Resolve receiver name (optional) — we can fetch using bank resolve endpoint if needed
    const receipt = buildReceipt({
      sender: user.fullName,
      senderAccount: '***', // you may implement actual account numbers per user
      receiver: resp.data.data?.account_name || 'Receiver',
      receiverAccount: toAccountNumber,
      receiverBank: toBankCode,
      amount,
      currency: cur,
      reference
    });

    res.json({ success: true, transfer: resp.data, receipt });
  } catch (err) {
    console.error('transfer error', err?.response?.data || err.message);
    res.status(500).json({ error: 'transfer_failed', details: err?.response?.data || err.message });
  }
});

// Crypto send endpoint (unlimited per your requirement) — logs tx
router.post('/crypto/send', async (req, res) => {
  try {
    const { userId, asset, amount, toAddress } = req.body;
    if (!userId || !asset || !amount || !toAddress) return res.status(400).json({ error: 'missing_parameters' });

    const reference = 'CR-' + Date.now();
    const tx = await Transaction.create({
      userId,
      type: 'crypto_send',
      amount,
      currency: asset.toUpperCase(),
      status: 'pending',
      referenceId: reference,
      meta: { toAddress }
    });

    // NOTE: actual on-chain transfer requires custody; here we only log and return a reference.
    tx.status = 'success';
    await tx.save();

    res.json({ success: true, reference, tx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'crypto_send_failed' });
  }
});

module.exports = router;
