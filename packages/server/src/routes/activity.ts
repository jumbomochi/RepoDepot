import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { RepositoryRepository, ConfigRepository } from '../repositories/index.js';
import { GitService } from '../services/GitService.js';
import { GitHubService } from '../services/GitHubService.js';
import { RepoActivity, ActivitySummary, Commit, Contributor } from '@repodepot/shared';

export const activityRoutes: IRouter = Router();

// Get commit history for a repository (from local git)
activityRoutes.get('/repositories/:id/commits', async (req, res) => {
  try {
    const db = getDb();
    const repoRepo = new RepositoryRepository(db);

    const repoId = parseInt(req.params.id, 10);
    const count = parseInt(req.query.count as string, 10) || 20;

    const repository = repoRepo.findById(repoId);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (!repository.localPath || !GitService.isGitRepository(repository.localPath)) {
      return res.status(400).json({ error: 'Repository not cloned locally' });
    }

    const git = new GitService(repository.localPath);
    const commits = await git.getCommitHistory(count);

    res.json(commits);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get activity summary for a single repository
activityRoutes.get('/repositories/:id/activity', async (req, res) => {
  try {
    const db = getDb();
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const repoId = parseInt(req.params.id, 10);
    const repository = repoRepo.findById(repoId);

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const activity: RepoActivity = {
      repoId: repository.id,
      repoFullName: repository.fullName,
      recentCommits: [],
      commitsThisWeek: 0,
      topContributors: [],
      openIssues: 0,
      openPRs: 0,
    };

    // Get local commit history if repo is cloned
    if (repository.localPath && GitService.isGitRepository(repository.localPath)) {
      const git = new GitService(repository.localPath);
      activity.recentCommits = await git.getCommitHistory(10);
      activity.commitsThisWeek = await git.getCommitsThisWeek();
    }

    // Get GitHub data if token is configured
    const token = configRepo.getGitHubToken();
    if (token) {
      const [owner, repo] = repository.fullName.split('/');
      const github = new GitHubService(token);

      try {
        const stats = await github.getRepoStats(owner, repo);
        activity.openIssues = stats.openIssues;
        activity.openPRs = stats.openPRs;

        const contributors = await github.getContributors(owner, repo);
        activity.topContributors = contributors;
      } catch (error) {
        console.error(`Error fetching GitHub data for ${repository.fullName}:`, error);
      }
    }

    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get global activity summary across all repositories
activityRoutes.get('/summary', async (req, res) => {
  try {
    const db = getDb();
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const repositories = repoRepo.findAll();
    const token = configRepo.getGitHubToken();

    let totalCommitsThisWeek = 0;
    let totalPRsMerged = 0;
    const contributorMap = new Map<string, Contributor>();
    const recentActivity: ActivitySummary['recentActivity'] = [];

    // Gather data from all repositories
    for (const repository of repositories) {
      // Get local commit data
      if (repository.localPath && GitService.isGitRepository(repository.localPath)) {
        const git = new GitService(repository.localPath);
        const commitsThisWeek = await git.getCommitsThisWeek();
        totalCommitsThisWeek += commitsThisWeek;

        // Get recent commits for activity feed
        const recentCommits = await git.getCommitHistory(5);
        for (const commit of recentCommits) {
          recentActivity.push({
            type: 'commit',
            repoFullName: repository.fullName,
            title: commit.message.split('\n')[0], // First line only
            author: commit.author,
            timestamp: commit.date,
          });
        }
      }

      // Get GitHub data
      if (token) {
        const [owner, repo] = repository.fullName.split('/');
        const github = new GitHubService(token);

        try {
          // Get contributors
          const contributors = await github.getContributors(owner, repo);
          for (const c of contributors) {
            if (contributorMap.has(c.login)) {
              const existing = contributorMap.get(c.login)!;
              existing.contributions += c.contributions;
            } else {
              contributorMap.set(c.login, { ...c });
            }
          }

          // Count merged PRs from stored PRs
          const prs = repoRepo.getPullRequestsByRepo(repository.id);
          totalPRsMerged += prs.filter(pr => pr.state === 'merged').length;
        } catch (error) {
          console.error(`Error fetching GitHub data for ${repository.fullName}:`, error);
        }
      }
    }

    // Sort recent activity by timestamp
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const summary: ActivitySummary = {
      totalCommitsThisWeek,
      totalPRsMerged,
      activeContributors: contributorMap.size,
      recentActivity: recentActivity.slice(0, 20), // Limit to 20 most recent
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get commits from GitHub (remote) for a repository
activityRoutes.get('/repositories/:id/github-commits', async (req, res) => {
  try {
    const db = getDb();
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const repoId = parseInt(req.params.id, 10);
    const count = parseInt(req.query.count as string, 10) || 20;

    const repository = repoRepo.findById(repoId);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const token = configRepo.getGitHubToken();
    if (!token) {
      return res.status(400).json({ error: 'GitHub token not configured' });
    }

    const [owner, repo] = repository.fullName.split('/');
    const github = new GitHubService(token);
    const commits = await github.getRecentCommits(owner, repo, count);

    res.json(commits);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get contributors for a repository from GitHub
activityRoutes.get('/repositories/:id/contributors', async (req, res) => {
  try {
    const db = getDb();
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const repoId = parseInt(req.params.id, 10);
    const repository = repoRepo.findById(repoId);

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const token = configRepo.getGitHubToken();
    if (!token) {
      return res.status(400).json({ error: 'GitHub token not configured' });
    }

    const [owner, repo] = repository.fullName.split('/');
    const github = new GitHubService(token);
    const contributors = await github.getContributors(owner, repo);

    res.json(contributors);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
