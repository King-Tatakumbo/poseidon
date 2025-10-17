const { DataTypes, Sequelize } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Kyc', {
    id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    tier: { type: DataTypes.INTEGER, allowNull: false }, // 1,2,3
    documents: { type: DataTypes.JSONB, defaultValue: {} }, // file refs
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    remarks: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
  }, {
    tableName: 'kyc'
  });
};
