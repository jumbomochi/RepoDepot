import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { ConfigRepository } from '../repositories/index.js';
import { GitHubService } from '../services/index.js';

export const configRoutes: IRouter = Router();

// Get public config (token masked)
configRoutes.get('/', (req, res) => {
  try {
    const db = getDb();
    const configRepository = new ConfigRepository(db);
    const config = configRepository.getPublicConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update config
configRoutes.put('/', (req, res) => {
  try {
    const db = getDb();
    const configRepository = new ConfigRepository(db);
    const { githubToken, defaultClonePath, autoFetch, fetchIntervalMinutes } = req.body;

    if (githubToken !== undefined) {
      if (githubToken === '' || githubToken === null) {
        configRepository.clearGitHubToken();
      } else {
        configRepository.setGitHubToken(githubToken);
      }
    }

    if (defaultClonePath !== undefined) {
      configRepository.setDefaultClonePath(defaultClonePath);
    }

    if (autoFetch !== undefined) {
      configRepository.setAutoFetch(autoFetch);
    }

    if (fetchIntervalMinutes !== undefined) {
      configRepository.setFetchIntervalMinutes(fetchIntervalMinutes);
    }

    const config = configRepository.getPublicConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Verify GitHub token
configRoutes.get('/github/verify', async (req, res) => {
  try {
    const db = getDb();
    const configRepository = new ConfigRepository(db);
    const token = configRepository.getGitHubToken();

    if (!token) {
      return res.json({ valid: false, error: 'No token configured' });
    }

    const githubService = new GitHubService(token);
    const verification = await githubService.verifyToken();

    res.json(verification);
  } catch (error) {
    res.status(500).json({ valid: false, error: (error as Error).message });
  }
});

// Test a GitHub token without saving
configRoutes.post('/github/test', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ valid: false, error: 'No token provided' });
    }

    const githubService = new GitHubService(token);
    const verification = await githubService.verifyToken();

    res.json(verification);
  } catch (error) {
    res.status(500).json({ valid: false, error: (error as Error).message });
  }
});
