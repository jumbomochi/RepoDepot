import { Octokit } from 'octokit';
import { PRState } from '@repodepot/shared';

export interface GitHubPR {
  githubId: number;
  number: number;
  title: string;
  state: PRState;
  draft: boolean;
  author: string;
  updatedAt: string;
  url: string;
}

export interface GitHubIssue {
  githubId: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  author: string;
  labels: string[];
  updatedAt: string;
  url: string;
}

export interface TokenVerification {
  valid: boolean;
  username?: string;
  error?: string;
}

export interface CreateIssueRequest {
  title: string;
  body?: string;
  labels?: string[];
}

export interface UpdateIssueRequest {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
}

export interface Contributor {
  login: string;
  avatarUrl: string;
  contributions: number;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  authorAvatar?: string;
  date: string;
  url: string;
}

export class GitHubService {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async verifyToken(): Promise<TokenVerification> {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return {
        valid: true,
        username: data.login,
      };
    } catch (error) {
      return {
        valid: false,
        error: (error as Error).message,
      };
    }
  }

  async getPullRequests(owner: string, repo: string): Promise<GitHubPR[]> {
    try {
      const { data } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      });

      return data.map(pr => ({
        githubId: pr.id,
        number: pr.number,
        title: pr.title,
        state: this.mapPRState(pr.state, pr.merged_at),
        draft: pr.draft || false,
        author: pr.user?.login || 'unknown',
        updatedAt: pr.updated_at,
        url: pr.html_url,
      }));
    } catch (error) {
      console.error(`Error fetching PRs for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async getIssues(owner: string, repo: string): Promise<GitHubIssue[]> {
    try {
      const { data } = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'all',
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      });

      // Filter out pull requests (GitHub API returns PRs as issues too)
      return data
        .filter(issue => !issue.pull_request)
        .map(issue => ({
          githubId: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body ?? null,
          state: issue.state as 'open' | 'closed',
          author: issue.user?.login || 'unknown',
          labels: issue.labels.map(label =>
            typeof label === 'string' ? label : label.name || ''
          ),
          updatedAt: issue.updated_at,
          url: issue.html_url,
        }));
    } catch (error) {
      console.error(`Error fetching issues for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async getRepoInfo(owner: string, repo: string): Promise<{
    defaultBranch: string;
    description: string | null;
    private: boolean;
  }> {
    const { data } = await this.octokit.rest.repos.get({ owner, repo });
    return {
      defaultBranch: data.default_branch,
      description: data.description,
      private: data.private,
    };
  }

  private mapPRState(state: string, mergedAt: string | null): PRState {
    if (mergedAt) {
      return 'merged';
    }
    if (state === 'closed') {
      return 'closed';
    }
    return 'open';
  }

  // === Issue Management Methods ===

  async createIssue(
    owner: string,
    repo: string,
    request: CreateIssueRequest
  ): Promise<GitHubIssue> {
    try {
      const { data } = await this.octokit.rest.issues.create({
        owner,
        repo,
        title: request.title,
        body: request.body,
        labels: request.labels,
      });

      return {
        githubId: data.id,
        number: data.number,
        title: data.title,
        body: data.body ?? null,
        state: data.state as 'open' | 'closed',
        author: data.user?.login || 'unknown',
        labels: data.labels.map(label =>
          typeof label === 'string' ? label : label.name || ''
        ),
        updatedAt: data.updated_at,
        url: data.html_url,
      };
    } catch (error) {
      console.error(`Error creating issue in ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    request: UpdateIssueRequest
  ): Promise<GitHubIssue> {
    try {
      const { data } = await this.octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        title: request.title,
        body: request.body,
        state: request.state,
        labels: request.labels,
      });

      return {
        githubId: data.id,
        number: data.number,
        title: data.title,
        body: data.body ?? null,
        state: data.state as 'open' | 'closed',
        author: data.user?.login || 'unknown',
        labels: data.labels.map(label =>
          typeof label === 'string' ? label : label.name || ''
        ),
        updatedAt: data.updated_at,
        url: data.html_url,
      };
    } catch (error) {
      console.error(`Error updating issue #${issueNumber} in ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    try {
      const { data } = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      return {
        githubId: data.id,
        number: data.number,
        title: data.title,
        body: data.body ?? null,
        state: data.state as 'open' | 'closed',
        author: data.user?.login || 'unknown',
        labels: data.labels.map(label =>
          typeof label === 'string' ? label : label.name || ''
        ),
        updatedAt: data.updated_at,
        url: data.html_url,
      };
    } catch (error) {
      console.error(`Error fetching issue #${issueNumber} from ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async closeIssue(owner: string, repo: string, issueNumber: number): Promise<void> {
    try {
      await this.octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        state: 'closed',
      });
    } catch (error) {
      console.error(`Error closing issue #${issueNumber} in ${owner}/${repo}:`, error);
      throw error;
    }
  }

  // === Activity & Contributors Methods ===

  async getContributors(owner: string, repo: string): Promise<Contributor[]> {
    try {
      const { data } = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 10,
      });

      return data.map(contributor => ({
        login: contributor.login || 'unknown',
        avatarUrl: contributor.avatar_url || '',
        contributions: contributor.contributions || 0,
      }));
    } catch (error) {
      console.error(`Error fetching contributors for ${owner}/${repo}:`, error);
      return [];
    }
  }

  async getRecentCommits(owner: string, repo: string, count: number = 20): Promise<CommitInfo[]> {
    try {
      const { data } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: count,
      });

      return data.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.author?.login || commit.commit.author?.name || 'unknown',
        authorAvatar: commit.author?.avatar_url,
        date: commit.commit.author?.date || '',
        url: commit.html_url,
      }));
    } catch (error) {
      console.error(`Error fetching commits for ${owner}/${repo}:`, error);
      return [];
    }
  }

  async getRepoStats(owner: string, repo: string): Promise<{
    openIssues: number;
    openPRs: number;
    stars: number;
    forks: number;
  }> {
    try {
      const { data } = await this.octokit.rest.repos.get({ owner, repo });

      // Get open PR count
      const { data: prs } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: 'open',
        per_page: 1,
      });

      return {
        openIssues: data.open_issues_count - (prs.length > 0 ? 1 : 0), // Approximate
        openPRs: prs.length,
        stars: data.stargazers_count,
        forks: data.forks_count,
      };
    } catch (error) {
      console.error(`Error fetching stats for ${owner}/${repo}:`, error);
      return { openIssues: 0, openPRs: 0, stars: 0, forks: 0 };
    }
  }
}
