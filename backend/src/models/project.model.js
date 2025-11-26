const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define(
  'Project',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    gitlabProjectId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false
    },

    url: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },
  { tableName: 'projects' }
);

module.exports = Project;