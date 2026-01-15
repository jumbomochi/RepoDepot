import Database from 'better-sqlite3';
import { join } from 'path';

const SCHEMA = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    created_at TEXT NOT NULL
);

-- Groups table for organizing repositories
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    position INTEGER NOT NULL DEFAULT 0
);

-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL UNIQUE,
    local_path TEXT,
    clone_url TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    group_id INTEGER,
    last_synced_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
);

-- Repository status table
CREATE TABLE IF NOT EXISTS repo_status (
    repo_id INTEGER PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('up_to_date', 'behind', 'ahead', 'diverged', 'has_changes', 'error', 'unknown')),
    ahead INTEGER NOT NULL DEFAULT 0,
    behind INTEGER NOT NULL DEFAULT 0,
    has_local_changes INTEGER NOT NULL DEFAULT 0,
    current_branch TEXT NOT NULL,
    last_checked_at TEXT NOT NULL,
    FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Pull requests table
CREATE TABLE IF NOT EXISTS pull_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL,
    github_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('open', 'closed', 'merged')),
    draft INTEGER NOT NULL DEFAULT 0,
    author TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    url TEXT NOT NULL,
    repo_full_name TEXT NOT NULL,
    UNIQUE(repo_id, github_id),
    FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Issues table (linked to repositories)
CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    repo_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('backlog', 'todo', 'in-progress', 'review', 'done')),
    priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    assignee_id TEXT,
    reporter_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Issue labels table
CREATE TABLE IF NOT EXISTS issue_labels (
    issue_id TEXT NOT NULL,
    label TEXT NOT NULL,
    PRIMARY KEY (issue_id, label),
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_repositories_group_id ON repositories(group_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_id ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_state ON pull_requests(state);
CREATE INDEX IF NOT EXISTS idx_issues_repo_id ON issues(repo_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assignee_id ON issues(assignee_id);
CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON comments(issue_id);
`;

export class DatabaseConnection {
  private static instance: Database.Database | null = null;

  static getConnection(dbPath: string = join(process.cwd(), 'repodepot.db')): Database.Database {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new Database(dbPath);
      DatabaseConnection.instance.pragma('foreign_keys = ON');
      DatabaseConnection.initializeSchema();
    }
    return DatabaseConnection.instance;
  }

  private static initializeSchema(): void {
    const statements = SCHEMA
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      DatabaseConnection.instance!.exec(statement);
    }
  }

  static close(): void {
    if (DatabaseConnection.instance) {
      DatabaseConnection.instance.close();
      DatabaseConnection.instance = null;
    }
  }
}

export const getDb = (dbPath?: string): Database.Database => DatabaseConnection.getConnection(dbPath);
