const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

const User = require('./user')(sequelize);
const Transaction = require('./transaction')(sequelize);
const Kyc = require('./kyc')(sequelize);

// associations (if needed)
User.hasMany(Transaction, { foreignKey: 'userId' });
Transaction.belongsTo(User, { foreignKey: 'userId' });

module.exports = { sequelize, User, Transaction, Kyc };
