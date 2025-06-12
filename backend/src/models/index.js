const { Sequelize } = require('sequelize');

// Initialize Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite::memory:', {
  dialect: process.env.DATABASE_URL?.startsWith('postgres')
    ? 'postgres'
    : 'sqlite',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  storage: process.env.NODE_ENV === 'test' ? ':memory:' : undefined,
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
