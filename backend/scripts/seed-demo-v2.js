'use strict';

const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

async function run() {
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/catalog_test';
  const sequelize = new Sequelize(databaseUrl, { dialect: 'postgres', logging: console.log });
  const qi = sequelize.getQueryInterface();

  const runFile = async (dir, file, type) => {
    const mod = require(path.join(__dirname, '..', dir, file));
    console.log(`> Running ${type} ${dir}/${file}`);
    await mod.up(qi, Sequelize);
  };

  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // Run migrations needed for V2 structures and course geo/tz
    const migrations = [
      '20250612171421-create-staffuser.js',
      '20250625010000-add-course-geo-tz.js',
      '20250908090000-create-templates-seasons-overrides.js',
    ];
    for (const m of migrations) {
      try { await runFile('migrations', m, 'migration'); } catch (e) { console.warn('Migration skip', m, e.message); }
    }

    // Seed base demo course
    try { await runFile('seeders', '20250624-create-demo-data.js', 'seeder'); } catch (e) { console.warn('Seeder skip', e.message); }

    // Seed geo/tz update
    try { await runFile('seeders', '20250910124500-update-demo-course-geo-tz.js', 'seeder'); } catch (e) { console.warn('Seeder skip', e.message); }

    // Seed V2 structures demo
    const seeders = [
      '20250910120000-create-v2-tee-sheet-demo.js',
      '20250910123000-create-v2-override-and-today-teetimes.js',
    ];
    for (const s of seeders) {
      try { await runFile('seeders', s, 'seeder'); } catch (e) { console.warn('Seeder skip', s, e.message); }
    }

    console.log('✔ Demo V2 migrations/seeders executed.');
  } catch (e) {
    console.error('Seed script error:', e);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
