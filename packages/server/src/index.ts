import express from 'express';
import cors from 'cors';
import { getDb } from './db/connection.js';
import { userRoutes } from './routes/users.js';
import { issueRoutes } from './routes/issues.js';
import { repositoryRoutes } from './routes/repositories.js';
import { pullRequestRoutes } from './routes/pull-requests.js';
import { configRoutes } from './routes/config.js';
import { activityRoutes } from './routes/activity.js';
import { agentRoutes } from './routes/agent.js';
import { progressRoutes } from './routes/progress.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const dbPath = process.env.DB_PATH || 'repodepot.db';
getDb(dbPath);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/repositories', repositoryRoutes);
app.use('/api/pull-requests', pullRequestRoutes);
app.use('/api/config', configRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/progress', progressRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
