const { AuthService } = require('../src/authService');

describe('AuthService', () => {
  const SECRET_KEY = 'test-secret-key-for-testing-only';
  let authService;

  beforeEach(() => {
    authService = new AuthService(SECRET_KEY);
  });

  const validUser = {
    email: 'user@example.com',
    password: 'SecureP@ss1',
    name: 'Test User',
  };

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register(validUser);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('user@example.com');
      expect(result.user.name).toBe('Test User');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should not return password in user object', async () => {
      const result = await authService.register(validUser);
      expect(result.user.hashedPassword).toBeUndefined();
      expect(result.user.password).toBeUndefined();
    });

    it('should reject weak passwords', async () => {
      await expect(
        authService.register({ ...validUser, password: 'weak' })
      ).rejects.toThrow('Weak password');
    });

    it('should reject duplicate email registration', async () => {
      await authService.register(validUser);
      await expect(
        authService.register(validUser)
      ).rejects.toThrow('A user with this email already exists');
    });

    it('should reject registration without uppercase letter', async () => {
      await expect(
        authService.register({ ...validUser, password: 'nouppercase1!' })
      ).rejects.toThrow('Weak password');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await authService.register(validUser);
    });

    it('should login with valid credentials', async () => {
      const result = await authService.login('user@example.com', 'SecureP@ss1');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('user@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      await expect(
        authService.login('user@example.com', 'WrongPassword1!')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject non-existent email', async () => {
      await expect(
        authService.login('nonexistent@example.com', 'SecureP@ss1')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject empty email', async () => {
      await expect(
        authService.login('', 'SecureP@ss1')
      ).rejects.toThrow('Email and password are required');
    });

    it('should reject empty password', async () => {
      await expect(
        authService.login('user@example.com', '')
      ).rejects.toThrow('Email and password are required');
    });

    it('should reject login for deactivated accounts', async () => {
      const result = await authService.login('user@example.com', 'SecureP@ss1');
      authService.userStore.deactivateUser(result.user.id);
      await expect(
        authService.login('user@example.com', 'SecureP@ss1')
      ).rejects.toThrow('Account is deactivated');
    });
  });

  describe('authenticate', () => {
    it('should authenticate with a valid access token', async () => {
      const { accessToken } = await authService.register(validUser);
      const user = authService.authenticate(accessToken);
      expect(user).toBeDefined();
      expect(user.email).toBe('user@example.com');
    });

    it('should reject an invalid token', () => {
      expect(() => authService.authenticate('invalid-token')).toThrow('Invalid token');
    });

    it('should reject a refresh token used as access token', async () => {
      const { refreshToken } = await authService.register(validUser);
      expect(() => authService.authenticate(refreshToken)).toThrow('Invalid token type');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh tokens with a valid refresh token', async () => {
      const { refreshToken } = await authService.register(validUser);
      const newTokens = authService.refreshAccessToken(refreshToken);
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
    });

    it('should invalidate old refresh token after rotation', async () => {
      const { refreshToken } = await authService.register(validUser);
      authService.refreshAccessToken(refreshToken);
      // Old refresh token should be invalid now
      expect(() => authService.refreshAccessToken(refreshToken)).toThrow('Invalid refresh token');
    });

    it('should reject an unknown refresh token', () => {
      expect(() => authService.refreshAccessToken('unknown-token')).toThrow('Invalid refresh token');
    });

    it('should reject an access token used as refresh token', async () => {
      const { accessToken } = await authService.register(validUser);
      expect(() => authService.refreshAccessToken(accessToken)).toThrow('Invalid refresh token');
    });
  });

  describe('logout', () => {
    it('should invalidate the refresh token', async () => {
      const { refreshToken } = await authService.register(validUser);
      authService.logout(refreshToken);
      expect(() => authService.refreshAccessToken(refreshToken)).toThrow('Invalid refresh token');
    });
  });

  describe('changePassword', () => {
    let userId;

    beforeEach(async () => {
      const result = await authService.register(validUser);
      userId = result.user.id;
    });

    it('should change password with valid current password', async () => {
      const updated = await authService.changePassword(userId, 'SecureP@ss1', 'NewSecureP@ss2');
      expect(updated).toBeDefined();
      // Should be able to login with new password
      const loginResult = await authService.login('user@example.com', 'NewSecureP@ss2');
      expect(loginResult.user).toBeDefined();
    });

    it('should reject wrong current password', async () => {
      await expect(
        authService.changePassword(userId, 'WrongPassword1!', 'NewSecureP@ss2')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should reject weak new password', async () => {
      await expect(
        authService.changePassword(userId, 'SecureP@ss1', 'weak')
      ).rejects.toThrow('Weak password');
    });

    it('should reject for non-existent user', async () => {
      await expect(
        authService.changePassword('non-existent-id', 'old', 'NewSecureP@ss2')
      ).rejects.toThrow('User not found');
    });
  });
});
