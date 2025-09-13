const { User } = require('../Models/userSchema');
const { Product, productValidationSchema } = require('../Models/productSchema');
const Order = require('../Models/orderSchema');
const jwt = require('jsonwebtoken');

module.exports = {
  login: async (req, res) => {
    const { email, password } = req.body;

    if (email === process.env.ADMIN_PANEL_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const accessToken = jwt.sign({ email }, process.env.ADMIN_ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ email }, process.env.USER_REFRESH_TOKEN_SECRET, { expiresIn: '1d' });
      res.cookie('jwt', refreshToken, { httpOnly: true, maxAge: 3 * 24 * 60 * 60 * 1000 });

      res.status(200).json({
        status: 'success',
        message: 'Successfully Logged In.',
        data: { jwt_token: accessToken, name: process.env.ADMIN_NAME },
      });
    } else {
      res.status(401).json({ message: 'Access denied. Incorrect password.' });
    }
  },

  getAllUsers: async (req, res) => {
    const users = await User.find();
    if (users.length == 0) {
      return res.json({ message: 'User collection is empty!' });
    }
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched user datas.',
      data: users,
    });
  },

  getUserById: async (req, res) => {
    const id = req.params.id;
    const user = await User.findById(id).populate({
      path: 'orders',
      populate: {
        path: 'products',
      },
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched user data.',
      data: user,
    });
  },

  getAllProducts: async (req, res) => {
    const products = await Product.find();
    if (products.length == 0) {
      return res.json({ message: 'Product collection is empty!' });
    }
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched products details.',
      data: products,
    });
  },

  getProductById: async (req, res) => {
    const id = req.params.id;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched product details.',
      data: product,
    });
  },

  getProductsByCategory: async (req, res) => {
    // products/category?name=men
    const categoryName = req.query.name;
    const products = await Product.find({ category: categoryName });
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched products details by category.',
      data: products,
    });
  },

  createProduct: async (req, res) => {
    console.log('Received request body:', req.body); // Debug log
    
    // Set default weight if not provided
    if (!req.body.weight) {
      req.body.weight = '1kg';
    }
    
    const { error, value } = productValidationSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details[0].message); // Debug log
      return res.status(400).json({ message: error.details[0].message });
    }
    const { title, description, price, category, weight } = value;

    try {
      // Use Cloudinary URL from middleware, or fallback to provided image URL
      const imageUrl = req.cloudinaryUrl || req.body.image;
      
      if (!imageUrl) {
        return res.status(400).json({ message: 'Image is required' });
      }

      await Product.create({ 
        title, 
        description, 
        image: imageUrl, 
        price, 
        category,
        weight: weight || '1kg',
        cloudinaryPublicId: req.cloudinaryPublicId || null // Store for deletion later
      });
      
      const updatedProducts = await Product.find();

      res.status(201).json({
        status: 'success',
        message: 'Successfully created a product.',
        data: updatedProducts,
      });
    } catch (error) {
      console.error('Create product error:', error);
      return res.status(500).json({ message: 'Failed to create a product' });
    }
  },

  updateProduct: async (req, res) => {
    const { error, value } = productValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { id, title, description, price, category, weight } = value;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update fields
    if (title) product.title = title;
    if (description) product.description = description;
    if (price) product.price = price;
    if (category) product.category = category;
    if (weight) product.weight = weight;
    
    // Handle image update
    if (req.cloudinaryUrl) {
      // New image uploaded via Cloudinary
      product.image = req.cloudinaryUrl;
      product.cloudinaryPublicId = req.cloudinaryPublicId;
    } else if (req.body.image) {
      // Direct URL provided
      product.image = req.body.image;
    }

    await product.save();

    const updatedProducts = await Product.find();
    res.status(200).json({
      status: 'success',
      message: 'Successfully updated a product.',
      data: updatedProducts,
    });
  },

  deleteProduct: async (req, res) => {
    const id = req.params.id;
    const product = await Product.findByIdAndRemove(id);
    if (product) {
      const updatedProducts = await Product.find();
      res.json({
        status: 'success',
        message: 'Successfully deleted a product.',
        data: updatedProducts,
      });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  },

  getOrders: async (req, res) => {
    try {
      const orders = await Order.find()
        .populate('user', 'name email phone')
        .populate('products.product', 'title category image price')
        .sort({ createdAt: -1 });

      if (orders.length == 0) {
        return res.json({ 
          status: 'success',
          message: 'No Orders',
          data: []
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Successfully fetched order details.',
        data: orders,
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ 
        message: 'Failed to fetch orders.',
        error: error.message 
      });
    }
  },

  updateOrderStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'out for delivery', 'delivered', 'cancelled', 'returned'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ') 
      });
    }

    try {
      const order = await Order.findByIdAndUpdate(
        id, 
        { 
          status, 
          updatedAt: new Date(),
          // If marking as cancelled by admin, add cancellation details
          ...(status === 'cancelled' && {
            cancelledAt: new Date(),
            cancellationReason: 'Cancelled by admin'
          })
        }, 
        { new: true }
      ).populate('user', 'name email phone')
       .populate('products.product');

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      res.status(200).json({
        status: 'success',
        message: 'Order status updated successfully.',
        data: order,
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ 
        message: 'Failed to update order status',
        error: error.message 
      });
    }
  },

  getStats: async (req, res) => {
    try {
      const stats = await Order.aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalProductsSold: { $sum: { $size: '$products' } },
            totalRevenue: { $sum: { $toDouble: '$total_amount' } },
            pendingOrders: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
              }
            },
            completedOrders: {
              $sum: {
                $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
              }
            },
            codOrders: {
              $sum: {
                $cond: [{ $eq: ['$payment_method', 'cod'] }, 1, 0]
              }
            },
            onlineOrders: {
              $sum: {
                $cond: [{ $eq: ['$payment_method', 'online'] }, 1, 0]
              }
            }
          },
        },
        { $project: { _id: 0 } },
      ]);

      const recentOrders = await Order.find()
        .populate('user', 'name email')
        .populate('products.product', 'title price')
        .sort({ createdAt: -1 })
        .limit(5);

      res.status(200).json({
        status: 'success',
        message: 'Successfully fetched stats.',
        data: {
          stats: stats[0] || {
            totalOrders: 0,
            totalProductsSold: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            completedOrders: 0,
            codOrders: 0,
            onlineOrders: 0
          },
          recentOrders
        },
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ 
        message: 'Failed to fetch stats.',
        error: error.message 
      });
    }
  },
};
