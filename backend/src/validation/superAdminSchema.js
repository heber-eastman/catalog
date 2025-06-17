const Joi = require('joi');

// Course management schemas
const createCourseSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  street: Joi.string().max(100).optional(),
  city: Joi.string().max(50).optional(),
  state: Joi.string().max(20).optional(),
  postal_code: Joi.string().max(20).optional(),
  country: Joi.string().max(20).optional().default('US'),
});

const updateCourseSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  street: Joi.string().max(100).optional(),
  city: Joi.string().max(50).optional(),
  state: Joi.string().max(20).optional(),
  postal_code: Joi.string().max(20).optional(),
  country: Joi.string().max(20).optional(),
});

const updateCourseStatusSchema = Joi.object({
  status: Joi.string().valid('Pending', 'Active', 'Suspended', 'Deactivated').required(),
});

// Super admin management schemas
const inviteSuperAdminSchema = Joi.object({
  email: Joi.string().email().required(),
  first_name: Joi.string().min(1).max(50).optional(),
  last_name: Joi.string().min(1).max(50).optional(),
  phone: Joi.string().min(10).max(20).optional(),
});

const registerSuperAdminSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
  first_name: Joi.string().min(1).max(50).required(),
  last_name: Joi.string().min(1).max(50).required(),
  phone: Joi.string().min(10).max(20).optional(),
});

const updateSuperAdminSchema = Joi.object({
  first_name: Joi.string().min(1).max(50).optional(),
  last_name: Joi.string().min(1).max(50).optional(),
  phone: Joi.string().min(10).max(20).optional(),
  is_active: Joi.boolean().optional(),
});

const resendInviteSchema = Joi.object({
  super_admin_id: Joi.string().uuid().required(),
});

const revokeInviteSchema = Joi.object({
  super_admin_id: Joi.string().uuid().required(),
});

module.exports = {
  createCourseSchema,
  updateCourseSchema,
  updateCourseStatusSchema,
  inviteSuperAdminSchema,
  registerSuperAdminSchema,
  updateSuperAdminSchema,
  resendInviteSchema,
  revokeInviteSchema,
}; 