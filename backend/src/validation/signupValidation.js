const Joi = require('joi');

const signupSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),

  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required',
    }),

  course: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Course name must be at least 2 characters long',
      'string.max': 'Course name cannot exceed 100 characters',
      'any.required': 'Course name is required',
    }),

    street: Joi.string().min(5).max(200).required().messages({
      'string.min': 'Street address must be at least 5 characters long',
      'string.max': 'Street address cannot exceed 200 characters',
      'any.required': 'Street address is required',
    }),

    city: Joi.string().min(2).max(100).required().messages({
      'string.min': 'City must be at least 2 characters long',
      'string.max': 'City cannot exceed 100 characters',
      'any.required': 'City is required',
    }),

    state: Joi.string().min(2).max(50).required().messages({
      'string.min': 'State must be at least 2 characters long',
      'string.max': 'State cannot exceed 50 characters',
      'any.required': 'State is required',
    }),

    postal_code: Joi.string()
      .pattern(/^[A-Za-z0-9\s-]{3,10}$/)
      .required()
      .messages({
        'string.pattern.base': 'Please provide a valid postal code',
        'any.required': 'Postal code is required',
      }),

    country: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Country must be at least 2 characters long',
      'string.max': 'Country cannot exceed 50 characters',
      'any.required': 'Country is required',
    }),
  }).required(),
});

module.exports = {
  signupSchema,
};
