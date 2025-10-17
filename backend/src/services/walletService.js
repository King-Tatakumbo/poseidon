// backend/src/services/walletService.js
// CommonJS style to match the rest of the backend scaffolding.
// Exports: updateWalletBalance(identifier, amount, currency)
// identifier: can be user's email OR userId
// amount: numeric (positive to credit)
// currency: string like 'NGN', 'USD' (defaults to 'NGN')

const { sequelize, User, Transaction } = require('../models');
const { v4: uuidv4 } = require('uuid');

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

/**
 * Ensure nested balance shape exists for a currency on a user object:
 * user.balances = { NGN: { available: Number, pending: Number }, USD: {...} }
 */
function ensureCurrencyShape(balances, cur) {
  if (!balances) balances = {};
  if (!balances[cur]) {
    // attempt to normalize previous flat value
    if (typeof balances[cur] === 'number') {
      const flat = toNumber(balances[cur]);
      balances[cur] = { available: flat, pending: 0 };
    } else {
      balances[cur] = { available: 0, pending: 0 };
    }
  } else {
    // if existing is a simple number, convert
    if (typeof balances[cur] === 'number') {
      const flat = toNumber(balances[cur]);
      balances[cur] = { available: flat, pending: 0 };
    } else {
      balances[cur].available = toNumber(balances[cur].available || 0);
      balances[cur].pending = toNumber(balances[cur].pending || 0);
    }
  }
  return balances;
}

/**
 * updateWalletBalance
 * - identifier: email or userId
 * - amount: positive number to credit to available (used by webhook on successful provider confirmation)
 * - currency: currency code
 *
 * Returns the updated user record (plain object).
 */
async function updateWalletBalance(identifier, amount, currency = 'NGN') {
  const cur = (currency || 'NGN').toUpperCase();
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) throw new Error('invalid_amount');

  // Find by email or by id
  const whereByEmail = { email: identifier };
  let user = null;

  // Try userId first (UUID length heuristic)
  try {
    if (typeof identifier === 'string' && identifier.length === 36) {
      user = await User.findByPk(identifier);
    }
  } catch (e) {
    // fallback to email
    user = null;
  }

  if (!user) {
    user = await User.findOne({ where: whereByEmail });
  }

  // If still not found, create a lightweight placeholder user (so demo receivers show up)
  let createdPlaceholder = false;
  if (!user) {
    const placeholderEmail = (typeof identifier === 'string' && identifier.includes('@')) ? identifier : `ext_${identifier}@poseidon.internal`;
    user = await User.create({
      fullName: `External ${placeholderEmail}`,
      email: placeholderEmail,
      phone: '',
      passwordHash: '',
      balances: { NGN: { available: 0, pending: 0 }, USD: { available: 0, pending: 0 }, EUR: { available: 0, pending: 0 }, GBP: { available: 0, pending: 0 }, GHS: { available: 0, pending: 0 }, KES: { available: 0, pending: 0 } },
      kycStatus: 'none'
    });
    createdPlaceholder = true;
  }

  // Perform atomic update: move amount into user's available balance and create a transaction
  let updatedUser = null;
  await sequelize.transaction(async (t) => {
    // reload & lock
    const locked = await User.findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });

    // normalize balances shape
    const b = locked.balances || {};
    ensureCurrencyShape(b, cur);

    // credit available
    b[cur].available = Number((toNumber(b[cur].available) + amt).toFixed(2));
    // save
    locked.balances = b;
    await locked.save({ transaction: t });

    // create transaction record (webhook credit)
    const tx = await Transaction.create({
      userId: locked.id,
      type: 'webhook_credit',
      amount: amt,
      currency: cur,
      status: 'success',
      referenceId: `WH-${Date.now()}`,
      meta: { note: 'credited_via_webhook', placeholder_created: createdPlaceholder }
    }, { transaction: t });

    // return plain user object
    updatedUser = locked;
  });

  // Return plain JSON-friendly user summary
  return {
    id: updatedUser.id,
    fullName: updatedUser.fullName,
    email: updatedUser.email,
    balances: updatedUser.balances
  };
}

module.exports = { updateWalletBalance };
