import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { ProjectRepository } from '../repositories/index.js';

export const projectRoutes: IRouter = Router();

projectRoutes.get('/', (req, res) => {
  try {
    const db = getDb();
    const projectRepo = new ProjectRepository(db);
    const projects = projectRepo.findAll();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

projectRoutes.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const projectRepo = new ProjectRepository(db);
    const project = projectRepo.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

projectRoutes.post('/', (req, res) => {
  try {
    const db = getDb();
    const projectRepo = new ProjectRepository(db);
    const project = projectRepo.create(req.body);
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

projectRoutes.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const projectRepo = new ProjectRepository(db);
    const project = projectRepo.update(req.params.id, req.body);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

projectRoutes.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const projectRepo = new ProjectRepository(db);
    const deleted = projectRepo.delete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
