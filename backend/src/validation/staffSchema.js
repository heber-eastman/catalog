const Joi = require('joi');

const inviteStaffSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('Admin', 'Manager', 'Staff').required(),
  first_name: Joi.string().min(1).max(50).optional(),
  last_name: Joi.string().min(1).max(50).optional(),
});

const registerStaffSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
  first_name: Joi.string().min(1).max(50).required(),
  last_name: Joi.string().min(1).max(50).required(),
  phone: Joi.string().min(10).max(20).optional(),
});

const updateStaffSchema = Joi.object({
  role: Joi.string().valid('Admin', 'Manager', 'Staff').optional(),
  first_name: Joi.string().min(1).max(50).optional(),
  last_name: Joi.string().min(1).max(50).optional(),
  phone: Joi.string().min(10).max(20).optional(),
  is_active: Joi.boolean().optional(),
});

const resendInviteSchema = Joi.object({
  staff_id: Joi.string().uuid().required(),
});

const revokeInviteSchema = Joi.object({
  staff_id: Joi.string().uuid().required(),
});

module.exports = {
  inviteStaffSchema,
  registerStaffSchema,
  updateStaffSchema,
  resendInviteSchema,
  revokeInviteSchema,
}; 