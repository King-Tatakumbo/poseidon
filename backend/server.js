require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const { sequelize } = require('./src/models');
const authRoutes = require('./src/controllers/authController');
const kycRoutes = require('./src/controllers/kycController');
const paymentRoutes = require('./src/controllers/paymentController');
const bankRoutes = require('./src/controllers/bankController');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/banks', bankRoutes);

// health
app.get('/health', (req, res) => res.json({ status: 'ok', now: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => console.log(`Server started on ${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
})();
