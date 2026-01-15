import type Database from 'better-sqlite3';
import { User } from '@repodepot/shared';
import { randomUUID } from 'crypto';

export class UserRepository {
  constructor(private db: Database.Database) {}

  create(data: Omit<User, 'id' | 'createdAt'>): User {
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      ...data,
      createdAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, email, avatar_url, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.id,
      user.username,
      user.email,
      user.avatarUrl || null,
      user.createdAt
    );

    return user;
  }

  findAll(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY username');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
    }));
  }

  findById(id: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
    };
  }

  findByUsername(username: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username) as any;

    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
    };
  }

  findByEmail(email: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;

    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
    };
  }

  update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): User | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
    }
    if (data.avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(data.avatarUrl);
    }

    if (updates.length === 0) return existing;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
