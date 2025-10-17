// backend/src/controllers/paymentController.js
'use strict';

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { sequelize, User, Transaction } = require('../models'); // models/index.js must export these
const { enforceLimits } = require('../middleware/limits');

const FLW_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.FLW_WEBHOOK_SECRET || null;

// helper: numeric safe parse
function toNumber(v) {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

// helper: build receipt
function buildReceipt({ sender, senderAccount, receiver, receiverAccount, receiverBank, amount, currency, reference, status }) {
  return {
    sender_name: sender,
    sender_account: senderAccount,
    reference_id: reference,
    date_time: new Date().toISOString(),
    receiver_name: receiver,
    receiver_account: receiverAccount,
    receiver_bank: receiverBank,
    session_id: uuidv4(),
    amount: Number(amount),
    currency,
    status
  };
}

/**
 * POST /api/payments/transfer
 * Body:
 * {
 *   senderId,            // required
 *   receiverId,          // optional (internal user)
 *   toAccountNumber,     // optional (external)
 *   toBankCode,          // optional (external)
 *   amount,              // required (number)
 *   currency             // optional (default NGN)
 * }
 *
 * Pending flow:
 * - debit sender.available
 * - credit receiver.pending
 * - create debit & credit tx (status = pending for receiver credit)
 * - attempt provider transfer (async call)
 *    -> provider success: mark tx success, move pending -> available
 *    -> provider failure: reverse (pending removed, sender refunded)
 */
router.post('/transfer', enforceLimits, async (req, res) => {
  const { senderId, receiverId, toAccountNumber, toBankCode, amount, currency = 'NGN' } = req.body;
  if (!senderId || !amount || (!receiverId && !(toAccountNumber && toBankCode))) {
    return res.status(400).json({ error: 'missing_parameters' });
  }

  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'invalid_amount' });

  const cur = (currency || 'NGN').toUpperCase();
  const reference = 'TX-' + Date.now();

  let debitTx, creditTx, receiverUser, senderUser;

  // 1) atomic DB changes: debit sender.available, credit receiver.pending, create TX rows
  try {
    await sequelize.transaction(async (t) => {
      // lock sender
      const sender = await User.findByPk(senderId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!sender) throw new Error('sender_not_found');
      senderUser = sender;

      // Resolve or create receiver user (internal placeholder for external accounts)
      if (receiverId) {
        receiverUser = await User.findByPk(receiverId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!receiverUser) throw new Error('receiver_not_found');
      } else {
        const extEmail = `external_${toAccountNumber}_${toBankCode}@poseidon.internal`;
        receiverUser = await User.findOne({ where: { email: extEmail }, transaction: t, lock: t.LOCK.UPDATE });
        if (!receiverUser) {
          // create lightweight placeholder
          receiverUser = await User.create({
            fullName: `External ${toAccountNumber}`,
            email: extEmail,
            phone: '',
            passwordHash: '',
            balances: { NGN: 0, USD: 0, EUR: 0, GBP: 0, GHS: 0, KES: 0 },
            kycStatus: 'none'
          }, { transaction: t });
        }
      }

      // ensure balances shape and numbers
      const sBal = sender.balances || {};
      const rBal = receiverUser.balances || {};
      sBal[cur] = toNumber(sBal[cur] || 0);
      rBal[cur] = toNumber(rBal[cur] || 0);

      if (sBal[cur] < amt) throw new Error('insufficient_funds');

      // Debit available from sender and credit pending to receiver
      sBal[cur] = Number((sBal[cur] - amt).toFixed(2));
      // rBal.pending model: we'll represent balances as { NGN: { available, pending } } if not already structured
      // normalize to nested shape if necessary
      if (typeof rBal[cur] === 'object' && rBal[cur] !== null) {
        rBal[cur].pending = toNumber(rBal[cur].pending || 0) + amt;
      } else {
        // convert to nested shape
        const existingAvailable = toNumber(rBal[cur]);
        rBal[cur] = { available: existingAvailable, pending: amt };
      }

      // Update model: ensure sender.balances keeps available value only or nested format consistent
      // For sender we want nested shape as well to keep available/pending consistent
      if (typeof sBal[cur] !== 'object' || sBal[cur] === null) {
        const existingSenderAvail = toNumber(sBal[cur]);
        sBal[cur] = { available: existingSenderAvail, pending: toNumber(sBal[cur].pending || 0) };
        sBal[cur].available = Number((existingSenderAvail - amt).toFixed(2));
      }

      sender.balances = sBal;
      receiverUser.balances = rBal;

      await sender.save({ transaction: t });
      await receiverUser.save({ transaction: t });

      // Create transactions
      debitTx = await Transaction.create({
        userId: sender.id,
        type: 'bank_transfer',
        amount: amt,
        currency: cur,
        status: 'success', // debit is immediate from sender (reserved)
        referenceId: reference,
        meta: { direction: 'debit', to_account: toAccountNumber || receiverUser.email, to_bank: toBankCode || 'INTERNAL' }
      }, { transaction: t });

      creditTx = await Transaction.create({
        userId: receiverUser.id,
        type: 'bank_transfer',
        amount: amt,
        currency: cur,
        status: 'pending', // receiver credit is pending until provider confirms
        referenceId: reference + '-C',
        meta: { direction: 'credit', from: sender.email || sender.id, external_account: toAccountNumber || null, external_bank: toBankCode || null }
      }, { transaction: t });
    }); // end transaction
  } catch (err) {
    console.error('transfer db txn failed:', err);
    return res.status(500).json({ error: 'transfer_failed', details: err.message || err });
  }

  // Prepare immediate response showing pending credit
  const senderAfter = await User.findByPk(senderUser.id);
  const receiverAfter = await User.findByPk(receiverUser.id);

  const receipt = buildReceipt({
    sender: senderAfter.fullName,
    senderAccount: senderAfter.email || senderAfter.id,
    receiver: receiverAfter.fullName,
    receiverAccount: toAccountNumber || receiverAfter.email || receiverAfter.id,
    receiverBank: toBankCode || 'INTERNAL',
    amount: amt,
    currency: cur,
    reference,
    status: 'pending'
  });

  // Respond immediately (UI shows pending)
  res.json({
    success: true,
    receipt,
    balances: {
      sender: senderAfter.balances,
      receiver: receiverAfter.balances
    },
    note: 'receiver credited as PENDING while provider confirms settlement'
  });

  // 2) Fire-and-forget: call provider to execute transfer if external (non-internal)
  if (!receiverId) {
    (async () => {
      try {
        const providerPayload = {
          account_bank: toBankCode,
          account_number: toAccountNumber,
          amount: amt,
          narration: `POSEIDON transfer ${reference}`,
          currency: cur,
          reference
        };

        const providerResp = await axios.post('https://api.flutterwave.com/v3/transfers', providerPayload, {
          headers: { Authorization: `Bearer ${FLW_KEY}`, 'Content-Type': 'application/json' },
          timeout: 30000
        });

        // Provider succeeded -> mark creditTx pending -> success and move pending->available
        await sequelize.transaction(async (t2) => {
          // reload receiver & tx with locks
          const recv = await User.findByPk(receiverUser.id, { transaction: t2, lock: t2.LOCK.UPDATE });
          const credit = await Transaction.findByPk(creditTx.id, { transaction: t2, lock: t2.LOCK.UPDATE });
          // normalize balances
          const rBal = recv.balances || {};
          if (!rBal[cur]) rBal[cur] = { available: 0, pending: 0 };
          rBal[cur].pending = toNumber(rBal[cur].pending || 0);
          rBal[cur].available = toNumber(rBal[cur].available || 0);
          // move pending -> available
          rBal[cur].pending = Number((rBal[cur].pending - amt).toFixed(2));
          rBal[cur].available = Number((rBal[cur].available + amt).toFixed(2));
          recv.balances = rBal;
          await recv.save({ transaction: t2 });

          await credit.update({ status: 'success', meta: { ...credit.meta, provider: providerResp.data } }, { transaction: t2 });

          // attach provider info to corresponding debit tx as well
          await debitTx.update({ meta: { ...debitTx.meta, provider: providerResp.data } }, { transaction: t2 });
        });

        // Optionally notify frontend/subscribers via webhook/push (not implemented here)
        console.log('provider success', providerResp.data);
      } catch (err) {
        console.error('provider transfer call failed', err?.response?.data || err.message || err);

        const providerError = err?.response?.data || { message: err.message };

        // Reversal: provider failed -> reverse pending credit and refund sender
        try {
          await sequelize.transaction(async (t3) => {
            // reload with locks
            const senderLocked = await User.findByPk(senderUser.id, { transaction: t3, lock: t3.LOCK.UPDATE });
            const receiverLocked = await User.findByPk(receiverUser.id, { transaction: t3, lock: t3.LOCK.UPDATE });

            const sBal = senderLocked.balances || {};
            const rBal = receiverLocked.balances || {};
            if (!sBal[cur]) sBal[cur] = { available: 0, pending: 0 };
            if (!rBal[cur]) rBal[cur] = { available: 0, pending: 0 };

            sBal[cur].available = toNumber(sBal[cur].available || 0);
            rBal[cur].pending = toNumber(rBal[cur].pending || 0);
            rBal[cur].available = toNumber(rBal[cur].available || 0);

            // Reverse
            rBal[cur].pending = Number((rBal[cur].pending - amt).toFixed(2));
            sBal[cur].available = Number((sBal[cur].available + amt).toFixed(2));

            senderLocked.balances = sBal;
            receiverLocked.balances = rBal;
            await senderLocked.save({ transaction: t3 });
            await receiverLocked.save({ transaction: t3 });

            // update tx statuses
            await Transaction.update(
              { status: 'failed', meta: sequelize.literal(`meta || '{"provider_error": ${JSON.stringify(providerError)}}'`) },
              { where: { referenceId: reference + '-C' }, transaction: t3 }
            );

            // create reversal audit record
            await Transaction.create({
              userId: senderLocked.id,
              type: 'reversal',
              amount: amt,
              currency: cur,
              status: 'success',
              referenceId: 'REV-' + reference,
              meta: { reason: 'provider_failure', provider_error: providerError }
            }, { transaction: t3 });
          });

          console.log('provider failed -> reversal completed');
        } catch (revErr) {
          console.error('reversal error after provider failure', revErr);
          // At this point manual reconciliation required
        }
      }
    })();
  } else {
    // internal transfer: finalize immediate success on creditTx
    try {
      await sequelize.transaction(async (t4) => {
        await creditTx.update({ status: 'success', meta: { ...creditTx.meta, note: 'internal_transfer' } }, { transaction: t4 });
      });
    } catch (finalErr) {
      console.error('finalize internal transfer failed', finalErr);
    }
  }
});

