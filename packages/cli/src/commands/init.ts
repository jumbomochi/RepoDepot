import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { randomUUID } from 'crypto';

export const initCommand = new Command('init')
  .description('Initialize RepoDepot database')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action((options) => {
    const db = getDb(options.db);
    console.log('✓ Database initialized successfully');
    console.log(`Database location: ${options.db}`);

    // Create a default user if none exists
    const userStmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = userStmt.get() as { count: number };

    if (result.count === 0) {
      const now = new Date().toISOString();
      const insertStmt = db.prepare(`
        INSERT INTO users (id, username, email, created_at)
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.run(randomUUID(), 'default', 'default@repodepot.local', now);
      console.log('✓ Created default user');
    }
  });
