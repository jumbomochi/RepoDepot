import type Database from 'better-sqlite3';
import { Repository, RepositoryStatus, PullRequest } from '@repodepot/shared';

export class RepositoryRepository {
  constructor(private db: Database.Database) {}

  create(data: Omit<Repository, 'id' | 'createdAt'>): Repository {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO repositories (name, full_name, local_path, clone_url, default_branch, group_id, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.name,
      data.fullName,
      data.localPath,
      data.cloneUrl,
      data.defaultBranch,
      data.groupId,
      data.lastSyncedAt,
      now
    );

    return {
      id: result.lastInsertRowid as number,
      ...data,
      createdAt: now,
    };
  }

  findAll(): Repository[] {
    const stmt = this.db.prepare('SELECT * FROM repositories ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      fullName: row.full_name,
      localPath: row.local_path,
      cloneUrl: row.clone_url,
      defaultBranch: row.default_branch,
      groupId: row.group_id,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
    }));
  }

  findById(id: number): Repository | null {
    const stmt = this.db.prepare('SELECT * FROM repositories WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      fullName: row.full_name,
      localPath: row.local_path,
      cloneUrl: row.clone_url,
      defaultBranch: row.default_branch,
      groupId: row.group_id,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
    };
  }

  findByFullName(fullName: string): Repository | null {
    const stmt = this.db.prepare('SELECT * FROM repositories WHERE full_name = ?');
    const row = stmt.get(fullName) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      fullName: row.full_name,
      localPath: row.local_path,
      cloneUrl: row.clone_url,
      defaultBranch: row.default_branch,
      groupId: row.group_id,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
    };
  }

  update(id: number, data: Partial<Omit<Repository, 'id' | 'createdAt'>>): Repository | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.fullName !== undefined) {
      updates.push('full_name = ?');
      values.push(data.fullName);
    }
    if (data.localPath !== undefined) {
      updates.push('local_path = ?');
      values.push(data.localPath);
    }
    if (data.cloneUrl !== undefined) {
      updates.push('clone_url = ?');
      values.push(data.cloneUrl);
    }
    if (data.defaultBranch !== undefined) {
      updates.push('default_branch = ?');
      values.push(data.defaultBranch);
    }
    if (data.groupId !== undefined) {
      updates.push('group_id = ?');
      values.push(data.groupId);
    }
    if (data.lastSyncedAt !== undefined) {
      updates.push('last_synced_at = ?');
      values.push(data.lastSyncedAt);
    }

    if (updates.length === 0) return existing;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE repositories SET ${updates.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    return this.findById(id);
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM repositories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  deleteByFullName(fullName: string): boolean {
    const stmt = this.db.prepare('DELETE FROM repositories WHERE full_name = ?');
    const result = stmt.run(fullName);
    return result.changes > 0;
  }

  // Repository Status methods
  upsertStatus(status: Omit<RepositoryStatus, 'lastCheckedAt'> & { lastCheckedAt?: string }): void {
    const lastCheckedAt = status.lastCheckedAt || new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO repo_status (repo_id, status, ahead, behind, has_local_changes, current_branch, last_checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo_id) DO UPDATE SET
        status = excluded.status,
        ahead = excluded.ahead,
        behind = excluded.behind,
        has_local_changes = excluded.has_local_changes,
        current_branch = excluded.current_branch,
        last_checked_at = excluded.last_checked_at
    `);

    stmt.run(
      status.repoId,
      status.status,
      status.ahead,
      status.behind,
      status.hasLocalChanges ? 1 : 0,
      status.currentBranch,
      lastCheckedAt
    );
  }

  getStatus(repoId: number): RepositoryStatus | null {
    const stmt = this.db.prepare('SELECT * FROM repo_status WHERE repo_id = ?');
    const row = stmt.get(repoId) as any;

    if (!row) return null;

    return {
      repoId: row.repo_id,
      status: row.status,
      ahead: row.ahead,
      behind: row.behind,
      hasLocalChanges: Boolean(row.has_local_changes),
      currentBranch: row.current_branch,
      lastCheckedAt: row.last_checked_at,
    };
  }

  getAllWithStatus(): (Repository & { status: RepositoryStatus | null })[] {
    const stmt = this.db.prepare(`
      SELECT
        r.*,
        rs.status as status_status,
        rs.ahead,
        rs.behind,
        rs.has_local_changes,
        rs.current_branch,
        rs.last_checked_at as status_last_checked_at
      FROM repositories r
      LEFT JOIN repo_status rs ON r.id = rs.repo_id
      ORDER BY r.created_at DESC
    `);

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      fullName: row.full_name,
      localPath: row.local_path,
      cloneUrl: row.clone_url,
      defaultBranch: row.default_branch,
      groupId: row.group_id,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
      status: row.status_status ? {
        repoId: row.id,
        status: row.status_status,
        ahead: row.ahead,
        behind: row.behind,
        hasLocalChanges: Boolean(row.has_local_changes),
        currentBranch: row.current_branch,
        lastCheckedAt: row.status_last_checked_at,
      } : null,
    }));
  }

  // Pull Request methods
  upsertPullRequest(pr: Omit<PullRequest, 'id'>): PullRequest {
    const stmt = this.db.prepare(`
      INSERT INTO pull_requests (repo_id, github_id, number, title, state, draft, author, updated_at, url, repo_full_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo_id, github_id) DO UPDATE SET
        number = excluded.number,
        title = excluded.title,
        state = excluded.state,
        draft = excluded.draft,
        author = excluded.author,
        updated_at = excluded.updated_at,
        url = excluded.url,
        repo_full_name = excluded.repo_full_name
      RETURNING id
    `);

    const result = stmt.get(
      pr.repoId,
      pr.githubId,
      pr.number,
      pr.title,
      pr.state,
      pr.draft ? 1 : 0,
      pr.author,
      pr.updatedAt,
      pr.url,
      pr.repoFullName
    ) as any;

    return {
      id: result.id,
      ...pr,
    };
  }

  getPullRequestsByRepo(repoId: number): PullRequest[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pull_requests
      WHERE repo_id = ?
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all(repoId) as any[];

    return rows.map(row => ({
      id: row.id,
      repoId: row.repo_id,
      githubId: row.github_id,
      number: row.number,
      title: row.title,
      state: row.state,
      draft: Boolean(row.draft),
      author: row.author,
      updatedAt: row.updated_at,
      url: row.url,
      repoFullName: row.repo_full_name,
    }));
  }

  getAllPullRequests(): PullRequest[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pull_requests
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      repoId: row.repo_id,
      githubId: row.github_id,
      number: row.number,
      title: row.title,
      state: row.state,
      draft: Boolean(row.draft),
      author: row.author,
      updatedAt: row.updated_at,
      url: row.url,
      repoFullName: row.repo_full_name,
    }));
  }

  getOpenPullRequests(): PullRequest[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pull_requests
      WHERE state = 'open'
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      repoId: row.repo_id,
      githubId: row.github_id,
      number: row.number,
      title: row.title,
      state: row.state,
      draft: Boolean(row.draft),
      author: row.author,
      updatedAt: row.updated_at,
      url: row.url,
      repoFullName: row.repo_full_name,
    }));
  }
}
