import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { SyncStatus } from '@repodepot/shared';
import { existsSync } from 'fs';

export interface GitStatusInfo {
  status: SyncStatus;
  ahead: number;
  behind: number;
  hasLocalChanges: boolean;
  currentBranch: string;
}

export class GitService {
  private git: SimpleGit;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  static async clone(cloneUrl: string, destinationPath: string): Promise<void> {
    const git = simpleGit();
    await git.clone(cloneUrl, destinationPath);
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
      console.error('Error getting git status:', error);
      return {
        status: 'error',
        ahead: 0,
        behind: 0,
        hasLocalChanges: false,
        currentBranch: 'unknown',
      };
    }
  }

  async pull(): Promise<void> {
    await this.git.pull();
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
    } catch (error) {
      return null;
    }
  }

  static isGitRepository(path: string): boolean {
    return existsSync(`${path}/.git`);
  }
}
