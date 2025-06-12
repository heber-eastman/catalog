const { Sequelize } = require('sequelize');
const path = require('path');

describe('Database Migrations', () => {
  describe('create-golfcourseinstance migration', () => {
    let sequelize;
    let queryInterface;

    beforeEach(async () => {
      // Create fresh in-memory SQLite database for each test
      sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
      });
      queryInterface = sequelize.getQueryInterface();
      await sequelize.authenticate();
    });

    afterEach(async () => {
      await sequelize.close();
    });

    test('should create GolfCourseInstances table with correct structure', async () => {
      // Load and run the migration
      const migrationPath = path.join(
        __dirname,
        '../../migrations/20250612171420-create-golfcourseinstance.js'
      );
      const migration = require(migrationPath);

      // Run the up migration
      await migration.up(queryInterface, Sequelize);

      // Verify table exists and has correct structure
      const tableDescription = await queryInterface.describeTable(
        'GolfCourseInstances'
      );

      // Verify all required columns exist
      const expectedColumns = [
        'id',
        'name',
        'street',
        'city',
        'state',
        'postal_code',
        'country',
        'subdomain',
        'primary_admin_id',
        'status',
        'date_created',
        'createdAt',
        'updatedAt',
      ];

      expectedColumns.forEach(column => {
        expect(tableDescription).toHaveProperty(column);
      });

      // Verify critical column properties
      expect(tableDescription.id.primaryKey).toBe(true);
      expect(tableDescription.name.allowNull).toBe(false);
      expect(tableDescription.subdomain.allowNull).toBe(false);
      expect(tableDescription.subdomain.unique).toBe(true);
      expect(tableDescription.status.allowNull).toBe(false);

      // Verify indexes exist
      const indexes = await queryInterface.showIndex('GolfCourseInstances');
      const statusIndex = indexes.find(
        idx => idx.name === 'golf_course_instances_status_idx'
      );
      expect(statusIndex).toBeDefined();
    });

    test('should allow inserting valid records', async () => {
      const migrationPath = path.join(
        __dirname,
        '../../migrations/20250612171420-create-golfcourseinstance.js'
      );
      const migration = require(migrationPath);

      await migration.up(queryInterface, Sequelize);

      // Insert test data using raw SQL to avoid Sequelize compatibility issues
      await sequelize.query(`
        INSERT INTO GolfCourseInstances (
          id, name, subdomain, status, date_created, createdAt, updatedAt
        ) VALUES (
          '123e4567-e89b-12d3-a456-426614174000',
          'Test Golf Course',
          'testcourse',
          'Pending',
          datetime('now'),
          datetime('now'),
          datetime('now')
        )
      `);

      // Verify record was inserted
      const [results] = await sequelize.query(
        'SELECT * FROM GolfCourseInstances WHERE subdomain = ?',
        {
          replacements: ['testcourse'],
        }
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test Golf Course');
      expect(results[0].subdomain).toBe('testcourse');
      expect(results[0].status).toBe('Pending');
    });

    test('should enforce unique constraint on subdomain', async () => {
      const migrationPath = path.join(
        __dirname,
        '../../migrations/20250612171420-create-golfcourseinstance.js'
      );
      const migration = require(migrationPath);

      await migration.up(queryInterface, Sequelize);

      // Insert first record
      await sequelize.query(`
        INSERT INTO GolfCourseInstances (
          id, name, subdomain, status, date_created, createdAt, updatedAt
        ) VALUES (
          '123e4567-e89b-12d3-a456-426614174000',
          'Test Golf Course 1',
          'duplicate',
          'Pending',
          datetime('now'),
          datetime('now'),
          datetime('now')
        )
      `);

      // Try to insert duplicate subdomain
      try {
        await sequelize.query(`
          INSERT INTO GolfCourseInstances (
            id, name, subdomain, status, date_created, createdAt, updatedAt
          ) VALUES (
            '123e4567-e89b-12d3-a456-426614174001',
            'Test Golf Course 2',
            'duplicate',
            'Pending',
            datetime('now'),
            datetime('now'),
            datetime('now')
          )
        `);
        throw new Error('Should have thrown unique constraint error');
      } catch (error) {
        expect(
          error.message.includes('UNIQUE constraint failed') ||
            error.message.includes('Validation error')
        ).toBe(true);
      }
    });

    test('should properly rollback with down migration', async () => {
      const migrationPath = path.join(
        __dirname,
        '../../migrations/20250612171420-create-golfcourseinstance.js'
      );
      const migration = require(migrationPath);

      // Run up migration
      await migration.up(queryInterface, Sequelize);

      // Verify table exists
      let tableExists = true;
      try {
        await queryInterface.describeTable('GolfCourseInstances');
      } catch (error) {
        tableExists = false;
      }
      expect(tableExists).toBe(true);

      // Run down migration
      await migration.down(queryInterface, Sequelize);

      // Verify table is dropped
      try {
        await queryInterface.describeTable('GolfCourseInstances');
        throw new Error('Table should have been dropped');
      } catch (error) {
        expect(
          error.message.includes('no such table') ||
            error.message.includes('No description found')
        ).toBe(true);
      }
    });
  });
});
