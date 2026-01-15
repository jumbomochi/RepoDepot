import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { SyncStatus, Commit } from '@repodepot/shared';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export interface GitStatusInfo {
  status: SyncStatus;
  ahead: number;
  behind: number;
  hasLocalChanges: boolean;
  currentBranch: string;
}

export interface CloneResult {
  success: boolean;
  path: string;
  error?: string;
}

export interface PullResult {
  success: boolean;
  changes: number;
  error?: string;
}

export class GitService {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  static async clone(cloneUrl: string, destinationPath: string): Promise<CloneResult> {
    try {
      // Ensure parent directory exists
      const parentDir = dirname(destinationPath);
      await mkdir(parentDir, { recursive: true });

      const git = simpleGit();
      await git.clone(cloneUrl, destinationPath);
      return { success: true, path: destinationPath };
    } catch (error) {
      return {
        success: false,
        path: destinationPath,
        error: (error as Error).message,
      };
    }
  }

  async fetch(): Promise<void> {
    await this.git.fetch();
  }

  async getStatus(): Promise<GitStatusInfo> {
    try {
      // Fetch latest from remote
      await this.fetch();

      // Get current branch
      const branchSummary = await this.git.branch();
      const currentBranch = branchSummary.current;

      // Get status
      const status: StatusResult = await this.git.status();

      // Check if there are local changes
      const hasLocalChanges =
        status.modified.length > 0 ||
        status.created.length > 0 ||
        status.deleted.length > 0 ||
        status.renamed.length > 0 ||
        status.not_added.length > 0;

      // Get ahead/behind counts
      const ahead = status.ahead;
      const behind = status.behind;

      // Determine sync status
      let syncStatus: SyncStatus;
      if (hasLocalChanges) {
        syncStatus = 'has_changes';
      } else if (ahead > 0 && behind > 0) {
        syncStatus = 'diverged';
      } else if (ahead > 0) {
        syncStatus = 'ahead';
      } else if (behind > 0) {
        syncStatus = 'behind';
      } else {
        syncStatus = 'up_to_date';
      }

      return {
        status: syncStatus,
        ahead,
        behind,
        hasLocalChanges,
        currentBranch,
      };
    } catch (error) {
      return {
        status: 'error',
        ahead: 0,
        behind: 0,
        hasLocalChanges: false,
        currentBranch: 'unknown',
      };
    }
  }

  async pull(): Promise<PullResult> {
    try {
      const result = await this.git.pull();
      return {
        success: true,
        changes: result.files.length,
      };
    } catch (error) {
      return {
        success: false,
        changes: 0,
        error: (error as Error).message,
      };
    }
  }

  async push(): Promise<void> {
    await this.git.push();
  }

  async getCurrentBranch(): Promise<string> {
    const branchSummary = await this.git.branch();
    return branchSummary.current;
  }

  async getRemoteUrl(): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      return origin?.refs.fetch || null;
    } catch {
      return null;
    }
  }

  static isGitRepository(path: string): boolean {
    return existsSync(`${path}/.git`);
  }

  getPath(): string {
    return this.repoPath;
  }

  async getCommitHistory(count: number = 20): Promise<Commit[]> {
    try {
      const log = await this.git.log({ maxCount: count });

      return log.all.map(commit => ({
        hash: commit.hash,
        hashShort: commit.hash.substring(0, 7),
        author: commit.author_name,
        authorEmail: commit.author_email,
        message: commit.message,
        date: commit.date,
      }));
    } catch (error) {
      console.error('Error getting commit history:', error);
      return [];
    }
  }

  async getCommitsThisWeek(): Promise<number> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const since = oneWeekAgo.toISOString().split('T')[0];

      const log = await this.git.log({ '--since': since });
      return log.all.length;
    } catch (error) {
      console.error('Error getting commits this week:', error);
      return 0;
    }
  }
}
