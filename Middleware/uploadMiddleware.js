const multer = require('multer');
const { uploadImage } = require('../config/cloudinary');

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware to handle image upload to Cloudinary
const uploadToCloudinary = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    // Convert buffer to base64
    const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    // Upload to Cloudinary
    const uploadResult = await uploadImage(fileStr);
    
    // Add Cloudinary URL to request object
    req.cloudinaryUrl = uploadResult.url;
    req.cloudinaryPublicId = uploadResult.publicId;
    
    next();
  } catch (error) {
    console.error('Upload middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Image upload failed',
      error: error.message 
    });
  }
};

module.exports = {
  upload,
  uploadToCloudinary
};
