import { db } from '../db.js';

// Único lugar que conoce el SQL de la tabla users
export const userRepository = {
  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  findById(id) {
    return db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(id);
  },

  create({ name, email, passwordHash }) {
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name, email, passwordHash);
    return { id: Number(info.lastInsertRowid), name, email };
  },
};
