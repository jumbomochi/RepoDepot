import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { RepositoryRepository, ConfigRepository } from '../repositories/index.js';
import { GitService, GitHubService } from '../services/index.js';
import { homedir } from 'os';
import { join } from 'path';

export const repositoryRoutes: IRouter = Router();

// Get all repositories with their status
repositoryRoutes.get('/', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const includeStatus = req.query.includeStatus === 'true';

    if (includeStatus) {
      const repos = repoRepository.getAllWithStatus();
      res.json(repos);
    } else {
      const repos = repoRepository.findAll();
      res.json(repos);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get a single repository by ID
repositoryRoutes.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    const repo = repoRepository.findById(id);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    res.json(repo);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get repository status
repositoryRoutes.get('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    const status = repoRepository.getStatus(id);

    if (!status) {
      return res.status(404).json({ error: 'Repository status not found' });
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create a new repository
repositoryRoutes.post('/', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const repo = repoRepository.create(req.body);
    res.status(201).json(repo);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Update a repository
repositoryRoutes.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    const repo = repoRepository.update(id, req.body);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    res.json(repo);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Update repository status
repositoryRoutes.put('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    repoRepository.upsertStatus({
      repoId: id,
      ...req.body,
    });

    const status = repoRepository.getStatus(id);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Delete a repository
repositoryRoutes.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    const deleted = repoRepository.delete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ ACTION ENDPOINTS ============

// Sync a repository (fetch + update status)
repositoryRoutes.post('/:id/sync', async (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    const repo = repoRepository.findById(id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (!repo.localPath) {
      return res.status(400).json({ error: 'Repository not cloned locally. Clone it first.' });
    }

    if (!GitService.isGitRepository(repo.localPath)) {
      return res.status(400).json({ error: 'Local path is not a git repository' });
    }

    const gitService = new GitService(repo.localPath);
    const statusInfo = await gitService.getStatus();

    // Update status in database
    repoRepository.upsertStatus({
      repoId: id,
      status: statusInfo.status,
      ahead: statusInfo.ahead,
      behind: statusInfo.behind,
      hasLocalChanges: statusInfo.hasLocalChanges,
      currentBranch: statusInfo.currentBranch,
      lastCheckedAt: new Date().toISOString(),
    });

    // Update lastSyncedAt
    repoRepository.update(id, { lastSyncedAt: new Date().toISOString() });

    const status = repoRepository.getStatus(id);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Pull updates for a repository
repositoryRoutes.post('/:id/pull', async (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    const repo = repoRepository.findById(id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (!repo.localPath) {
      return res.status(400).json({ error: 'Repository not cloned locally' });
    }

    if (!GitService.isGitRepository(repo.localPath)) {
      return res.status(400).json({ error: 'Local path is not a git repository' });
    }

    const gitService = new GitService(repo.localPath);
    const pullResult = await gitService.pull();

    if (!pullResult.success) {
      return res.status(500).json({ success: false, error: pullResult.error });
    }

    // Update status after pull
    const statusInfo = await gitService.getStatus();
    repoRepository.upsertStatus({
      repoId: id,
      status: statusInfo.status,
      ahead: statusInfo.ahead,
      behind: statusInfo.behind,
      hasLocalChanges: statusInfo.hasLocalChanges,
      currentBranch: statusInfo.currentBranch,
      lastCheckedAt: new Date().toISOString(),
    });

    repoRepository.update(id, { lastSyncedAt: new Date().toISOString() });

    const status = repoRepository.getStatus(id);
    res.json({ success: true, changes: pullResult.changes, status });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Clone a repository
repositoryRoutes.post('/:id/clone', async (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const configRepository = new ConfigRepository(db);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    const repo = repoRepository.findById(id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (repo.localPath && GitService.isGitRepository(repo.localPath)) {
      return res.status(400).json({ error: 'Repository is already cloned' });
    }

    // Determine destination path
    const defaultClonePath = configRepository.getDefaultClonePath();
    const destinationPath = req.body.path || join(defaultClonePath, repo.fullName);

    const cloneResult = await GitService.clone(repo.cloneUrl, destinationPath);

    if (!cloneResult.success) {
      return res.status(500).json({ success: false, error: cloneResult.error });
    }

    // Update repository with local path
    repoRepository.update(id, { localPath: destinationPath });

    // Get initial status
    const gitService = new GitService(destinationPath);
    const statusInfo = await gitService.getStatus();

    repoRepository.upsertStatus({
      repoId: id,
      status: statusInfo.status,
      ahead: statusInfo.ahead,
      behind: statusInfo.behind,
      hasLocalChanges: statusInfo.hasLocalChanges,
      currentBranch: statusInfo.currentBranch,
      lastCheckedAt: new Date().toISOString(),
    });

    const updatedRepo = repoRepository.findById(id);
    const status = repoRepository.getStatus(id);

    res.json({ success: true, repository: updatedRepo, status });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Sync all repositories
repositoryRoutes.post('/sync-all', async (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const repos = repoRepository.findAll();

    const results = [];

    for (const repo of repos) {
      if (!repo.localPath || !GitService.isGitRepository(repo.localPath)) {
        results.push({ repoId: repo.id, success: false, error: 'Not cloned locally' });
        continue;
      }

      try {
        const gitService = new GitService(repo.localPath);
        const statusInfo = await gitService.getStatus();

        repoRepository.upsertStatus({
          repoId: repo.id,
          status: statusInfo.status,
          ahead: statusInfo.ahead,
          behind: statusInfo.behind,
          hasLocalChanges: statusInfo.hasLocalChanges,
          currentBranch: statusInfo.currentBranch,
          lastCheckedAt: new Date().toISOString(),
        });

        repoRepository.update(repo.id, { lastSyncedAt: new Date().toISOString() });

        results.push({ repoId: repo.id, success: true, status: statusInfo });
      } catch (error) {
        results.push({ repoId: repo.id, success: false, error: (error as Error).message });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Fetch PRs from GitHub for a repository
repositoryRoutes.post('/:id/fetch-prs', async (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const configRepository = new ConfigRepository(db);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    const repo = repoRepository.findById(id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const token = configRepository.getGitHubToken();
    if (!token) {
      return res.status(400).json({ error: 'GitHub token not configured. Set it in Settings.' });
    }

    // Parse owner/repo from fullName
    const [owner, repoName] = repo.fullName.split('/');
    if (!owner || !repoName) {
      return res.status(400).json({ error: 'Invalid repository name format' });
    }

    const githubService = new GitHubService(token);
    const prs = await githubService.getPullRequests(owner, repoName);

    // Upsert PRs to database
    for (const pr of prs) {
      repoRepository.upsertPullRequest({
        repoId: id,
        githubId: pr.githubId,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        author: pr.author,
        updatedAt: pr.updatedAt,
        url: pr.url,
        repoFullName: repo.fullName,
      });
    }

    res.json({ success: true, count: prs.length, prs });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Fetch PRs from GitHub for all repositories
repositoryRoutes.post('/fetch-all-prs', async (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const configRepository = new ConfigRepository(db);

    const token = configRepository.getGitHubToken();
    if (!token) {
      return res.status(400).json({ error: 'GitHub token not configured. Set it in Settings.' });
    }

    const repos = repoRepository.findAll();
    const githubService = new GitHubService(token);
    const results = [];

    for (const repo of repos) {
      try {
        const [owner, repoName] = repo.fullName.split('/');
        if (!owner || !repoName) {
          results.push({ repoId: repo.id, success: false, error: 'Invalid name format' });
          continue;
        }

        const prs = await githubService.getPullRequests(owner, repoName);

        for (const pr of prs) {
          repoRepository.upsertPullRequest({
            repoId: repo.id,
            githubId: pr.githubId,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            draft: pr.draft,
            author: pr.author,
            updatedAt: pr.updatedAt,
            url: pr.url,
            repoFullName: repo.fullName,
          });
        }

        results.push({ repoId: repo.id, success: true, count: prs.length });
      } catch (error) {
        results.push({ repoId: repo.id, success: false, error: (error as Error).message });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
