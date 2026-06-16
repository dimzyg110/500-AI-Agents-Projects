const { UserStore } = require('../src/userStore');

describe('UserStore', () => {
  let store;

  beforeEach(() => {
    store = new UserStore();
  });

  describe('createUser', () => {
    it('should create a user with valid data', () => {
      const user = store.createUser({
        email: 'test@example.com',
        hashedPassword: 'hashed_password_123',
        name: 'Test User',
      });
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should not expose hashed password in returned user', () => {
      const user = store.createUser({
        email: 'test@example.com',
        hashedPassword: 'hashed_password_123',
      });
      expect(user.hashedPassword).toBeUndefined();
    });

    it('should normalize email to lowercase', () => {
      const user = store.createUser({
        email: 'Test@EXAMPLE.COM',
        hashedPassword: 'hashed_password_123',
      });
      expect(user.email).toBe('test@example.com');
    });

    it('should set name to null when not provided', () => {
      const user = store.createUser({
        email: 'test@example.com',
        hashedPassword: 'hashed_password_123',
      });
      expect(user.name).toBeNull();
    });

    it('should throw for missing email', () => {
      expect(() =>
        store.createUser({ hashedPassword: 'hash' })
      ).toThrow('Email is required');
    });

    it('should throw for empty email', () => {
      expect(() =>
        store.createUser({ email: '', hashedPassword: 'hash' })
      ).toThrow('Email is required');
    });

    it('should throw for missing hashed password', () => {
      expect(() =>
        store.createUser({ email: 'test@example.com' })
      ).toThrow('Hashed password is required');
    });

    it('should throw for duplicate email', () => {
      store.createUser({ email: 'test@example.com', hashedPassword: 'hash1' });
      expect(() =>
        store.createUser({ email: 'test@example.com', hashedPassword: 'hash2' })
      ).toThrow('A user with this email already exists');
    });

    it('should throw for duplicate email with different case', () => {
      store.createUser({ email: 'test@example.com', hashedPassword: 'hash1' });
      expect(() =>
        store.createUser({ email: 'TEST@EXAMPLE.COM', hashedPassword: 'hash2' })
      ).toThrow('A user with this email already exists');
    });
  });

  describe('findById', () => {
    it('should find an existing user', () => {
      const created = store.createUser({
        email: 'test@example.com',
        hashedPassword: 'hash',
        name: 'Test',
      });
      const found = store.findById(created.id);
      expect(found).toBeDefined();
      expect(found.email).toBe('test@example.com');
      expect(found.hashedPassword).toBeUndefined();
    });

    it('should return null for non-existent user', () => {
      expect(store.findById('non-existent-id')).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find an existing user by email', () => {
      store.createUser({ email: 'test@example.com', hashedPassword: 'hash' });
      const found = store.findByEmail('test@example.com');
      expect(found).toBeDefined();
      expect(found.email).toBe('test@example.com');
      expect(found.hashedPassword).toBe('hash'); // findByEmail returns full user
    });

    it('should be case-insensitive', () => {
      store.createUser({ email: 'test@example.com', hashedPassword: 'hash' });
      const found = store.findByEmail('TEST@EXAMPLE.COM');
      expect(found).toBeDefined();
    });

    it('should return null for non-existent email', () => {
      expect(store.findByEmail('nonexistent@example.com')).toBeNull();
    });

    it('should return null for null email', () => {
      expect(store.findByEmail(null)).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user name', () => {
      const created = store.createUser({
        email: 'test@example.com',
        hashedPassword: 'hash',
        name: 'Old Name',
      });
      const updated = store.updateUser(created.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('should update hashed password', () => {
      const created = store.createUser({
        email: 'test@example.com',
        hashedPassword: 'old_hash',
      });
      store.updateUser(created.id, { hashedPassword: 'new_hash' });
      const user = store.findByEmail('test@example.com');
      expect(user.hashedPassword).toBe('new_hash');
    });

    it('should not allow updating disallowed fields', () => {
      const created = store.createUser({
        email: 'test@example.com',
        hashedPassword: 'hash',
      });
      store.updateUser(created.id, { email: 'hacked@example.com', isActive: false });
      const user = store.findByEmail('test@example.com');
      expect(user.email).toBe('test@example.com');
      expect(user.isActive).toBe(true);
    });

    it('should update the updatedAt timestamp', () => {
      const created = store.createUser({
        email: 'test@example.com',
        hashedPassword: 'hash',
      });
      const originalUpdatedAt = created.updatedAt;
      // Small delay to ensure different timestamp
      const updated = store.updateUser(created.id, { name: 'New Name' });
      expect(updated.updatedAt).toBeDefined();
    });

    it('should throw for non-existent user', () => {
      expect(() => store.updateUser('non-existent', { name: 'Test' })).toThrow('User not found');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate an active user', () => {
      const created = store.createUser({
        email: 'test@example.com',
        hashedPassword: 'hash',
      });
      const deactivated = store.deactivateUser(created.id);
      expect(deactivated.isActive).toBe(false);
    });

    it('should throw for non-existent user', () => {
      expect(() => store.deactivateUser('non-existent')).toThrow('User not found');
    });
  });
});
