const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * Generate access token with short expiry
 * @param {Object} payload - User data to encode in token
 * @returns {string} Access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.USER_ACCESS_TOKEN_SECRET, { 
    expiresIn: '15m' // Short expiry for security
  });
};

/**
 * Generate refresh token with long expiry
 * @param {Object} payload - User data to encode in token
 * @returns {string} Refresh token
 */
const generateRefreshToken = (payload) => {
  // Add random data to make refresh token unique
  const tokenPayload = {
    ...payload,
    tokenId: crypto.randomBytes(16).toString('hex')
  };
  
  return jwt.sign(tokenPayload, process.env.USER_REFRESH_TOKEN_SECRET, { 
    expiresIn: '7d' // Longer expiry for refresh token
  });
};

/**
 * Verify access token
 * @param {string} token - Access token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.USER_ACCESS_TOKEN_SECRET);
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token to verify
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.USER_REFRESH_TOKEN_SECRET);
};

/**
 * Hash refresh token for storage in database
 * @param {string} token - Refresh token to hash
 * @returns {string} Hashed token
 */
const hashRefreshToken = async (token) => {
  return await bcrypt.hash(token, 10);
};

/**
 * Compare refresh token with hashed version
 * @param {string} token - Plain text token
 * @param {string} hashedToken - Hashed token from database
 * @returns {boolean} Whether tokens match
 */
const compareRefreshToken = async (token, hashedToken) => {
  return await bcrypt.compare(token, hashedToken);
};

/**
 * Set HTTP-only cookies for tokens
 * @param {Object} res - Express response object
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 */
const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Set access token cookie
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Set refresh token cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
const clearTokenCookies = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashRefreshToken,
  compareRefreshToken,
  setTokenCookies,
  clearTokenCookies
};