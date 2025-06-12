module.exports = (sequelize, DataTypes) => {
  const GolfCourseInstance = sequelize.define(
    'GolfCourseInstance',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      street: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      postal_code: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subdomain: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      primary_admin_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Pending',
        validate: {
          isIn: [['Pending', 'Active', 'Suspended', 'Cancelled']],
        },
      },
      date_created: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'GolfCourseInstances',
      timestamps: false,
      indexes: [
        {
          fields: ['status'],
        },
        {
          fields: ['subdomain'],
          unique: true,
        },
      ],
    }
  );

  return GolfCourseInstance;
};
