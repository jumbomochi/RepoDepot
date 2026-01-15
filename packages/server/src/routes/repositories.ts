import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { RepositoryRepository } from '../repositories/index.js';

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
