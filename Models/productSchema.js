const mongoose = require('mongoose');
const Joi = require('joi');

const productSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  image: String,
  category: String,
  weight: {
    type: String,
    enum: ['0.5kg', '1kg', '1.5kg', '2kg', '2.5kg', '3kg', '4kg', '5kg', '10kg', '15kg', '20kg'],
    required: true,
    default: '1kg'
  },
  cloudinaryPublicId: String, // Store Cloudinary public ID for deletion
}, {
  timestamps: true // Add createdAt and updatedAt
});

const productValidationSchema = Joi.object({
  id: Joi.string(),
  title: Joi.string().min(3).required(),
  description: Joi.string().min(10).required(),
  price: Joi.number().min(1).required(),
  image: Joi.string(), // Make image optional since it can come from file upload
  category: Joi.string().min(3).max(20).required(),
  weight: Joi.string().valid('0.5kg', '1kg', '1.5kg', '2kg', '2.5kg', '3kg', '4kg', '5kg', '10kg', '15kg', '20kg').optional().default('1kg'),
});

const Product = mongoose.model('Product', productSchema);

module.exports = { Product, productValidationSchema };
