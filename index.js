require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const userRoutes = require('./Routes/userRoutes');
const adminRoutes = require('./Routes/adminRoutes');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://localhost:3000',
      process.env.FRONTEND_URL,
      // Allow any Vercel deployment URLs
      /\.vercel\.app$/,
      // Allow custom domains
      process.env.CUSTOM_DOMAIN
    ].filter(Boolean);
    
    // Log for debugging
    console.log('🌐 Request origin:', origin);
    console.log('✅ Allowed origins:', allowedOrigins);
    
    // Check if origin matches any allowed origin or pattern
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.get('origin') || 'no-origin'}`);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'DogHub API is running!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

// MongoDB connection with better error handling
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000, // Increase timeout
  socketTimeoutMS: 45000,
}).then(() => {
  console.log('Connected to MongoDB Atlas successfully!');
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
 });

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
    console.error('🚨 This appears to be a network connectivity issue.');
    console.error('📋 Quick fix: Add your IP to MongoDB Atlas whitelist');
  }
});

db.once('open', () => {
  console.log('✅ MongoDB connected successfully!');
});

db.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected. Attempting to reconnect...');
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
