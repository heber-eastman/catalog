const Joi = require('joi');

const customerSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(255).messages({
    'string.empty': 'First name is required',
    'string.min': 'First name must be at least 1 character long',
    'string.max': 'First name cannot exceed 255 characters',
  }),

  last_name: Joi.string().trim().min(1).max(255).messages({
    'string.empty': 'Last name is required',
    'string.min': 'Last name must be at least 1 character long',
    'string.max': 'Last name cannot exceed 255 characters',
  }),

  email: Joi.string().email().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),

  phone: Joi.string()
    .allow('')
    .max(20)
    .pattern(/^\+?[\d\s-()]*$/)
    .messages({
      'string.max': 'Phone number cannot exceed 20 characters',
      'string.pattern.base':
        'Phone number can only contain numbers, spaces, and +-() characters',
    }),

  handicap: Joi.number().precision(1).min(-10).max(54).allow(null).messages({
    'number.min': 'Handicap must be at least -10',
    'number.max': 'Handicap cannot exceed 54',
    'number.precision': 'Handicap can only have one decimal place',
  }),

  membership_type: Joi.string()
    .valid('Full', 'Junior', 'Senior', 'Social', 'Trial')
    .messages({
      'any.only':
        'Membership type must be one of: Full, Junior, Senior, Social, Trial',
      'string.empty': 'Membership type is required',
    }),

  membership_start_date: Joi.date().iso().allow(null).messages({
    'date.base': 'Please provide a valid membership start date',
  }),

  membership_end_date: Joi.date()
    .iso()
    .min(Joi.ref('membership_start_date'))
    .allow(null)
    .messages({
      'date.base': 'Please provide a valid membership end date',
      'date.min': 'Membership end date must be after start date',
    }),
});

// Create schema for new customers (all required fields)
const createCustomerSchema = customerSchema.fork(
  ['first_name', 'last_name', 'email', 'membership_type'],
  field => field.required()
);

// Update schema for existing customers (all fields optional)
const updateCustomerSchema = customerSchema;

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
};
