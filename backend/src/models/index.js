const { Sequelize } = require('sequelize');
require('dotenv').config();

// Initialize Sequelize with PostgreSQL configuration
const sequelize = new Sequelize({
  database: process.env.DB_NAME || 'catalog_dev',
  username: process.env.DB_USER || 'heber',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

// Import models
const GolfCourseInstance = require('./GolfCourseInstance')(
  sequelize,
  Sequelize.DataTypes
);
const StaffUser = require('./StaffUser')(sequelize, Sequelize.DataTypes);

// Define associations
GolfCourseInstance.hasMany(StaffUser, {
  foreignKey: 'course_id',
  as: 'staff',
});

StaffUser.belongsTo(GolfCourseInstance, {
  foreignKey: 'course_id',
  as: 'course',
});

const db = {
  sequelize,
  Sequelize,
  GolfCourseInstance,
  StaffUser,
};

module.exports = db;
