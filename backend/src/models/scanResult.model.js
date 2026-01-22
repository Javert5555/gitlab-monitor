const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScanResult = sequelize.define('ScanResult', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  projectId: { type: DataTypes.INTEGER, allowNull: false },
  results: { type: DataTypes.JSONB, allowNull: false },
  summary: { type: DataTypes.JSONB, allowNull: true },
  scannedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'scan_results'
});

module.exports = ScanResult;
