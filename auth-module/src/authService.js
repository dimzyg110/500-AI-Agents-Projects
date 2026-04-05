const { PasswordService } = require('./passwordService');
const { TokenService } = require('./tokenService');
const { UserStore } = require('./userStore');

class AuthService {
  constructor(secretKey, options = {}) {
    this.passwordService = new PasswordService();
    this.tokenService = new TokenService(secretKey, options);
    this.userStore = options.userStore || new UserStore();
    this.refreshTokens = new Set(); // Track valid refresh tokens
  }

  /**
   * Register a new user.
   */
  async register({ email, password, name }) {
    // Validate password strength
    const strength = this.passwordService.validatePasswordStrength(password);
    if (!strength.valid) {
      throw new Error(`Weak password: ${strength.errors.join(', ')}`);
    }

    // Hash password and create user
    const hashedPassword = await this.passwordService.hashPassword(password);
    const user = this.userStore.createUser({ email, hashedPassword, name });

    // Generate tokens
    const tokens = this.tokenService.generateTokenPair({ userId: user.id, email: user.email });
    this.refreshTokens.add(tokens.refreshToken);

    return { user, ...tokens };
  }

  /**
   * Authenticate a user with email and password.
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const user = this.userStore.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    const isValid = await this.passwordService.comparePassword(password, user.hashedPassword);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const sanitizedUser = this.userStore.findById(user.id);
    const tokens = this.tokenService.generateTokenPair({ userId: user.id, email: user.email });
    this.refreshTokens.add(tokens.refreshToken);

    return { user: sanitizedUser, ...tokens };
  }

  /**
   * Refresh an access token using a refresh token.
   */
  refreshAccessToken(refreshToken) {
    if (!this.refreshTokens.has(refreshToken)) {
      throw new Error('Invalid refresh token');
    }

    const decoded = this.tokenService.verifyToken(refreshToken);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const user = this.userStore.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Rotate refresh token
    this.refreshTokens.delete(refreshToken);
    const tokens = this.tokenService.generateTokenPair({ userId: user.id, email: user.email });
    this.refreshTokens.add(tokens.refreshToken);

    return tokens;
  }

  /**
   * Verify an access token and return the user.
   */
  authenticate(accessToken) {
    const decoded = this.tokenService.verifyToken(accessToken);
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    const user = this.userStore.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Logout by invalidating a refresh token.
   */
  logout(refreshToken) {
    this.refreshTokens.delete(refreshToken);
  }

  /**
   * Change a user's password.
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = this.userStore.findByEmail(
      this.userStore.findById(userId)?.email
    );
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await this.passwordService.comparePassword(currentPassword, user.hashedPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const strength = this.passwordService.validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new Error(`Weak password: ${strength.errors.join(', ')}`);
    }

    const hashedPassword = await this.passwordService.hashPassword(newPassword);
    return this.userStore.updateUser(userId, { hashedPassword });
  }
}

module.exports = { AuthService };
