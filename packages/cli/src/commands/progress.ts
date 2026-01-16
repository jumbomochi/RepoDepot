import { Command } from 'commander';
import type { TaskStep, TaskQuestion, StepStatus } from '@repodepot/shared';

const DEFAULT_API_URL = 'http://localhost:3001';

interface ApiError {
  error: string;
}

interface PlanResponse {
  success: boolean;
  taskId: string;
  steps: TaskStep[];
}

interface ShowResponse {
  taskId: string;
  steps: TaskStep[];
  currentQuestion?: TaskQuestion;
}

interface UpdateStepResponse {
  success: boolean;
  step: TaskStep;
}

interface AddStepResponse {
  success: boolean;
  step: TaskStep;
}

interface AskResponse {
  success: boolean;
  question: TaskQuestion;
}

interface WaitResponse {
  answered: boolean;
  question?: TaskQuestion;
  message?: string;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return data as T;
}

function formatStatus(status: StepStatus): string {
  const icons: Record<StepStatus, string> = {
    pending: '[ ]',
    in_progress: '[~]',
    done: '[x]',
    failed: '[!]',
    skipped: '[-]',
  };
  return icons[status] || '[ ]';
}

function printStep(step: TaskStep): void {
  const statusIcon = formatStatus(step.status);
  const note = step.note ? ` (${step.note})` : '';
  console.log(`  ${step.index}. ${statusIcon} ${step.description}${note}`);
}

function printQuestion(question: TaskQuestion): void {
  console.log(`\nPending question:`);
  console.log(`  Q: ${question.question}`);
  if (question.choices && question.choices.length > 0) {
    console.log(`  Choices:`);
    question.choices.forEach((choice, i) => {
      console.log(`    ${i + 1}. ${choice}`);
    });
  }
  if (question.answer) {
    console.log(`  A: ${question.answer}`);
  }
}

// Create the progress command with subcommands
export const progressCommand = new Command('progress')
  .description('Report and track agent progress on tasks');

// Subcommand: plan - Declare steps for a task
progressCommand
  .command('plan')
  .description('Declare the steps for a task')
  .requiredOption('-t, --task <id>', 'Task ID')
  .option('--api <url>', 'RepoDepot API URL', DEFAULT_API_URL)
  .argument('<steps...>', 'Step descriptions')
  .action(async (steps: string[], options) => {
    const apiUrl = options.api;
    const taskId = options.task;

    try {
      const result = await fetchJson<PlanResponse>(`${apiUrl}/api/progress/${taskId}/plan`, {
        method: 'POST',
        body: JSON.stringify({ steps }),
      });

      console.log(`Plan created for task ${taskId}:`);
      result.steps.forEach(printStep);
    } catch (error) {
      console.error('Error creating plan:', (error as Error).message);
      process.exit(1);
    }
  });

// Subcommand: update - Update step status
progressCommand
  .command('update')
  .description('Update the status of a step')
  .requiredOption('-t, --task <id>', 'Task ID')
  .requiredOption('-s, --step <index>', 'Step index (0-based)')
  .requiredOption('--status <status>', 'New status (pending, in_progress, done, failed, skipped)')
  .option('-n, --note <note>', 'Optional note about the step')
  .option('--api <url>', 'RepoDepot API URL', DEFAULT_API_URL)
  .action(async (options) => {
    const apiUrl = options.api;
    const taskId = options.task;
    const stepIndex = parseInt(options.step, 10);
    const status = options.status as StepStatus;
    const note = options.note;

    if (isNaN(stepIndex) || stepIndex < 0) {
      console.error('Error: step index must be a non-negative number');
      process.exit(1);
    }

    const validStatuses: StepStatus[] = ['pending', 'in_progress', 'done', 'failed', 'skipped'];
    if (!validStatuses.includes(status)) {
      console.error(`Error: status must be one of: ${validStatuses.join(', ')}`);
      process.exit(1);
    }

    try {
      const result = await fetchJson<UpdateStepResponse>(`${apiUrl}/api/progress/${taskId}/step/${stepIndex}`, {
        method: 'PUT',
        body: JSON.stringify({ status, note }),
      });

      console.log(`Step ${stepIndex} updated:`);
      printStep(result.step);
    } catch (error) {
      console.error('Error updating step:', (error as Error).message);
      process.exit(1);
    }
  });

