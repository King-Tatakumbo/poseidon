const { DataTypes, Sequelize } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Transaction', {
    id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM('bank_transfer','airtime','data','biller','crypto_send','crypto_receive','fx','card_payment','pos'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(30, 2), allowNull: false },
    currency: { type: DataTypes.STRING, allowNull: false }, // NGN, USD...
    status: { type: DataTypes.ENUM('pending','success','failed','cancelled'), defaultValue: 'pending' },
    referenceId: { type: DataTypes.STRING, unique: true },
    meta: { type: DataTypes.JSONB, defaultValue: {} }, // receipts, session ids etc.
    createdAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
  }, {
    tableName: 'transactions'
  });
};
