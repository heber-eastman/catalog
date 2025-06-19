'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Customer extends Model {
    // Commented out for testing
    // static associate(models) {
    //   Customer.belongsTo(models.GolfCourseInstance, {
    //     foreignKey: 'course_id',
    //     as: 'course',
    //   });
    // }
  }

  Customer.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      course_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
          len: [0, 20],
        },
      },
      handicap: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
        validate: {
          min: -10,
          max: 54,
        },
      },
      membership_type: {
        type: DataTypes.ENUM('Full', 'Junior', 'Senior', 'Social', 'Trial'),
        allowNull: false,
        defaultValue: 'Trial',
      },
      membership_start_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      membership_end_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_archived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Customer',
      tableName: 'Customers',
      // Temporarily removed indexes to avoid sync issues
      // indexes: [
      //   {
      //     fields: ['course_id'],
      //   },
      //   {
      //     fields: ['email'],
      //   },
      //   {
      //     fields: ['is_archived'],
      //   },
      //   {
      //     fields: ['membership_type'],
      //   },
      // ],
    }
  );

  return Customer;
};
