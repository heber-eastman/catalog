const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const {
  GolfCourseInstance,
  StaffUser,
  Customer,
  CustomerNote,
  sequelize,
} = require('../../src/models');

describe('Customer Notes API', () => {
  let adminAuthToken;
  let staffAuthToken;
  let courseId;
  let adminUserId;
  let staffUserId;
  let customerId;

  beforeAll(async () => {
    try {
      // Set up database for this test suite only
      await sequelize.authenticate();
      console.log('Database connection established for notes tests');

      // Create tables using raw SQL
      await sequelize.getQueryInterface().dropAllTables();

      // Create GolfCourseInstances table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "GolfCourseInstances" (
          "id" UUID PRIMARY KEY,
          "name" VARCHAR(255) NOT NULL,
          "subdomain" VARCHAR(255) UNIQUE NOT NULL,
          "primary_admin_id" INTEGER,
          "status" VARCHAR(255) NOT NULL DEFAULT 'Pending',
          "street" VARCHAR(255),
          "city" VARCHAR(255),
          "state" VARCHAR(255),
          "postal_code" VARCHAR(255),
          "country" VARCHAR(255),
          "date_created" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create StaffUsers table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "StaffUsers" (
          "id" SERIAL PRIMARY KEY,
          "course_id" UUID NOT NULL,
          "email" VARCHAR(255) UNIQUE NOT NULL,
          "password" VARCHAR(255) NOT NULL,
          "role" VARCHAR(255) NOT NULL DEFAULT 'Staff',
          "is_active" BOOLEAN NOT NULL DEFAULT false,
          "invitation_token" VARCHAR(255),
          "invited_at" TIMESTAMP WITH TIME ZONE,
          "token_expires_at" TIMESTAMP WITH TIME ZONE,
          "first_name" VARCHAR(255),
          "last_name" VARCHAR(255),
          "phone" VARCHAR(255),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create customers table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "customers" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "course_id" UUID NOT NULL,
          "first_name" VARCHAR(255) NOT NULL,
          "last_name" VARCHAR(255) NOT NULL,
          "email" VARCHAR(255) NOT NULL,
          "phone" VARCHAR(20),
          "handicap" DECIMAL(4,1),
          "membership_type" VARCHAR(255) NOT NULL DEFAULT 'Trial',
          "membership_start_date" TIMESTAMP WITH TIME ZONE,
          "membership_end_date" TIMESTAMP WITH TIME ZONE,
          "is_archived" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE("email")
        );
      `);

      // Create customer_notes table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "customer_notes" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "customer_id" UUID NOT NULL,
          "author_id" INTEGER NOT NULL,
          "content" TEXT NOT NULL,
          "is_private" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('Tables created for notes tests');

      // Create test golf course
      const course = await GolfCourseInstance.create({
        name: 'Test Golf Club',
        subdomain: 'test-golf-club',
        status: 'Active',
        street: '123 Golf Lane',
        city: 'Golfville',
        state: 'CA',
        postal_code: '12345',
        country: 'USA',
      });
      courseId = course.id;

      // Create test staff users
      const adminUser = await StaffUser.create({
        course_id: courseId,
        email: 'admin@testgolf.com',
        password: 'hashedpassword123',
        first_name: 'Test',
        last_name: 'Admin',
        role: 'Admin',
        is_active: true,
      });
      adminUserId = adminUser.id;

      const staffUser = await StaffUser.create({
        course_id: courseId,
        email: 'staff@testgolf.com',
        password: 'hashedpassword123',
        first_name: 'Test',
        last_name: 'Staff',
        role: 'Staff',
        is_active: true,
      });
      staffUserId = staffUser.id;

      // Create test customer
      const customer = await Customer.create({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        membership_type: 'Full',
        course_id: courseId,
      });
      customerId = customer.id;

      // Generate auth tokens
      adminAuthToken = jwt.sign(
        {
          user_id: adminUserId,
          course_id: courseId,
          email: 'admin@testgolf.com',
          role: 'Admin',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      staffAuthToken = jwt.sign(
        {
          user_id: staffUserId,
          course_id: courseId,
          email: 'staff@testgolf.com',
          role: 'Staff',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    } catch (error) {
      console.error('Error setting up notes tests database:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clean up notes before each test
    await CustomerNote.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    try {
      await sequelize.close();
    } catch (error) {
      // Ignore connection already closed errors
    }
  });

  describe('GET /api/v1/customers/:cid/notes', () => {
    test('should retrieve all notes for a customer', async () => {
      // Create notes with explicit timestamps
      const note1 = await CustomerNote.create({
        customer_id: customerId,
        author_id: adminUserId,
        content: 'First note from admin',
        is_private: false,
      });

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const note2 = await CustomerNote.create({
        customer_id: customerId,
        author_id: staffUserId,
        content: 'Second note from staff',
        is_private: true,
      });

      const response = await request(app)
        .get(`/api/v1/customers/${customerId}/notes`)
        .set('Cookie', `jwt=${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('content');
      expect(response.body[0]).toHaveProperty('author');
      expect(response.body[0].author).toHaveProperty('first_name');
      
      // Check that all notes are present (order may vary due to timing)
      const noteContents = response.body.map(note => note.content);
      expect(noteContents).toContain('First note from admin');
      expect(noteContents).toContain('Second note from staff');
      
      // Verify the most recent note is first (should be the second one created)
      expect(response.body[0].content).toBe('Second note from staff');
      expect(response.body[1].content).toBe('First note from admin');
    });

    test('should return empty array when no notes exist', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${customerId}/notes`)
        .set('Cookie', `jwt=${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });

    test('should return 404 for non-existent customer', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/customers/${nonExistentId}/notes`)
        .set('Cookie', `jwt=${adminAuthToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Customer not found');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${customerId}/notes`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/customers/:cid/notes', () => {
    test('should create a new note successfully', async () => {
      const noteData = {
        content: 'This is a test note',
        is_private: false,
      };

      const response = await request(app)
        .post(`/api/v1/customers/${customerId}/notes`)
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(noteData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(noteData.content);
      expect(response.body.is_private).toBe(false);
      expect(response.body.customer_id).toBe(customerId);
      expect(response.body.author_id).toBe(adminUserId);
      expect(response.body).toHaveProperty('author');
      expect(response.body.author.first_name).toBe('Test');

      // Verify note was saved to database
      const savedNote = await CustomerNote.findByPk(response.body.id);
      expect(savedNote).toBeTruthy();
      expect(savedNote.content).toBe(noteData.content);
    });

    test('should create a private note', async () => {
      const noteData = {
        content: 'This is a private note',
        is_private: true,
      };

      const response = await request(app)
        .post(`/api/v1/customers/${customerId}/notes`)
        .set('Cookie', `jwt=${staffAuthToken}`)
        .send(noteData);

      expect(response.status).toBe(201);
      expect(response.body.is_private).toBe(true);
      expect(response.body.author_id).toBe(staffUserId);
    });

    test('should default is_private to false', async () => {
      const noteData = {
        content: 'This note has no privacy setting',
      };

      const response = await request(app)
        .post(`/api/v1/customers/${customerId}/notes`)
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(noteData);

      expect(response.status).toBe(201);
      expect(response.body.is_private).toBe(false);
    });

    test('should return 400 for invalid note data', async () => {
      const invalidData = {
        content: '', // Empty content
      };

      const response = await request(app)
        .post(`/api/v1/customers/${customerId}/notes`)
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    test('should return 400 for missing content', async () => {
      const response = await request(app)
        .post(`/api/v1/customers/${customerId}/notes`)
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    test('should return 404 for non-existent customer', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const noteData = {
        content: 'This is a test note',
      };

      const response = await request(app)
        .post(`/api/v1/customers/${nonExistentId}/notes`)
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(noteData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Customer not found');
    });

    test('should return 401 without authentication', async () => {
      const noteData = {
        content: 'This is a test note',
      };

      const response = await request(app)
        .post(`/api/v1/customers/${customerId}/notes`)
        .send(noteData);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/customers/:cid/notes/:id', () => {
    let noteId;

    beforeEach(async () => {
      // Create a test note by staff user
      const note = await CustomerNote.create({
        customer_id: customerId,
        author_id: staffUserId,
        content: 'Original note content',
        is_private: false,
      });
      noteId = note.id;
    });

    test('should update note successfully by author', async () => {
      const updateData = {
        content: 'Updated note content',
        is_private: true,
      };

      const response = await request(app)
        .put(`/api/v1/customers/${customerId}/notes/${noteId}`)
        .set('Cookie', `jwt=${staffAuthToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.content).toBe(updateData.content);
      expect(response.body.is_private).toBe(true);

      // Verify update in database
      const updatedNote = await CustomerNote.findByPk(noteId);
      expect(updatedNote.content).toBe(updateData.content);
      expect(updatedNote.is_private).toBe(true);
    });

    test('should allow admin to update any note', async () => {
      const updateData = {
        content: 'Admin updated this note',
      };

      const response = await request(app)
        .put(`/api/v1/customers/${customerId}/notes/${noteId}`)
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.content).toBe(updateData.content);
    });

    test('should return 403 when non-author tries to update note', async () => {
      // Create another staff user
      const otherStaffUser = await StaffUser.create({
        course_id: courseId,
        email: 'other-staff@testgolf.com',
        password: 'hashedpassword123',
        first_name: 'Other',
        last_name: 'Staff',
        role: 'Staff',
        is_active: true,
      });

      const otherStaffToken = jwt.sign(
        {
          user_id: otherStaffUser.id,
          course_id: courseId,
          email: 'other-staff@testgolf.com',
          role: 'Staff',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const updateData = {
        content: 'Trying to update someone else\'s note',
      };

      const response = await request(app)
        .put(`/api/v1/customers/${customerId}/notes/${noteId}`)
        .set('Cookie', `jwt=${otherStaffToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'You can only edit your own notes');
    });

    test('should return 400 for invalid update data', async () => {
      const invalidData = {
        content: '', // Empty content
      };

      const response = await request(app)
        .put(`/api/v1/customers/${customerId}/notes/${noteId}`)
        .set('Cookie', `jwt=${staffAuthToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    test('should return 404 for non-existent note', async () => {
      const nonExistentNoteId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        content: 'Updated content',
      };

      const response = await request(app)
        .put(`/api/v1/customers/${customerId}/notes/${nonExistentNoteId}`)
        .set('Cookie', `jwt=${staffAuthToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Note not found');
    });

    test('should return 401 without authentication', async () => {
      const updateData = {
        content: 'Updated content',
      };

      const response = await request(app)
        .put(`/api/v1/customers/${customerId}/notes/${noteId}`)
        .send(updateData);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/customers/:cid/notes/:id', () => {
    let noteId;

    beforeEach(async () => {
      // Create a test note by staff user
      const note = await CustomerNote.create({
        customer_id: customerId,
        author_id: staffUserId,
        content: 'Note to be deleted',
        is_private: false,
      });
      noteId = note.id;
    });

    test('should delete note successfully by author', async () => {
      const response = await request(app)
        .delete(`/api/v1/customers/${customerId}/notes/${noteId}`)
        .set('Cookie', `jwt=${staffAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Note deleted successfully');

      // Verify note was deleted from database
      const deletedNote = await CustomerNote.findByPk(noteId);
      expect(deletedNote).toBeNull();
    });

    test('should allow admin to delete any note', async () => {
      const response = await request(app)
        .delete(`/api/v1/customers/${customerId}/notes/${noteId}`)
        .set('Cookie', `jwt=${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Note deleted successfully');

      // Verify note was deleted from database
      const deletedNote = await CustomerNote.findByPk(noteId);
      expect(deletedNote).toBeNull();
    });

    test('should return 403 when non-author tries to delete note', async () => {
      // Create another staff user
      const otherStaffUser = await StaffUser.create({
        course_id: courseId,
        email: 'other-staff2@testgolf.com',
        password: 'hashedpassword123',
        first_name: 'Other',
        last_name: 'Staff',
        role: 'Staff',
        is_active: true,
      });

      const otherStaffToken = jwt.sign(
        {
          user_id: otherStaffUser.id,
          course_id: courseId,
          email: 'other-staff2@testgolf.com',
          role: 'Staff',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .delete(`/api/v1/customers/${customerId}/notes/${noteId}`)
        .set('Cookie', `jwt=${otherStaffToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'You can only delete your own notes');

      // Verify note was not deleted
      const note = await CustomerNote.findByPk(noteId);
      expect(note).toBeTruthy();
    });

    test('should return 404 for non-existent note', async () => {
      const nonExistentNoteId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .delete(`/api/v1/customers/${customerId}/notes/${nonExistentNoteId}`)
        .set('Cookie', `jwt=${staffAuthToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Note not found');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete(`/api/v1/customers/${customerId}/notes/${noteId}`);

      expect(response.status).toBe(401);
    });
  });
}); 