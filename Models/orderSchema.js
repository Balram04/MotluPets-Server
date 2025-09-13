const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: false // Make optional for backward compatibility
  },
  products: [
    {
      product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
      },
      quantity: { 
        type: Number, 
        default: 1, 
        min: 1 
      },
      price: {
        type: Number,
        required: true
      }
    }
  ],
  total_amount: { 
    type: Number, 
    required: true 
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'out for delivery', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  payment_status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'refund_pending'],
    default: 'pending'
  },
  payment_method: {
    type: String,
    enum: ['online', 'cod'],
    default: 'online'
  },
  payment_id: String,
  order_id: String,
  shipping_address: {
    fullName: String,
    phoneNumber: String,
    email: String,
    streetAddress: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  phone_number: String, // Keep for backward compatibility
  special_instructions: String,
  notes: String,
  estimated_delivery: Date,
  tracking_number: String,
  
  // Cancellation fields
  cancelledAt: Date,
  cancellationReason: String,
  refund_initiated: Date,
  refund_completed: Date,
}, {
  timestamps: true // This adds createdAt and updatedAt automatically
});

// Virtual for order number
orderSchema.virtual('orderNumber').get(function() {
  return `DH-${this._id.toString().slice(-6).toUpperCase()}`;
});

// Ensure virtuals are included in JSON output
orderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
