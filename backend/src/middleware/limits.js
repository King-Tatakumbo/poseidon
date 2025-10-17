// Enforce limits per currency and daily limits.
// Note: this middleware checks perTx only; implement daily aggregation using Transaction sums.

const LIMITS = {
  NGN: { perTx: 2000000, daily: 100000000 },
  USD: { perTx: 2000000, daily: 100000000 },
  EUR: { perTx: 2000000, daily: 100000000 },
  GBP: { perTx: 2000000, daily: 100000000 },
  GHS: { perTx: 2000000, daily: 100000000 },
  KES: { perTx: 2000000, daily: 100000000 }
};

module.exports.enforceLimits = async (req, res, next) => {
  try {
    const { fromCurrency, amount } = req.body;
    const currency = (fromCurrency || 'NGN').toUpperCase();
    const amt = Number(amount);
    const lim = LIMITS[currency] || LIMITS.NGN;
    if (Number.isNaN(amt)) return res.status(400).json({ error: 'invalid_amount' });
    if (amt > lim.perTx) return res.status(400).json({ error: `per_transaction_limit_exceeded_for_${currency}` });
    // TODO: Implement daily total checks by summing today's transactions for user in DB
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'limits_check_failed' });
  }
};
