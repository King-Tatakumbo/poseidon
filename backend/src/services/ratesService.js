const axios = require('axios');

async function getFxRates(base = 'NGN') {
  // Example: use open.er-api (free) or plug in your paid provider with API key
  try {
    const resp = await axios.get(`${process.env.FOREX_API_URL || 'https://open.er-api.com/v6/latest'}/${base}`);
    return resp.data;
  } catch (err) {
    console.error('getFxRates error', err?.response?.data || err.message);
    return null;
  }
}

async function getCryptoRates(ids = ['bitcoin', 'ethereum']) {
  try {
    const resp = await axios.get(`${process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3'}/simple/price?ids=${ids.join(',')}&vs_currencies=usd,ngn`);
    return resp.data;
  } catch (err) {
    console.error('getCryptoRates error', err?.response?.data || err.message);
    return null;
  }
}

module.exports = { getFxRates, getCryptoRates };
