module.exports = (sequelize, DataTypes) => {
  const StaffUser = sequelize.define(
    'StaffUser',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      course_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'GolfCourseInstances',
          key: 'id',
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('Admin', 'Manager', 'Staff'),
        allowNull: false,
        defaultValue: 'Staff',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      invitation_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      invited_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      token_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    },
    {
      tableName: 'StaffUsers',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['course_id'],
        },
        {
          fields: ['email'],
          unique: true,
        },
        {
          fields: ['invitation_token'],
        },
        {
          fields: ['is_active'],
        },
      ],
    }
  );

  StaffUser.associate = function (models) {
    StaffUser.belongsTo(models.GolfCourseInstance, {
      foreignKey: 'course_id',
      as: 'course',
    });
  };

  return StaffUser;
};
