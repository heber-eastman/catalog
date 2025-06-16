const bcrypt = require('bcrypt');
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');
const { GolfCourseInstance, StaffUser } = require('../models');
const { generateTokenString } = require('../auth/tokenUtil');
const { sendConfirmationEmail } = require('./emailService');

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

  // Check for collisions and append counter if needed
  while (await GolfCourseInstance.findOne({ where: { subdomain } })) {
    // Calculate the maximum length for the base part to accommodate the counter
    const counterStr = `-${counter}`;
    const maxBaseLength = MAX_SUBDOMAIN_LENGTH - counterStr.length;
    subdomain = `${truncatedBaseSlug.slice(0, maxBaseLength)}${counterStr}`;
    counter++;
  }

  return subdomain;
}

/**
 * Create new golf course and admin user
 * @param {Object} signupData - Signup form data
 * @returns {Promise<Object>} Created course and user data
 */
async function createCourseAndAdmin(signupData) {
  const { admin, course } = signupData;

  // Generate unique subdomain
  const subdomain = await generateUniqueSubdomain(course.name);

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(admin.password, saltRounds);

  // Generate invitation token and expiry
  const invitationToken = generateTokenString();
  const invitedAt = new Date();
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  try {
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
      date_created: new Date(),
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

    // Send confirmation email
    await sendConfirmationEmail(admin.email, subdomain, invitationToken);

    return {
      course: golfCourse,
      user: staffUser,
      subdomain,
    };
  } catch (error) {
    console.error('Error creating course and admin:', error);
    throw error;
  }
}

module.exports = {
  generateUniqueSubdomain,
  createCourseAndAdmin,
};
