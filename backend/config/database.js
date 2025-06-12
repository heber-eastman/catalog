require('dotenv').config();

module.exports = {
  development: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/catalog_dev',
    dialect: 'postgres',
    logging: console.log,
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
