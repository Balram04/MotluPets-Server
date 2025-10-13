const { User, userRegisterSchema, userLoginSchema, otpVerificationSchema } = require('../Models/userSchema');
const { Product } = require('../Models/productSchema');
const Order = require('../Models/orderSchema');
const { sendOrderConfirmationEmail, sendVerificationOTP, generateOTP, testOTPEmail } = require('../Services/emailService');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  hashRefreshToken, 
  setTokenCookies,
  clearTokenCookies 
} = require('../Utils/jwtUtils');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

let orderDetails = {};

// Helper function to check if authenticated user can access the requested user's data
const checkUserAccess = (req, res, requestedUserId) => {
  if (req.user.userId.toString() !== requestedUserId) {
    res.status(403).json({ message: 'Access denied. You can only access your own data.' });
    return false;
  }
  return true;
};

module.exports = {
  register: async (req, res) => {
    const { error, value } = userRegisterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { name, email, password } = value;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ message: 'Email is already registered and verified.' });
    }

    // Generate OTP and set expiry (2 minutes from now)
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 3* 60 * 1000); // 2 minutes
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      // Send OTP email
      await sendVerificationOTP(email, name, otp);

      // If user exists but not verified, update their details
      if (existingUser && !existingUser.isVerified) {
        await User.findOneAndUpdate(
          { email },
          {
            name,
            password: hashedPassword,
            emailVerificationOTP: otp,
            otpExpiry,
            isVerified: false
          }
        );
      } else {
        // Create new user with unverified status
        await User.create({
          name,
          email,
          password: hashedPassword,
          emailVerificationOTP: otp,
          otpExpiry,
          isVerified: false
        });
      }

      res.status(201).json({
        status: 'success',
        message: 'Registration initiated! Please check your email for the verification code. The code will expire in 2 minutes.',
        data: { email } // Send email back for verification step
      });

    } catch (error) {
      console.error('Registration error:', error);
      // Clean up user if email sending failed
      await User.findOneAndDelete({ email, isVerified: false });
      res.status(500).json({ 
        message: 'Failed to send verification email. Please try again.' 
      });
    }
  },

  verifyOTP: async (req, res) => {
    const { error, value } = otpVerificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, otp } = value;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found. Please register first.' });
      }

      if (user.isVerified) {
        return res.status(400).json({ message: 'Email is already verified. Please login.' });
      }

      // Check if OTP is valid and not expired
      if (user.emailVerificationOTP !== otp) {
        return res.status(400).json({ message: 'Invalid verification code. Please try again.' });
      }

      if (new Date() > user.otpExpiry) {
        return res.status(400).json({ 
          message: 'Verification code has expired. Please request a new one.' 
        });
      }

      // Verify the user
      await User.findOneAndUpdate(
        { email },
        {
          isVerified: true,
          emailVerificationOTP: null,
          otpExpiry: null
        }
      );

      res.status(200).json({
        status: 'success',
        message: 'Email verified successfully! You can now login to your account.',
      });

    } catch (error) {
      console.error('OTP verification error:', error);
      res.status(500).json({ message: 'Verification failed. Please try again.' });
    }
  },

  resendOTP: async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found. Please register first.' });
      }

      if (user.isVerified) {
        return res.status(400).json({ message: 'Email is already verified. Please login.' });
      }

      // Generate new OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 3* 60 * 1000); // 2 minutes

      // Send new OTP email
      await sendVerificationOTP(email, user.name, otp);

      // Update user with new OTP
      await User.findOneAndUpdate(
        { email },
        {
          emailVerificationOTP: otp,
          otpExpiry
        }
      );

      res.status(200).json({
        status: 'success',
        message: 'New verification code sent! Please check your email. The code will expire in 3 minutes.',
      });

    } catch (error) {
      console.error('Resend OTP error:', error);
      res.status(500).json({ message: 'Failed to send verification code. Please try again.' });
    }
  },

  login: async (req, res) => {
    const { error, value } = userLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { email, password } = value;
    
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ 
          message: 'Email not registered. Please sign up to create an account.',
          requiresRegistration: true 
        });
      }

      if (!user.isVerified) {
        return res.status(401).json({ 
          message: 'Please verify your email before logging in. Check your inbox for the verification code.',
          requiresVerification: true,
          email: email
        });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Incorrect Password. Try again.' });
      }

      // Generate tokens
      const tokenPayload = { email: user.email, userId: user._id };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Hash and store refresh token in database
      const hashedRefreshToken = await hashRefreshToken(refreshToken);
      await User.findByIdAndUpdate(user._id, { refreshToken: hashedRefreshToken });

      // Set HTTP-only cookies
      setTokenCookies(res, accessToken, refreshToken);

      res.status(200).json({
        status: 'success',
        message: 'Successfully Logged In.',
        data: { 
          name: user.name, 
          userID: user._id,
          email: user.email 
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed. Please try again.' });
    }
  },

  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.cookies;
      
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token not provided' });
      }

      // Verify refresh token
      const { verifyRefreshToken, compareRefreshToken } = require('../Utils/jwtUtils');
      const decoded = verifyRefreshToken(refreshToken);
      
      // Find user and verify stored refresh token
      const user = await User.findOne({ email: decoded.email });
      if (!user || !user.refreshToken) {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      // Compare refresh token with stored hashed version
      const isValidRefreshToken = await compareRefreshToken(refreshToken, user.refreshToken);
      if (!isValidRefreshToken) {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      // Generate new tokens
      const tokenPayload = { email: user.email, userId: user._id };
      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      // Update stored refresh token
      const hashedRefreshToken = await hashRefreshToken(newRefreshToken);
      await User.findByIdAndUpdate(user._id, { refreshToken: hashedRefreshToken });

      // Set new cookies
      setTokenCookies(res, newAccessToken, newRefreshToken);

      res.status(200).json({
        status: 'success',
        message: 'Tokens refreshed successfully',
        data: {
          name: user.name,
          userID: user._id,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
  },

  logout: async (req, res) => {
    try {
      const { refreshToken } = req.cookies;
      
      if (refreshToken) {
        // Verify and find user to invalidate refresh token
        const { verifyRefreshToken } = require('../Utils/jwtUtils');
        try {
          const decoded = verifyRefreshToken(refreshToken);
          await User.findOneAndUpdate(
            { email: decoded.email }, 
            { refreshToken: null }
          );
        } catch (error) {
          // Token might be invalid, but we still want to clear cookies
          console.log('Invalid refresh token during logout:', error.message);
        }
      }

      // Clear cookies
      clearTokenCookies(res);

      res.status(200).json({
        status: 'success',
        message: 'Successfully logged out'
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, clear cookies
      clearTokenCookies(res);
      res.status(200).json({
        status: 'success',
        message: 'Successfully logged out'
      });
    }
  },

  getAllProducts: async (req, res) => {
    const products = await Product.find();
    if (products.length == 0) {
      return res.json({ message: 'Product collection is empty!' });
    }
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched products detail.',
      data: products,
    });
  },

  getProductById: async (req, res) => {
    const productID = req.params.id;
    const product = await Product.findById(productID);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched product details.',
      data: product,
    });
  },

  getTopSellingProducts: async (req, res) => {
    const DogFood = await Product.find({ category: 'Dog' }).limit(4);
    const CatFood = await Product.find({ category: 'Cat' }).limit(4);
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched products.',
      data: [...DogFood, ...CatFood],
    });
  },

  getProductsByCategory: async (req, res) => {
    const category = req.params.categoryname;
    const products = await Product.find({ category });
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched products details.',
      data: products,
    });
  },

  showCart: async (req, res) => {
    const userID = req.params.id;
    
    // Security check: ensure the authenticated user can only access their own cart
    if (!checkUserAccess(req, res, userID)) return;

    const user = await User.findById(userID).populate('cart.product');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Filter out cart items with null products and update the user's cart
    const validCartItems = user.cart.filter(item => item.product !== null);
    
    // If some items were removed, update the cart in the database
    if (validCartItems.length !== user.cart.length) {
      user.cart = validCartItems;
      await user.save();
      console.log(`Cleaned up ${user.cart.length - validCartItems.length} invalid cart items for user ${userID}`);
    }

    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched cart items.',
      data: validCartItems,
    });
  },

  addToCart: async (req, res) => {
    const userID = req.params.id;
    
    // Security check: ensure the authenticated user can only modify their own cart
    if (!checkUserAccess(req, res, userID)) return;

    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { productID } = req.body;
    const product = await Product.findById(productID);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await User.findByIdAndUpdate(userID, { $addToSet: { cart: { product: productID } } });

    res.status(200).json({
      status: 'success',
      message: 'Product added to cart',
      cart: user.cart,
    });
  },

  updateCartItemQuantity: async (req, res) => {
    const userID = req.params.id;
    const { id, quantityChange } = req.body;

    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedCart = (user.cart.id(id).quantity += quantityChange);
    if (updatedCart > 0) {
      await user.save();
    }

    res.status(200).json({
      status: 'success',
      message: 'Cart item quantity updated',
      data: user.cart,
    });
  },

  removeFromCart: async (req, res) => {
    const userID = req.params.id;
    const productID = req.params.product;

    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndUpdate(userID, { $pull: { cart: { product: productID } } });
    res.status(200).json({
      status: 'success',
      message: 'Successfully removed from cart',
    });
  },

  showWishlist: async (req, res) => {
    const userID = req.params.id;
    const user = await User.findById(userID).populate('wishlist');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched wishlist.',
      data: user.wishlist,
    });
  },

  addToWishlist: async (req, res) => {
    const userID = req.params.id;
    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { productID } = req.body;
    const product = await Product.findById(productID);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedUser = await User.findByIdAndUpdate(userID, { $addToSet: { wishlist: productID } }, { new: true });
    res.status(200).json({
      status: 'success',
      message: 'Successfully added to wishlist',
      data: updatedUser.wishlist,
    });
  },

  removeFromWishlist: async (req, res) => {
    const userID = req.params.id;
    const productID = req.params.product;

    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndUpdate(userID, { $pull: { wishlist: productID } });
    res.status(200).json({
      status: 'success',
      message: 'Successfully removed from wishlist',
    });
  },

  payment: async (req, res) => {
    const userID = req.params.id;
    console.log('=== PAYMENT ENDPOINT CALLED ===');
    console.log('Processing payment for user:', userID);
    console.log('Razorpay Key ID:', process.env.RAZORPAY_KEY_ID ? 'Present' : 'Missing');
    console.log('Razorpay Key Secret:', process.env.RAZORPAY_KEY_SECRET ? 'Present' : 'Missing');
    
    try {
      const user = await User.findById(userID).populate('cart.product');
      if (!user) {
        console.log('❌ User not found:', userID);
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (user.cart.length === 0) {
        console.log('❌ Cart is empty for user:', userID);
        return res.status(404).json({ message: 'Cart is empty' });
      }

      console.log('✅ Cart items:', user.cart.length);

      // Calculate total amount
      const totalAmount = user.cart.reduce((total, item) => {
        if (item?.product?.price && item?.quantity) {
          return total + (item.product.price * item.quantity);
        }
        return total;
      }, 0);

      // Add delivery fee: ₹99 for orders below ₹999, free delivery for ₹999+
      const deliveryFee = totalAmount < 999 ? 99 : 0;
      const finalAmount = totalAmount + deliveryFee;

      console.log('💰 Amounts calculated:');
      console.log('  - Subtotal:', totalAmount);
      console.log('  - Delivery Fee:', deliveryFee);
      console.log('  - Final Amount:', finalAmount);

      const options = {
        amount: Math.round(finalAmount * 100), // Razorpay expects amount in paisa
        currency: 'INR',
        receipt: `order_${Date.now()}`,
        notes: {
          userId: userID,
          cartItems: user.cart.length
        }
      };

      console.log('🚀 Creating Razorpay order with options:', options);

      const razorpayOrder = await razorpay.orders.create(options);
      console.log('✅ Razorpay order created successfully:', razorpayOrder.id);

      orderDetails[razorpayOrder.id] = {
        userID,
        user,
        newOrder: {
          products: user.cart
            .filter((item) => item?.product?._id) // Filter out items with null products
            .map((item) => ({
              product: new mongoose.Types.ObjectId(item.product._id),
              quantity: item.quantity || 1,
              price: item.product.price
            })),
          order_id: razorpayOrder.id,
          payment_id: null, // Will be updated after successful payment
          total_amount: finalAmount,
          payment_method: 'online',
          payment_status: 'pending'
        },
      };

      console.log('📦 Order details stored for order ID:', razorpayOrder.id);
      console.log('📊 Total stored orders:', Object.keys(orderDetails).length);

      const responseData = {
        status: 'success',
        message: 'Razorpay order created successfully',
        orderId: razorpayOrder.id,
        amount: finalAmount,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID
      };

      console.log('📤 Sending response:', responseData);

      res.status(200).json(responseData);
    } catch (razorpayError) {
      console.error('❌ Razorpay Error:', razorpayError);
      console.error('Error details:', {
        message: razorpayError.message,
        stack: razorpayError.stack,
        name: razorpayError.name
      });
      return res.status(500).json({ 
        message: 'Failed to create payment order. Please check Razorpay configuration.',
        error: razorpayError.message,
        details: process.env.NODE_ENV === 'development' ? razorpayError.stack : undefined
      });
    }
  },

  // New endpoint for COD orders
  createCodOrder: async (req, res) => {
    const userID = req.params.id;
    const { shippingAddress, phoneNumber, specialInstructions } = req.body;
    
    console.log('Processing COD order for user:', userID);
    
    const user = await User.findById(userID).populate('cart.product');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.cart.length === 0) {
      return res.status(404).json({ message: 'Cart is empty' });
    }

    try {
      // Calculate total amount
      const totalAmount = user.cart.reduce((total, item) => {
        if (item?.product?.price && item?.quantity) {
          return total + (item.product.price * item.quantity);
        }
        return total;
      }, 0);

      // Add delivery fee: ₹99 for orders below ₹999, free delivery for ₹999+
      const deliveryFee = totalAmount < 999 ? 99 : 0;
      const finalAmount = totalAmount + deliveryFee;

      const newOrder = {
        products: user.cart
          .filter((item) => item?.product?._id) // Filter out items with null products
          .map((item) => ({
            product: new mongoose.Types.ObjectId(item.product._id),
            quantity: item.quantity,
            price: item.product.price
          })),
        order_id: `COD_${Date.now()}`,
        payment_id: null,
        total_amount: finalAmount,
        payment_method: 'cod',
        payment_status: 'pending',
        shipping_address: shippingAddress,
        phone_number: phoneNumber,
        special_instructions: specialInstructions
      };

      const order = await Order.create(newOrder);
      await User.findByIdAndUpdate(userID, { $push: { orders: order._id } });

      // Clear cart
      user.cart = [];
      await user.save();

      // Send email notifications
      try {
        console.log('📧 Sending COD order confirmation emails...');
        const populatedOrder = await Order.findById(order._id).populate('products.product');
        
        const emailResult = await sendOrderConfirmationEmail({
          order: populatedOrder,
          user: user,
          customerEmail: shippingAddress?.email || user.email
        });
        
        console.log('✅ COD order email notifications sent:', emailResult);
      } catch (emailError) {
        console.error('❌ Failed to send COD order email notifications:', emailError);
        // Don't fail the order creation if email fails
      }

      res.status(200).json({
        status: 'success',
        message: 'COD order placed successfully',
        orderId: order.order_id
      });
    } catch (error) {
      console.error('COD Order Error:', error);
      return res.status(500).json({ 
        message: 'Failed to create COD order.',
        error: error.message 
      });
    }
  },

  verifyPayment: async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shippingAddress, phoneNumber, specialInstructions } = req.body;
    
    // console.log('=== PAYMENT VERIFICATION STARTED ===');
    // console.log('📦 Request body:', req.body);
    // console.log('🔑 Razorpay Order ID:', razorpay_order_id);
    // console.log('💳 Razorpay Payment ID:', razorpay_payment_id);
    // console.log('📝 Razorpay Signature:', razorpay_signature);
    // console.log('🏠 Shipping Address:', shippingAddress);

    try {
      // Verify Razorpay signature
      const sign = razorpay_order_id + "|" + razorpay_payment_id;
      console.log('🔗 Sign string:', sign);
      
      const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");
      
      console.log('🔐 Expected signature:', expectedSign);
      console.log('📨 Received signature:', razorpay_signature);
      console.log('✅ Signatures match:', razorpay_signature === expectedSign);

      if (razorpay_signature !== expectedSign) {
        console.log('❌ Signature verification failed');
        return res.status(400).json({ 
          status: 'failure',
          message: 'Invalid payment signature',
          debug: {
            expected: expectedSign,
            received: razorpay_signature,
            signString: sign
          }
        });
      }

      // Get order details
      console.log('📋 Available order details keys:', Object.keys(orderDetails));
      let orderData = orderDetails[razorpay_order_id];
      
      if (!orderData) {
        console.log('❌ Order data not found in memory for order ID:', razorpay_order_id);
        
        // Try to fetch user from payment_id as fallback
        try {
          const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
          console.log('💳 Fetched payment details from Razorpay:', paymentDetails);
          
          if (paymentDetails && paymentDetails.notes && paymentDetails.notes.userId) {
            const userID = paymentDetails.notes.userId;
            const user = await User.findById(userID).populate('cart.product');
            
            if (user && user.cart.length > 0) {
              console.log('🔄 Reconstructing order data from user cart');
              const totalAmount = user.cart.reduce((total, item) => {
                if (item?.product?.price && item?.quantity) {
                  return total + (item.product.price * (item.quantity || 1));
                }
                return total;
              }, 0);
              const deliveryFee = totalAmount < 999 ? 99 : 0;
              const finalAmount = totalAmount + deliveryFee;
              
              orderData = {
                userID,
                user,
                newOrder: {
                  products: user.cart
                    .filter((item) => item?.product?._id) // Filter out items with null products
                    .map((item) => ({
                      product: new mongoose.Types.ObjectId(item.product._id),
                      quantity: item.quantity || 1,
                      price: item.product.price
                    })),
                  order_id: razorpay_order_id,
                  payment_id: null,
                  total_amount: finalAmount,
                  payment_method: 'online',
                  payment_status: 'pending'
                }
              };
              console.log('✅ Order data reconstructed successfully');
            }
          }
        } catch (fallbackError) {
          console.error('❌ Fallback reconstruction failed:', fallbackError);
        }
        
        if (!orderData) {
          return res.status(404).json({ 
            status: 'failure',
            message: 'Order details not found. Please try placing the order again.',
            debug: {
              orderId: razorpay_order_id,
              availableOrders: Object.keys(orderDetails),
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      console.log('✅ Order data found:', orderData);
      const { userID, user, newOrder } = orderData;

      // Update order with payment details and shipping info
      newOrder.payment_id = razorpay_payment_id;
      newOrder.payment_status = 'completed';
      newOrder.shipping_address = shippingAddress;
      newOrder.phone_number = phoneNumber;
      newOrder.special_instructions = specialInstructions;

      console.log('💾 Creating order in database...');
      const order = await Order.create(newOrder);
      console.log('✅ Order created with ID:', order._id);
      
      console.log('👤 Adding order to user...');
      await User.findByIdAndUpdate(userID, { $push: { orders: order._id } });
      console.log('✅ Order added to user');

      // Clear cart
      console.log('🛒 Clearing user cart...');
      user.cart = [];
      await user.save();
      console.log('✅ Cart cleared');

      // Send email notifications
      try {
        console.log('📧 Sending order confirmation emails...');
        const populatedOrder = await Order.findById(order._id).populate('products.product');
        
        const emailResult = await sendOrderConfirmationEmail({
          order: populatedOrder,
          user: user,
          customerEmail: shippingAddress?.email || user.email
        });
        
        console.log('✅ Email notifications sent:', emailResult);
      } catch (emailError) {
        console.error('❌ Failed to send email notifications:', emailError);
        // Don't fail the order creation if email fails
      }

      // Clean up order details
      delete orderDetails[razorpay_order_id];
      console.log('🧹 Order details cleaned up');

      console.log('🎉 Payment verification completed successfully');
      res.status(200).json({
        status: 'success',
        message: 'Payment verified successfully',
        orderId: order.order_id
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({ 
        status: 'failure',
        message: 'Payment verification failed',
        error: error.message 
      });
    }
  },

  success: async (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Payment was successful',
    });
  },

  cancel: async (req, res) => {
    res.status(200).json({
      status: 'failure',
      message: 'Payment was cancelled',
    });
  },

  showOrders: async (req, res) => {
    const userID = req.params.id;
    
    try {
      // Security check: ensure the authenticated user can only access their own orders
      if (!checkUserAccess(req, res, userID)) return;

      const user = await User.findById(userID);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.orders.length === 0) {
        return res.status(404).json({ message: 'You have no orders' });
      }

      const orderDetails = await Order.find({ _id: { $in: user.orders } })
        .populate('products.product')
        .sort({ createdAt: -1 });

      res.status(200).json({
        status: 'success',
        message: 'Successfully fetched order details.',
        data: orderDetails,
      });
    } catch (error) {
      console.error('Error fetching user orders:', error);
      res.status(500).json({ 
        message: 'Failed to fetch orders',
        error: error.message 
      });
    }
  },

  cancelOrder: async (req, res) => {
    const { id: userID, orderId } = req.params;
    
    try {
      // Find the user
      const user = await User.findById(userID);
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      // Find the order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ 
          success: false,
          message: 'Order not found' 
        });
      }

      // Check if the order belongs to the user
      if (!user.orders.includes(orderId)) {
        return res.status(403).json({ 
          success: false,
          message: 'You are not authorized to cancel this order' 
        });
      }

      // Check if order can be cancelled
      const cancelableStatuses = ['pending', 'confirmed', 'processing'];
      if (!cancelableStatuses.includes(order.status.toLowerCase())) {
        return res.status(400).json({ 
          success: false,
          message: `Cannot cancel order with status: ${order.status}. Order can only be cancelled when status is pending, confirmed, or processing.` 
        });
      }

      // Update order status to cancelled
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancellationReason = 'Cancelled by customer';
      
      // If it was an online payment, mark for refund
      if (order.payment_method !== 'cod' && order.payment_status === 'completed') {
        order.payment_status = 'refund_pending';
        order.refund_initiated = new Date();
      }

      await order.save();

      // Log the cancellation for admin tracking
      console.log(`Order ${orderId} cancelled by user ${userID} at ${new Date()}`);

      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: {
          orderId: order._id,
          status: order.status,
          cancelledAt: order.cancelledAt,
          refundStatus: order.payment_method !== 'cod' ? 'Refund will be processed within 3-5 business days' : 'No payment was collected'
        }
      });

    } catch (error) {
      console.error('Error cancelling order:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  },

  // Test function for debugging OTP emails
  testOTPEmail: async (req, res) => {
    try {
      const { email, name = 'Test User' } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          message: 'Email is required for testing' 
        });
      }

      console.log('🧪 Testing OTP email for:', email);
      await testOTPEmail(email, name);
      
      res.status(200).json({
        status: 'success',
        message: 'Test OTP email sent successfully! Check your inbox and spam folder.',
        data: { email }
      });

    } catch (error) {
      console.error('❌ Test OTP email failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to send test OTP email',
        error: error.message
      });
    }
  },
};
