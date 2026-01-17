import { Router, type IRouter } from 'express';
import { spawn, ChildProcess } from 'child_process';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getDb } from '../db/connection.js';
import { IssueRepository, RepositoryRepository, ConfigRepository } from '../repositories/index.js';
import { GitHubService } from '../services/GitHubService.js';
import { AgentStatus } from '@repodepot/shared';

// Logs directory for agent output
const LOGS_DIR = join(process.cwd(), 'agent-logs');
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

// Track running agents
const runningAgents: Map<number, { process: ChildProcess; startedAt: string; logs: string[]; logFile: string }> = new Map();

export const agentRoutes: IRouter = Router();

// Agent label mappings
const AGENT_LABELS: Record<AgentStatus, string> = {
  pending: 'claude-code-pending',
  assigned: 'claude-code-assigned',
  in_progress: 'claude-code-in-progress',
  completed: 'claude-code-completed',
  failed: 'claude-code-failed',
};

// Helper to update GitHub issue labels
async function updateGitHubLabels(
  github: GitHubService,
  owner: string,
  repo: string,
  issueNumber: number,
  newStatus: AgentStatus,
  oldStatus?: AgentStatus
): Promise<void> {
  try {
    // Get current labels
    const issue = await github.getIssue(owner, repo, issueNumber);
    let labels = [...issue.labels];

    // Remove old agent label if exists
    if (oldStatus) {
      labels = labels.filter(l => l !== AGENT_LABELS[oldStatus]);
    }
    // Also remove any other agent labels to be safe
    labels = labels.filter(l => !l.startsWith('claude-code-'));

    // Add new agent label
    labels.push(AGENT_LABELS[newStatus]);

    // Update labels on GitHub
    await github.updateIssue(owner, repo, issueNumber, { labels });
  } catch (error) {
    console.error(`Error updating GitHub labels for issue #${issueNumber}:`, error);
  }
}

