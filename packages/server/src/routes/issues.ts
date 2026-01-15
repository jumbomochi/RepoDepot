import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { IssueRepository, RepositoryRepository, ConfigRepository } from '../repositories/index.js';
import { IssueStatus, IssuePriority } from '@repodepot/shared';
import { GitHubService } from '../services/GitHubService.js';

export const issueRoutes: IRouter = Router();

issueRoutes.get('/', (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);

    const filters: {
      repoId?: number;
      status?: IssueStatus;
      assigneeId?: string;
      priority?: IssuePriority;
    } = {};

    if (req.query.repoId) filters.repoId = parseInt(req.query.repoId as string, 10);
    if (req.query.status) filters.status = req.query.status as IssueStatus;
    if (req.query.assigneeId) filters.assigneeId = req.query.assigneeId as string;
    if (req.query.priority) filters.priority = req.query.priority as IssuePriority;

    const issues = issueRepo.findAll(filters);
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

issueRoutes.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const issue = issueRepo.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json(issue);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

issueRoutes.post('/', (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const issue = issueRepo.create(req.body);
    res.status(201).json(issue);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

issueRoutes.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const issue = issueRepo.update(req.params.id, req.body);

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json(issue);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

issueRoutes.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const deleted = issueRepo.delete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// === GitHub Sync Endpoints ===

// Sync issue to GitHub (create or update)
issueRoutes.post('/:id/sync-to-github', async (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const issue = issueRepo.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const repository = repoRepo.findById(issue.repoId);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const token = configRepo.getGitHubToken();
    if (!token) {
      return res.status(400).json({ error: 'GitHub token not configured' });
    }

    const [owner, repo] = repository.fullName.split('/');
    const github = new GitHubService(token);

    let githubIssue;
    const now = new Date().toISOString();

    if (issue.githubIssueNumber) {
      // Update existing GitHub issue
      githubIssue = await github.updateIssue(owner, repo, issue.githubIssueNumber, {
        title: issue.title,
        body: issue.description,
        state: issue.status === 'done' ? 'closed' : 'open',
        labels: issue.labels,
      });
    } else {
      // Create new GitHub issue
      githubIssue = await github.createIssue(owner, repo, {
        title: issue.title,
        body: issue.description,
        labels: issue.labels,
      });
    }

    // Update local issue with GitHub info
    const updatedIssue = issueRepo.update(req.params.id, {
      githubIssueNumber: githubIssue.number,
      githubIssueUrl: githubIssue.url,
      syncedAt: now,
    });

    res.json({
      issue: updatedIssue,
      githubIssue,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Sync issue from GitHub (pull updates)
issueRoutes.post('/:id/sync-from-github', async (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const issue = issueRepo.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (!issue.githubIssueNumber) {
      return res.status(400).json({ error: 'Issue not synced to GitHub yet' });
    }

    const repository = repoRepo.findById(issue.repoId);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const token = configRepo.getGitHubToken();
    if (!token) {
      return res.status(400).json({ error: 'GitHub token not configured' });
    }

    const [owner, repo] = repository.fullName.split('/');
    const github = new GitHubService(token);
    const now = new Date().toISOString();

    const githubIssue = await github.getIssue(owner, repo, issue.githubIssueNumber);

    // Map GitHub state to local status
    let newStatus: IssueStatus = issue.status;
    if (githubIssue.state === 'closed' && issue.status !== 'done') {
      newStatus = 'done';
    } else if (githubIssue.state === 'open' && issue.status === 'done') {
      newStatus = 'todo';
    }

    // Update local issue with GitHub data
    const updatedIssue = issueRepo.update(req.params.id, {
      title: githubIssue.title,
      description: githubIssue.body || undefined,
      status: newStatus,
      labels: githubIssue.labels,
      syncedAt: now,
    });

    res.json({
      issue: updatedIssue,
      githubIssue,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Sync all unsynced issues for a repository to GitHub
issueRoutes.post('/sync-all/:repoId', async (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const repoId = parseInt(req.params.repoId, 10);
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

    // Get all unsynced issues for this repo
    const unsyncedIssues = issueRepo.findUnsyncedByRepo(repoId);
    const results: { issueId: string; success: boolean; error?: string; githubNumber?: number }[] = [];

    for (const issue of unsyncedIssues) {
      try {
        const githubIssue = await github.createIssue(owner, repo, {
          title: issue.title,
          body: issue.description,
          labels: issue.labels,
        });

        issueRepo.update(issue.id, {
          githubIssueNumber: githubIssue.number,
          githubIssueUrl: githubIssue.url,
          syncedAt: new Date().toISOString(),
        });

        results.push({ issueId: issue.id, success: true, githubNumber: githubIssue.number });
      } catch (error) {
        results.push({ issueId: issue.id, success: false, error: (error as Error).message });
      }
    }

    res.json({
      total: unsyncedIssues.length,
      synced: results.filter(r => r.success).length,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Fetch issues from GitHub and import to local
issueRoutes.post('/import-from-github/:repoId', async (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const repoId = parseInt(req.params.repoId, 10);
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

    const githubIssues = await github.getIssues(owner, repo);
    const results: { githubNumber: number; action: 'created' | 'updated' | 'skipped'; issueId?: string }[] = [];
    const now = new Date().toISOString();

    for (const ghIssue of githubIssues) {
      // Check if issue already exists locally
      const existingIssue = issueRepo.findByGitHubIssueNumber(repoId, ghIssue.number);

      if (existingIssue) {
        // Update existing issue
        issueRepo.update(existingIssue.id, {
          title: ghIssue.title,
          description: ghIssue.body || undefined,
          status: ghIssue.state === 'closed' ? 'done' : 'todo',
          labels: ghIssue.labels,
          syncedAt: now,
        });
        results.push({ githubNumber: ghIssue.number, action: 'updated', issueId: existingIssue.id });
      } else {
        // Create new local issue
        const newIssue = issueRepo.create({
          repoId,
          title: ghIssue.title,
          description: ghIssue.body || undefined,
          status: ghIssue.state === 'closed' ? 'done' : 'todo',
          priority: 'medium',
          reporterId: 'github-import',
          labels: ghIssue.labels,
          githubIssueNumber: ghIssue.number,
          githubIssueUrl: ghIssue.url,
          syncedAt: now,
        });
        results.push({ githubNumber: ghIssue.number, action: 'created', issueId: newIssue.id });
      }
    }

    res.json({
      total: githubIssues.length,
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
