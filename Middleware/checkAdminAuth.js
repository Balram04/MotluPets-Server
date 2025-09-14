const jwt = require('jsonwebtoken');
const { verifyAccessToken, verifyRefreshToken, generateAccessToken, setTokenCookies } = require('../Utils/jwtUtils');

/**
 * Admin-specific authentication middleware
 * Does not rely on database storage like regular user auth
 */
const checkAdminAuth = () => {
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
        
        // Verify this is actually an admin token
        if (decoded.role !== 'admin') {
          return res.status(401).json({ message: 'Admin access required' });
        }
        
        req.user = decoded; // Attach admin info to request
        next();
      } catch (accessTokenError) {
        // Access token invalid/expired, try refresh token
        if (!refreshToken) {
          return res.status(401).json({ message: 'Both access and refresh tokens missing' });
        }

        try {
          // Verify refresh token
          const refreshDecoded = verifyRefreshToken(refreshToken);
          
          // Verify this is an admin refresh token
          if (refreshDecoded.role !== 'admin') {
            return res.status(401).json({ message: 'Invalid admin refresh token' });
          }

          // Verify admin credentials are still valid
          if (refreshDecoded.email !== process.env.ADMIN_PANEL_EMAIL) {
            return res.status(401).json({ message: 'Admin credentials no longer valid' });
          }

          // Generate new access token
          const tokenPayload = { email: refreshDecoded.email, role: 'admin' };
          const newAccessToken = generateAccessToken(tokenPayload);
          
          // Generate new refresh token for rotation
          const newRefreshToken = require('../Utils/jwtUtils').generateRefreshToken(tokenPayload);

          // Set new cookies
          setTokenCookies(res, newAccessToken, newRefreshToken);

          // Attach admin info to request
          req.user = { email: refreshDecoded.email, role: 'admin' };
          next();
        } catch (refreshTokenError) {
          console.error('Admin refresh token error:', refreshTokenError);
          return res.status(401).json({ message: 'Invalid or expired admin refresh token' });
        }
      }
    } catch (error) {
      console.error('Admin auth middleware error:', error);
      res.status(401).json({ message: 'Admin authentication failed' });
    }
  };
};

module.exports = checkAdminAuth;