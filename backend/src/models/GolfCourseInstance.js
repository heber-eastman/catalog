module.exports = (sequelize, DataTypes) => {
  const GolfCourseInstance = sequelize.define(
    'GolfCourseInstance',
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      street: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      postal_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'US',
      },
      subdomain: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      primary_admin_id: {
        type: DataTypes.STRING,
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      }
    },
    {
      tableName: 'GolfCourseInstances',
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
