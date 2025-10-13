const express = require('express');
const router = express.Router();
const controller = require('../Controllers/userController');
const tryCatch = require('../Middleware/tryCatch');
const checkAuth = require('../Middleware/checkAuth');

router
  .post('/register', tryCatch(controller.register))
  .post('/verify-otp', tryCatch(controller.verifyOTP))
  .post('/resend-otp', tryCatch(controller.resendOTP))
  .post('/test-otp-email', tryCatch(controller.testOTPEmail)) // Debug route
  .post('/login', tryCatch(controller.login))
  .post('/refresh-token', tryCatch(controller.refreshToken))
  .post('/logout', tryCatch(controller.logout))

  .post('/:id/payment', tryCatch(controller.payment))
  .post('/:id/cod-order', tryCatch(controller.createCodOrder))
  .post('/payment/verify', tryCatch(controller.verifyPayment))
  .get('/payment/success', tryCatch(controller.success))
  .post('/payment/cancel', tryCatch(controller.cancel))

  .get('/products', tryCatch(controller.getAllProducts))
  .get('/products/top-selling', tryCatch(controller.getTopSellingProducts))
  .get('/products/:id', tryCatch(controller.getProductById))
  .get('/products/category/:categoryname', tryCatch(controller.getProductsByCategory))

  // Protected routes - require authentication
  .use(checkAuth())

  .get('/:id/cart', tryCatch(controller.showCart))
  .post('/:id/cart', tryCatch(controller.addToCart))
  .put('/:id/cart', tryCatch(controller.updateCartItemQuantity))
  .delete('/:id/cart/:product', tryCatch(controller.removeFromCart))

  .get('/:id/wishlist', tryCatch(controller.showWishlist))
  .post('/:id/wishlist', tryCatch(controller.addToWishlist))
  .delete('/:id/wishlist/:product', tryCatch(controller.removeFromWishlist))

  .get('/:id/orders', tryCatch(controller.showOrders))
  .put('/:id/orders/:orderId/cancel', tryCatch(controller.cancelOrder));

module.exports = router;