// Subcommand: add - Add a step after a given index
progressCommand
  .command('add')
  .description('Add a new step after a given index')
  .requiredOption('-t, --task <id>', 'Task ID')
  .requiredOption('-a, --after <index>', 'Insert after this index (-1 to insert at beginning)')
  .argument('<description>', 'Step description')
  .option('--api <url>', 'RepoDepot API URL', DEFAULT_API_URL)
  .action(async (description: string, options) => {
    const apiUrl = options.api;
    const taskId = options.task;
    const afterIndex = parseInt(options.after, 10);

    if (isNaN(afterIndex) || afterIndex < -1) {
      console.error('Error: after index must be a number >= -1');
      process.exit(1);
    }

    try {
      const result = await fetchJson<AddStepResponse>(`${apiUrl}/api/progress/${taskId}/step`, {
        method: 'POST',
        body: JSON.stringify({ description, afterIndex }),
      });

      console.log(`Step added:`);
      printStep(result.step);
    } catch (error) {
      console.error('Error adding step:', (error as Error).message);
      process.exit(1);
    }
  });

// Subcommand: ask - Ask a question
progressCommand
  .command('ask')
  .description('Ask a question and wait for user input')
  .requiredOption('-t, --task <id>', 'Task ID')
  .argument('<question>', 'The question to ask')
  .option('-c, --choices <choices...>', 'Optional choices for the question')
  .option('--api <url>', 'RepoDepot API URL', DEFAULT_API_URL)
  .action(async (question: string, options) => {
    const apiUrl = options.api;
    const taskId = options.task;
    const choices = options.choices;

    try {
      const body: { question: string; choices?: string[] } = { question };
      if (choices && choices.length > 0) {
        body.choices = choices;
      }

      const result = await fetchJson<AskResponse>(`${apiUrl}/api/progress/${taskId}/ask`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      console.log(`Question submitted for task ${taskId}:`);
      printQuestion(result.question);
      console.log(`\nWaiting for answer... Use 'progress wait --task ${taskId}' to poll for response.`);
    } catch (error) {
      console.error('Error asking question:', (error as Error).message);
      process.exit(1);
    }
  });

// Subcommand: wait - Wait for answer to a question
progressCommand
  .command('wait')
  .description('Wait for an answer to a pending question')
  .requiredOption('-t, --task <id>', 'Task ID')
  .option('--timeout <seconds>', 'Timeout in seconds (max 30)', '30')
  .option('--api <url>', 'RepoDepot API URL', DEFAULT_API_URL)
  .action(async (options) => {
    const apiUrl = options.api;
    const taskId = options.task;
    const timeoutSec = Math.min(Math.max(parseInt(options.timeout, 10) || 30, 0), 30);
    const timeoutMs = timeoutSec * 1000;

    try {
      console.log(`Waiting for answer (timeout: ${timeoutSec}s)...`);

      const result = await fetchJson<WaitResponse>(`${apiUrl}/api/progress/${taskId}/answer?timeout=${timeoutMs}`);

      if (result.answered && result.question) {
        console.log(`\nAnswer received!`);
        console.log(`  Q: ${result.question.question}`);
        console.log(`  A: ${result.question.answer}`);
      } else if (result.question) {
        console.log(`\nNo answer yet.`);
        printQuestion(result.question);
      } else {
        console.log(`\n${result.message || 'No pending question for this task.'}`);
      }
    } catch (error) {
      console.error('Error waiting for answer:', (error as Error).message);
      process.exit(1);
    }
  });

// Subcommand: show - Show current progress
progressCommand
  .command('show')
  .description('Show current progress for a task')
  .requiredOption('-t, --task <id>', 'Task ID')
  .option('--api <url>', 'RepoDepot API URL', DEFAULT_API_URL)
  .action(async (options) => {
    const apiUrl = options.api;
    const taskId = options.task;

    try {
      const result = await fetchJson<ShowResponse>(`${apiUrl}/api/progress/${taskId}`);

      console.log(`Progress for task ${result.taskId}:`);

      if (result.steps.length === 0) {
        console.log('  No steps defined yet.');
      } else {
        result.steps.forEach(printStep);

        // Summary
        const done = result.steps.filter(s => s.status === 'done').length;
        const total = result.steps.length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        console.log(`\n  Progress: ${done}/${total} (${percent}%)`);
      }

      if (result.currentQuestion) {
        printQuestion(result.currentQuestion);
      }
    } catch (error) {
      console.error('Error showing progress:', (error as Error).message);
      process.exit(1);
    }
  });
