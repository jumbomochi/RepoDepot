import { Command } from 'commander';
import { spawn } from 'child_process';
import { join } from 'path';

interface RepoInfo {
  id: number;
  fullName: string;
  localPath: string | null;
  cloneUrl: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  githubIssueNumber: number;
  githubIssueUrl: string;
  labels: string[];
}

interface TasksResponse {
  repository: RepoInfo;
  tasks: Task[];
  count: number;
}

const DEFAULT_API_URL = 'http://localhost:3001';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

async function getPendingTasks(apiUrl: string, repoId: number): Promise<TasksResponse> {
  return fetchJson<TasksResponse>(`${apiUrl}/api/agent/tasks/${repoId}`);
}

async function claimTask(apiUrl: string, taskId: string): Promise<void> {
  await fetchJson(`${apiUrl}/api/agent/tasks/${taskId}/claim`, { method: 'POST' });
}

async function updateTaskStatus(apiUrl: string, taskId: string, status: string, error?: string): Promise<void> {
  await fetchJson(`${apiUrl}/api/agent/tasks/${taskId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, error }),
  });
}

async function completeTask(apiUrl: string, taskId: string, summary: string, prUrl?: string): Promise<void> {
  await fetchJson(`${apiUrl}/api/agent/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ summary, prUrl }),
  });
}

function runClaudeCode(workDir: string, prompt: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    console.log(`\n📂 Working directory: ${workDir}`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);
    console.log('\n🤖 Starting Claude Code...\n');

    const claude = spawn('claude', ['-p', prompt, '--yes'], {
      cwd: workDir,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    });

    let output = '';
    let errorOutput = '';

    claude.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    claude.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(text);
    });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, output: errorOutput || output || `Exit code ${code}` });
      }
    });

    claude.on('error', (err) => {
      resolve({ success: false, output: err.message });
    });
  });
}

async function processTask(apiUrl: string, task: Task, workDir: string): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Task: ${task.title}`);
  console.log(`🔗 GitHub: ${task.githubIssueUrl}`);
  console.log(`📊 Priority: ${task.priority}`);
  console.log(`${'='.repeat(60)}`);

  // Claim the task
  console.log('\n⏳ Claiming task...');
  await claimTask(apiUrl, task.id);
  console.log('✅ Task claimed');

  // Update status to in_progress
  await updateTaskStatus(apiUrl, task.id, 'in_progress');
  console.log('🔄 Status: in_progress');

  // Build the prompt for Claude Code
  const prompt = `You are working on GitHub issue #${task.githubIssueNumber}: "${task.title}"

Issue Description:
${task.description || 'No description provided.'}

Labels: ${task.labels.join(', ') || 'none'}

Your task:
1. Understand the issue and investigate the codebase
2. Implement the fix or feature
3. Test your changes
4. Create a commit with a descriptive message referencing the issue

When done, summarize what you did.`;

  // Run Claude Code
  const result = await runClaudeCode(workDir, prompt);

  if (result.success) {
    // Extract a summary from the output (last few lines typically contain summary)
    const lines = result.output.trim().split('\n');
    const summary = lines.slice(-5).join('\n').substring(0, 500);

    await completeTask(apiUrl, task.id, summary || 'Task completed successfully');
    console.log('\n✅ Task completed!');
  } else {
    await updateTaskStatus(apiUrl, task.id, 'failed', result.output.substring(0, 500));
    console.log('\n❌ Task failed:', result.output.substring(0, 200));
  }
}

export const agentCommand = new Command('agent')
  .description('Run Claude Code agent to process pending tasks')
  .requiredOption('-r, --repo <id>', 'Repository ID to process tasks for')
  .option('-d, --dir <path>', 'Local repository directory (overrides repo localPath)')
  .option('--api <url>', 'RepoDepot API URL', DEFAULT_API_URL)
  .option('--once', 'Process one task and exit (default: process all pending)')
  .option('--watch', 'Keep watching for new tasks')
  .option('--interval <seconds>', 'Poll interval in seconds for watch mode', '30')
  .action(async (options) => {
    const apiUrl = options.api;
    const repoId = parseInt(options.repo, 10);
    const watchMode = options.watch;
    const pollInterval = parseInt(options.interval, 10) * 1000;
    const processOnce = options.once;

    console.log('🚀 RepoDepot Agent Starting...');
    console.log(`📡 API: ${apiUrl}`);
    console.log(`📦 Repository ID: ${repoId}`);

    const processAllTasks = async () => {
      try {
        const response = await getPendingTasks(apiUrl, repoId);

        if (!response.repository) {
          console.error('❌ Repository not found');
          process.exit(1);
        }

        const workDir = options.dir || response.repository.localPath;
        if (!workDir) {
          console.error('❌ No local path configured for repository. Use --dir to specify.');
          console.error(`   Repo: ${response.repository.fullName}`);
          process.exit(1);
        }

        console.log(`\n📁 Repository: ${response.repository.fullName}`);
        console.log(`📂 Local path: ${workDir}`);
        console.log(`📋 Pending tasks: ${response.count}`);

        if (response.count === 0) {
          console.log('\n✨ No pending tasks!');
          return false;
        }

        const tasksToProcess = processOnce ? [response.tasks[0]] : response.tasks;

        for (const task of tasksToProcess) {
          await processTask(apiUrl, task, workDir);
        }

        return true;
      } catch (error) {
        console.error('❌ Error:', (error as Error).message);
        return false;
      }
    };

    if (watchMode) {
      console.log(`👀 Watch mode enabled (polling every ${options.interval}s)`);

      const poll = async () => {
        await processAllTasks();
        setTimeout(poll, pollInterval);
      };

      await poll();
    } else {
      await processAllTasks();
    }
  });
