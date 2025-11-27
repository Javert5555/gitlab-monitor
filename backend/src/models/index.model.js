// src/models/index.model.js
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Project = require('./project.model');
const ScanResult = require('./scanResult.model');

// Associations
Project.hasMany(ScanResult, { foreignKey: 'projectId', onDelete: 'CASCADE' });
ScanResult.belongsTo(Project, { foreignKey: 'projectId' });

// Sync helper
const syncModels = async () => {
  // Используем alter:true чтобы мигрировать schema автоматически (в dev-среде).
  await sequelize.sync({ alter: true });
};

module.exports = {
  sequelize,
  syncModels,
  User,
  Project,
  ScanResult
};
