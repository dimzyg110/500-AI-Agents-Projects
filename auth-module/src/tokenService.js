const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_ACCESS_TOKEN_EXPIRY = '15m';
const DEFAULT_REFRESH_TOKEN_EXPIRY = '7d';

class TokenService {
  constructor(secretKey, options = {}) {
    if (!secretKey || typeof secretKey !== 'string') {
      throw new Error('Secret key must be a non-empty string');
    }
    this.secretKey = secretKey;
    this.accessTokenExpiry = options.accessTokenExpiry || DEFAULT_ACCESS_TOKEN_EXPIRY;
    this.refreshTokenExpiry = options.refreshTokenExpiry || DEFAULT_REFRESH_TOKEN_EXPIRY;
    this.issuer = options.issuer || 'auth-module';
  }

  /**
   * Generate an access token for a user.
   */
  generateAccessToken(payload) {
    if (!payload || !payload.userId) {
      throw new Error('Payload must include a userId');
    }
    return jwt.sign(
      { ...payload, type: 'access' },
      this.secretKey,
      { expiresIn: this.accessTokenExpiry, issuer: this.issuer }
    );
  }

  /**
   * Generate a refresh token for a user.
   */
  generateRefreshToken(payload) {
    if (!payload || !payload.userId) {
      throw new Error('Payload must include a userId');
    }
    return jwt.sign(
      { userId: payload.userId, type: 'refresh', jti: uuidv4() },
      this.secretKey,
      { expiresIn: this.refreshTokenExpiry, issuer: this.issuer }
    );
  }

  /**
   * Verify and decode a token.
   */
  verifyToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a non-empty string');
    }
    try {
      return jwt.verify(token, this.secretKey, { issuer: this.issuer });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw err;
    }
  }

  /**
   * Decode a token without verification (for inspection).
   */
  decodeToken(token) {
    if (!token || typeof token !== 'string') {
      return null;
    }
    return jwt.decode(token);
  }

  /**
   * Generate a token pair (access + refresh) for a user.
   */
  generateTokenPair(payload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}

module.exports = { TokenService, DEFAULT_ACCESS_TOKEN_EXPIRY, DEFAULT_REFRESH_TOKEN_EXPIRY };
