const jwt = require('jsonwebtoken');
const { verifyAccessToken, verifyRefreshToken, generateAccessToken, setTokenCookies } = require('../Utils/jwtUtils');
const { User } = require('../Models/userSchema');

const checkAuth = (accessTokenSecret = process.env.USER_ACCESS_TOKEN_SECRET) => {
  return async (req, res, next) => {
    try {
      const { accessToken, refreshToken } = req.cookies;

      // Check if access token exists
      if (!accessToken) {
        return res.status(401).json({ message: 'Access token not provided' });
      }

      try {
        // Try to verify access token
        const decoded = verifyAccessToken(accessToken);
        req.user = decoded; // Attach user info to request
        next();
      } catch (accessTokenError) {
        // Access token invalid/expired, try refresh token
        if (!refreshToken) {
          return res.status(401).json({ message: 'Both access and refresh tokens missing' });
        }

        try {
          // Verify refresh token
          const refreshDecoded = verifyRefreshToken(refreshToken);
          
          // Find user and verify stored refresh token
          const user = await User.findOne({ email: refreshDecoded.email });
          if (!user || !user.refreshToken) {
            return res.status(401).json({ message: 'Invalid refresh token' });
          }

          // Compare refresh token with stored hashed version
          const { compareRefreshToken, hashRefreshToken } = require('../Utils/jwtUtils');
          const isValidRefreshToken = await compareRefreshToken(refreshToken, user.refreshToken);
          if (!isValidRefreshToken) {
            return res.status(401).json({ message: 'Invalid refresh token' });
          }

          // Generate new access token
          const tokenPayload = { email: user.email, userId: user._id };
          const newAccessToken = generateAccessToken(tokenPayload);
          
          // Optionally generate new refresh token for rotation
          const { generateRefreshToken } = require('../Utils/jwtUtils');
          const newRefreshToken = generateRefreshToken(tokenPayload);
          const hashedNewRefreshToken = await hashRefreshToken(newRefreshToken);
          
          // Update stored refresh token
          await User.findByIdAndUpdate(user._id, { refreshToken: hashedNewRefreshToken });

          // Set new cookies
          setTokenCookies(res, newAccessToken, newRefreshToken);

          // Attach user info to request
          req.user = { email: user.email, userId: user._id };
          next();
        } catch (refreshTokenError) {
          console.error('Refresh token error:', refreshTokenError);
          return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ message: 'Authentication failed' });
    }
  };
};

module.exports = checkAuth;
