import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { IssueRepository } from '../repositories/index.js';
import { IssueStatus, IssuePriority } from '@repodepot/shared';

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
