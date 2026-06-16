const { v4: uuidv4 } = require('uuid');

class UserStore {
  constructor() {
    this.users = new Map();
    this.emailIndex = new Map();
  }

  /**
   * Create a new user record.
   */
  createUser({ email, hashedPassword, name }) {
    if (!email || typeof email !== 'string') {
      throw new Error('Email is required');
    }
    if (!hashedPassword) {
      throw new Error('Hashed password is required');
    }
    if (this.emailIndex.has(email.toLowerCase())) {
      throw new Error('A user with this email already exists');
    }

    const user = {
      id: uuidv4(),
      email: email.toLowerCase(),
      hashedPassword,
      name: name || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };

    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user.id);
    return this._sanitizeUser(user);
  }

  /**
   * Find a user by ID.
   */
  findById(id) {
    const user = this.users.get(id);
    return user ? this._sanitizeUser(user) : null;
  }

  /**
   * Find a user by email (returns full user including hashed password for auth).
   */
  findByEmail(email) {
    if (!email) return null;
    const userId = this.emailIndex.get(email.toLowerCase());
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  /**
   * Update a user's profile.
   */
  updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }

    const allowedUpdates = ['name', 'hashedPassword'];
    for (const key of Object.keys(updates)) {
      if (allowedUpdates.includes(key)) {
        user[key] = updates[key];
      }
    }
    user.updatedAt = new Date().toISOString();
    return this._sanitizeUser(user);
  }

  /**
   * Deactivate a user account.
   */
  deactivateUser(id) {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    user.isActive = false;
    user.updatedAt = new Date().toISOString();
    return this._sanitizeUser(user);
  }

  /**
   * Remove sensitive fields from user object.
   */
  _sanitizeUser(user) {
    const { hashedPassword, ...sanitized } = user;
    return sanitized;
  }
}

module.exports = { UserStore };
