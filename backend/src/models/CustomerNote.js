const { Model, DataTypes } = require('sequelize');

module.exports = sequelize => {
  class CustomerNote extends Model {
    static associate(models) {
      // CustomerNote belongs to Customer
      CustomerNote.belongsTo(models.Customer, {
        foreignKey: 'customer_id',
        as: 'customer',
      });

      // CustomerNote belongs to StaffUser (author)
      CustomerNote.belongsTo(models.StaffUser, {
        foreignKey: 'author_id',
        as: 'author',
      });
    }
  }

  CustomerNote.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      customer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'id',
        },
      },
      author_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'StaffUsers',
          key: 'id',
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 2000],
        },
      },
      is_private: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'CustomerNote',
      tableName: 'customer_notes',
      underscored: true,
      timestamps: true,
    }
  );

  return CustomerNote;
};
