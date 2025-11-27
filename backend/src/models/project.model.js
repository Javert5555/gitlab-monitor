// src/models/project.model.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gitlabProjectId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  url: { type: DataTypes.STRING, allowNull: true },
  raw: { type: DataTypes.JSONB, allowNull: true } // сырые данные GitLab
}, {
  tableName: 'projects'
});

module.exports = Project;
