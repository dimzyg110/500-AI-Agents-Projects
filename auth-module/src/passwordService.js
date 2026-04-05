const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

class PasswordService {
  /**
   * Hash a plaintext password using bcrypt.
   */
  async hashPassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare a plaintext password against a hashed password.
   */
  async comparePassword(password, hashedPassword) {
    if (!password || !hashedPassword) {
      return false;
    }
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Validate password strength requirements.
   */
  validatePasswordStrength(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
      return { valid: false, errors: ['Password must be a non-empty string'] };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
  }
}

module.exports = { PasswordService, MIN_PASSWORD_LENGTH };
