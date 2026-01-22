const { sequelize } = require('../config/database');
const User = require('./user.model');
const Project = require('./project.model');
const ScanResult = require('./scanResult.model');

Project.hasMany(ScanResult, { foreignKey: 'projectId', onDelete: 'CASCADE' });
ScanResult.belongsTo(Project, { foreignKey: 'projectId' });

const syncModels = async () => {
  // используем alter:true чтобы мигрировать schema автоматически
  await sequelize.sync({ alter: true });
};

module.exports = {
  sequelize,
  syncModels,
  User,
  Project,
  ScanResult
};
