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
        type: DataTypes.INTEGER,
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
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Staff',
        validate: {
          isIn: [['Admin', 'Manager', 'Staff']],
        },
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

  return StaffUser;
};
