import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { RepositoryRepository } from '../repositories/index.js';

export const pullRequestRoutes: IRouter = Router();

// Get all pull requests
pullRequestRoutes.get('/', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const stateFilter = req.query.state as string | undefined;

    if (stateFilter === 'open') {
      const prs = repoRepository.getOpenPullRequests();
      res.json(prs);
    } else {
      const prs = repoRepository.getAllPullRequests();
      res.json(prs);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get pull requests for a specific repository
pullRequestRoutes.get('/repo/:repoId', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const repoId = parseInt(req.params.repoId);

    if (isNaN(repoId)) {
      return res.status(400).json({ error: 'Invalid repository ID' });
    }

    const prs = repoRepository.getPullRequestsByRepo(repoId);
    res.json(prs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create or update a pull request
pullRequestRoutes.post('/', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const pr = repoRepository.upsertPullRequest(req.body);
    res.status(201).json(pr);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Bulk upsert pull requests (for syncing)
pullRequestRoutes.post('/bulk', (req, res) => {
  try {
    const db = getDb();
    const repoRepository = new RepositoryRepository(db);
    const prs = req.body as Array<any>;

    if (!Array.isArray(prs)) {
      return res.status(400).json({ error: 'Request body must be an array' });
    }

    const results = prs.map(pr => repoRepository.upsertPullRequest(pr));
    res.status(201).json(results);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
