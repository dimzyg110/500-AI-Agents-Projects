const { TokenService } = require('../src/tokenService');

describe('TokenService', () => {
  const SECRET_KEY = 'test-secret-key-for-testing-only';
  let tokenService;

  beforeEach(() => {
    tokenService = new TokenService(SECRET_KEY);
  });

  describe('constructor', () => {
    it('should create a token service with valid secret key', () => {
      expect(tokenService).toBeDefined();
    });

    it('should throw for empty secret key', () => {
      expect(() => new TokenService('')).toThrow('Secret key must be a non-empty string');
    });

    it('should throw for null secret key', () => {
      expect(() => new TokenService(null)).toThrow('Secret key must be a non-empty string');
    });

    it('should accept custom options', () => {
      const service = new TokenService(SECRET_KEY, {
        accessTokenExpiry: '30m',
        refreshTokenExpiry: '14d',
        issuer: 'custom-issuer',
      });
      expect(service.accessTokenExpiry).toBe('30m');
      expect(service.refreshTokenExpiry).toBe('14d');
      expect(service.issuer).toBe('custom-issuer');
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = tokenService.generateAccessToken({ userId: 'user-1', email: 'test@example.com' });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include user data in the token', () => {
      const token = tokenService.generateAccessToken({ userId: 'user-1', email: 'test@example.com' });
      const decoded = tokenService.decodeToken(token);
      expect(decoded.userId).toBe('user-1');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.type).toBe('access');
    });

    it('should throw without userId', () => {
      expect(() => tokenService.generateAccessToken({ email: 'test@example.com' })).toThrow(
        'Payload must include a userId'
      );
    });

    it('should throw for null payload', () => {
      expect(() => tokenService.generateAccessToken(null)).toThrow('Payload must include a userId');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = tokenService.generateRefreshToken({ userId: 'user-1' });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should include only userId and type in refresh token', () => {
      const token = tokenService.generateRefreshToken({ userId: 'user-1', email: 'test@example.com' });
      const decoded = tokenService.decodeToken(token);
      expect(decoded.userId).toBe('user-1');
      expect(decoded.type).toBe('refresh');
      expect(decoded.email).toBeUndefined();
    });

    it('should throw without userId', () => {
      expect(() => tokenService.generateRefreshToken({})).toThrow('Payload must include a userId');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = tokenService.generateAccessToken({ userId: 'user-1' });
      const decoded = tokenService.verifyToken(token);
      expect(decoded.userId).toBe('user-1');
      expect(decoded.iss).toBe('auth-module');
    });

    it('should reject a token signed with a different secret', () => {
      const otherService = new TokenService('different-secret-key');
      const token = otherService.generateAccessToken({ userId: 'user-1' });
      expect(() => tokenService.verifyToken(token)).toThrow('Invalid token');
    });

    it('should reject an expired token', () => {
      const shortLivedService = new TokenService(SECRET_KEY, { accessTokenExpiry: '0s' });
      const token = shortLivedService.generateAccessToken({ userId: 'user-1' });
      // Token with 0s expiry is already expired
      expect(() => tokenService.verifyToken(token)).toThrow('Token has expired');
    });

    it('should throw for empty token', () => {
      expect(() => tokenService.verifyToken('')).toThrow('Token must be a non-empty string');
    });

    it('should throw for null token', () => {
      expect(() => tokenService.verifyToken(null)).toThrow('Token must be a non-empty string');
    });

    it('should throw for malformed token', () => {
      expect(() => tokenService.verifyToken('not.a.valid.jwt')).toThrow('Invalid token');
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid token without verification', () => {
      const token = tokenService.generateAccessToken({ userId: 'user-1' });
      const decoded = tokenService.decodeToken(token);
      expect(decoded.userId).toBe('user-1');
    });

    it('should return null for empty string', () => {
      expect(tokenService.decodeToken('')).toBeNull();
    });

    it('should return null for null', () => {
      expect(tokenService.decodeToken(null)).toBeNull();
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const pair = tokenService.generateTokenPair({ userId: 'user-1', email: 'test@example.com' });
      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken).toBeDefined();
      expect(typeof pair.accessToken).toBe('string');
      expect(typeof pair.refreshToken).toBe('string');
    });

    it('should generate tokens with correct types', () => {
      const pair = tokenService.generateTokenPair({ userId: 'user-1' });
      const accessDecoded = tokenService.decodeToken(pair.accessToken);
      const refreshDecoded = tokenService.decodeToken(pair.refreshToken);
      expect(accessDecoded.type).toBe('access');
      expect(refreshDecoded.type).toBe('refresh');
    });
  });
});
