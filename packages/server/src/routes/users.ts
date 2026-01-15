import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { UserRepository } from '../repositories/index.js';

export const userRoutes: IRouter = Router();

userRoutes.get('/', (req, res) => {
  try {
    const db = getDb();
    const userRepo = new UserRepository(db);
    const users = userRepo.findAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

userRoutes.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const userRepo = new UserRepository(db);
    const user = userRepo.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

userRoutes.post('/', (req, res) => {
  try {
    const db = getDb();
    const userRepo = new UserRepository(db);
    const user = userRepo.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

userRoutes.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const userRepo = new UserRepository(db);
    const user = userRepo.update(req.params.id, req.body);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

userRoutes.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const userRepo = new UserRepository(db);
    const deleted = userRepo.delete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
