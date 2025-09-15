const bcrypt = require('bcrypt');
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');
const { GolfCourseInstance, StaffUser } = require('../models');
const { generateTokenString } = require('../auth/tokenUtil');
const { enqueueEmailNonBlocking } = require('../emailQueue');

/**
 * Generate unique subdomain from course name
 * @param {string} courseName - Original course name
 * @returns {Promise<string>} Unique subdomain
 */
async function generateUniqueSubdomain(courseName) {
  const MAX_SUBDOMAIN_LENGTH = 63; // DNS limit

  // Create initial slug
  const baseSlug = slugify(courseName, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@&]/g,
  });

  // Truncate the base slug if it's too long
  const truncatedBaseSlug = baseSlug.slice(0, MAX_SUBDOMAIN_LENGTH);

  let subdomain = truncatedBaseSlug;
  let counter = 2;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops

  // Check for collisions and append counter if needed
  while (attempts < maxAttempts) {
    const queryStart = Date.now();
    const existingCourse = await GolfCourseInstance.findOne({
      where: { subdomain },
      attributes: ['id'], // Only fetch ID for performance
    });
    console.log(
      `Subdomain check (${subdomain}) took ${Date.now() - queryStart}ms`
    );

    if (!existingCourse) {
      console.log(
        `Found unique subdomain: ${subdomain} after ${attempts + 1} attempts`
      );
      return subdomain;
    }

    // Calculate the maximum length for the base part to accommodate the counter
    const counterStr = `-${counter}`;
    const maxBaseLength = MAX_SUBDOMAIN_LENGTH - counterStr.length;
    subdomain = `${truncatedBaseSlug.slice(0, maxBaseLength)}${counterStr}`;
    counter++;
    attempts++;
  }

  // Fallback to UUID suffix if we can't find a unique subdomain
  const uuidSuffix = uuidv4().substring(0, 8);
  const fallbackSubdomain = `${truncatedBaseSlug.slice(0, MAX_SUBDOMAIN_LENGTH - 9)}-${uuidSuffix}`;
  console.log(
    `Using fallback subdomain: ${fallbackSubdomain} after ${maxAttempts} attempts`
  );

  return fallbackSubdomain;
}

/**
 * Create new golf course and admin user
 * @param {Object} signupData - Signup form data
 * @returns {Promise<Object>} Created course and user data
 */
async function createCourseAndAdmin(signupData) {
  const startTime = Date.now();
  console.log('Starting signup process...');

  const { admin, course } = signupData;

  try {
    // Step 1: Generate unique subdomain
    const subdomainStart = Date.now();
    const subdomain = await generateUniqueSubdomain(course.name);
    console.log(`Subdomain generation took ${Date.now() - subdomainStart}ms`);

    // Step 2: Hash password (reduced salt rounds for better performance)
    const hashStart = Date.now();
    const saltRounds = 10; // Reduced from 12 to 10 for better performance while maintaining security
    const passwordHash = await bcrypt.hash(admin.password, saltRounds);
    console.log(`Password hashing took ${Date.now() - hashStart}ms`);

    // Step 3: Generate invitation token and expiry
    const invitationToken = generateTokenString();
    const invitedAt = new Date();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Step 4: Database operations
    const dbStart = Date.now();

    // Create golf course instance with UUID
    const golfCourse = await GolfCourseInstance.create({
      id: uuidv4(),
      name: course.name,
      street: course.street,
      city: course.city,
      state: course.state,
      postal_code: course.postal_code,
      country: course.country,
      subdomain,
      status: 'Pending',
    });

    // Create staff user (admin)
    const staffUser = await StaffUser.create({
      course_id: golfCourse.id,
      email: admin.email,
      password: passwordHash,
      first_name: admin.first_name,
      last_name: admin.last_name,
      role: 'Admin',
      is_active: false,
      invitation_token: invitationToken,
      invited_at: invitedAt,
      token_expires_at: tokenExpiresAt,
    });

    console.log(`Database operations took ${Date.now() - dbStart}ms`);

    // Step 5: Send confirmation email via SQS queue (non-blocking)
    // This won't block the response if email service is slow or unavailable
    const emailStart = Date.now();
    const confirmationLink = `https://${subdomain}.catalog.golf/confirm?token=${invitationToken}`;
    enqueueEmailNonBlocking('SignupConfirmation', admin.email, {
      confirmation_link: confirmationLink,
      course_name: course.name,
    });
    console.log(`Email queue operation took ${Date.now() - emailStart}ms`);

    const totalTime = Date.now() - startTime;
    console.log(
      `Course ${course.name} and admin ${admin.email} created successfully. Subdomain: ${subdomain}. Total time: ${totalTime}ms`
    );

    return {
      course: golfCourse,
      user: staffUser,
      subdomain,
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(
      `Error creating course and admin after ${totalTime}ms:`,
      error
    );
    throw error;
  }
}

module.exports = {
  generateUniqueSubdomain,
  createCourseAndAdmin,
};
