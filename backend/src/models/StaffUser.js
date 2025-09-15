module.exports = (sequelize, DataTypes) => {
  const StaffUser = sequelize.define(
    'StaffUser',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      course_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
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
      // Temporarily removed indexes to avoid sync issues
      // indexes: [
      //   {
      //     fields: ['course_id'],
      //   },
      //   {
      //     fields: ['email'],
      //     unique: true,
      //   },
      //   {
      //     fields: ['invitation_token'],
      //   },
      //   {
      //     fields: ['is_active'],
      //   },
      // ],
    }
  );

  // Commented out for testing
  // StaffUser.associate = function (models) {
  //   StaffUser.belongsTo(models.GolfCourseInstance, {
  //     foreignKey: 'course_id',
  //     as: 'course',
  //   });
  // };

  return StaffUser;
};
