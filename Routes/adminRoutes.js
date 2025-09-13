const express = require('express');
const router = express.Router();
const controller = require('../Controllers/adminController');
const tryCatch = require('../Middleware/tryCatch');
const checkAuth = require('../Middleware/checkAuth');
const { upload, uploadToCloudinary } = require('../Middleware/uploadMiddleware');

router
  .post('/login', tryCatch(controller.login))
  .use(checkAuth(process.env.ADMIN_ACCESS_TOKEN_SECRET))

  .get('/users', tryCatch(controller.getAllUsers))
  .get('/users/:id', tryCatch(controller.getUserById))

  .get('/products/category', tryCatch(controller.getProductsByCategory))
  .get('/products', tryCatch(controller.getAllProducts))
  .get('/products/:id', tryCatch(controller.getProductById))
  .post('/products', upload.single('image'), uploadToCloudinary, tryCatch(controller.createProduct))
  .put('/products', upload.single('image'), uploadToCloudinary, tryCatch(controller.updateProduct))
  .delete('/products/:id', tryCatch(controller.deleteProduct))

  // Image upload endpoint
  .post('/upload-image', upload.single('image'), uploadToCloudinary, (req, res) => {
    try {
      if (!req.cloudinaryUrl) {
        return res.status(400).json({ 
          success: false, 
          message: 'No image uploaded' 
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: req.cloudinaryUrl,
        publicId: req.cloudinaryPublicId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Image upload failed',
        error: error.message
      });
    }
  })

  .get('/stats', tryCatch(controller.getStats))
  .get('/orders', tryCatch(controller.getOrders))
  .put('/orders/:id', tryCatch(controller.updateOrderStatus));

module.exports = router;