// GET /api/agent/tasks/:repoId - Get pending tasks for a repo (for agent to poll)
agentRoutes.get('/tasks/:repoId', (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const repoRepo = new RepositoryRepository(db);

    const repoId = parseInt(req.params.repoId, 10);
    const repository = repoRepo.findById(repoId);

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const pendingTasks = issueRepo.findPendingByRepo(repoId);

    res.json({
      repository: {
        id: repository.id,
        fullName: repository.fullName,
        localPath: repository.localPath,
        cloneUrl: repository.cloneUrl,
      },
      tasks: pendingTasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        githubIssueNumber: task.githubIssueNumber,
        githubIssueUrl: task.githubIssueUrl,
        labels: task.labels,
        createdAt: task.createdAt,
      })),
      count: pendingTasks.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/agent/tasks/:issueId/claim - Agent claims a task
agentRoutes.post('/tasks/:issueId/claim', async (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const issue = issueRepo.findById(req.params.issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (issue.agentStatus !== 'pending') {
      return res.status(400).json({
        error: `Task already ${issue.agentStatus}`,
        currentStatus: issue.agentStatus,
      });
    }

    const now = new Date().toISOString();
    const updatedIssue = issueRepo.update(req.params.issueId, {
      agentStatus: 'assigned',
      agentClaimedAt: now,
      status: 'in-progress', // Also update issue status
    });

    // Update GitHub labels
    const token = configRepo.getGitHubToken();
    if (token && issue.githubIssueNumber) {
      const repository = repoRepo.findById(issue.repoId);
      if (repository) {
        const [owner, repo] = repository.fullName.split('/');
        const github = new GitHubService(token);
        await updateGitHubLabels(github, owner, repo, issue.githubIssueNumber, 'assigned', 'pending');
      }
    }

    res.json({
      success: true,
      issue: updatedIssue,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/agent/tasks/:issueId/status - Agent updates task status
agentRoutes.post('/tasks/:issueId/status', async (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const { status, error: agentError } = req.body as {
      status: AgentStatus;
      error?: string;
    };

    if (!status || !['assigned', 'in_progress', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const issue = issueRepo.findById(req.params.issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const oldStatus = issue.agentStatus;
    const updates: any = { agentStatus: status };

    if (status === 'in_progress') {
      updates.status = 'in-progress';
    } else if (status === 'completed') {
      updates.agentCompletedAt = new Date().toISOString();
      updates.status = 'review'; // Move to review when agent completes
    } else if (status === 'failed') {
      updates.agentError = agentError || 'Unknown error';
      updates.status = 'todo'; // Reset to todo on failure
    }

    const updatedIssue = issueRepo.update(req.params.issueId, updates);

    // Update GitHub labels
    const token = configRepo.getGitHubToken();
    if (token && issue.githubIssueNumber) {
      const repository = repoRepo.findById(issue.repoId);
      if (repository) {
        const [owner, repo] = repository.fullName.split('/');
        const github = new GitHubService(token);
        await updateGitHubLabels(github, owner, repo, issue.githubIssueNumber, status, oldStatus);
      }
    }

    res.json({
      success: true,
      issue: updatedIssue,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/agent/tasks/:issueId/complete - Agent marks task as complete
agentRoutes.post('/tasks/:issueId/complete', async (req, res) => {
  try {
    const db = getDb();
    const issueRepo = new IssueRepository(db);
    const repoRepo = new RepositoryRepository(db);
    const configRepo = new ConfigRepository(db);

    const { prUrl, prNumber, summary } = req.body as {
      prUrl?: string;
      prNumber?: number;
      summary?: string;
    };

    const issue = issueRepo.findById(req.params.issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const oldStatus = issue.agentStatus;
    const now = new Date().toISOString();

    const updatedIssue = issueRepo.update(req.params.issueId, {
      agentStatus: 'completed',
      agentCompletedAt: now,
      status: 'review',
      description: summary
        ? `${issue.description || ''}\n\n---\n**Agent Summary:** ${summary}${prUrl ? `\n**PR:** ${prUrl}` : ''}`
        : issue.description,
    });

    // Update GitHub labels and add comment
    const token = configRepo.getGitHubToken();
    if (token && issue.githubIssueNumber) {
      const repository = repoRepo.findById(issue.repoId);
      if (repository) {
        const [owner, repo] = repository.fullName.split('/');
        const github = new GitHubService(token);
        await updateGitHubLabels(github, owner, repo, issue.githubIssueNumber, 'completed', oldStatus);
      }
    }

    res.json({
      success: true,
      issue: updatedIssue,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/agent/repos - Get all repos with task counts (for agent discovery)
agentRoutes.get('/repos', (req, res) => {
  try {
    const db = getDb();
    const repoRepo = new RepositoryRepository(db);
    const issueRepo = new IssueRepository(db);

    const repos = repoRepo.findAll();

    const reposWithTasks = repos.map(repo => {
      const pendingTasks = issueRepo.findPendingByRepo(repo.id);
      const inProgressTasks = issueRepo.findByAgentStatus(repo.id, 'in_progress');
      const assignedTasks = issueRepo.findByAgentStatus(repo.id, 'assigned');

      return {
        id: repo.id,
        fullName: repo.fullName,
        localPath: repo.localPath,
        cloneUrl: repo.cloneUrl,
        taskCounts: {
          pending: pendingTasks.length,
          assigned: assignedTasks.length,
          inProgress: inProgressTasks.length,
        },
      };
    });

    res.json({
      repos: reposWithTasks,
      total: repos.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/agent/start/:repoId - Start an agent for a repository
agentRoutes.post('/start/:repoId', (req, res) => {
  try {
    const db = getDb();
    const repoRepo = new RepositoryRepository(db);

    const repoId = parseInt(req.params.repoId, 10);
    const repository = repoRepo.findById(repoId);

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Check if agent is already running
    if (runningAgents.has(repoId)) {
      return res.status(400).json({
        error: 'Agent already running for this repository',
        startedAt: runningAgents.get(repoId)?.startedAt,
      });
    }

    const workDir = req.body.workDir || repository.localPath;
    if (!workDir) {
      return res.status(400).json({
        error: 'No local path configured for repository. Provide workDir in request body.',
      });
    }

    const apiUrl = req.body.apiUrl || `http://localhost:${process.env.PORT || 3001}`;

    // Build the agent prompt
    const prompt = `You are an autonomous coding agent working on repository "${repository.fullName}".

IMPORTANT - Progress Reporting:
Before starting work on any task, declare your plan using the CLI:
  repodepot progress plan --task <taskId> "Step 1" "Step 2" "Step 3" ...

As you complete each step, update progress:
  repodepot progress update --task <taskId> --step <index> --status done

If you need clarification from the user:
  repodepot progress ask --task <taskId> "Your question" --choices "Option A" "Option B"
  # Then wait for the response:
  repodepot progress wait --task <taskId> --timeout 3600

If you discover additional steps needed:
  repodepot progress add --task <taskId> --after <index> "New step description"

Your workflow:
1. Fetch pending tasks: curl ${apiUrl}/api/agent/tasks/${repoId}
2. Claim a task: curl -X POST ${apiUrl}/api/agent/tasks/{taskId}/claim
3. Create your plan with repodepot progress plan
4. Work through each step, reporting progress
5. Ask for clarification if requirements are ambiguous
6. Commit with message referencing the GitHub issue
7. Mark complete: curl -X POST ${apiUrl}/api/agent/tasks/{taskId}/complete -H "Content-Type: application/json" -d '{"summary": "your summary"}'

Work autonomously and complete the task.`;

    // Create log file for this agent
    const logFile = join(LOGS_DIR, `agent-${repoId}-${Date.now()}.log`);
    const logStream = createWriteStream(logFile, { flags: 'a' });

    const startedAt = new Date().toISOString();
    logStream.write(`=== Agent started at ${startedAt} ===\n`);
    logStream.write(`Repository: ${repository.fullName}\n`);
    logStream.write(`Working directory: ${workDir}\n`);
    logStream.write(`Log file: ${logFile}\n`);
    logStream.write(`${'='.repeat(50)}\n\n`);

    // Spawn the Claude CLI process
    const agentProcess = spawn('claude', [
      '-p', prompt,
      '--dangerously-skip-permissions',
      '--verbose'
    ], {
      cwd: workDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logs: string[] = [];

    agentProcess.stdout?.on('data', (data) => {
      const line = data.toString();
      logs.push(line);
      // Keep only last 100 log lines
      if (logs.length > 100) logs.shift();
      logStream.write(line);
      console.log(`[Agent ${repoId}] ${line}`);
    });

    agentProcess.stderr?.on('data', (data) => {
      const line = data.toString();
      logs.push(`[ERROR] ${line}`);
      if (logs.length > 100) logs.shift();
      logStream.write(`[ERROR] ${line}`);
      console.error(`[Agent ${repoId}] ${line}`);
    });

    agentProcess.on('close', (code) => {
      const msg = `\n=== Agent exited with code ${code} at ${new Date().toISOString()} ===\n`;
      logStream.write(msg);
      logStream.end();
      console.log(`[Agent ${repoId}] Process exited with code ${code}`);
      runningAgents.delete(repoId);
    });

    agentProcess.on('error', (err) => {
      logStream.write(`[FATAL] Failed to start: ${err.message}\n`);
      logStream.end();
      console.error(`[Agent ${repoId}] Failed to start:`, err);
      runningAgents.delete(repoId);
    });

    runningAgents.set(repoId, { process: agentProcess, startedAt, logs, logFile });

    res.json({
      success: true,
      message: `Agent started for ${repository.fullName}`,
      repoId,
      startedAt,
      pid: agentProcess.pid,
      logFile,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/agent/stop/:repoId - Stop a running agent
agentRoutes.post('/stop/:repoId', (req, res) => {
  try {
    const repoId = parseInt(req.params.repoId, 10);
    const agent = runningAgents.get(repoId);

    if (!agent) {
      return res.status(404).json({ error: 'No agent running for this repository' });
    }

    agent.process.kill('SIGTERM');
    runningAgents.delete(repoId);

    res.json({
      success: true,
      message: `Agent stopped for repository ${repoId}`,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/agent/status/:repoId - Get agent status for a repository
agentRoutes.get('/status/:repoId', (req, res) => {
  try {
    const repoId = parseInt(req.params.repoId, 10);
    const agent = runningAgents.get(repoId);

    if (!agent) {
      return res.json({
        running: false,
        repoId,
      });
    }

    res.json({
      running: true,
      repoId,
      startedAt: agent.startedAt,
      pid: agent.process.pid,
      logFile: agent.logFile,
      recentLogs: agent.logs.slice(-20),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/agent/running - Get all running agents
agentRoutes.get('/running', (req, res) => {
  try {
    const agents = Array.from(runningAgents.entries()).map(([repoId, agent]) => ({
      repoId,
      startedAt: agent.startedAt,
      pid: agent.process.pid,
    }));

    res.json({
      agents,
      count: agents.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/agent/start-all - Start agents for all repos with pending tasks
agentRoutes.post('/start-all', (req, res) => {
  try {
    const db = getDb();
    const repoRepo = new RepositoryRepository(db);
    const issueRepo = new IssueRepository(db);

    const repos = repoRepo.findAll();
    const apiUrl = req.body.apiUrl || `http://localhost:${process.env.PORT || 3001}`;

    const results: {
      repoId: number;
      repoName: string;
      status: 'started' | 'already_running' | 'no_tasks' | 'no_local_path' | 'error';
      pendingTasks?: number;
      error?: string;
      pid?: number;
      logFile?: string;
    }[] = [];

    for (const repo of repos) {
      // Check for pending tasks
      const pendingTasks = issueRepo.findPendingByRepo(repo.id);

      if (pendingTasks.length === 0) {
        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          status: 'no_tasks',
          pendingTasks: 0,
        });
        continue;
      }

      // Check if agent already running
      if (runningAgents.has(repo.id)) {
        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          status: 'already_running',
          pendingTasks: pendingTasks.length,
        });
        continue;
      }

      // Check local path
      if (!repo.localPath) {
        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          status: 'no_local_path',
          pendingTasks: pendingTasks.length,
        });
        continue;
      }

      // Start the agent
      try {
        const prompt = `You are an autonomous coding agent working on repository "${repo.fullName}".

IMPORTANT - Progress Reporting:
Before starting work on any task, declare your plan using the CLI:
  repodepot progress plan --task <taskId> "Step 1" "Step 2" "Step 3" ...

As you complete each step, update progress:
  repodepot progress update --task <taskId> --step <index> --status done

If you need clarification from the user:
  repodepot progress ask --task <taskId> "Your question" --choices "Option A" "Option B"
  # Then wait for the response:
  repodepot progress wait --task <taskId> --timeout 3600

If you discover additional steps needed:
  repodepot progress add --task <taskId> --after <index> "New step description"

Your workflow:
1. Fetch pending tasks: curl ${apiUrl}/api/agent/tasks/${repo.id}
2. Claim a task: curl -X POST ${apiUrl}/api/agent/tasks/{taskId}/claim
3. Create your plan with repodepot progress plan
4. Work through each step, reporting progress
5. Ask for clarification if requirements are ambiguous
6. Commit with message referencing the GitHub issue
7. Mark complete: curl -X POST ${apiUrl}/api/agent/tasks/{taskId}/complete -H "Content-Type: application/json" -d '{"summary": "your summary"}'

Work autonomously and complete the task.`;

        // Create log file for this agent
        const logFile = join(LOGS_DIR, `agent-${repo.id}-${Date.now()}.log`);
        const logStream = createWriteStream(logFile, { flags: 'a' });

        const startedAt = new Date().toISOString();
        logStream.write(`=== Agent started at ${startedAt} ===\n`);
        logStream.write(`Repository: ${repo.fullName}\n`);
        logStream.write(`Working directory: ${repo.localPath}\n`);
        logStream.write(`Log file: ${logFile}\n`);
        logStream.write(`${'='.repeat(50)}\n\n`);

        const agentProcess = spawn('claude', [
          '-p', prompt,
          '--dangerously-skip-permissions',
          '--verbose'
        ], {
          cwd: repo.localPath,
          env: { ...process.env },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const logs: string[] = [];

        agentProcess.stdout?.on('data', (data) => {
          const line = data.toString();
          logs.push(line);
          if (logs.length > 100) logs.shift();
          logStream.write(line);
          console.log(`[Agent ${repo.id}] ${line}`);
        });

        agentProcess.stderr?.on('data', (data) => {
          const line = data.toString();
          logs.push(`[ERROR] ${line}`);
          if (logs.length > 100) logs.shift();
          logStream.write(`[ERROR] ${line}`);
          console.error(`[Agent ${repo.id}] ${line}`);
        });

        agentProcess.on('close', (code) => {
          const msg = `\n=== Agent exited with code ${code} at ${new Date().toISOString()} ===\n`;
          logStream.write(msg);
          logStream.end();
          console.log(`[Agent ${repo.id}] Process exited with code ${code}`);
          runningAgents.delete(repo.id);
        });

        agentProcess.on('error', (err) => {
          logStream.write(`[FATAL] Failed to start: ${err.message}\n`);
          logStream.end();
          console.error(`[Agent ${repo.id}] Failed to start:`, err);
          runningAgents.delete(repo.id);
        });

        runningAgents.set(repo.id, { process: agentProcess, startedAt, logs, logFile });

        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          status: 'started',
          pendingTasks: pendingTasks.length,
          pid: agentProcess.pid,
          logFile,
        });
      } catch (err) {
        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          status: 'error',
          pendingTasks: pendingTasks.length,
          error: (err as Error).message,
        });
      }
    }

    const started = results.filter(r => r.status === 'started').length;
    const totalPendingTasks = results.reduce((sum, r) => sum + (r.pendingTasks || 0), 0);

    res.json({
      success: true,
      summary: {
        totalRepos: repos.length,
        agentsStarted: started,
        alreadyRunning: results.filter(r => r.status === 'already_running').length,
        noTasks: results.filter(r => r.status === 'no_tasks').length,
        errors: results.filter(r => r.status === 'error').length,
        totalPendingTasks,
      },
      results,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/agent/stop-all - Stop all running agents
agentRoutes.post('/stop-all', (req, res) => {
  try {
    const stoppedAgents: number[] = [];

    for (const [repoId, agent] of runningAgents.entries()) {
      agent.process.kill('SIGTERM');
      stoppedAgents.push(repoId);
    }

    runningAgents.clear();

    res.json({
      success: true,
      stoppedCount: stoppedAgents.length,
      stoppedRepos: stoppedAgents,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
