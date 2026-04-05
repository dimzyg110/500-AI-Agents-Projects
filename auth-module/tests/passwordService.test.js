const { PasswordService, MIN_PASSWORD_LENGTH } = require('../src/passwordService');

describe('PasswordService', () => {
  let passwordService;

  beforeEach(() => {
    passwordService = new PasswordService();
  });

  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'SecurePass123!';
      const hash = await passwordService.hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'SecurePass123!';
      const hash1 = await passwordService.hashPassword(password);
      const hash2 = await passwordService.hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });

    it('should throw for empty password', async () => {
      await expect(passwordService.hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw for null password', async () => {
      await expect(passwordService.hashPassword(null)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw for non-string password', async () => {
      await expect(passwordService.hashPassword(12345678)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw for password shorter than minimum length', async () => {
      await expect(passwordService.hashPassword('short')).rejects.toThrow(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
      );
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'SecurePass123!';
      const hash = await passwordService.hashPassword(password);
      const result = await passwordService.comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const hash = await passwordService.hashPassword('SecurePass123!');
      const result = await passwordService.comparePassword('WrongPassword1!', hash);
      expect(result).toBe(false);
    });

    it('should return false for empty password', async () => {
      const result = await passwordService.comparePassword('', 'somehash');
      expect(result).toBe(false);
    });

    it('should return false for null password', async () => {
      const result = await passwordService.comparePassword(null, 'somehash');
      expect(result).toBe(false);
    });

    it('should return false for null hash', async () => {
      const result = await passwordService.comparePassword('password', null);
      expect(result).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept a strong password', () => {
      const result = passwordService.validatePasswordStrength('SecureP@ss1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject a short password', () => {
      const result = passwordService.validatePasswordStrength('Sh@1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    });

    it('should reject a password without uppercase', () => {
      const result = passwordService.validatePasswordStrength('lowercase1!pass');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject a password without lowercase', () => {
      const result = passwordService.validatePasswordStrength('UPPERCASE1!PASS');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject a password without numbers', () => {
      const result = passwordService.validatePasswordStrength('NoNumbers!Pass');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject a password without special characters', () => {
      const result = passwordService.validatePasswordStrength('NoSpecial1Pass');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should return multiple errors for a very weak password', () => {
      const result = passwordService.validatePasswordStrength('abc');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should reject null password', () => {
      const result = passwordService.validatePasswordStrength(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be a non-empty string');
    });

    it('should reject non-string password', () => {
      const result = passwordService.validatePasswordStrength(123);
      expect(result.valid).toBe(false);
    });
  });
});
