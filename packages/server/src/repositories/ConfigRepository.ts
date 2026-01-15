import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

export interface ConfigEntry {
  key: string;
  value: string;
  updatedAt: string;
}

const DEFAULT_CLONE_PATH = join(homedir(), 'repodepot');

export class ConfigRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM app_config WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO app_config (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, now);
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM app_config WHERE key = ?').run(key);
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM app_config').all() as { key: string; value: string }[];
    return rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
  }

  // Convenience methods for common config values
  getGitHubToken(): string | null {
    return this.get('github_token');
  }

  setGitHubToken(token: string): void {
    this.set('github_token', token);
  }

  clearGitHubToken(): void {
    this.delete('github_token');
  }

  getDefaultClonePath(): string {
    return this.get('default_clone_path') || DEFAULT_CLONE_PATH;
  }

  setDefaultClonePath(path: string): void {
    this.set('default_clone_path', path);
  }

  getAutoFetch(): boolean {
    return this.get('auto_fetch') === 'true';
  }

  setAutoFetch(enabled: boolean): void {
    this.set('auto_fetch', enabled.toString());
  }

  getFetchIntervalMinutes(): number {
    const value = this.get('fetch_interval_minutes');
    return value ? parseInt(value, 10) : 30;
  }

  setFetchIntervalMinutes(minutes: number): void {
    this.set('fetch_interval_minutes', minutes.toString());
  }

  // Get config as AppConfig-like object (masks token)
  getPublicConfig(): {
    hasGitHubToken: boolean;
    defaultClonePath: string;
    autoFetch: boolean;
    fetchIntervalMinutes: number;
  } {
    return {
      hasGitHubToken: !!this.getGitHubToken(),
      defaultClonePath: this.getDefaultClonePath(),
      autoFetch: this.getAutoFetch(),
      fetchIntervalMinutes: this.getFetchIntervalMinutes(),
    };
  }
}
