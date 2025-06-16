const Joi = require('joi');

const createNoteSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'Content is required',
    'string.min': 'Content must be at least 1 character long',
    'string.max': 'Content cannot exceed 2000 characters',
    'any.required': 'Content is required',
  }),
  is_private: Joi.boolean().default(false),
});

const updateNoteSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).messages({
    'string.empty': 'Content cannot be empty',
    'string.min': 'Content must be at least 1 character long',
    'string.max': 'Content cannot exceed 2000 characters',
  }),
  is_private: Joi.boolean(),
}).min(1);

module.exports = {
  createNoteSchema,
  updateNoteSchema,
};
