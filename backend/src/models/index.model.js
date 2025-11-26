const { sequelize } = require('../config/database');

const User = require('./user.model');
const Project = require('./project.model');
const ScanResult = require('./scanResult.model');

// Project → ScanResult
Project.hasMany(ScanResult, { foreignKey: 'projectId' });
ScanResult.belongsTo(Project, { foreignKey: 'projectId' });

// Sync
const syncModels = async () => {
  await sequelize.sync({ alter: true });
};


// Синхронизация моделей с базой данных
// const syncModels = async () => {
//   try {
//     await sequelize.sync({ force: false });
//     console.log(' Database models synchronized successfully.');
//   } catch (error) {
//     console.error('Error synchronizing database models:', error);
//   }
// };


module.exports = {
  User,
  Project,
  ScanResult,
  sequelize,
  syncModels
};