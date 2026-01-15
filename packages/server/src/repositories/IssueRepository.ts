import type Database from 'better-sqlite3';
import { Issue, IssueStatus, IssuePriority, AgentStatus } from '@repodepot/shared';
import { randomUUID } from 'crypto';

export class IssueRepository {
  constructor(private db: Database.Database) {}

  create(data: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>): Issue {
    const now = new Date().toISOString();
    const issue: Issue = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO issues (id, repo_id, title, description, status, priority, assignee_id, reporter_id, created_at, updated_at, github_issue_number, github_issue_url, synced_at, agent_status, agent_claimed_at, agent_completed_at, agent_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      issue.id,
      issue.repoId,
      issue.title,
      issue.description,
      issue.status,
      issue.priority,
      issue.assigneeId || null,
      issue.reporterId,
      issue.createdAt,
      issue.updatedAt,
      issue.githubIssueNumber || null,
      issue.githubIssueUrl || null,
      issue.syncedAt || null,
      issue.agentStatus || 'pending',
      issue.agentClaimedAt || null,
      issue.agentCompletedAt || null,
      issue.agentError || null
    );

    // Insert labels
    if (issue.labels && issue.labels.length > 0) {
      const labelStmt = this.db.prepare('INSERT INTO issue_labels (issue_id, label) VALUES (?, ?)');
      for (const label of issue.labels) {
        labelStmt.run(issue.id, label);
      }
    }

    return issue;
  }

  findAll(filters?: {
    repoId?: number;
    status?: IssueStatus;
    assigneeId?: string;
    priority?: IssuePriority;
  }): Issue[] {
    let query = 'SELECT * FROM issues WHERE 1=1';
    const params: any[] = [];

    if (filters?.repoId) {
      query += ' AND repo_id = ?';
      params.push(filters.repoId);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.assigneeId) {
      query += ' AND assignee_id = ?';
      params.push(filters.assigneeId);
    }
    if (filters?.priority) {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapRowToIssue(row));
  }

  findById(id: string): Issue | null {
    const stmt = this.db.prepare('SELECT * FROM issues WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapRowToIssue(row);
  }

  findByRepo(repoId: number): Issue[] {
    return this.findAll({ repoId });
  }

  update(id: string, data: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt' | 'repoId' | 'reporterId'>>): Issue | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updatedAt = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.priority !== undefined) {
      updates.push('priority = ?');
      values.push(data.priority);
    }
    if (data.assigneeId !== undefined) {
      updates.push('assignee_id = ?');
      values.push(data.assigneeId);
    }
    if (data.githubIssueNumber !== undefined) {
      updates.push('github_issue_number = ?');
      values.push(data.githubIssueNumber);
    }
    if (data.githubIssueUrl !== undefined) {
      updates.push('github_issue_url = ?');
      values.push(data.githubIssueUrl);
    }
    if (data.syncedAt !== undefined) {
      updates.push('synced_at = ?');
      values.push(data.syncedAt);
    }
    if (data.agentStatus !== undefined) {
      updates.push('agent_status = ?');
      values.push(data.agentStatus);
    }
    if (data.agentClaimedAt !== undefined) {
      updates.push('agent_claimed_at = ?');
      values.push(data.agentClaimedAt);
    }
    if (data.agentCompletedAt !== undefined) {
      updates.push('agent_completed_at = ?');
      values.push(data.agentCompletedAt);
    }
    if (data.agentError !== undefined) {
      updates.push('agent_error = ?');
      values.push(data.agentError);
    }

    if (updates.length === 0 && !data.labels) return existing;

    updates.push('updated_at = ?');
    values.push(updatedAt);
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE issues SET ${updates.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    // Update labels if provided
    if (data.labels !== undefined) {
      const deleteStmt = this.db.prepare('DELETE FROM issue_labels WHERE issue_id = ?');
      deleteStmt.run(id);

      if (data.labels.length > 0) {
        const insertStmt = this.db.prepare('INSERT INTO issue_labels (issue_id, label) VALUES (?, ?)');
        for (const label of data.labels) {
          insertStmt.run(id, label);
        }
      }
    }

    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM issues WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private mapRowToIssue(row: any): Issue {
    // Get labels for this issue
    const labelStmt = this.db.prepare('SELECT label FROM issue_labels WHERE issue_id = ?');
    const labelRows = labelStmt.all(row.id) as any[];
    const labels = labelRows.map(r => r.label);

    return {
      id: row.id,
      repoId: row.repo_id,
      title: row.title,
      description: row.description,
      status: row.status as IssueStatus,
      priority: row.priority as IssuePriority,
      assigneeId: row.assignee_id,
      reporterId: row.reporter_id,
      labels,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      githubIssueNumber: row.github_issue_number || undefined,
      githubIssueUrl: row.github_issue_url || undefined,
      syncedAt: row.synced_at || undefined,
      agentStatus: row.agent_status || 'pending',
      agentClaimedAt: row.agent_claimed_at || undefined,
      agentCompletedAt: row.agent_completed_at || undefined,
      agentError: row.agent_error || undefined,
    };
  }

  // Agent-specific query methods
  findPendingByRepo(repoId: number): Issue[] {
    const stmt = this.db.prepare(`
      SELECT * FROM issues
      WHERE repo_id = ? AND agent_status = 'pending' AND github_issue_number IS NOT NULL
      ORDER BY priority DESC, created_at ASC
    `);
    const rows = stmt.all(repoId) as any[];
    return rows.map(row => this.mapRowToIssue(row));
  }

  findByAgentStatus(repoId: number, status: AgentStatus): Issue[] {
    const stmt = this.db.prepare(`
      SELECT * FROM issues
      WHERE repo_id = ? AND agent_status = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(repoId, status) as any[];
    return rows.map(row => this.mapRowToIssue(row));
  }

  findByGitHubIssueNumber(repoId: number, githubIssueNumber: number): Issue | null {
    const stmt = this.db.prepare('SELECT * FROM issues WHERE repo_id = ? AND github_issue_number = ?');
    const row = stmt.get(repoId, githubIssueNumber) as any;

    if (!row) return null;

    return this.mapRowToIssue(row);
  }

  findUnsyncedByRepo(repoId: number): Issue[] {
    const stmt = this.db.prepare('SELECT * FROM issues WHERE repo_id = ? AND github_issue_number IS NULL ORDER BY created_at DESC');
    const rows = stmt.all(repoId) as any[];

    return rows.map(row => this.mapRowToIssue(row));
  }
}
