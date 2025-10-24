module.exports = (sequelize, DataTypes) => {
  const GolfCourseInstance = sequelize.define(
    'GolfCourseInstance',
    {
      id: {
        type: DataTypes.UUID,
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
        type: DataTypes.UUID,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('Pending', 'Active', 'Deactivated'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
      // Optional geo/timezone fields (added via migration 20250625010000)
      timezone: { type: DataTypes.STRING, allowNull: true },
      latitude: { type: DataTypes.DECIMAL(9,6), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(9,6), allowNull: true },
    },
    {
      tableName: 'GolfCourseInstances',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      // Temporarily removed indexes to avoid sync issues
      // indexes: [
      //   {
      //     fields: ['status'],
      //   },
      //   {
      //     fields: ['subdomain'],
      //     unique: true,
      //   },
      // ],
    }
  );

  return GolfCourseInstance;
};