/**
 * POST /api/payments/webhook
 * Provider webhook to confirm transfer status asynchronously.
 * NOTE: Configure provider to call this endpoint and optionally include a secret header for verification.
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    // Optional verification if provider sends a secret header
    if (WEBHOOK_SECRET) {
      const incomingSecret = req.headers['x-flw-webhook-secret'] || req.headers['x-webhook-secret'] || req.headers['x-hook-secret'];
      if (!incomingSecret || incomingSecret !== WEBHOOK_SECRET) {
        console.warn('webhook secret mismatch');
        return res.status(403).send('forbidden');
      }
    }

    const body = req.body || {};
    // Example Flutterwave structure may put reference and status in body.data or directly
    const event = body.event || body;
    const data = body.data || body;

    const providerRef = data.reference || data.tx_ref || data.id;
    const providerStatus = (data.status || '').toLowerCase();

    // find our transactions by reference
    // We used reference as 'TX-<timestamp>' and credit tx reference 'TX-<timestamp>-C'
    if (!providerRef) {
      console.warn('webhook missing reference');
      return res.status(400).json({ ok: false });
    }

    // query credit transaction
    const creditTx = await Transaction.findOne({ where: { referenceId: `${providerRef}-C` } });
    if (!creditTx) {
      // maybe provider sends same reference as our original TX (without -C)
      const altTx = await Transaction.findOne({ where: { referenceId: providerRef } });
      if (!altTx) {
        console.warn('no matching tx for webhook reference', providerRef);
        return res.json({ ok: true });
      }
      // assign altTx to creditTx if direction was credit
      // fallback - mark and return
      return res.json({ ok: true });
    }

    // fetch receiver user
    const receiver = await User.findByPk(creditTx.userId);
    if (!receiver) return res.json({ ok: true });

    const cur = creditTx.currency || 'NGN';
    if (providerStatus === 'success' || providerStatus === 'successful') {
      await sequelize.transaction(async (t) => {
        // move pending -> available
        const r = await User.findByPk(receiver.id, { transaction: t, lock: t.LOCK.UPDATE });
        const rBal = r.balances || {};
        if (!rBal[cur]) rBal[cur] = { available: 0, pending: 0 };
        rBal[cur].pending = toNumber(rBal[cur].pending || 0);
        rBal[cur].available = toNumber(rBal[cur].available || 0);
        // find amount
        const amt = toNumber(creditTx.amount);
        rBal[cur].pending = Number((rBal[cur].pending - amt).toFixed(2));
        rBal[cur].available = Number((rBal[cur].available + amt).toFixed(2));
        r.balances = rBal;
        await r.save({ transaction: t });

        await creditTx.update({ status: 'success', meta: { ...creditTx.meta, provider_webhook: data } }, { transaction: t });
      });

      console.log('webhook: provider confirmed success for', providerRef);
    } else if (providerStatus === 'failed' || providerStatus === 'error') {
      // reverse pending -> refund sender
      await sequelize.transaction(async (t) => {
        // find corresponding debit tx to identify sender
        const debitTx = await Transaction.findOne({ where: { referenceId: providerRef }, transaction: t });
        let sender;
        if (debitTx) sender = await User.findByPk(debitTx.userId, { transaction: t, lock: t.LOCK.UPDATE });
        else sender = null;

        // reverse receiver pending
        const r = await User.findByPk(receiver.id, { transaction: t, lock: t.LOCK.UPDATE });
        const rBal = r.balances || {};
        if (!rBal[cur]) rBal[cur] = { available: 0, pending: 0 };
        const amt = toNumber(creditTx.amount);
        rBal[cur].pending = toNumber(rBal[cur].pending || 0);
        rBal[cur].pending = Number((rBal[cur].pending - amt).toFixed(2));
        r.balances = rBal;
        await r.save({ transaction: t });

        if (sender) {
          const sBal = sender.balances || {};
          if (!sBal[cur]) sBal[cur] = { available: 0, pending: 0 };
          sBal[cur].available = toNumber(sBal[cur].available || 0) + amt;
          sender.balances = sBal;
          await sender.save({ transaction: t });

          await Transaction.create({
            userId: sender.id,
            type: 'reversal',
            amount: amt,
            currency: cur,
            status: 'success',
            referenceId: 'REV-' + providerRef,
            meta: { reason: 'provider_webhook_failed', provider: data }
          }, { transaction: t });
        }

        await creditTx.update({ status: 'failed', meta: { ...creditTx.meta, provider_webhook: data } }, { transaction: t });
      });

      console.log('webhook: provider reported failure for', providerRef);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('webhook handler error', err);
    return res.status(500).json({ ok: false, error: err.message || err });
  }
});

module.exports = router;
